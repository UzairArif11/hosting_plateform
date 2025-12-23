const User = require('../models/User');
const Settings = require('../models/Settings');
const logger = require('../utils/logger');

/**
 * IP-based Free Account Restriction Service
 * Prevents abuse by limiting free account usage per IP
 * Users can create accounts, but can't use resources if IP has 3+ free accounts
 */

/**
 * Check if email was previously used (even if deleted)
 */
async function isEmailBlocked(email) {
    try {
        const settings = await Settings.getSettings();

        if (!settings.ipRestrictions.blockDeletedEmailReuse) {
            return { blocked: false };
        }

        // Check if email exists in any user (including deleted)
        const existingUser = await User.findOne({
            email: email.toLowerCase()
        });

        if (existingUser) {
            if (existingUser.status === 'deleted') {
                return {
                    blocked: true,
                    reason: 'This email was previously used and cannot be reused. Please use a different email address.',
                    deletedAt: existingUser.deletedAt
                };
            }

            return {
                blocked: true,
                reason: 'An account with this email already exists.',
                userId: existingUser._id
            };
        }

        return { blocked: false };
    } catch (error) {
        logger.error('Error checking email block:', error);
        return { blocked: false }; // Fail open to not block legitimate users
    }
}

/**
 * Check if IP can use free resources
 * Counts total free accounts ever created from this IP (including deleted)
 */
async function canUseFreeResources(ipAddress, userId) {
    try {
        const settings = await Settings.getSettings();

        // If IP restrictions are disabled, allow
        if (!settings.ipRestrictions.enabled) {
            return { allowed: true };
        }

        // Get user's plan
        const user = await User.findById(userId);
        if (!user) {
            return { allowed: false, reason: 'User not found' };
        }

        // If this is a paid account and paid accounts are exempt, allow
        if (user.planType !== 'free' && settings.ipRestrictions.exemptPaidAccounts) {
            return {
                allowed: true,
                reason: 'Paid account - can use resources'
            };
        }

        // Count ALL free accounts from this IP (including deleted, suspended, etc.)
        // This is the key: we count accounts, not containers
        const freeAccountsCount = await User.countDocuments({
            signupIP: ipAddress,
            planType: 'free'
            // Don't filter by status - count ALL free accounts ever created
        });

        const maxAllowed = settings.ipRestrictions.maxFreeAccountsPerIP;

        // If this IP has already created 3+ free accounts, block resource usage
        if (freeAccountsCount > maxAllowed) {
            return {
                allowed: false,
                reason: `You have already used free resources multiple times from this IP address. Please upgrade to a paid plan to use resources again.`,
                currentCount: freeAccountsCount,
                maxAllowed: maxAllowed,
                upgradeRequired: true,
                message: 'You already used free resources multiple times. Upgrade to use resources again.'
            };
        }

        return {
            allowed: true,
            currentCount: freeAccountsCount,
            maxAllowed: maxAllowed,
            remaining: maxAllowed - freeAccountsCount
        };
    } catch (error) {
        logger.error('Error checking free resource usage:', error);
        return { allowed: true }; // Fail open to not block legitimate users
    }
}

/**
 * Check if signup is allowed (only email check, no IP limit for account creation)
 */
async function canSignup(email, ipAddress) {
    try {
        // Only check email, allow account creation
        const emailCheck = await isEmailBlocked(email);
        if (emailCheck.blocked) {
            return {
                allowed: false,
                reason: emailCheck.reason,
                type: 'email',
                details: emailCheck
            };
        }

        return {
            allowed: true,
            message: 'Account creation allowed. Resource usage limits may apply based on IP history.'
        };
    } catch (error) {
        logger.error('Error checking signup eligibility:', error);
        return { allowed: true }; // Fail open
    }
}

/**
 * Track IP for user
 */
async function trackIP(userId, ipAddress, action = 'login') {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        // Update last login IP
        if (action === 'login') {
            user.lastLoginIP = ipAddress;
        }

        // Add to IP history (keep last 50 entries)
        user.ipHistory = user.ipHistory || [];
        user.ipHistory.push({
            ip: ipAddress,
            timestamp: new Date(),
            action
        });

        // Keep only last 50 IP history entries
        if (user.ipHistory.length > 50) {
            user.ipHistory = user.ipHistory.slice(-50);
        }

        await user.save();
    } catch (error) {
        logger.error('Error tracking IP:', error);
    }
}

/**
 * Get IP statistics
 */
async function getIPStatistics(ipAddress) {
    try {
        const settings = await Settings.getSettings();

        const stats = {
            ipAddress,
            totalAccounts: 0,
            freeAccounts: 0,
            paidAccounts: 0,
            activeAccounts: 0,
            suspendedAccounts: 0,
            deletedAccounts: 0,
            limit: settings.ipRestrictions.maxFreeAccountsPerIP,
            canCreateFreeAccount: false,
            canUseFreeResources: false
        };

        // Get all users from this IP (including deleted)
        const users = await User.find({ signupIP: ipAddress });

        stats.totalAccounts = users.length;

        for (const user of users) {
            if (user.planType === 'free') {
                stats.freeAccounts++;
            } else {
                stats.paidAccounts++;
            }

            if (user.status === 'active' || user.status === 'trial') {
                stats.activeAccounts++;
            } else if (user.status === 'suspended') {
                stats.suspendedAccounts++;
            } else if (user.status === 'deleted') {
                stats.deletedAccounts++;
            }
        }

        // Can always create account
        stats.canCreateFreeAccount = true;

        // Can use free resources only if free account count <= limit
        stats.canUseFreeResources = stats.freeAccounts <= stats.limit;

        return stats;
    } catch (error) {
        logger.error('Error getting IP statistics:', error);
        return null;
    }
}

/**
 * Get all IPs with account counts (for admin)
 */
async function getAllIPStatistics() {
    try {
        const pipeline = [
            {
                $match: {
                    signupIP: { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: '$signupIP',
                    totalAccounts: { $sum: 1 },
                    freeAccounts: {
                        $sum: { $cond: [{ $eq: ['$planType', 'free'] }, 1, 0] }
                    },
                    paidAccounts: {
                        $sum: { $cond: [{ $ne: ['$planType', 'free'] }, 1, 0] }
                    },
                    activeAccounts: {
                        $sum: { $cond: [{ $in: ['$status', ['active', 'trial']] }, 1, 0] }
                    }
                }
            },
            {
                $sort: { freeAccounts: -1 }
            },
            {
                $limit: 100 // Top 100 IPs
            }
        ];

        const results = await User.aggregate(pipeline);

        return results.map(r => ({
            ipAddress: r._id,
            totalAccounts: r.totalAccounts,
            freeAccounts: r.freeAccounts,
            paidAccounts: r.paidAccounts,
            activeAccounts: r.activeAccounts
        }));
    } catch (error) {
        logger.error('Error getting all IP statistics:', error);
        return [];
    }
}

module.exports = {
    isEmailBlocked,
    canUseFreeResources,
    canSignup,
    trackIP,
    getIPStatistics,
    getAllIPStatistics
};
