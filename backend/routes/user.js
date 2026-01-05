const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');
const accountLifecycle = require('../services/accountLifecycle');
const logger = require('../utils/logger');

/**
 * @route   DELETE /api/user/account
 * @desc    User requests account deletion (15-day recovery period)
 * @access  User (authenticated)
 */
router.delete('/account', requireAuth, async (req, res) => {
    try {
        const { confirm } = req.body;

        if (confirm !== 'DELETE MY ACCOUNT') {
            return res.status(400).json({
                error: 'Confirmation required. Send { "confirm": "DELETE MY ACCOUNT" } to proceed.'
            });
        }

        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        logger.info(`User ${user.email} requested account deletion`);

        // Soft delete with 15-day recovery period
        const result = await accountLifecycle.softDeleteUser(
            userId,
            userId, // deletedBy = self
            'User requested deletion'
        );

        res.json({
            message: 'Your account has been scheduled for deletion',
            deletedAt: result.user.deletedAt,
            recoveryDeadline: result.user.recoveryDeadline,
            daysToRecover: 15,
            warning: 'You have 15 days to recover your account. After that, all data will be permanently deleted.'
        });

    } catch (error) {
        logger.error('User account deletion error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

/**
 * @route   PUT /api/user/account/recover
 * @desc    User requests account recovery (within 15-day period)
 * @access  User (authenticated, even if deleted)
 */
router.put('/account/recover', requireAuth, async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.status !== 'deleted') {
            return res.status(400).json({ error: 'Account is not deleted' });
        }

        logger.info(`User ${user.email} requested account recovery`);

        // Recover account
        const result = await accountLifecycle.recoverDeletedUser(userId, userId);

        res.json({
            message: 'Your account has been recovered successfully!',
            recoveredAt: result.user.recoveredAt,
            status: 'active'
        });

    } catch (error) {
        logger.error('User account recovery error:', error);
        res.status(500).json({ error: error.message || 'Failed to recover account' });
    }
});

/**
 * @route   GET /api/user/account/status
 * @desc    Get user account status and lifecycle information
 * @access  User (authenticated)
 */
router.get('/account/status', requireAuth, async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const status = {
            email: user.email,
            status: user.status,
            plan: user.plan,
            trialActive: user.isTrialActive,
            trialExpiry: user.trialExpiry,
            subscriptionExpiry: user.subscriptionExpiry,
            suspended: user.status === 'suspended',
            deleted: user.status === 'deleted',
            canRecover: false
        };

        // Check if user can recover
        if (user.status === 'deleted' && user.recoveryDeadline) {
            const now = new Date();
            status.canRecover = now < user.recoveryDeadline;
            status.recoveryDeadline = user.recoveryDeadline;
            status.daysLeftToRecover = Math.ceil((user.recoveryDeadline - now) / (1000 * 60 * 60 * 24));
        }

        // Check if suspended
        if (user.status === 'suspended') {
            status.suspendedAt = user.suspendedAt;
            status.suspensionReason = user.suspensionReason;
            status.resourcesDeleted = user.resourcesDeleted;

            if (user.suspendedAt) {
                const daysSuspended = Math.floor((new Date() - user.suspendedAt) / (1000 * 60 * 60 * 24));
                status.daysSuspended = daysSuspended;
                status.daysUntilResourceDeletion = Math.max(0, 7 - daysSuspended);
            }
        }

        res.json(status);

    } catch (error) {
        logger.error('Get account status error:', error);
        res.status(500).json({ error: 'Failed to get account status' });
    }
});

/**
 * @route   GET /api/user/notifications
 * @desc    Get user notifications (resource warnings, etc)
 * @access  User (authenticated)
 */
router.get('/notifications', requireAuth, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });

        res.json({ notifications, unreadCount });
    } catch (error) {
        logger.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

/**
 * @route   PUT /api/user/notifications/:id/read
 * @desc    Mark notification as read
 * @access  User (authenticated)
 */
router.put('/notifications/:id/read', requireAuth, async (req, res) => {
    try {
        await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { read: true }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Update failed' });
    }
});

module.exports = router;
