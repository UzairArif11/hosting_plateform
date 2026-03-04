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
            features,
            alertConfig,
            resourceLimits,
            paymentConfig
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

/**
 * @route   GET /api/settings/servers
 * @desc    Get all server information with IPs and DNS instructions
 * @access  Admin
 */
router.get('/servers', requireAuth, requireAdmin, async (req, res) => {
    try {
        const settings = await Settings.getSettings();

        // Get server IPs from environment variables
        const servers = {
            EC2: {
                domain: settings.serverDomains.EC2,
                ip: process.env.EC2_HOST || 'Not configured',
                sshKey: process.env.SSH_EC2_KEY ? 'Configured' : 'Not configured',
                status: process.env.EC2_HOST ? 'active' : 'inactive'
            },
            EC3: {
                domain: settings.serverDomains.EC3,
                ip: process.env.EC3_HOST || 'Not configured',
                sshKey: process.env.SSH_EC3_KEY ? 'Configured' : 'Not configured',
                status: process.env.EC3_HOST ? 'active' : 'inactive'
            },
            EC4: {
                domain: settings.serverDomains.EC4,
                ip: process.env.EC4_HOST || 'Not configured',
                sshKey: process.env.SSH_EC4_KEY ? 'Configured' : 'Not configured',
                status: process.env.EC4_HOST ? 'active' : 'inactive'
            },
            EC5: {
                domain: settings.serverDomains.EC5,
                ip: process.env.EC5_HOST || 'Not configured',
                sshKey: process.env.SSH_EC5_KEY ? 'Configured' : 'Not configured',
                status: process.env.EC5_HOST ? 'active' : 'inactive'
            }
        };

        // Generate DNS instructions for each server
        const dnsInstructions = {};
        for (const [serverKey, serverInfo] of Object.entries(servers)) {
            if (serverInfo.status === 'active') {
                dnsInstructions[serverKey] = {
                    domain: serverInfo.domain,
                    ip: serverInfo.ip,
                    records: [
                        {
                            type: 'A',
                            name: serverInfo.domain === settings.baseDomain ? '@' : serverInfo.domain.replace(`.${settings.baseDomain}`, ''),
                            value: serverInfo.ip,
                            ttl: 3600
                        },
                        {
                            type: 'A',
                            name: `www.${serverInfo.domain === settings.baseDomain ? '@' : serverInfo.domain.replace(`.${settings.baseDomain}`, '')}`,
                            value: serverInfo.ip,
                            ttl: 3600
                        }
                    ]
                };
            }
        }

        res.json({
            servers,
            dnsInstructions,
            sslEmail: settings.sslEmail,
            protocol: settings.protocol
        });
    } catch (error) {
        logger.error('Get servers error:', error);
        res.status(500).json({ error: 'Failed to get server information' });
    }
});

/**
 * @route   POST /api/settings/verify-dns
 * @desc    Verify DNS records are configured correctly before domain migration
 * @access  Admin
 */
router.post('/verify-dns', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { serverKey, domain } = req.body;

        if (!serverKey || !domain) {
            return res.status(400).json({ error: 'serverKey and domain are required' });
        }

        const dns = require('dns').promises;

        try {
            // Lookup A record for domain
            const addresses = await dns.resolve4(domain);

            // Get expected IP from environment
            const expectedIP = process.env[`${serverKey}_HOST`];

            if (!expectedIP) {
                return res.json({
                    verified: false,
                    message: `Server ${serverKey} is not configured in backend`,
                    domain,
                    foundIPs: addresses
                });
            }

            // Check if expected IP is in the results
            const isCorrect = addresses.includes(expectedIP);

            res.json({
                verified: isCorrect,
                message: isCorrect
                    ? `DNS is correctly configured for ${domain}`
                    : `DNS points to ${addresses.join(', ')} but should point to ${expectedIP}`,
                domain,
                expectedIP,
                foundIPs: addresses,
                ready: isCorrect
            });

        } catch (dnsError) {
            res.json({
                verified: false,
                message: `DNS lookup failed for ${domain}. Make sure DNS records are added.`,
                domain,
                error: dnsError.message,
                ready: false
            });
        }

    } catch (error) {
        logger.error('Verify DNS error:', error);
        res.status(500).json({ error: 'Failed to verify DNS' });
    }
});

// Get servers configuration
router.get('/servers', requireAuth, requireAdmin, async (req, res) => {
    try {
        const settings = await Settings.getSettings();

        // Construct detailed server info from Env + Settings
        const servers = {
            'EC2': {
                domain: settings.serverDomains?.EC2 || process.env.EC2_DOMAIN || 'ec2.example.com',
                ip: process.env.EC2_SERVER_IP || '123.45.67.89', // Mock if not set
                sshKey: process.env.SSH_EC2_KEY ? 'Configured' : 'Missing',
                status: 'active'
            },
            'EC3': {
                domain: settings.serverDomains?.EC3 || process.env.EC3_DOMAIN || 'ec3.example.com',
                ip: process.env.EC3_SERVER_IP || '98.76.54.32',
                sshKey: process.env.SSH_EC3_KEY ? 'Configured' : 'Missing',
                status: 'active'
            }
        };

        // Construct DNS instructions
        const dnsInstructions = {};
        for (const [key, server] of Object.entries(servers)) {
            dnsInstructions[key] = {
                domain: server.domain,
                ip: server.ip,
                records: [
                    { type: 'A', name: server.domain, value: server.ip, ttl: 300 },
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

// Verify DNS
router.post('/verify-dns', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { serverKey, domain } = req.body;
        const dns = require('dns').promises;

        // Determine expected IP
        const expectedIP = serverKey === 'EC2' ? process.env.EC2_SERVER_IP : process.env.EC3_SERVER_IP;

        if (!expectedIP) {
            return res.json({
                verified: false,
                message: 'Server IP not configured in environment variables',
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
