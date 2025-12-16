const docker = require('./docker');
const logger = require('../utils/logger');
const User = require('../models/User');
const Project = require('../models/Project');

/**
 * Clean up old containers for a project
 * Keeps only the active container, removes all others
 */
async function cleanupOldContainers(project) {
    try {
        logger.info(`Cleaning up old containers for project ${project.name}`);

        // Get all containers
        const result = await docker.listContainers(null, true);

        if (!result.success) {
            logger.error('Failed to list containers:', result.error);
            return { success: false, error: result.error, cleaned: 0 };
        }

        const containers = result.containers;

        if (!containers || containers.length === 0) {
            logger.info('No containers found to clean up');
            return { success: true, cleaned: 0 };
        }

        let cleaned = 0;

        for (const container of containers) {
            // Skip if this is the active container
            if (project.activeContainer && container.Id === project.activeContainer.id) {
                const containerName = container.Names && container.Names[0] ? container.Names[0] : container.Id;
                logger.info(`Skipping active container: ${containerName}`);
                continue;
            }

            try {
                const containerName = container.Names && container.Names[0] ? container.Names[0] : container.Id;
                logger.info(`Removing old container: ${containerName}`);

                // Stop if running
                if (container.State === 'running') {
                    await docker.stopContainer(container.Id);
                }

                // Remove container
                await docker.removeContainer(container.Id);
                cleaned++;

                logger.info(`✅ Removed container: ${containerName}`);

            } catch (error) {
                const containerName = container.Names && container.Names[0] ? container.Names[0] : container.Id;
                logger.error(`Failed to remove container ${containerName}:`, error.message);
            }
        }

        logger.info(`✅ Cleanup complete: ${cleaned} containers removed`);

        return { success: true, cleaned };

    } catch (error) {
        logger.error('Container cleanup failed:', error);
        return { success: false, error: error.message, cleaned: 0 };
    }
}

/**
 * Clean up on redeploy
 * Updates project's active container and removes old ones
 */
async function cleanupOnRedeploy(project, newContainerId, newContainerName) {
    try {
        logger.info(`Cleanup on redeploy for project ${project.name}`);

        // Update project's active container
        project.activeContainer = {
            id: newContainerId,
            name: newContainerName,
            updatedAt: new Date()
        };
        await project.save();

        // Clean up old containers
        const result = await cleanupOldContainers(project);

        logger.info(`✅ Redeploy cleanup complete`, {
            project: project.name,
            newContainer: newContainerName,
            oldContainersRemoved: result.cleaned
        });

        return result;

    } catch (error) {
        logger.error('Redeploy cleanup failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Clean up all containers for a user
 */
async function cleanupUserContainers(userId) {
    try {
        logger.info(`Cleaning up all containers for user ${userId}`);

        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        let cleaned = 0;

        // Clean up all user's containers
        for (const container of user.containers || []) {
            try {
                logger.info(`Removing container: ${container.name}`);

                await docker.stopContainer(container.id);
                await docker.removeContainer(container.id);
                cleaned++;

            } catch (error) {
                logger.error(`Failed to remove container ${container.name}:`, error.message);
            }
        }

        // Clear user's container list
        user.containers = [];
        await user.save();

        logger.info(`✅ User cleanup complete: ${cleaned} containers removed`);

        return { success: true, cleaned };

    } catch (error) {
        logger.error('User container cleanup failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Clean up all containers for a project (when deleting project)
 */
async function cleanupProjectContainers(projectId) {
    try {
        logger.info(`Cleaning up all containers for project ${projectId}`);

        const project = await Project.findById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }

        // Get all containers
        const result = await docker.listContainers(null, true);

        if (!result.success) {
            logger.error('Failed to list containers:', result.error);
            return { success: false, error: result.error, cleaned: 0 };
        }

        const containers = result.containers;

        let cleaned = 0;

        for (const container of containers) {
            try {
                const containerName = container.Names && container.Names[0] ? container.Names[0] : container.Id;
                logger.info(`Removing container: ${containerName}`);

                if (container.State === 'running') {
                    await docker.stopContainer(container.Id);
                }

                await docker.removeContainer(container.Id);
                cleaned++;

            } catch (error) {
                const containerName = container.Names && container.Names[0] ? container.Names[0] : container.Id;
                logger.error(`Failed to remove container ${containerName}:`, error.message);
            }
        }

        // Remove from Nginx config
        try {
            const nginxRouter = require('./nginxRouter');
            // TODO: Add removeNginxRouting function
            logger.info('Nginx routing cleanup would happen here');
        } catch (error) {
            logger.error('Nginx cleanup failed:', error);
        }

        logger.info(`✅ Project cleanup complete: ${cleaned} containers removed`);

        return { success: true, cleaned };

    } catch (error) {
        logger.error('Project container cleanup failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Clean up orphaned containers (containers without projects)
 */
async function cleanupOrphanedContainers() {
    try {
        logger.info('Cleaning up orphaned containers...');

        const result = await docker.listContainers(null, true);

        if (!result.success) {
            logger.error('Failed to list containers:', result.error);
            return { success: false, error: result.error, cleaned: 0 };
        }

        const allContainers = result.containers;
        const projects = await Project.find().select('_id activeContainer');

        const activeContainerIds = new Set(
            projects
                .filter(p => p.activeContainer?.id)
                .map(p => p.activeContainer.id)
        );

        let cleaned = 0;

        for (const container of allContainers) {
            // Skip if it's an active container
            if (activeContainerIds.has(container.Id)) {
                continue;
            }

            const containerName = container.Names && container.Names[0] ? container.Names[0] : container.Id;

            // Skip if containerName is still undefined/null
            if (!containerName) {
                continue;
            }

            // Skip shared containers
            if (containerName.includes('shared-main')) {
                continue;
            }

            // Skip system containers
            if (containerName.includes('nginx') ||
                containerName.includes('mongo') ||
                containerName.includes('redis')) {
                continue;
            }

            try {
                logger.info(`Removing orphaned container: ${containerName}`);

                if (container.State === 'running') {
                    await docker.stopContainer(container.Id);
                }

                await docker.removeContainer(container.Id);
                cleaned++;

            } catch (error) {
                logger.error(`Failed to remove orphaned container ${containerName}:`, error.message);
            }
        }

        logger.info(`✅ Orphaned cleanup complete: ${cleaned} containers removed`);

        return { success: true, cleaned };

    } catch (error) {
        logger.error('Orphaned container cleanup failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Scheduled cleanup job (runs daily)
 */
async function scheduledCleanup() {
    try {
        logger.info('Running scheduled container cleanup...');

        const orphanedResult = await cleanupOrphanedContainers();

        logger.info('✅ Scheduled cleanup complete', {
            orphanedContainers: orphanedResult.cleaned
        });

        return {
            success: true,
            orphanedContainers: orphanedResult.cleaned
        };

    } catch (error) {
        logger.error('Scheduled cleanup failed:', error);
        return { success: false, error: error.message };
    }
}

// Run cleanup daily at 2 AM
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
setInterval(scheduledCleanup, CLEANUP_INTERVAL);

// Run initial cleanup after 1 minute
setTimeout(scheduledCleanup, 60 * 1000);

module.exports = {
    cleanupOldContainers,
    cleanupOnRedeploy,
    cleanupUserContainers,
    cleanupProjectContainers,
    cleanupOrphanedContainers,
    scheduledCleanup
};
