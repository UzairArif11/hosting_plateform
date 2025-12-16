const docker = require('./docker');
const logger = require('../utils/logger');
const containerOrchestrator = require('./containerOrchestrator');
const { Client } = require('ssh2');

/**
 * Find existing shared container for a server using SSH
 */
async function findSharedContainer(serverKey) {
    try {
        const containerName = `${serverKey}-shared-main`;
        const server = containerOrchestrator.ORACLE_SERVERS[serverKey];

        if (!server) {
            logger.error(`No server configuration found for ${serverKey}`);
            return null;
        }

        // Use SSH to check if container exists on remote server
        const ssh = new Client();

        return new Promise((resolve, reject) => {
            ssh.on('ready', () => {
                // Check if container exists
                ssh.exec(`docker ps -a --filter "name=^/${containerName}$" --format "{{.ID}}|{{.State}}|{{.Status}}"`, (err, stream) => {
                    if (err) {
                        ssh.end();
                        return reject(err);
                    }

                    let output = '';
                    stream.on('data', (data) => {
                        output += data.toString();
                    });

                    stream.on('close', () => {
                        ssh.end();

                        const trimmed = output.trim();
                        if (trimmed) {
                            const [id, state, status] = trimmed.split('|');
                            logger.info(`Found existing shared container: ${containerName}`, { id, state });

                            resolve({
                                id: id,
                                name: containerName,
                                state: state.toLowerCase(),
                                status: status
                            });
                        } else {
                            logger.info(`No shared container found for ${serverKey}`);
                            resolve(null);
                        }
                    });
                });
            });

            ssh.on('error', (err) => {
                logger.error(`SSH connection error for ${serverKey}:`, err);
                resolve(null);
            });

            // Connect to server
            const sshConfig = {
                host: server.host,
                port: 22,
                username: process.env.SSH_USERNAME || 'ubuntu'
            };

            // Use SSH key
            const keyPath = process.env[`SSH_${serverKey}_KEY`];
            if (keyPath) {
                const fs = require('fs');
                sshConfig.privateKey = fs.readFileSync(keyPath);
            }

            ssh.connect(sshConfig);
        });

    } catch (error) {
        logger.error(`Error finding shared container for ${serverKey}:`, error);
        return null;
    }
}

/**
 * Create shared container for a server
 */
async function createSharedContainer(serverKey, server) {
    try {
        const containerName = `${serverKey}-shared-main`;
        const resourceCaps = containerOrchestrator.SHARED_RESOURCE_CAPS[serverKey];

        if (!resourceCaps) {
            throw new Error(`No resource caps defined for ${serverKey}`);
        }

        logger.info(`Creating shared container for ${serverKey}`, {
            totalCPU: resourceCaps.totalCPU,
            totalRAM: resourceCaps.totalRAM,
            maxUsers: resourceCaps.maxUsers
        });

        // Create shared container with nginx:alpine as base
        // This container will run multiple user apps as processes
        const container = await docker.runContainer('nginx:alpine', containerName, {
            host: server.host,
            ports: ['3001-3999:3001-3999'], // Expose port range for user apps
            memory: resourceCaps.totalRAM,
            cpu: resourceCaps.totalCPU,
            restart: 'unless-stopped',
            labels: {
                type: 'shared',
                server: serverKey,
                maxUsers: resourceCaps.maxUsers.toString()
            }
        });

        logger.info(`✅ Shared container created: ${containerName}`, {
            id: container.containerId || container.id,
            server: serverKey
        });

        return {
            id: container.containerId || container.id,
            name: containerName,
            server: serverKey,
            state: 'running'
        };

    } catch (error) {
        // If container already exists, find and return it
        if (error.message && error.message.includes('already in use')) {
            logger.info(`Container already exists, finding it...`);
            const existing = await findSharedContainer(serverKey);
            if (existing) {
                return existing;
            }
        }

        logger.error(`Failed to create shared container for ${serverKey}:`, error);
        throw error;
    }
}

/**
 * Get available port in shared container
 */
async function getAvailablePortInContainer(containerName) {
    try {
        const User = require('../models/User');

        // Get all users using this shared container
        const users = await User.find({
            'containers.name': containerName
        });

        // Get all used ports
        const usedPorts = new Set();
        users.forEach(user => {
            user.containers.forEach(container => {
                if (container.name === containerName && container.port) {
                    usedPorts.add(container.port);
                }
            });
        });

        // Find available port in range 3001-3999
        for (let port = 3001; port <= 3999; port++) {
            if (!usedPorts.has(port)) {
                return port;
            }
        }

        throw new Error('No available ports in shared container');

    } catch (error) {
        logger.error('Error getting available port:', error);
        throw error;
    }
}

/**
 * Deploy user app to shared container
 * For free users, we run their Docker image with strict resource limits
 */
async function deployToSharedContainer(user, project, imageName, serverKey, server) {
    try {
        // For free users, we run their image as a separate container with resource limits
        // This is simpler and more reliable than trying to run multiple apps in one container

        const resourceCaps = containerOrchestrator.SHARED_RESOURCE_CAPS[serverKey];
        const containerName = `${serverKey}-shared-user-${user.email.split('@')[0]}-${Date.now()}`;

        // Get available port
        const port = await getAvailablePortInContainer(containerName);

        logger.info(`Deploying ${project.name} to shared container`, {
            container: containerName,
            port,
            user: user.email,
            resourceLimits: resourceCaps.perUserCap
        });

        // Run user's Docker image with strict resource limits
        const containerResult = await docker.runContainer(imageName, containerName, {
            host: server.host,
            port: port,
            memory: resourceCaps.perUserCap.ram, // MB
            cpu: resourceCaps.perUserCap.cpu,
            env: project.environmentVariables?.map(e => `${e.key}=${e.value}`) || [],
            restart: 'unless-stopped',
            labels: {
                type: 'shared',
                user: user._id.toString(),
                project: project._id.toString(),
                server: serverKey
            }
        });

        const containerId = containerResult.containerId || containerResult.id;

        // Apply additional cgroup limits for extra isolation
        try {
            await applyUserCgroupLimits(containerId, user._id.toString(), {
                cpu: resourceCaps.perUserCap.cpu,
                ram: resourceCaps.perUserCap.ram
            });
        } catch (cgroupError) {
            logger.warn(`Cgroup limits failed (non-critical):`, cgroupError.message);
            // Continue even if cgroups fail - Docker limits are still applied
        }

        // Update user's container tracking
        const User = require('../models/User');
        await User.findByIdAndUpdate(user._id, {
            $push: {
                containers: {
                    id: containerId,
                    name: containerName,
                    type: 'shared',
                    server: serverKey,
                    port: port,
                    resources: {
                        cpu: resourceCaps.perUserCap.cpu,
                        ram: resourceCaps.perUserCap.ram
                    },
                    projects: [project._id]
                }
            },
            containerType: 'shared',
            oracleAccountId: serverKey
        });

        logger.info(`✅ Deployed to shared container`, {
            user: user.email,
            project: project.name,
            container: containerName,
            containerId,
            port
        });

        return {
            containerName: containerName,
            containerId: containerId,
            port,
            serverKey,
            host: server.host,
            isShared: true
        };

    } catch (error) {
        logger.error('Failed to deploy to shared container:', error);
        throw error;
    }
}

/**
 * Apply cgroup limits for a user in shared container
 */
async function applyUserCgroupLimits(containerId, userId, limits) {
    try {
        logger.info(`Applying cgroup limits for user ${userId}`, limits);

        // Create user-specific cgroup
        await docker.execCommand(containerId,
            `mkdir -p /sys/fs/cgroup/cpu/user-${userId}`
        );
        await docker.execCommand(containerId,
            `mkdir -p /sys/fs/cgroup/memory/user-${userId}`
        );

        // Set CPU limit
        await docker.execCommand(containerId,
            `echo ${limits.cpu * 100000} > /sys/fs/cgroup/cpu/user-${userId}/cpu.cfs_quota_us`
        );
        await docker.execCommand(containerId,
            `echo 100000 > /sys/fs/cgroup/cpu/user-${userId}/cpu.cfs_period_us`
        );

        // Set memory limit
        await docker.execCommand(containerId,
            `echo ${limits.ram * 1024 * 1024} > /sys/fs/cgroup/memory/user-${userId}/memory.limit_in_bytes`
        );
        await docker.execCommand(containerId,
            `echo ${limits.ram * 1024 * 1024 * 0.8} > /sys/fs/cgroup/memory/user-${userId}/memory.soft_limit_in_bytes`
        );

        logger.info(`✅ Cgroup limits applied for user ${userId}`);

    } catch (error) {
        logger.error(`Failed to apply cgroup limits for user ${userId}:`, error);
        // Don't throw - continue even if cgroup setup fails
    }
}

/**
 * Remove user from shared container
 */
async function removeUserFromSharedContainer(userId, containerName) {
    try {
        logger.info(`Removing user ${userId} from shared container ${containerName}`);

        // TODO: Implement user removal from shared container
        // For now, just log the action
        logger.warn('User removal from shared container not yet fully implemented');

        return { success: true };

    } catch (error) {
        logger.error(`Failed to remove user from shared container:`, error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    findSharedContainer,
    createSharedContainer,
    getAvailablePortInContainer,
    deployToSharedContainer,
    applyUserCgroupLimits,
    removeUserFromSharedContainer
};
