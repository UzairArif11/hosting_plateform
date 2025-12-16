const docker = require('./docker');
const logger = require('../utils/logger');
const User = require('../models/User');
const Plan = require('../models/Plan');

/**
 * Get effective resources for a user (with priority system)
 * Priority: Admin Override > User Allocated > Plan Actual > Plan Display
 */
function getEffectiveResources(user) {
    // 1. Check admin override first (HIGHEST PRIORITY)
    if (user.adminOverride?.enabled &&
        user.adminOverride.expiresAt &&
        user.adminOverride.expiresAt > new Date()) {
        return {
            cpu: user.adminOverride.customCPU,
            ram: user.adminOverride.customRAM,
            storage: user.adminOverride.customStorage || user.allocatedResources?.storage,
            bandwidth: user.adminOverride.customBandwidth || user.allocatedResources?.bandwidth,
            source: 'admin_override'
        };
    }

    // 2. Check user-specific allocation
    if (user.allocatedResources?.cpu) {
        return {
            cpu: user.allocatedResources.cpu,
            ram: user.allocatedResources.ram,
            storage: user.allocatedResources.storage,
            bandwidth: user.allocatedResources.bandwidth,
            source: 'user_allocated'
        };
    }

    // 3. Fall back to plan actual resources
    if (user.plan?.actualResources?.cpu) {
        return {
            cpu: user.plan.actualResources.cpu,
            ram: user.plan.actualResources.ram,
            storage: user.plan.actualResources.storage,
            bandwidth: user.plan.actualResources.bandwidth,
            source: 'plan_actual'
        };
    }

    // 4. Final fallback to plan resources
    return {
        cpu: user.plan?.resources?.cpu || user.resourceAllocation?.cpu || 0.5,
        ram: user.plan?.resources?.ram || user.resourceAllocation?.ram || 1024,
        storage: user.plan?.resources?.storage || 10,
        bandwidth: user.plan?.resources?.bandwidth || 100,
        source: 'plan_default'
    };
}

/**
 * Apply admin override to a user
 */
async function applyAdminOverride(userId, override, adminId) {
    try {
        const user = await User.findById(userId).populate('plan');
        if (!user) {
            throw new Error('User not found');
        }

        logger.info(`Applying admin override for user ${user.email}`);

        // Save override to database
        user.adminOverride = {
            enabled: true,
            customCPU: override.cpu,
            customRAM: override.ram,
            customStorage: override.storage,
            customBandwidth: override.bandwidth,
            reason: override.reason || 'Admin override',
            expiresAt: new Date(Date.now() + (override.duration * 1000)),
            setBy: adminId,
            setAt: new Date()
        };
        await user.save();

        // Get effective resources (override takes priority)
        const effectiveResources = getEffectiveResources(user);

        // Update all user's containers WITHOUT stopping them
        const updateResults = [];
        for (const container of user.containers || []) {
            const result = await updateContainerResourcesLive(
                container.id,
                effectiveResources,
                container.type
            );
            updateResults.push(result);
        }

        // Log the change
        logger.info(`✅ Override applied: ${override.cpu} CPU, ${override.ram} MB RAM for ${user.email}`);

        return {
            success: true,
            message: 'Override applied without downtime',
            containersUpdated: updateResults.length,
            effectiveResources
        };

    } catch (error) {
        logger.error('Failed to apply override:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update container resources live (no restart)
 */
async function updateContainerResourcesLive(containerId, resources, containerType) {
    try {
        logger.info(`Updating container ${containerId} to ${resources.cpu} CPU, ${resources.ram} MB RAM`);

        if (containerType === 'dedicated') {
            // Update dedicated container using Docker API
            await docker.updateContainer(containerId, {
                Memory: resources.ram * 1024 * 1024,
                MemoryReservation: resources.ram * 1024 * 1024 * 0.8,
                CpuQuota: resources.cpu * 100000,
                CpuPeriod: 100000,
                MemorySwap: resources.ram * 1024 * 1024 * 2
            });

            logger.info(`✅ Dedicated container ${containerId} updated`);
        } else if (containerType === 'shared') {
            // Update cgroups for shared container
            await updateCgroupLimits(containerId, resources);
            logger.info(`✅ Shared container user limits updated`);
        }

        return { success: true, containerId };

    } catch (error) {
        logger.error(`Failed to update container ${containerId}:`, error);
        return { success: false, containerId, error: error.message };
    }
}

/**
 * Update cgroup limits for shared container users
 */
async function updateCgroupLimits(containerId, resources) {
    try {
        // Update CPU quota
        await docker.execCommand(containerId,
            `echo ${resources.cpu * 100000} > /sys/fs/cgroup/cpu/cpu.cfs_quota_us`
        );

        // Update memory limit
        await docker.execCommand(containerId,
            `echo ${resources.ram * 1024 * 1024} > /sys/fs/cgroup/memory/memory.limit_in_bytes`
        );

        // Update memory soft limit (80%)
        await docker.execCommand(containerId,
            `echo ${resources.ram * 1024 * 1024 * 0.8} > /sys/fs/cgroup/memory/memory.soft_limit_in_bytes`
        );

        return { success: true };
    } catch (error) {
        logger.error('Failed to update cgroup limits:', error);
        throw error;
    }
}

/**
 * Check and expire admin overrides
 */
async function checkExpiredOverrides() {
    try {
        const users = await User.find({
            'adminOverride.enabled': true,
            'adminOverride.expiresAt': { $lt: new Date() }
        }).populate('plan');

        logger.info(`Checking ${users.length} expired overrides`);

        for (const user of users) {
            logger.info(`Override expired for user ${user.email}`);

            // Disable override
            user.adminOverride.enabled = false;
            await user.save();

            // Get new effective resources (will use allocated or plan)
            const effectiveResources = getEffectiveResources(user);

            // Update containers back to normal (NO RESTART!)
            for (const container of user.containers || []) {
                await updateContainerResourcesLive(
                    container.id,
                    effectiveResources,
                    container.type
                );
            }

            logger.info(`✅ User ${user.email} reverted to ${effectiveResources.cpu} CPU, ${effectiveResources.ram} MB RAM`);
        }

        return { success: true, expired: users.length };

    } catch (error) {
        logger.error('Failed to check expired overrides:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update user resources (backend and/or display)
 */
async function updateUserResources(userId, resources, updateType = 'both') {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Update display resources
        if (updateType === 'display' || updateType === 'both') {
            user.displayedResources = {
                cpu: resources.cpu,
                ram: resources.ram,
                storage: resources.storage || user.displayedResources?.storage,
                bandwidth: resources.bandwidth || user.displayedResources?.bandwidth,
                projects: resources.projects || user.displayedResources?.projects
            };
        }

        // Update allocated resources
        if (updateType === 'backend' || updateType === 'both') {
            user.allocatedResources = {
                cpu: resources.cpu,
                ram: resources.ram,
                storage: resources.storage || user.allocatedResources?.storage,
                bandwidth: resources.bandwidth || user.allocatedResources?.bandwidth,
                projects: resources.projects || user.allocatedResources?.projects
            };

            // Apply to running containers
            const effectiveResources = getEffectiveResources(user);
            for (const container of user.containers || []) {
                await updateContainerResourcesLive(
                    container.id,
                    effectiveResources,
                    container.type
                );
            }
        }

        await user.save();

        logger.info(`✅ User ${user.email} resources updated (${updateType})`);

        return {
            success: true,
            message: `Resources updated (${updateType})`,
            displayedResources: user.displayedResources,
            allocatedResources: user.allocatedResources
        };

    } catch (error) {
        logger.error('Failed to update user resources:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Bulk update all users on a plan
 */
async function bulkUpdatePlanUsers(planId, resources, updateType = 'both') {
    try {
        const plan = await Plan.findById(planId);
        if (!plan) {
            throw new Error('Plan not found');
        }

        // Update plan
        if (updateType === 'display' || updateType === 'both') {
            plan.displayResources = resources;
        }
        if (updateType === 'backend' || updateType === 'both') {
            plan.actualResources = resources;
        }
        await plan.save();

        // Update all users on this plan
        const users = await User.find({ plan: planId });

        logger.info(`Bulk updating ${users.length} users on plan ${plan.name}`);

        for (const user of users) {
            await updateUserResources(user._id, resources, updateType);
        }

        return {
            success: true,
            message: `Updated ${users.length} users`,
            affectedUsers: users.length
        };

    } catch (error) {
        logger.error('Failed to bulk update plan users:', error);
        return { success: false, error: error.message };
    }
}

// Start checking expired overrides every hour
setInterval(checkExpiredOverrides, 60 * 60 * 1000);

module.exports = {
    getEffectiveResources,
    applyAdminOverride,
    updateContainerResourcesLive,
    updateCgroupLimits,
    checkExpiredOverrides,
    updateUserResources,
    bulkUpdatePlanUsers
};
