const User = require('../models/User');
const Deployment = require('../models/Deployment');
const Project = require('../models/Project');
const docker = require('./docker');
const logger = require('../utils/logger');

/**
 * Account Lifecycle Management Service
 * Handles trial expiry, suspension, deletion, and recovery
 */

/**
 * Check and suspend expired trial users
 * Runs daily via cron job
 */
async function checkAndSuspendExpiredTrials() {
    try {
        logger.info('Checking for expired trial users...');

        const now = new Date();

        // Find users with expired trials (EXCLUDE ADMINS)
        const expiredUsers = await User.find({
            status: 'active',
            role: { $ne: 'admin' }, // ← CRITICAL: Never suspend admins
            plan: 'free',
            trialExpiry: { $lt: now },
            isTrialActive: true
        });

        logger.info(`Found ${expiredUsers.length} expired trial users (admins excluded)`);

        for (const user of expiredUsers) {
            try {
                // DOUBLE-CHECK: Never suspend admins
                if (user.role === 'admin') {
                    logger.warn(`Skipping admin user ${user.email} - admins cannot be suspended`);
                    continue;
                }

                // Update user status
                user.status = 'suspended';
                user.isTrialActive = false;
                user.suspendedAt = new Date();
                user.suspensionReason = 'Free trial expired (30 days)';
                user.autoSuspended = true;
                await user.save();

                logger.info(`Suspended expired trial user: ${user.email}`);

                // Stop user's containers
                await stopUserContainers(user._id);

                // Send email notification
                // await emailService.sendTrialExpiredEmail(user);

            } catch (error) {
                logger.error(`Failed to suspend user ${user.email}:`, error);
            }
        }

        return {
            checked: expiredUsers.length,
            suspended: expiredUsers.length
        };

    } catch (error) {
        logger.error('Error checking expired trials:', error);
        throw error;
    }
}

/**
 * Check and suspend expired paid subscriptions
 * Runs daily via cron job
 */
async function checkAndSuspendExpiredSubscriptions() {
    try {
        logger.info('Checking for expired paid subscriptions...');

        const now = new Date();

        // Find users with expired subscriptions (EXCLUDE ADMINS)
        const expiredUsers = await User.find({
            status: 'active',
            role: { $ne: 'admin' }, // ← CRITICAL: Never suspend admins
            plan: { $in: ['pro', 'enterprise'] },
            subscriptionExpiry: { $lt: now }
        });

        logger.info(`Found ${expiredUsers.length} expired subscription users (admins excluded)`);

        for (const user of expiredUsers) {
            try {
                // DOUBLE-CHECK: Never suspend admins
                if (user.role === 'admin') {
                    logger.warn(`Skipping admin user ${user.email} - admins cannot be suspended`);
                    continue;
                }

                // Update user status
                user.status = 'suspended';
                user.suspendedAt = new Date();
                user.suspensionReason = 'Subscription expired';
                user.autoSuspended = true;
                await user.save();

                logger.info(`Suspended expired subscription user: ${user.email}`);

                // Stop user's containers
                await stopUserContainers(user._id);

                // Send email notification
                // await emailService.sendSubscriptionExpiredEmail(user);

            } catch (error) {
                logger.error(`Failed to suspend user ${user.email}:`, error);
            }
        }

        return {
            checked: expiredUsers.length,
            suspended: expiredUsers.length
        };

    } catch (error) {
        logger.error('Error checking expired subscriptions:', error);
        throw error;
    }
}

/**
 * Delete resources for users suspended > 7 days
 * Runs daily via cron job
 */
async function deleteResourcesForLongSuspended() {
    try {
        logger.info('Checking for users suspended > 7 days...');

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Find users suspended for more than 7 days
        const longSuspendedUsers = await User.find({
            status: 'suspended',
            suspendedAt: { $lt: sevenDaysAgo },
            resourcesDeleted: { $ne: true }
        });

        logger.info(`Found ${longSuspendedUsers.length} users suspended > 7 days`);

        for (const user of longSuspendedUsers) {
            try {
                // Delete all user resources
                const result = await deleteUserResources(user._id);

                // Mark resources as deleted
                user.resourcesDeleted = true;
                user.resourcesDeletedAt = new Date();
                await user.save();

                logger.info(`Deleted resources for ${user.email}: ${JSON.stringify(result)}`);

                // Send email notification
                // await emailService.sendResourcesDeletedEmail(user);

            } catch (error) {
                logger.error(`Failed to delete resources for ${user.email}:`, error);
            }
        }

        return {
            checked: longSuspendedUsers.length,
            deleted: longSuspendedUsers.length
        };

    } catch (error) {
        logger.error('Error deleting resources for suspended users:', error);
        throw error;
    }
}

/**
 * Soft delete user account (15-day recovery period)
 */
async function softDeleteUser(userId, deletedBy, reason = 'User requested deletion') {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        logger.info(`Soft deleting user: ${user.email}`);

        // Update user status
        user.status = 'deleted';
        user.deletedAt = new Date();
        user.deletedBy = deletedBy;
        user.deletionReason = reason;
        user.recoveryDeadline = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days
        await user.save();

        // Stop all containers
        await stopUserContainers(userId);

        logger.info(`User ${user.email} soft deleted. Recovery deadline: ${user.recoveryDeadline}`);

        // Send email notification
        // await emailService.sendAccountDeletedEmail(user);

        return {
            success: true,
            user: {
                email: user.email,
                deletedAt: user.deletedAt,
                recoveryDeadline: user.recoveryDeadline
            }
        };

    } catch (error) {
        logger.error('Error soft deleting user:', error);
        throw error;
    }
}

/**
 * Permanently delete users past recovery deadline
 * Runs daily via cron job
 */
async function permanentlyDeleteExpiredAccounts() {
    try {
        logger.info('Checking for users past recovery deadline...');

        const now = new Date();

        // Find deleted users past recovery deadline
        const expiredUsers = await User.find({
            status: 'deleted',
            recoveryDeadline: { $lt: now }
        });

        logger.info(`Found ${expiredUsers.length} users past recovery deadline`);

        const results = [];

        for (const user of expiredUsers) {
            try {
                // Permanently delete all data
                const result = await permanentlyDeleteUser(user._id);
                results.push(result);

                logger.info(`Permanently deleted user: ${user.email}`);

            } catch (error) {
                logger.error(`Failed to permanently delete ${user.email}:`, error);
            }
        }

        return {
            checked: expiredUsers.length,
            deleted: results.length,
            results
        };

    } catch (error) {
        logger.error('Error permanently deleting expired accounts:', error);
        throw error;
    }
}

/**
 * Permanently delete user and all data
 */
async function permanentlyDeleteUser(userId) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const userEmail = user.email;
        logger.info(`Permanently deleting user: ${userEmail}`);

        const result = {
            email: userEmail,
            projects: 0,
            deployments: 0,
            containers: 0
        };

        // 1. Delete all user's deployments
        const deployments = await Deployment.find({ userId });
        result.deployments = deployments.length;

        for (const deployment of deployments) {
            try {
                // Stop and remove container
                if (deployment.containerId && deployment.serverKey) {
                    await stopAndRemoveContainer(deployment.containerId, deployment.serverKey);
                    result.containers++;
                }
            } catch (error) {
                logger.error(`Failed to remove container ${deployment.containerId}:`, error);
            }
        }

        await Deployment.deleteMany({ userId });

        // 2. Delete all user's projects
        const projects = await Project.find({ owner: userId });
        result.projects = projects.length;
        await Project.deleteMany({ owner: userId });

        // 3. Delete user account
        await User.findByIdAndDelete(userId);

        logger.info(`Permanently deleted ${userEmail}: ${result.projects} projects, ${result.deployments} deployments, ${result.containers} containers`);

        return result;

    } catch (error) {
        logger.error('Error permanently deleting user:', error);
        throw error;
    }
}

/**
 * Recover deleted user account (within 15-day period)
 */
async function recoverDeletedUser(userId, recoveredBy) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        if (user.status !== 'deleted') {
            throw new Error('User is not deleted');
        }

        const now = new Date();
        if (now > user.recoveryDeadline) {
            throw new Error('Recovery deadline has passed');
        }

        logger.info(`Recovering user: ${user.email}`);

        // Restore user status
        user.status = 'active';
        user.recoveredAt = new Date();
        user.recoveredBy = recoveredBy;
        user.deletedAt = null;
        user.deletionReason = null;
        user.recoveryDeadline = null;
        await user.save();

        // Restart containers (if resources not deleted)
        if (!user.resourcesDeleted) {
            await restartUserContainers(userId);
        }

        logger.info(`User ${user.email} recovered successfully`);

        // Send email notification
        // await emailService.sendAccountRecoveredEmail(user);

        return {
            success: true,
            user: {
                email: user.email,
                recoveredAt: user.recoveredAt
            }
        };

    } catch (error) {
        logger.error('Error recovering user:', error);
        throw error;
    }
}

/**
 * Stop all user's containers
 */
async function stopUserContainers(userId) {
    try {
        const deployments = await Deployment.find({
            userId,
            status: 'success',
            containerId: { $exists: true }
        });

        logger.info(`Stopping ${deployments.length} containers for user ${userId}`);

        let stopped = 0;

        for (const deployment of deployments) {
            try {
                if (deployment.containerId && deployment.serverKey) {
                    await stopContainer(deployment.containerId, deployment.serverKey);
                    stopped++;
                }
            } catch (error) {
                logger.error(`Failed to stop container ${deployment.containerId}:`, error);
            }
        }

        logger.info(`Stopped ${stopped} containers for user ${userId}`);

        return { stopped };

    } catch (error) {
        logger.error('Error stopping user containers:', error);
        throw error;
    }
}

/**
 * Restart all user's containers
 */
async function restartUserContainers(userId) {
    try {
        const deployments = await Deployment.find({
            userId,
            status: 'success',
            containerId: { $exists: true }
        });

        logger.info(`Restarting ${deployments.length} containers for user ${userId}`);

        let restarted = 0;

        for (const deployment of deployments) {
            try {
                if (deployment.containerId && deployment.serverKey) {
                    await restartContainer(deployment.containerId, deployment.serverKey);
                    restarted++;
                }
            } catch (error) {
                logger.error(`Failed to restart container ${deployment.containerId}:`, error);
            }
        }

        logger.info(`Restarted ${restarted} containers for user ${userId}`);

        return { restarted };

    } catch (error) {
        logger.error('Error restarting user containers:', error);
        throw error;
    }
}

/**
 * Delete all user resources (containers, deployments, projects)
 */
async function deleteUserResources(userId) {
    try {
        logger.info(`Deleting all resources for user ${userId}`);

        const result = {
            containers: 0,
            deployments: 0,
            projects: 0
        };

        // 1. Stop and remove all containers
        const deployments = await Deployment.find({ userId });

        for (const deployment of deployments) {
            try {
                if (deployment.containerId && deployment.serverKey) {
                    await stopAndRemoveContainer(deployment.containerId, deployment.serverKey);
                    result.containers++;
                }
            } catch (error) {
                logger.error(`Failed to remove container ${deployment.containerId}:`, error);
            }
        }

        // 2. Delete all deployments
        const deletedDeployments = await Deployment.deleteMany({ userId });
        result.deployments = deletedDeployments.deletedCount;

        // 3. Delete all projects
        const deletedProjects = await Project.deleteMany({ owner: userId });
        result.projects = deletedProjects.deletedCount;

        logger.info(`Deleted resources for user ${userId}: ${JSON.stringify(result)}`);

        return result;

    } catch (error) {
        logger.error('Error deleting user resources:', error);
        throw error;
    }
}

/**
 * Stop container
 */
async function stopContainer(containerName, serverKey) {
    try {
        const server = {
            host: process.env[`${serverKey}_HOST`],
            key: serverKey
        };

        const dockerClient = await docker.getDockerClient(server);
        const container = dockerClient.getContainer(containerName);

        await container.stop();
        logger.info(`Stopped container: ${containerName} on ${serverKey}`);

    } catch (error) {
        if (error.statusCode === 304) {
            // Container already stopped
            logger.info(`Container ${containerName} already stopped`);
        } else {
            throw error;
        }
    }
}

/**
 * Restart container
 */
async function restartContainer(containerName, serverKey) {
    try {
        const server = {
            host: process.env[`${serverKey}_HOST`],
            key: serverKey
        };

        const dockerClient = await docker.getDockerClient(server);
        const container = dockerClient.getContainer(containerName);

        await container.restart();
        logger.info(`Restarted container: ${containerName} on ${serverKey}`);

    } catch (error) {
        logger.error(`Failed to restart container ${containerName}:`, error);
        throw error;
    }
}

/**
 * Stop and remove container
 */
async function stopAndRemoveContainer(containerName, serverKey) {
    try {
        const server = {
            host: process.env[`${serverKey}_HOST`],
            key: serverKey
        };

        const dockerClient = await docker.getDockerClient(server);
        const container = dockerClient.getContainer(containerName);

        // Stop container
        try {
            await container.stop();
        } catch (error) {
            if (error.statusCode !== 304) {
                throw error;
            }
        }

        // Remove container
        await container.remove();
        logger.info(`Removed container: ${containerName} from ${serverKey}`);

    } catch (error) {
        logger.error(`Failed to remove container ${containerName}:`, error);
        throw error;
    }
}

module.exports = {
    checkAndSuspendExpiredTrials,
    checkAndSuspendExpiredSubscriptions,
    deleteResourcesForLongSuspended,
    softDeleteUser,
    permanentlyDeleteExpiredAccounts,
    permanentlyDeleteUser,
    recoverDeletedUser,
    stopUserContainers,
    restartUserContainers,
    deleteUserResources
};
