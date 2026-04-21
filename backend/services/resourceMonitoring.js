const User = require('../models/User');
const Settings = require('../models/Settings');
const logger = require('../utils/logger');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Resource Capacity Planning & Monitoring Service
 * Aggregates resources from all servers in the ORACLE_SERVERS cache
 */

// Fallback defaults (single Oracle Free Tier instance)
const DEFAULT_TOTAL_RESOURCES = {
    cpu: 4,      // 4 cores
    ram: 28,     // 28 GB (including swap)
    storage: 240 // 240 GB
};

// Reserve per server for system overhead
const PER_SERVER_RESERVED = {
    cpu: 0.5,    // 0.5 core
    ram: 4,      // 4 GB
    storage: 40  // 40 GB
};

/**
 * Dynamically aggregate total resources from all worker servers in ORACLE_SERVERS cache.
 * Falls back to single-server defaults if cache is empty.
 */
function getAggregatedResources() {
    try {
        const { ORACLE_SERVERS } = require('./containerOrchestrator');
        const workerServers = Object.values(ORACLE_SERVERS).filter(s => s.type !== 'api_main' && s.host);

        if (workerServers.length === 0) {
            // No workers configured — use single-server fallback
            return {
                total: { ...DEFAULT_TOTAL_RESOURCES },
                reserved: { ...PER_SERVER_RESERVED },
                available: {
                    cpu: DEFAULT_TOTAL_RESOURCES.cpu - PER_SERVER_RESERVED.cpu,
                    ram: DEFAULT_TOTAL_RESOURCES.ram - PER_SERVER_RESERVED.ram,
                    storage: DEFAULT_TOTAL_RESOURCES.storage - PER_SERVER_RESERVED.storage
                },
                serverCount: 1
            };
        }

        // Aggregate across all worker servers
        const total = { cpu: 0, ram: 0, storage: 0 };
        const reserved = { cpu: 0, ram: 0, storage: 0 };

        for (const srv of workerServers) {
            total.cpu += srv.resources?.cpu || 4;
            total.ram += srv.resources?.ram || 24;
            total.storage += srv.resources?.storage || 200;
            reserved.cpu += PER_SERVER_RESERVED.cpu;
            reserved.ram += PER_SERVER_RESERVED.ram;
            reserved.storage += PER_SERVER_RESERVED.storage;
        }

        return {
            total,
            reserved,
            available: {
                cpu: total.cpu - reserved.cpu,
                ram: total.ram - reserved.ram,
                storage: total.storage - reserved.storage
            },
            serverCount: workerServers.length
        };
    } catch (err) {
        logger.warn('Failed to aggregate server resources, using defaults:', err.message);
        return {
            total: { ...DEFAULT_TOTAL_RESOURCES },
            reserved: { ...PER_SERVER_RESERVED },
            available: {
                cpu: DEFAULT_TOTAL_RESOURCES.cpu - PER_SERVER_RESERVED.cpu,
                ram: DEFAULT_TOTAL_RESOURCES.ram - PER_SERVER_RESERVED.ram,
                storage: DEFAULT_TOTAL_RESOURCES.storage - PER_SERVER_RESERVED.storage
            },
            serverCount: 1
        };
    }
}

// Legacy exports for backward compatibility (computed dynamically)
const TOTAL_RESOURCES = DEFAULT_TOTAL_RESOURCES;
const SYSTEM_RESERVED = PER_SERVER_RESERVED;
const AVAILABLE_FOR_USERS = {
    cpu: DEFAULT_TOTAL_RESOURCES.cpu - PER_SERVER_RESERVED.cpu,
    ram: DEFAULT_TOTAL_RESOURCES.ram - PER_SERVER_RESERVED.ram,
    storage: DEFAULT_TOTAL_RESOURCES.storage - PER_SERVER_RESERVED.storage
};

// Alert threshold (70% of available)
const ALERT_THRESHOLD = 0.70;

// Signup capacity limit is now admin-configurable via Settings.resourceLimits.signupCapacityLimit (default 200%)

// Fallback plan resource allocation (used when user has no resourceAllocation)
const PLAN_RESOURCES = {
    free: {
        cpu: 0.5,    // 0.5 cores
        ram: 512,    // 512 MB
        storage: 1   // 1 GB
    },
    pro: {
        cpu: 1,      // 1 core
        ram: 2048,   // 2 GB
        storage: 5   // 5 GB
    },
    enterprise: {
        cpu: 2,      // 2 cores
        ram: 4096,   // 4 GB
        storage: 10  // 10 GB
    }
};

/**
 * Get current resource usage
 */
async function getCurrentResourceUsage() {
    try {
        const { total: aggTotal, available: aggAvailable } = getAggregatedResources();
        const usage = {
            cpu: {
                total: aggTotal.cpu,
                used: 0,
                available: aggAvailable.cpu,
                percentage: 0
            },
            ram: {
                total: aggTotal.ram,
                used: 0,
                available: aggAvailable.ram,
                percentage: 0
            },
            storage: {
                total: aggTotal.storage,
                used: 0,
                available: aggAvailable.storage,
                percentage: 0
            }
        };

        // Get CPU usage
        const cpus = os.cpus();
        const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            return acc + (1 - idle / total);
        }, 0) / cpus.length;
        usage.cpu.used = cpuUsage * TOTAL_RESOURCES.cpu;
        usage.cpu.percentage = (usage.cpu.used / AVAILABLE_FOR_USERS.cpu) * 100;

        // Get RAM usage
        const totalMem = os.totalmem() / (1024 * 1024 * 1024); // GB
        const freeMem = os.freemem() / (1024 * 1024 * 1024); // GB
        usage.ram.used = totalMem - freeMem;
        usage.ram.percentage = (usage.ram.used / AVAILABLE_FOR_USERS.ram) * 100;

        // Get storage usage (cross-platform)
        try {
            let usedStorage = 0;

            // Detect OS
            const platform = os.platform();

            if (platform === 'win32') {
                // Windows: Use wmic
                try {
                    const { stdout } = await execAsync('wmic logicaldisk where "DeviceID=\'C:\'" get Size,FreeSpace /format:value');
                    const lines = stdout.split('\n').filter(line => line.trim());
                    let size = 0, freeSpace = 0;

                    lines.forEach(line => {
                        if (line.startsWith('FreeSpace=')) {
                            freeSpace = parseInt(line.split('=')[1]) / (1024 * 1024 * 1024); // Convert to GB
                        }
                        if (line.startsWith('Size=')) {
                            size = parseInt(line.split('=')[1]) / (1024 * 1024 * 1024); // Convert to GB
                        }
                    });

                    usedStorage = size - freeSpace;
                } catch (winError) {
                    logger.warn('Windows storage check failed, using fallback');
                    usedStorage = 10; // Fallback value
                }
            } else {
                // Linux/Unix: Use df (more robust parsing)
                const { stdout } = await execAsync("df -BG / | tail -1");
                const parts = stdout.trim().split(/\s+/);
                usedStorage = parseInt(parts[2].replace('G', ''));
            }

            usage.storage.used = usedStorage;
            usage.storage.percentage = (usage.storage.used / AVAILABLE_FOR_USERS.storage) * 100;
        } catch (error) {
            logger.error('Failed to get storage usage:', error);
            // Use fallback value
            usage.storage.used = 10;
            usage.storage.percentage = (10 / AVAILABLE_FOR_USERS.storage) * 100;
        }

        return usage;
    } catch (error) {
        logger.error('Failed to get resource usage:', error);
        throw error;
    }
}

/**
 * Calculate allocated resources by plan
 */
async function getAllocatedResources() {
    try {
        const users = await User.find({ status: 'active' }).select('planType resourceAllocation');

        const allocated = {
            total: { cpu: 0, ram: 0, storage: 0 }
        };

        for (const user of users) {
            const plan = user.planType || 'free';

            // Prefer user's actual resourceAllocation (set at signup/upgrade)
            // Fall back to PLAN_RESOURCES lookup for legacy users
            let userCpu, userRamGB, userStorage;
            if (user.resourceAllocation && user.resourceAllocation.cpu) {
                userCpu = user.resourceAllocation.cpu;
                userRamGB = (user.resourceAllocation.ram || 512) / 1024;
                userStorage = user.resourceAllocation.storage || 1;
            } else {
                const fallback = PLAN_RESOURCES[plan] || PLAN_RESOURCES.free;
                userCpu = fallback.cpu;
                userRamGB = fallback.ram / 1024;
                userStorage = fallback.storage;
            }

            // Ensure plan category exists in allocated object
            if (!allocated[plan]) {
                allocated[plan] = { count: 0, cpu: 0, ram: 0, storage: 0 };
            }

            allocated[plan].count++;
            allocated[plan].cpu += userCpu;
            allocated[plan].ram += userRamGB;
            allocated[plan].storage += userStorage;
        }

        // Calculate totals by summing ALL plan categories dynamically
        allocated.total = { cpu: 0, ram: 0, storage: 0 };
        for (const [key, val] of Object.entries(allocated)) {
            if (key === 'total') continue;
            allocated.total.cpu += val.cpu;
            allocated.total.ram += val.ram;
            allocated.total.storage += val.storage;
        }

        return allocated;
    } catch (error) {
        logger.error('Failed to calculate allocated resources:', error);
        throw error;
    }
}

/**
 * Calculate capacity for new users
 */
async function calculateCapacity() {
    try {
        const allocated = await getAllocatedResources();
        const { available: aggAvailable } = getAggregatedResources();

        const capacity = {
            free: 0,
            pro: 0,
            enterprise: 0,
            canAcceptNewUsers: true,
            limitReached: false
        };

        // Calculate how many users of each plan can be added (using dynamic totals)
        const remaining = {
            cpu: aggAvailable.cpu - allocated.total.cpu,
            ram: aggAvailable.ram - allocated.total.ram,
            storage: aggAvailable.storage - allocated.total.storage
        };

        // Free plan capacity
        capacity.free = Math.floor(Math.min(
            remaining.cpu / PLAN_RESOURCES.free.cpu,
            remaining.ram / (PLAN_RESOURCES.free.ram / 1024),
            remaining.storage / PLAN_RESOURCES.free.storage
        ));

        // Pro plan capacity
        capacity.pro = Math.floor(Math.min(
            remaining.cpu / PLAN_RESOURCES.pro.cpu,
            remaining.ram / (PLAN_RESOURCES.pro.ram / 1024),
            remaining.storage / PLAN_RESOURCES.pro.storage
        ));

        // Enterprise plan capacity
        capacity.enterprise = Math.floor(Math.min(
            remaining.cpu / PLAN_RESOURCES.enterprise.cpu,
            remaining.ram / (PLAN_RESOURCES.enterprise.ram / 1024),
            remaining.storage / PLAN_RESOURCES.enterprise.storage
        ));

        // Check if we can accept new users
        capacity.canAcceptNewUsers = capacity.free > 0;
        capacity.limitReached = capacity.free === 0 && capacity.pro === 0 && capacity.enterprise === 0;

        return {
            allocated,
            remaining,
            capacity
        };
    } catch (error) {
        logger.error('Failed to calculate capacity:', error);
        throw error;
    }
}

/**
 * Check if plan signup is allowed
 */
async function canSignupForPlan(plan) {
    try {
        const { capacity, remaining } = await calculateCapacity();

        // Read admin-configurable threshold from Settings (default 200%)
        let criticalThresholdPercent = 200;
        try {
            const settings = await Settings.getSettings();
            criticalThresholdPercent = settings.resourceLimits?.signupCapacityLimit || 200;
        } catch (settingsErr) {
            logger.warn('Could not read signupCapacityLimit from Settings, using default 200%');
        }
        const criticalThreshold = criticalThresholdPercent / 100; // Convert 200% → 2.0

        // Calculate how much of total capacity is used (dynamic multi-server)
        const { available: aggAvailable } = getAggregatedResources();
        const cpuUsageRatio = 1 - (remaining.cpu / aggAvailable.cpu);
        const ramUsageRatio = 1 - (remaining.ram / aggAvailable.ram);
        const storageUsageRatio = 1 - (remaining.storage / aggAvailable.storage);
        const maxUsageRatio = Math.max(cpuUsageRatio, ramUsageRatio, storageUsageRatio);

        // CRITICAL overload (exceeds admin-set limit) — block signups
        if (maxUsageRatio >= criticalThreshold) {
            return {
                allowed: false,
                severity: 'critical',
                reason: `Server resources at ${(maxUsageRatio * 100).toFixed(0)}% (limit: ${criticalThresholdPercent}%). Please try again later.`,
                usageRatio: maxUsageRatio,
                threshold: criticalThresholdPercent,
                retryAfter: 24 * 60 * 60 * 1000
            };
        }

        // Normal overload (plan slots exhausted but under critical limit) — allow, alert admin
        const planCapacity = capacity[plan] || 0;
        if (planCapacity <= 0) {
            return {
                allowed: true,
                severity: 'warning',
                reason: `${plan} plan slots exhausted but under ${criticalThresholdPercent}% limit. Admin should review.`,
                remainingSlots: 0,
                usageRatio: maxUsageRatio,
                threshold: criticalThresholdPercent
            };
        }

        return {
            allowed: true,
            severity: 'ok',
            remainingSlots: planCapacity,
            usageRatio: maxUsageRatio,
            threshold: criticalThresholdPercent
        };
    } catch (error) {
        logger.error('Failed to check plan signup:', error);
        // On error, allow signup (don't block users due to monitoring failures)
        return {
            allowed: true,
            severity: 'error',
            reason: 'Capacity check failed, allowing signup'
        };
    }
}

/**
 * Check if alert threshold reached
 */
async function checkAlertThreshold() {
    try {
        const usage = await getCurrentResourceUsage();
        const alerts = [];

        // Check CPU
        if (usage.cpu.percentage >= ALERT_THRESHOLD * 100) {
            alerts.push({
                type: 'cpu',
                percentage: usage.cpu.percentage,
                used: usage.cpu.used,
                available: usage.cpu.available,
                message: `CPU usage at ${usage.cpu.percentage.toFixed(1)}% (threshold: ${ALERT_THRESHOLD * 100}%)`
            });
        }

        // Check RAM
        if (usage.ram.percentage >= ALERT_THRESHOLD * 100) {
            alerts.push({
                type: 'ram',
                percentage: usage.ram.percentage,
                used: usage.ram.used,
                available: usage.ram.available,
                message: `RAM usage at ${usage.ram.percentage.toFixed(1)}% (threshold: ${ALERT_THRESHOLD * 100}%)`
            });
        }

        // Check Storage
        if (usage.storage.percentage >= ALERT_THRESHOLD * 100) {
            alerts.push({
                type: 'storage',
                percentage: usage.storage.percentage,
                used: usage.storage.used,
                available: usage.storage.available,
                message: `Storage usage at ${usage.storage.percentage.toFixed(1)}% (threshold: ${ALERT_THRESHOLD * 100}%)`
            });
        }

        return {
            alertsTriggered: alerts.length > 0,
            alerts,
            usage
        };
    } catch (error) {
        logger.error('Failed to check alert threshold:', error);
        throw error;
    }
}

/**
 * Get capacity planning recommendations
 */
async function getCapacityRecommendations() {
    try {
        const { allocated, remaining, capacity } = await calculateCapacity();
        const usage = await getCurrentResourceUsage();

        const recommendations = [];

        // Check if nearing capacity
        if (capacity.free < 10) {
            recommendations.push({
                level: 'warning',
                message: `Only ${capacity.free} free plan slots remaining`,
                action: 'Consider cleaning up inactive users or upgrading server'
            });
        }

        // Check resource usage
        if (usage.cpu.percentage > 70) {
            recommendations.push({
                level: 'critical',
                message: `CPU usage at ${usage.cpu.percentage.toFixed(1)}%`,
                action: 'Reduce CPU-intensive operations or upgrade server'
            });
        }

        if (usage.ram.percentage > 70) {
            recommendations.push({
                level: 'critical',
                message: `RAM usage at ${usage.ram.percentage.toFixed(1)}%`,
                action: 'Clean up memory or upgrade server'
            });
        }

        if (usage.storage.percentage > 70) {
            recommendations.push({
                level: 'critical',
                message: `Storage usage at ${usage.storage.percentage.toFixed(1)}%`,
                action: 'Clean up old deployments/logs or upgrade storage'
            });
        }

        // Optimal distribution suggestion
        const optimalDistribution = calculateOptimalDistribution(remaining);
        recommendations.push({
            level: 'info',
            message: 'Optimal plan distribution',
            action: `Free: ${optimalDistribution.free}, Pro: ${optimalDistribution.pro}, Enterprise: ${optimalDistribution.enterprise}`
        });

        return {
            allocated,
            remaining,
            capacity,
            usage,
            recommendations
        };
    } catch (error) {
        logger.error('Failed to get capacity recommendations:', error);
        throw error;
    }
}

/**
 * Calculate optimal distribution of plans
 */
function calculateOptimalDistribution(remaining) {
    // Prioritize free users (70%), pro (20%), enterprise (10%)
    const freeSlots = Math.floor(remaining.cpu * 0.7 / PLAN_RESOURCES.free.cpu);
    const proSlots = Math.floor(remaining.cpu * 0.2 / PLAN_RESOURCES.pro.cpu);
    const enterpriseSlots = Math.floor(remaining.cpu * 0.1 / PLAN_RESOURCES.enterprise.cpu);

    return {
        free: freeSlots,
        pro: proSlots,
        enterprise: enterpriseSlots
    };
}

/**
 * Send alert email to admin
 */
async function sendAlertEmail(alerts) {
    try {
        // TODO: Implement email service
        logger.warn('ALERT: Resource threshold reached', alerts);

        // For now, just log
        for (const alert of alerts) {
            logger.warn(`[ALERT] ${alert.message}`);
        }
    } catch (error) {
        logger.error('Failed to send alert email:', error);
    }
}

/**
 * Monitor resources (run periodically)
 */
async function monitorResources() {
    try {
        const { alertsTriggered, alerts, usage } = await checkAlertThreshold();

        if (alertsTriggered) {
            logger.warn('Resource alerts triggered:', alerts);
            await sendAlertEmail(alerts);
        }

        logger.info('Resource monitoring:', {
            cpu: `${usage.cpu.percentage.toFixed(1)}%`,
            ram: `${usage.ram.percentage.toFixed(1)}%`,
            storage: `${usage.storage.percentage.toFixed(1)}%`
        });

        return { alertsTriggered, alerts, usage };
    } catch (error) {
        logger.error('Resource monitoring failed:', error);
    }
}

module.exports = {
    TOTAL_RESOURCES,
    SYSTEM_RESERVED,
    AVAILABLE_FOR_USERS,
    PLAN_RESOURCES,
    getCurrentResourceUsage,
    getAllocatedResources,
    calculateCapacity,
    canSignupForPlan,
    checkAlertThreshold,
    getCapacityRecommendations,
    monitorResources
};
