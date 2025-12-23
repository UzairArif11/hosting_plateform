const User = require('../models/User');
const Settings = require('../models/Settings');
const logger = require('../utils/logger');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Resource Capacity Planning & Monitoring Service
 * Ensures platform stays within Oracle Free Tier limits
 */

// Oracle Free Tier Limits
const TOTAL_RESOURCES = {
    cpu: 4,      // 4 cores
    ram: 24,     // 24 GB
    storage: 45  // 45 GB
};

// Reserve 25% for system
const SYSTEM_RESERVED = {
    cpu: 1,      // 1 core
    ram: 6,      // 6 GB
    storage: 15  // 15 GB
};

// Available for users (75%)
const AVAILABLE_FOR_USERS = {
    cpu: 3,      // 3 cores
    ram: 18,     // 18 GB
    storage: 30  // 30 GB
};

// Alert threshold (70% of available)
const ALERT_THRESHOLD = 0.70;

// Plan resource allocation
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
        const usage = {
            cpu: {
                total: TOTAL_RESOURCES.cpu,
                used: 0,
                available: AVAILABLE_FOR_USERS.cpu,
                percentage: 0
            },
            ram: {
                total: TOTAL_RESOURCES.ram,
                used: 0,
                available: AVAILABLE_FOR_USERS.ram,
                percentage: 0
            },
            storage: {
                total: TOTAL_RESOURCES.storage,
                used: 0,
                available: AVAILABLE_FOR_USERS.storage,
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
                // Linux/Unix: Use df
                const { stdout } = await execAsync("df -BG / | tail -1 | awk '{print $3}'");
                usedStorage = parseInt(stdout.replace('G', ''));
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
        const users = await User.find({ status: 'active' });

        const allocated = {
            free: { count: 0, cpu: 0, ram: 0, storage: 0 },
            pro: { count: 0, cpu: 0, ram: 0, storage: 0 },
            enterprise: { count: 0, cpu: 0, ram: 0, storage: 0 },
            total: { cpu: 0, ram: 0, storage: 0 }
        };

        for (const user of users) {
            const plan = user.planType || 'free';
            const resources = PLAN_RESOURCES[plan] || PLAN_RESOURCES.free;

            // Ensure plan exists in allocated object
            if (!allocated[plan]) {
                allocated[plan] = { count: 0, cpu: 0, ram: 0, storage: 0 };
            }

            allocated[plan].count++;
            allocated[plan].cpu += resources.cpu;
            allocated[plan].ram += resources.ram / 1024; // Convert MB to GB
            allocated[plan].storage += resources.storage;
        }

        // Calculate totals
        allocated.total.cpu = allocated.free.cpu + allocated.pro.cpu + allocated.enterprise.cpu;
        allocated.total.ram = allocated.free.ram + allocated.pro.ram + allocated.enterprise.ram;
        allocated.total.storage = allocated.free.storage + allocated.pro.storage + allocated.enterprise.storage;

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

        const capacity = {
            free: 0,
            pro: 0,
            enterprise: 0,
            canAcceptNewUsers: true,
            limitReached: false
        };

        // Calculate how many users of each plan can be added
        const remaining = {
            cpu: AVAILABLE_FOR_USERS.cpu - allocated.total.cpu,
            ram: AVAILABLE_FOR_USERS.ram - allocated.total.ram,
            storage: AVAILABLE_FOR_USERS.storage - allocated.total.storage
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
        const { capacity } = await calculateCapacity();

        if (capacity.limitReached) {
            return {
                allowed: false,
                reason: 'Server capacity reached. Please try again in 24 hours.',
                retryAfter: 24 * 60 * 60 * 1000 // 24 hours
            };
        }

        const planCapacity = capacity[plan] || 0;

        if (planCapacity <= 0) {
            return {
                allowed: false,
                reason: `${plan} plan capacity reached. Please try a different plan or try again in 24 hours.`,
                retryAfter: 24 * 60 * 60 * 1000
            };
        }

        return {
            allowed: true,
            remainingSlots: planCapacity
        };
    } catch (error) {
        logger.error('Failed to check plan signup:', error);
        return {
            allowed: false,
            reason: 'Error checking capacity'
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
