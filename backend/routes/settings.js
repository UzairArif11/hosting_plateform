const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

/**
 * @route   GET /api/settings
 * @desc    Get platform settings
 * @access  Admin
 */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const settings = await Settings.getSettings();
        res.json(settings);
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

/**
 * @route   PUT /api/settings
 * @desc    Update platform settings
 * @access  Admin
 */
router.put('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const {
            baseDomain,
            serverDomains,
            sslEmail,
            protocol,
            maxDeploymentsPerUser,
            maxBuildTime,
            features
        } = req.body;

        const updates = {};

        if (baseDomain) updates.baseDomain = baseDomain;
        if (serverDomains) updates.serverDomains = serverDomains;
        if (sslEmail) updates.sslEmail = sslEmail;
        if (protocol) updates.protocol = protocol;
        if (maxDeploymentsPerUser) updates.maxDeploymentsPerUser = maxDeploymentsPerUser;
        if (maxBuildTime) updates.maxBuildTime = maxBuildTime;
        if (features) updates.features = features;

        const settings = await Settings.updateSettings(updates, req.user._id);

        res.json({
            message: 'Settings updated successfully',
            settings
        });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

/**
 * @route   PUT /api/settings/domains
 * @desc    Update domain configuration and migrate existing deployments
 * @access  Admin
 */
router.put('/domains', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { baseDomain, serverDomains } = req.body;

        // Get current settings to compare
        const currentSettings = await Settings.getSettings();
        const oldServerDomains = currentSettings.serverDomains;

        // Update settings
        const updates = {};
        if (baseDomain) updates.baseDomain = baseDomain;
        if (serverDomains) updates.serverDomains = serverDomains;

        const settings = await Settings.updateSettings(updates, req.user._id);

        // Trigger domain migration in background
        if (serverDomains) {
            const domainMigration = require('../services/domainMigration');

            // Run migration asynchronously
            domainMigration.migrateAllDomains(oldServerDomains, serverDomains)
                .then(result => {
                    console.log('Domain migration completed:', result);
                })
                .catch(error => {
                    console.error('Domain migration failed:', error);
                });
        }

        res.json({
            message: 'Domain configuration updated successfully. Existing deployments are being migrated and users will be notified.',
            baseDomain: settings.baseDomain,
            serverDomains: settings.serverDomains,
            migrationStarted: !!serverDomains
        });
    } catch (error) {
        console.error('Update domains error:', error);
        res.status(500).json({ error: 'Failed to update domains' });
    }
});

/**
 * @route   GET /api/settings/domain/:serverKey
 * @desc    Get domain for specific server
 * @access  Public (used by deployment service)
 */
router.get('/domain/:serverKey', async (req, res) => {
    try {
        const { serverKey } = req.params;
        const domain = await Settings.getDomainForServer(serverKey);

        res.json({ domain, serverKey });
    } catch (error) {
        console.error('Get domain error:', error);
        res.status(500).json({ error: 'Failed to get domain' });
    }
});

module.exports = router;
