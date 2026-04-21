const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const logger = require('../utils/logger');

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
        logger.error('Get settings error:', error);
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
            features,
            alertConfig,
            resourceLimits,
            paymentConfig,
            currencyConfig,
            accountDeletion
        } = req.body;

        const updates = {};

        if (baseDomain) updates.baseDomain = baseDomain;
        if (serverDomains) updates.serverDomains = serverDomains;
        if (sslEmail) updates.sslEmail = sslEmail;
        if (protocol) updates.protocol = protocol;
        if (maxDeploymentsPerUser) updates.maxDeploymentsPerUser = maxDeploymentsPerUser;
        if (maxBuildTime) updates.maxBuildTime = maxBuildTime;
        if (features) updates.features = features;
        if (alertConfig) updates.alertConfig = alertConfig;
        if (resourceLimits) updates.resourceLimits = resourceLimits;
        if (paymentConfig) updates.paymentConfig = paymentConfig;
        if (currencyConfig) updates.currencyConfig = currencyConfig;
        if (accountDeletion) updates.accountDeletion = accountDeletion;

        const settings = await Settings.updateSettings(updates, req.user._id);

        // If alertConfig (SMTP credentials) changed, reset the cached email transporter
        if (alertConfig) {
            try {
                const { resetTransporter } = require('../services/notificationService');
                resetTransporter();
                logger.info('Email transporter reset after alertConfig update');
            } catch (e) { /* non-fatal */ }
        }

        res.json({
            message: 'Settings updated successfully',
            settings
        });
    } catch (error) {
        logger.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

/**
 * @route   PUT /api/settings/domains
 * @desc    Update domain configuration and migrate existing deployments (complete migration)
 * @access  Admin
 */
router.put('/domains', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { baseDomain, serverDomains, updateServerConfig = true } = req.body;

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
            if (updateServerConfig) {
                // Complete migration: database + server configuration
                const completeDomainMigration = require('../services/completeDomainMigration');

                // Run complete migration asynchronously
                completeDomainMigration.migrateAllDomainsComplete(oldServerDomains, serverDomains)
                    .then(result => {
                        logger.info('Complete domain migration finished:', result);
                    })
                    .catch(error => {
                        logger.error('Complete domain migration failed:', error);
                    });

                res.json({
                    message: 'Domain configuration updated successfully. Database, server configuration, and SSL certificates are being updated. Users will be notified.',
                    baseDomain: settings.baseDomain,
                    serverDomains: settings.serverDomains,
                    migrationStarted: true,
                    migrationType: 'complete' // database + server config
                });
            } else {
                // Database-only migration (manual server update required)
                const domainMigration = require('../services/domainMigration');

                // Run database migration asynchronously
                domainMigration.migrateAllDomains(oldServerDomains, serverDomains)
                    .then(result => {
                        logger.info('Database domain migration completed:', result);
                    })
                    .catch(error => {
                        logger.error('Database domain migration failed:', error);
                    });

                res.json({
                    message: 'Domain configuration updated successfully. Database is being updated and users will be notified. Server configuration must be updated manually.',
                    baseDomain: settings.baseDomain,
                    serverDomains: settings.serverDomains,
                    migrationStarted: true,
                    migrationType: 'database-only', // manual server update required
                    manualSteps: [
                        'SSH to each server',
                        'Update /etc/nginx/sites-available/default',
                        'Run: sudo nginx -t',
                        'Run: sudo systemctl reload nginx',
                        'Run: sudo certbot --nginx -d <new-domain>'
                    ]
                });
            }
        } else {
            res.json({
                message: 'Settings updated successfully',
                baseDomain: settings.baseDomain,
                serverDomains: settings.serverDomains
            });
        }
    } catch (error) {
        logger.error('Update domains error:', error);
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
        logger.error('Get domain error:', error);
        res.status(500).json({ error: 'Failed to get domain' });
    }
});


// Get servers configuration with capacity data (reads from Server model — dynamic)
router.get('/servers', requireAuth, requireAdmin, async (req, res) => {
    try {
        const ServerModel    = require('../models/Server');
        const ServerCapacity = require('../models/ServerCapacity');
        const User           = require('../models/User');

        const serverDocs = await ServerModel.find({}).lean();
        const servers = {};

        for (const s of serverDocs) {
            const key      = s.key;
            const capacity = await ServerCapacity.findOne({ serverName: key });
            const userCount = await User.countDocuments({ assignedServer: key });

            // Resolve SSH key status: check the env var referenced by sshKeyEnvVar, then direct sshKey
            const envKeyPath  = s.sshKeyEnvVar ? process.env[s.sshKeyEnvVar] : null;
            const sshKeyLabel = (envKeyPath || s.sshKey) ? 'Configured' : 'Missing';

            servers[key] = {
                name:          s.name,
                domain:        s.domain || '',
                ip:            s.host || 'Not configured',
                sshKey:        sshKeyLabel,
                type:          s.type,
                description:   s.description || '',
                status:        s.host ? (s.isActive !== false ? 'active' : 'inactive') : 'inactive',
                acceptNewUsers: s.acceptNewUsers !== false,
                notes:         s.notes || '',
                userCount,
                capacity: capacity ? {
                    totalCPU:       capacity.totalResources.cpu,
                    totalRAM:       capacity.totalResources.ram,
                    totalStorage:   capacity.totalResources.storage,
                    allocatedCPU:   capacity.allocatedResources.cpu,
                    allocatedRAM:   capacity.allocatedResources.ram,
                    allocatedStorage: capacity.allocatedResources.storage,
                    maxContainers:  s.maxContainers,
                    serverType:     s.type,
                    isActive:       capacity.isActive,
                    warnings:       capacity.getWarnings(),
                    lastUpdated:    capacity.lastUpdated
                } : {
                    totalCPU:       s.totalCPU,
                    totalRAM:       s.totalRAM,
                    totalStorage:   200,
                    allocatedCPU:   0,
                    allocatedRAM:   0,
                    allocatedStorage: 0,
                    maxContainers:  s.maxContainers,
                    serverType:     s.type,
                    isActive:       s.isActive !== false,
                    warnings:       [],
                    lastUpdated:    null
                }
            };
        }

        // Construct DNS instructions
        const dnsInstructions = {};
        for (const [key, server] of Object.entries(servers)) {
            if (!server.domain) continue;
            dnsInstructions[key] = {
                domain:  server.domain,
                ip:      server.ip,
                records: [
                    { type: 'A', name: server.domain,       value: server.ip, ttl: 300 },
                    { type: 'A', name: `*.${server.domain}`, value: server.ip, ttl: 300 }
                ]
            };
        }

        res.json({ servers, dnsInstructions });
    } catch (error) {
        logger.error('Get servers error:', error);
        res.status(500).json({ error: 'Failed to get server configuration' });
    }
});

// Update server capacity settings (writes to Server model + ServerCapacity + refreshes cache)
router.put('/servers/:serverKey', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { serverKey } = req.params;
        const { totalCPU, totalRAM, totalStorage, maxContainers, serverType, isActive } = req.body;

        const ServerModel    = require('../models/Server');
        const ServerCapacity = require('../models/ServerCapacity');
        const { refreshServerCache } = require('../services/containerOrchestrator');

        // Update the canonical Server document
        const serverUpdates = {};
        if (totalCPU        !== undefined) serverUpdates.totalCPU      = parseFloat(totalCPU);
        if (totalRAM        !== undefined) serverUpdates.totalRAM       = parseFloat(totalRAM);
        if (maxContainers   !== undefined) serverUpdates.maxContainers  = parseInt(maxContainers);
        if (serverType      !== undefined) serverUpdates.type           = serverType;
        if (isActive        !== undefined) serverUpdates.isActive       = isActive;

        const serverDoc = await ServerModel.findOneAndUpdate(
            { key: serverKey.toUpperCase() },
            { $set: serverUpdates },
            { new: true }
        );
        if (!serverDoc) {
            return res.status(404).json({ error: `Server '${serverKey}' not found` });
        }

        // Also upsert ServerCapacity (for detailed tracking)
        const capacityUpdate = {};
        if (totalCPU     !== undefined) capacityUpdate['totalResources.cpu']     = parseFloat(totalCPU);
        if (totalRAM     !== undefined) capacityUpdate['totalResources.ram']      = parseFloat(totalRAM);
        if (totalStorage !== undefined) capacityUpdate['totalResources.storage']  = parseFloat(totalStorage);
        if (isActive     !== undefined) capacityUpdate.isActive = isActive;
        capacityUpdate.lastUpdated = new Date();

        const capacity = await ServerCapacity.findOneAndUpdate(
            { serverName: serverKey.toUpperCase() },
            { $set: capacityUpdate },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Refresh in-memory cache immediately
        await refreshServerCache();

        logger.info(`Server capacity updated for ${serverKey}`, { serverUpdates, updatedBy: req.user.email });

        res.json({
            success: true,
            message: `${serverKey} capacity updated`,
            capacity: {
                totalCPU:     capacity.totalResources.cpu,
                totalRAM:     capacity.totalResources.ram,
                totalStorage: capacity.totalResources.storage,
                maxContainers: serverDoc.maxContainers,
                serverType:   serverDoc.type,
                isActive:     capacity.isActive,
                lastUpdated:  capacity.lastUpdated
            }
        });
    } catch (error) {
        logger.error('Update server capacity error:', error);
        res.status(500).json({ error: 'Failed to update server capacity' });
    }
});

// Verify DNS
router.post('/verify-dns', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { serverKey, domain } = req.body;
        const { resolveHost } = require('../utils/serverResolver');
        const dns = require('dns').promises;

        // Determine expected IP dynamically from DB cache
        const expectedIP = resolveHost(serverKey);

        if (!expectedIP) {
            return res.json({
                verified: false,
                message: `Server '${serverKey}' has no IP configured. Register it in Admin Panel → Servers.`,
                expectedIP: 'Not configured'
            });
        }

        try {
            const addresses = await dns.resolve4(domain);
            const verified = addresses.includes(expectedIP);

            res.json({
                verified,
                message: verified ? 'DNS record matches server IP' : 'DNS record does not match',
                expectedIP,
                foundIPs: addresses
            });
        } catch (dnsError) {
            res.json({
                verified: false,
                message: `DNS lookup failed: ${dnsError.code}`,
                expectedIP
            });
        }
    } catch (error) {
        logger.error('Verify DNS error:', error);
        res.status(500).json({ error: 'Failed to verify DNS' });
    }
});

module.exports = router;
