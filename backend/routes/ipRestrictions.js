const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const ipRestrictions = require('../services/ipRestrictions');
const Settings = require('../models/Settings');
const logger = require('../utils/logger');

/**
 * @route   GET /api/ip-restrictions/settings
 * @desc    Get IP restriction settings
 * @access  Admin
 */
router.get('/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
        const settings = await Settings.getSettings();
        res.json({
            ipRestrictions: settings.ipRestrictions
        });
    } catch (error) {
        logger.error('Get IP restriction settings error:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

/**
 * @route   PUT /api/ip-restrictions/settings
 * @desc    Update IP restriction settings
 * @access  Admin
 */
router.put('/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { enabled, maxFreeAccountsPerIP, blockDeletedEmailReuse, exemptPaidAccounts } = req.body;

        const settings = await Settings.getSettings();

        if (enabled !== undefined) {
            settings.ipRestrictions.enabled = enabled;
        }
        if (maxFreeAccountsPerIP !== undefined) {
            if (maxFreeAccountsPerIP < 1 || maxFreeAccountsPerIP > 10) {
                return res.status(400).json({ error: 'maxFreeAccountsPerIP must be between 1 and 10' });
            }
            settings.ipRestrictions.maxFreeAccountsPerIP = maxFreeAccountsPerIP;
        }
        if (blockDeletedEmailReuse !== undefined) {
            settings.ipRestrictions.blockDeletedEmailReuse = blockDeletedEmailReuse;
        }
        if (exemptPaidAccounts !== undefined) {
            settings.ipRestrictions.exemptPaidAccounts = exemptPaidAccounts;
        }

        settings.updatedBy = req.user._id;
        settings.updatedAt = new Date();
        await settings.save();

        logger.info('IP restriction settings updated', {
            admin: req.user.email,
            settings: settings.ipRestrictions
        });

        res.json({
            message: 'IP restriction settings updated successfully',
            ipRestrictions: settings.ipRestrictions
        });
    } catch (error) {
        logger.error('Update IP restriction settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

/**
 * @route   GET /api/ip-restrictions/statistics
 * @desc    Get IP statistics (top IPs with account counts)
 * @access  Admin
 */
router.get('/statistics', requireAuth, requireAdmin, async (req, res) => {
    try {
        const stats = await ipRestrictions.getAllIPStatistics();
        res.json({
            totalIPs: stats.length,
            topIPs: stats
        });
    } catch (error) {
        logger.error('Get IP statistics error:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

/**
 * @route   GET /api/ip-restrictions/check/:ip
 * @desc    Check specific IP statistics
 * @access  Admin
 */
router.get('/check/:ip', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { ip } = req.params;
        const stats = await ipRestrictions.getIPStatistics(ip);

        if (!stats) {
            return res.status(404).json({ error: 'No data found for this IP' });
        }

        res.json(stats);
    } catch (error) {
        logger.error('Check IP error:', error);
        res.status(500).json({ error: 'Failed to check IP' });
    }
});

/**
 * @route   POST /api/ip-restrictions/test
 * @desc    Test if signup is allowed for email/IP combination
 * @access  Admin
 */
router.post('/test', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { email, ipAddress, planType = 'free' } = req.body;

        if (!email || !ipAddress) {
            return res.status(400).json({ error: 'Email and IP address are required' });
        }

        const result = await ipRestrictions.canSignup(email, ipAddress, planType);
        res.json(result);
    } catch (error) {
        logger.error('Test signup error:', error);
        res.status(500).json({ error: 'Failed to test signup' });
    }
});

module.exports = router;
