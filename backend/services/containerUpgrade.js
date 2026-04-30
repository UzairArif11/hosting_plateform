const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const Deployment = require('../models/Deployment');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Project = require('../models/Project');
const logger = require('../utils/logger');
const docker = require('./docker');
const nginxRouter = require('./nginxRouter');
const { resolveSSHKey, resolveHost } = require('../utils/serverResolver');

async function connectToServer(serverKey) {
    const ssh = new NodeSSH();
    const keyPath = resolveSSHKey(serverKey);
    if (!keyPath) throw new Error(`No SSH key for ${serverKey}`);
    const host = resolveHost(serverKey);
    if (!host) throw new Error(`No host for ${serverKey}`);

    await ssh.connect({
        host,
        username: process.env.SSH_USERNAME || 'ubuntu',
        privateKey: fs.readFileSync(keyPath, 'utf8')
    });

    return ssh;
}

// Helper to rename container
async function renameContainer(host, oldName, newName) {
    try {
        const dockerClient = docker.getDockerClient(host);
        const container = dockerClient.getContainer(oldName);
        await container.rename({ name: newName });
        return true;
    } catch (err) {
        logger.error(`Failed to rename container ${oldName} to ${newName}:`, err.message);
        return false;
    }
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

        // Step 1: Find valid deployments (Latest per project)
        // Step 1: Finding active deployments...
        logger.info(`[${userId}] Step 1: Finding active deployments...`);

        // STATS SYNC: Fix "Insufficient Capacity" errors by recalculating actual usage
        try {
            // Count non-archived projects
            const projectCount = await Project.countDocuments({ owner: user._id, status: { $ne: 'archived' } });

            // Ensure currentUsage object exists
            if (!user.currentUsage) user.currentUsage = {};

            // Update usage
            user.currentUsage.projects = projectCount;
            // Also sync total deployments (optional but good)
            const deployCount = await Deployment.countDocuments({ userId: user._id });
            user.currentUsage.deployments = deployCount;

            await user.save();
            logger.info(`[${userId}] 🔄 Usage Synced: Projects=${projectCount}, Deployments=${deployCount}`);
        } catch (err) {
            logger.warn(`[${userId}] ⚠️ Usage Sync Failed: ${err.message}`);
        }


        // Find ALL deployments with a container, sorted newest first
        const allDeployments = await Deployment.find({
            userId: userId,
            containerId: { $exists: true, $ne: null }
        })
            .sort({ createdAt: -1 })
            .populate('projectId');

        const deployments = [];
        const seenProjects = new Set();
        const skippedLog = [];

        // Filter: Take only the LATEST successful or active deployment for each project
        for (const d of allDeployments) {
            const pid = d.projectId?._id?.toString();
            if (pid && !seenProjects.has(pid)) {
                if (d.status === 'success' || d.status === 'deploying' || d.status === 'stalled') {
                    deployments.push(d);
                    seenProjects.add(pid);
                } else {
                    skippedLog.push(`${d._id} (Status: ${d.status})`);
                }
            } else {
                skippedLog.push(`${d._id} (Older version of ${pid})`);
            }
        }

        if (deployments.length === 0) {
            logger.info(`[${userId}] No active deployments found.`);
            result.steps.findDeployments = true;

            // FALLBACK: Even with no deployments, user may have a running container
            // that needs its resource limits updated to match the new plan
            if (user.containerName && user.assignedServer) {
                logger.info(`[${userId}] User has container ${user.containerName} on ${user.assignedServer} — performing in-place resource update`);
                try {
                    const planDetails = await Plan.findOne({ name: newPlan });
                    if (planDetails) {
                        const resources = await getResourcesForPlan(planDetails);
                        const host = resolveHost(user.assignedServer);

                        // Update container memory/CPU limits live (no restart)
                        await docker.updateContainerResources(user.containerName, {
                            memory: resources.memory / (1024 * 1024), // bytes → MB (docker.updateContainerResources expects MB)
                            cpu: resources.cpu
                        }, host);

                        // Update user's DB resource allocation
                        user.resourceAllocation = planDetails.resources;
                        user.displayedResources = planDetails.displayResources;
                        user.plan = planDetails._id;
                        user.planType = planDetails.name;
                        await user.save();

                        logger.info(`[${userId}] ✅ In-place container resource update complete: ${resources.memory / (1024 * 1024)}MB RAM, ${resources.cpu} CPU`);
                        result.success = true;
                        result.inPlaceUpdate = true;
                    } else {
                        logger.warn(`[${userId}] Plan ${newPlan} not found for in-place update`);
                    }
                } catch (updateErr) {
                    logger.error(`[${userId}] In-place container resource update failed:`, updateErr.message);
                    result.errors.push(`In-place update: ${updateErr.message}`);
                }
            } else {
                logger.info(`[${userId}] No container assigned — skipping resource update`);
                result.success = true;
            }

            return result;
        }

        result.steps.findDeployments = true;
        logger.info(`[${userId}] Found ${deployments.length} active deployments`);

        // Group deployments by server
        const deploymentsByServer = {};
        for (const deployment of deployments) {
            const serverKey = deployment.serverKey || user.assignedServer || Object.keys(require('./containerOrchestrator').ORACLE_SERVERS).find(k => require('./containerOrchestrator').ORACLE_SERVERS[k].type !== 'api_main');
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

                // Get Plan details from DB to ensure we have latest resources
                const planDetails = await Plan.findOne({ name: newPlan });
                if (!planDetails) {
                    throw new Error(`Plan ${newPlan} not found`);
                }

                // Update User resource allocation (Actual & Display)
                user.resourceAllocation = planDetails.resources;
                user.displayedResources = planDetails.displayResources;
                user.plan = planDetails._id;
                user.planType = planDetails.name;
                await user.save();

                logger.info(`[${userId}] Updated user resources: Actual=${planDetails.resources.ram}GB, Display=${planDetails.displayResources?.ram || planDetails.resources.ram}GB`);

                const standardName = `${serverKey}-user-${user._id}`;

                // Step 2a: Create new container with upgraded resources
                logger.info(`[${userId}] Step 2: Creating new ${newPlan} container on ${serverKey}...`);

                const newContainerInfo = await createUpgradedContainer(
                    user,
                    serverKey,
                    serverDeployments,
                    planDetails // Pass full plan object
                );

                if (!newContainerInfo.success) {
                    throw new Error(`Failed to create new container: ${newContainerInfo.error}`);
                }

                result.steps.createNewContainers = true;
                logger.info(`[${userId}] [SYNC_LOG] 🏗️ NEW CONTAINER CREATED: ${newContainerInfo.containerName}`);
                logger.info(`[${userId}] [SYNC_LOG] 📦 Port mapping: Internal -> Host:${newContainerInfo.port}`);
                logger.info(`[${userId}] [SYNC_LOG] 🧠 Assigned Server: ${serverKey}`);

                const ssh = await connectToServer(serverKey);

                // Step 2b: Migrate data if shared container (Crucial for PM2 processes)
                const isShared = user.planType === 'free';
                if (isShared) {
                    try {
                        logger.info(`[${userId}] [SYNC_LOG] 📂 STARTING DATA MIGRATION from ${oldContainerName}...`);
                        // Ensure PM2 is saved in old container
                        logger.info(`[${userId}] [SYNC_LOG] Saving PM2 state in ${oldContainerName}...`);
                        await ssh.execCommand(`docker exec ${oldContainerName} pm2 save`).catch(() => { });

                        // Create migration dir on host
                        const migrationId = `mig_${userId}_${Date.now()}`;
                        await ssh.execCommand(`mkdir -p /tmp/${migrationId}/projects`);

                        // Copy projects ONLY (We will restart processes fresh)
                        logger.info(`[${userId}] [SYNC_LOG] Copying project files to intermediate host path...`);
                        await ssh.execCommand(`docker cp ${oldContainerName}:/app/projects/. /tmp/${migrationId}/projects/`);

                        // Ensure directories exist in new container
                        logger.info(`[${userId}] [SYNC_LOG] Preparing directories in ${newContainerInfo.containerName}...`);
                        await ssh.execCommand(`docker exec ${newContainerInfo.containerName} mkdir -p /app/projects`);

                        // Copy from host to new container
                        logger.info(`[${userId}] [SYNC_LOG] Moving files into the NEW container...`);
                        await ssh.execCommand(`docker cp /tmp/${migrationId}/projects/. ${newContainerInfo.containerName}:/app/projects/`);

                        // Cleanup host
                        await ssh.execCommand(`rm -rf /tmp/${migrationId}`);

                        logger.info(`[${userId}] [SYNC_LOG] ✓ Shared container files migrated (PM2 will be restarted fresh)`);

                        logger.info(`[${userId}] [SYNC_LOG] ✓ Shared container data migrated`);
                    } catch (migErr) {
                        logger.error(`[${userId}] ❌ Data migration failed: ${migErr.message}`);
                    }
                }

                // CRITICAL: Update User record with new container details
                // We will rename this container to the standard name after deleting the old one
                user.containerName = newContainerInfo.containerName;
                user.assignedServer = serverKey;
                user.containerId = newContainerInfo.containerId;
                await user.save();

                // Step 3: Update Nginx routing to point to new container
                logger.info(`[${userId}] Step 3: Updating Nginx routing...`);

                for (const deployment of serverDeployments) {
                    try {
                        // Determine the port to use in Nginx
                        // Shared container (host networking) means ports stay the same
                        // Dedicated container means we use the new allocated port
                        const targetPort = isShared ? deployment.port : newContainerInfo.port;

                        logger.info(`[${userId}] Updating Nginx routing for ${deployment.subdomain || deployment._id}: ${deployment.port} -> ${targetPort}`);

                        // Update Nginx
                        await updateNginxForNewContainer(
                            deployment,
                            deployment.port, // Current port in Nginx
                            targetPort,      // New port (same for shared, different for dedicated)
                            serverKey
                        );

                        // PM2 verification will happen after rename to ensure persistence

                        // Update deployment record
                        deployment.containerId = standardName;
                        deployment.port = targetPort;
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
                        const finalUrl = deployment.deploymentUrl || deployment.url;
                        logger.info(`[${userId}] [SYNC_LOG] ✅ COMPLETED MIGRATION: ${deployment._id}`);
                        logger.info(`[${userId}] [SYNC_LOG] 🔗 LIVE URL: ${finalUrl}`);
                        logger.info(`[${userId}] [SYNC_LOG] 🔌 Target Port: ${targetPort}`);

                    } catch (error) {
                        logger.error(`[${userId}] Failed to migrate deployment ${deployment._id}:`, error);
                        result.errors.push(`Deployment ${deployment._id}: ${error.message}`);
                    }
                }

                result.steps.migrateDeployments = true;
                result.steps.updateNginx = true;

                try {
                    const host = resolveHost(serverKey);
                    logger.info(`[${userId}] [SYNC_LOG] 🗑️ REMOVING OLD CONTAINER: ${oldContainerName}`);
                    await removeOldContainer(oldContainerName, serverKey);

                    // RENAME new container to the standard name for consistency
                    logger.info(`[${userId}] [SYNC_LOG] 🏷️ RENAMING temporary container to ${standardName}...`);
                    const renameSuccess = await renameContainer(host, newContainerInfo.containerName, standardName);

                    if (renameSuccess) {
                        user.containerName = standardName;
                        await user.save();

                        // NOW verify and start PM2 processes in the RENAMED container
                        if (isShared) {
                            logger.info(`[${userId}] [SYNC_LOG] 🔍 Verifying PM2 processes in ${standardName}...`);
                            for (const deployment of serverDeployments) {
                                try {
                                    const projectId = deployment.projectId._id || deployment.projectId;
                                    const projectDir = `/app/projects/${projectId}`;
                                    const deployPort = deployment.port;

                                    logger.info(`[${userId}] [SYNC_LOG] Checking process ${projectId} on port ${deployPort}...`);

                                    // Check if process is running
                                    const checkResult = await ssh.execCommand(`docker exec ${standardName} pm2 describe ${projectId} 2>&1`);

                                    if (checkResult.stdout.includes("doesn't exist") || checkResult.code !== 0) {
                                        // Verify directory exists first
                                        const dirCheck = await ssh.execCommand(`docker exec ${standardName} ls -la ${projectDir}`);
                                        if (dirCheck.code !== 0) {
                                            logger.error(`[${userId}] [SYNC_LOG] ❌ Project directory missing: ${projectDir}`);
                                            continue;
                                        }

                                        logger.warn(`[${userId}] [SYNC_LOG] ⚠️ Process ${projectId} not running, starting now...`);

                                        // Start the process
                                        const startCmd = `docker exec ${standardName} sh -c "cd ${projectDir} && PORT=${deployPort} pm2 start server.js --name ${projectId} --env production"`;
                                        logger.info(`[${userId}] [SYNC_LOG] Executing: ${startCmd}`);

                                        const startResult = await ssh.execCommand(startCmd);

                                        if (startResult.code === 0) {
                                            logger.info(`[${userId}] [SYNC_LOG] ✅ Started ${projectId} on port ${deployPort}`);
                                            logger.info(`[${userId}] [SYNC_LOG] Output: ${startResult.stdout}`);
                                        } else {
                                            logger.error(`[${userId}] [SYNC_LOG] ❌ Failed to start ${projectId}`);
                                            logger.error(`[${userId}] [SYNC_LOG] Stderr: ${startResult.stderr}`);
                                            logger.error(`[${userId}] [SYNC_LOG] Stdout: ${startResult.stdout}`);
                                        }
                                    } else {
                                        logger.info(`[${userId}] [SYNC_LOG] ✅ Process ${projectId} already running`);
                                    }
                                } catch (pmErr) {
                                    logger.error(`[${userId}] PM2 verification error for ${deployment._id}: ${pmErr.message}`);
                                }
                            }

                            // Save PM2 state after all processes are verified
                            await ssh.execCommand(`docker exec ${standardName} pm2 save`);
                            logger.info(`[${userId}] [SYNC_LOG] 💾 PM2 state saved`);
                        }
                    }

                    result.steps.removeOldContainers = true;
                    logger.info(`[${userId}] [SYNC_LOG] ✓ Old container removed and new one renamed: ${standardName}`);
                } catch (error) {
                    logger.warn(`[${userId}] Failed to remove/rename container: ${error.message}`);
                    result.errors.push(`Remove/Rename: ${error.message}`);
                }

                if (ssh) ssh.dispose();

            } catch (error) {
                logger.error(`[${userId}] Failed to upgrade containers on ${serverKey}:`, error);
                result.errors.push(`${serverKey}: ${error.message}`);
            }
        }

        result.success = result.migratedDeployments > 0;
        result.skipped = skippedLog || [];
        result.skippedCount = skippedLog ? skippedLog.length : 0;

        if (result.success) {
            logger.info(`[${userId}] ✅ Container upgrade complete! Migrated ${result.migratedDeployments} deployments, Skipped ${result.skippedCount}`);
        } else {
            logger.error(`[${userId}] ❌ Container upgrade failed. Skipped ${result.skippedCount}`);
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
            host: resolveHost(serverKey),
            key: serverKey
        };

        // Determine new container resources based on plan
        const resources = await getResourcesForPlan(newPlan);

        const planName = typeof newPlan === 'string' ? newPlan : newPlan.name;

        // Create new container name (temporary name for zero-downtime)
        const timestamp = Date.now();
        const containerName = `${serverKey}-user-${user._id}-upgrading-${timestamp}`;

        // Allocate new port
        // Allocate new unique port
        const Deployment = require('../models/Deployment');
        let newPort = 0;
        for (let i = 0; i < 200; i++) {
            const candidate = 4000 + Math.floor(Math.random() * 16000);
            const exists = await Deployment.findOne({ port: candidate, status: { $ne: 'failed' } });
            if (!exists) {
                newPort = candidate;
                break;
            }
        }
        if (newPort === 0) throw new Error('Failed to allocate unique port for upgrade');

        // Get first deployment's image
        const isShared = user.planType === 'free';
        let imageName = isShared ? 'node-pm2-alpine:latest' : (deployments[0].metadata?.imageName || `${deployments[0].projectId.slug}-${deployments[0]._id}`);

        // Create container with upgraded resources
        const host = resolveHost(serverKey);
        const dockerClient = docker.getDockerClient(host);

        // Fetch Env Vars from Project (Critical for app startup)
        let envDefs = [`PORT=3000`, `NODE_ENV=production`]; // Default envs
        try {
            const project = await Project.findById(deployments[0].projectId);
            if (project && project.environmentVariables) {
                const targetEnv = deployments[0].environment || 'production';
                project.environmentVariables.forEach(ev => {
                    // Include if it matches environment or has no specific environments set
                    if (!ev.environments || ev.environments.length === 0 || ev.environments.includes(targetEnv)) {
                        envDefs.push(`${ev.key}=${ev.value}`);
                    }
                });
            }
        } catch (err) {
            logger.warn(`Failed to fetch project env vars: ${err.message}`);
        }

        logger.info(`[${user.email}] Container Config: Image=${imageName}, EnvVars=${envDefs.length}, Memory=${Math.floor(resources.memory)}, NanoCpus=${Math.floor(resources.cpu * 1000000000)}`);


        // Attempt to use exact image ID from running container (fixes 'No such image' if tag missing)
        if (deployments[0]?.containerName) {
            try {
                const oldContainer = dockerClient.getContainer(deployments[0].containerName);
                const info = await oldContainer.inspect();
                if (info && info.Image) {
                    imageName = info.Image;
                    logger.info(`[${user.email}] Using active image ID from container: ${imageName}`);
                }
            } catch (err) {
                // Ignore, fallback to metadata image
            }
        }

        const containerConfig = {
            Image: imageName,
            name: containerName,
            Env: envDefs,
            HostConfig: {
                Memory: Math.floor(resources.memory),
                MemorySwap: Math.floor(resources.memory), // Disable swap or limit to same as RAM
                NanoCpus: Math.floor(resources.cpu * 1000000000),
                RestartPolicy: {
                    Name: 'unless-stopped'
                }
            }
        };

        // Shared container specifics (PM2 + Host Networking)
        if (isShared) {
            // Use pre-installed PM2 to keep container alive
            containerConfig.Cmd = ['pm2-runtime', 'start', '/dev/null', '--name', 'keepalive'];

            // We use Host Networking so simple ports work
            containerConfig.HostConfig.NetworkMode = 'host';
            // No port bindings needed for host mode
        } else {
            containerConfig.ExposedPorts = { '3000/tcp': {} };
            containerConfig.HostConfig.PortBindings = {
                '3000/tcp': [{ HostPort: newPort.toString() }]
            };
        }

        const container = await dockerClient.createContainer(containerConfig);

        await container.start();

        // Verify status immediately to catch startup crashes
        const verifyInfo = await container.inspect();
        logger.info(`[${user.email}] New Container Status: ${verifyInfo.State.Status}, ExitCode: ${verifyInfo.State.ExitCode}, Error: ${verifyInfo.State.Error}`);

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
        const fullUrl = deployment.deploymentUrl || deployment.url;
        if (!fullUrl) {
            logger.warn(`Deployment ${deployment._id} has no URL, skipping Nginx update`);
            return;
        }
        const urlPath = fullUrl.split('/').filter(Boolean).pop();

        // Replace ANY numeric port with new port in the location block
        const locationRegex = new RegExp(
            `(location\\s+/${urlPath}/\\s*{[^}]*proxy_pass\\s+http://localhost:)\\d+(/[^;]*;)`,
            'g'
        );

        nginxConfig = nginxConfig.replace(locationRegex, `$1${newPort}$2`);

        // Write updated config using a robust method (putFile via temp)
        const path = require('path');
        const os = require('os');
        const tempFile = path.join(os.tmpdir(), `nginx-upgrade-${Date.now()}.conf`);
        fs.writeFileSync(tempFile, nginxConfig);

        await ssh.putFile(tempFile, '/tmp/nginx-upgrade.conf');
        const writeResult = await ssh.execCommand('sudo mv /tmp/nginx-upgrade.conf /etc/nginx/sites-available/default');

        try { fs.unlinkSync(tempFile); } catch (e) { }

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
        const host = resolveHost(serverKey);
        const dockerClient = docker.getDockerClient(host);
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
/**
 * Get resource allocation for plan
 */
async function getResourcesForPlan(planIdentifier) {
    let plan;
    if (typeof planIdentifier === 'string') {
        plan = await Plan.findOne({ name: planIdentifier });
    } else if (planIdentifier && planIdentifier.resources) {
        plan = planIdentifier;
    }

    if (!plan) {
        logger.warn(`Plan ${planIdentifier} not found in DB, using fallback defaults.`);
        return {
            memory: 512 * 1024 * 1024,  // 512MB
            cpu: 0.5
        };
    }

    return {
        memory: Math.floor((plan.actualResources?.ram || plan.resources?.ram || 0.5) * 1024 * 1024 * 1024),
        cpu: plan.actualResources?.cpu || plan.resources?.cpu || 0.5
    };
}

module.exports = {
    upgradeUserContainer
};
