const docker = require('./docker');
const logger = require('../utils/logger');
const containerOrchestrator = require('./containerOrchestrator');
const { generateContainerName } = require('../utils/dockerNames');

/**
 * Get available port for user container
 * Returns a port in the range 3001-3999
 */
async function getAvailablePort() {
    try {
        const minPort = 3001;
        const maxPort = 3999;

        // Simple random port assignment
        // In production, you'd want to track used ports
        const port = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;

        return port;

    } catch (error) {
        logger.error('Error getting available port:', error);
        throw error;
    }
}

/**
 * Deploy free tier user app
 * Creates a small container with resource limits
 */
async function deployFreeTierContainer(user, project, imageName, serverKey, server) {
    try {
        const resourceCaps = containerOrchestrator.SHARED_RESOURCE_CAPS[serverKey];

        // Generate safe container name
        const containerName = generateContainerName(
            serverKey,
            'free',
            user.email.split('@')[0],
            project.name
        );

        // Get available port
        const port = await getAvailablePort();

        logger.info(`Deploying ${project.name} as free tier`, {
            container: containerName,
            port,
            user: user.email,
            resourceLimits: resourceCaps.perUserCap
        });

        // Run user's Docker image with strict resource limits
        const containerResult = await docker.runContainer(imageName, containerName, {
            host: server.host,
            port: port,
            memory: resourceCaps.perUserCap.ram, // MB (e.g., 1228 MB)
            cpu: resourceCaps.perUserCap.cpu,     // e.g., 0.2 CPU
            env: project.environmentVariables?.map(e => `${e.key}=${e.value}`) || [],
            restart: 'unless-stopped',
            labels: {
                tier: 'free',
                user: user._id.toString(),
                project: project._id.toString(),
                server: serverKey
            }
        });

        const containerId = containerResult.containerId || containerResult.id;

        // Update user's container tracking
        const User = require('../models/User');
        await User.findByIdAndUpdate(user._id, {
            $push: {
                containers: {
                    id: containerId,
                    name: containerName,
                    type: 'free',
                    server: serverKey,
                    port: port,
                    resources: {
                        cpu: resourceCaps.perUserCap.cpu,
                        ram: resourceCaps.perUserCap.ram
                    },
                    projects: [project._id],
                    createdAt: new Date()
                }
            },
            containerType: 'free',
            oracleAccountId: serverKey
        });

        logger.info(`✅ Free tier container deployed`, {
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
            tier: 'free'
        };

    } catch (error) {
        logger.error('Failed to deploy free tier container:', error);
        throw error;
    }
}

/**
 * Remove user from free tier (cleanup)
 */
async function removeFreeTierContainer(userId, containerName) {
    try {
        logger.info(`Removing free tier container for user ${userId}`, { containerName });

        // Container cleanup is handled by containerCleanup service
        // This is just a placeholder for future enhancements

        return { success: true };

    } catch (error) {
        logger.error(`Failed to remove free tier container:`, error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    deployFreeTierContainer,
    removeFreeTierContainer,
    getAvailablePort
};
