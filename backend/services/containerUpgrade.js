const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const Deployment = require('../models/Deployment');
const User = require('../models/User');
const logger = require('../utils/logger');
const docker = require('./docker');
const nginxRouter = require('./nginxRouter');

// Helper function to connect to server via SSH
async function connectToServer(serverKey) {
    const ssh = new NodeSSH();
    const keyPath = serverKey === 'EC2' ? process.env.SSH_EC2_KEY
        : serverKey === 'EC3' ? process.env.SSH_EC3_KEY
            : process.env.SSH_EC3_KEY;

    const keyContent = fs.readFileSync(keyPath, 'utf8');
    const host = process.env[`${serverKey}_HOST`] || process.env.EC3_SERVER_IP;

    await ssh.connect({
        host: host,
        username: process.env.SSH_USERNAME || 'ubuntu',
        privateKey: keyContent
    });

    return ssh;
}

/**
 * Zero-Downtime Container Upgrade Service
 * Migrates user deployments when plan changes
 */

/**
 * Upgrade user's container with zero downtime
 */
async function upgradeUserContainer(userId, oldPlan, newPlan) {
    try {
        logger.info(`Starting zero-downtime container upgrade for user ${userId}: ${oldPlan} → ${newPlan}`);

        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const result = {
            userId,
            oldPlan,
            newPlan,
            steps: {
                findDeployments: false,
                createNewContainers: false,
                migrateDeployments: false,
                updateNginx: false,
                removeOldContainers: false
            },
            migratedDeployments: 0,
            errors: []
        };

        // Step 1: Find all active deployments for this user
        logger.info(`[${userId}] Step 1: Finding active deployments...`);
        const deployments = await Deployment.find({
            userId: userId,
            status: 'success',
            url: { $exists: true }
        }).populate('projectId');

        if (deployments.length === 0) {
            logger.info(`[${userId}] No active deployments found. Skipping migration.`);
            result.steps.findDeployments = true;
            result.success = true;
            return result;
        }

        result.steps.findDeployments = true;
        logger.info(`[${userId}] Found ${deployments.length} active deployments`);

        // Group deployments by server
        const deploymentsByServer = {};
        for (const deployment of deployments) {
            const serverKey = deployment.serverKey || 'EC3';
            if (!deploymentsByServer[serverKey]) {
                deploymentsByServer[serverKey] = [];
            }
            deploymentsByServer[serverKey].push(deployment);
        }

        // Step 2: For each server, create new container and migrate
        for (const [serverKey, serverDeployments] of Object.entries(deploymentsByServer)) {
            try {
                logger.info(`[${userId}] Processing ${serverDeployments.length} deployments on ${serverKey}...`);

                // Get old container info
                const oldContainerName = serverDeployments[0].containerId;
                const oldPort = serverDeployments[0].port;

                logger.info(`[${userId}] Old container: ${oldContainerName} (port ${oldPort})`);

                // Step 2a: Create new container with upgraded resources
                logger.info(`[${userId}] Step 2: Creating new ${newPlan} container on ${serverKey}...`);

                const newContainerInfo = await createUpgradedContainer(
                    user,
                    serverKey,
                    serverDeployments,
                    newPlan
                );

                if (!newContainerInfo.success) {
                    throw new Error(`Failed to create new container: ${newContainerInfo.error}`);
                }

                result.steps.createNewContainers = true;
                logger.info(`[${userId}] ✓ New container created: ${newContainerInfo.containerName} (port ${newContainerInfo.port})`);

                // Step 3: Update Nginx routing to point to new container
                logger.info(`[${userId}] Step 3: Updating Nginx routing...`);

                for (const deployment of serverDeployments) {
                    try {
                        // Update Nginx to point to new port
                        await updateNginxForNewContainer(
                            deployment,
                            oldPort,
                            newContainerInfo.port,
                            serverKey
                        );

                        // Update deployment record
                        deployment.containerId = newContainerInfo.containerName;
                        deployment.port = newContainerInfo.port;
                        deployment.metadata = deployment.metadata || {};
                        deployment.metadata.containerUpgrade = {
                            oldContainer: oldContainerName,
                            newContainer: newContainerInfo.containerName,
                            oldPlan,
                            newPlan,
                            upgradedAt: new Date()
                        };
                        await deployment.save();

                        result.migratedDeployments++;
                        logger.info(`[${userId}] ✓ Migrated deployment: ${deployment._id}`);

                    } catch (error) {
                        logger.error(`[${userId}] Failed to migrate deployment ${deployment._id}:`, error);
                        result.errors.push(`Deployment ${deployment._id}: ${error.message}`);
                    }
                }

                result.steps.migrateDeployments = true;
                result.steps.updateNginx = true;

                // Step 4: Remove old container (after successful migration)
                logger.info(`[${userId}] Step 4: Removing old container...`);

                try {
                    await removeOldContainer(oldContainerName, serverKey);
                    result.steps.removeOldContainers = true;
                    logger.info(`[${userId}] ✓ Old container removed: ${oldContainerName}`);
                } catch (error) {
                    logger.warn(`[${userId}] Failed to remove old container: ${error.message}`);
                    result.errors.push(`Remove old container: ${error.message}`);
                }

            } catch (error) {
                logger.error(`[${userId}] Failed to upgrade containers on ${serverKey}:`, error);
                result.errors.push(`${serverKey}: ${error.message}`);
            }
        }

        result.success = result.migratedDeployments > 0;

        if (result.success) {
            logger.info(`[${userId}] ✅ Container upgrade complete! Migrated ${result.migratedDeployments} deployments`);
        } else {
            logger.error(`[${userId}] ❌ Container upgrade failed`);
        }

        return result;

    } catch (error) {
        logger.error(`Container upgrade failed for user ${userId}:`, error);
        return {
            success: false,
            userId,
            error: error.message
        };
    }
}

/**
 * Create upgraded container with new resources
 */
async function createUpgradedContainer(user, serverKey, deployments, newPlan) {
    try {
        const ssh = await connectToServer(serverKey);
        const server = {
            host: process.env[`${serverKey}_HOST`],
            key: serverKey
        };

        // Determine new container resources based on plan
        const resources = getResourcesForPlan(newPlan);

        // Create new container name
        const timestamp = Date.now();
        const containerName = `${serverKey}-${newPlan}-${user.email.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}`;

        // Allocate new port
        const newPort = 3000 + Math.floor(Math.random() * 2000);

        // Get first deployment's image
        const imageName = deployments[0].metadata?.imageName || `${deployments[0].projectId.slug}-${deployments[0]._id}`;

        // Create container with upgraded resources
        const dockerClient = await docker.getDockerClient(server);

        const container = await dockerClient.createContainer({
            Image: imageName,
            name: containerName,
            ExposedPorts: {
                '80/tcp': {}
            },
            HostConfig: {
                PortBindings: {
                    '80/tcp': [{ HostPort: newPort.toString() }]
                },
                Memory: resources.memory,
                NanoCpus: resources.cpu * 1000000000,
                RestartPolicy: {
                    Name: 'unless-stopped'
                }
            }
        });

        await container.start();

        logger.info(`Created upgraded container: ${containerName} with ${resources.memory / 1024 / 1024}MB RAM, ${resources.cpu} CPU`);

        ssh.dispose();

        return {
            success: true,
            containerName,
            port: newPort,
            resources
        };

    } catch (error) {
        logger.error('Failed to create upgraded container:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Update Nginx to point to new container port
 */
async function updateNginxForNewContainer(deployment, oldPort, newPort, serverKey) {
    try {
        const ssh = await connectToServer(serverKey);

        // Read current Nginx config
        const readResult = await ssh.execCommand('sudo cat /etc/nginx/sites-available/default');
        if (readResult.code !== 0) {
            throw new Error(`Failed to read Nginx config: ${readResult.stderr}`);
        }

        let nginxConfig = readResult.stdout;

        // Extract URL path from deployment URL
        const urlPath = deployment.url.split('/').filter(Boolean).pop();

        // Replace old port with new port in the location block
        const locationRegex = new RegExp(
            `(location\\s+/${urlPath}/\\s*{[^}]*proxy_pass\\s+http://localhost:)${oldPort}(/[^;]*;)`,
            'g'
        );

        nginxConfig = nginxConfig.replace(locationRegex, `$1${newPort}$2`);

        // Write updated config
        const writeResult = await ssh.execCommand(
            `echo '${nginxConfig.replace(/'/g, "'\\''")}' | sudo tee /etc/nginx/sites-available/default > /dev/null`
        );

        if (writeResult.code !== 0) {
            throw new Error(`Failed to write Nginx config: ${writeResult.stderr}`);
        }

        // Test Nginx config
        const testResult = await ssh.execCommand('sudo nginx -t 2>&1');
        if (!testResult.stdout.includes('successful') && !testResult.stdout.includes('syntax is ok')) {
            throw new Error(`Nginx config test failed: ${testResult.stdout}`);
        }

        // Reload Nginx
        const reloadResult = await ssh.execCommand('sudo systemctl reload nginx');
        if (reloadResult.code !== 0) {
            throw new Error(`Nginx reload failed: ${reloadResult.stderr}`);
        }

        logger.info(`Updated Nginx routing: ${urlPath} → port ${oldPort} to ${newPort}`);

        ssh.dispose();

    } catch (error) {
        logger.error('Failed to update Nginx:', error);
        throw error;
    }
}

/**
 * Remove old container
 */
async function removeOldContainer(containerName, serverKey) {
    try {
        const server = {
            host: process.env[`${serverKey}_HOST`],
            key: serverKey
        };

        const dockerClient = await docker.getDockerClient(server);
        const container = dockerClient.getContainer(containerName);

        // Stop container
        await container.stop();
        logger.info(`Stopped old container: ${containerName}`);

        // Remove container
        await container.remove();
        logger.info(`Removed old container: ${containerName}`);

    } catch (error) {
        logger.error(`Failed to remove old container ${containerName}:`, error);
        throw error;
    }
}

/**
 * Get resource allocation for plan
 */
function getResourcesForPlan(plan) {
    const plans = {
        free: {
            memory: 512 * 1024 * 1024,  // 512MB
            cpu: 0.5
        },
        pro: {
            memory: 2 * 1024 * 1024 * 1024,  // 2GB
            cpu: 2
        },
        enterprise: {
            memory: 4 * 1024 * 1024 * 1024,  // 4GB
            cpu: 4
        }
    };

    return plans[plan] || plans.free;
}

module.exports = {
    upgradeUserContainer
};
