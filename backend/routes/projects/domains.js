const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth, requireProjectAccess } = require('../../middleware/auth');
const crypto = require('crypto');
const logger = require('../../utils/logger');

// POST /api/projects/:id/domains - Add custom domain
router.post('/', requireAuth, requireProjectAccess('admin'), async (req, res) => {
    try {
        const { domain } = req.body;
        const project = req.project;

        // Validate domain format
        if (!domain || !/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(domain)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid domain format. Example: example.com'
            });
        }

        // Check if domain already exists in this project
        const exists = project.domains?.some(d => d.domain === domain.toLowerCase());
        if (exists) {
            return res.status(400).json({
                success: false,
                error: 'Domain already added to this project'
            });
        }

        // Check plan feature (optional - can be added later)
        // const { hasFeature } = require('../../utils/featureCheck');
        // if (!hasFeature(req.user.plan, 'customDomains')) {
        //     return res.status(403).json({ error: 'Custom domains not available in your plan' });
        // }

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Get server IP based on which server this project is deployed to
        // Use existing server assignment logic
        const serverKey = project.serverKey || 'EC2'; // Default to EC2 if not assigned
        const serverIp = serverKey === 'EC2'
            ? process.env.EC2_IP || '129.154.255.90'
            : process.env.EC3_IP || '152.67.11.146';

        // Add domain to project
        if (!project.domains) {
            project.domains = [];
        }

        const newDomain = {
            domain: domain.toLowerCase(),
            isCustom: true,
            isPrimary: project.domains.filter(d => d.isCustom).length === 0,
            verified: false,
            sslEnabled: false,
            sslStatus: 'inactive',
            verificationToken,
            createdAt: new Date()
        };

        project.domains.push(newDomain);
        await project.save();

        const domainId = project.domains[project.domains.length - 1]._id;

        res.json({
            success: true,
            domain: newDomain,
            dnsInstructions: {
                txtRecord: {
                    type: 'TXT',
                    name: '_platform-verify',
                    value: verificationToken,
                    ttl: 3600
                },
                aRecord: {
                    type: 'A',
                    name: '@',
                    value: serverIp,
                    ttl: 3600
                },
                cnameRecord: {
                    type: 'CNAME',
                    name: 'www',
                    value: domain,
                    ttl: 3600
                }
            },
            message: `Domain added! Configure DNS records to verify. Visit https://www.cloudflare.com for easy DNS + SSL setup.`
        });

        logger.info(`Domain ${domain} added to project ${project.name}`);

    } catch (error) {
        logger.error('Add domain error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add domain'
        });
    }
});

// GET /api/projects/:id/domains - List domains
router.get('/', requireAuth, requireProjectAccess('viewer'), async (req, res) => {
    try {
        const project = req.project;

        res.json({
            success: true,
            domains: project.domains || [],
            platformDomain: `${project.slug}.platform.com` // Adjust to your domain
        });
    } catch (error) {
        logger.error('List domains error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list domains'
        });
    }
});

// DELETE /api/projects/:id/domains/:domainId - Remove domain
router.delete('/:domainId', requireAuth, requireProjectAccess('admin'), async (req, res) => {
    try {
        const project = req.project;
        const domainId = req.params.domainId;

        const domain = project.domains?.id(domainId);
        if (!domain) {
            return res.status(404).json({
                success: false,
                error: 'Domain not found'
            });
        }

        // Remove domain
        project.domains.pull(domainId);
        await project.save();

        res.json({
            success: true,
            message: 'Domain removed successfully'
        });

        logger.info(`Domain ${domain.domain} removed from project ${project.name}`);

    } catch (error) {
        logger.error('Remove domain error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove domain'
        });
    }
});

// POST /api/projects/:id/domains/:domainId/verify - Basic DNS verification
router.post('/:domainId/verify', requireAuth, requireProjectAccess('admin'), async (req, res) => {
    try {
        const project = req.project;
        const domainId = req.params.domainId;

        const domain = project.domains?.id(domainId);
        if (!domain) {
            return res.status(404).json({
                success: false,
                error: 'Domain not found'
            });
        }

        // Simple DNS check using Node.js dns module
        const dns = require('dns').promises;

        try {
            // Check TXT record for verification token
            const txtRecords = await dns.resolveTxt(domain.domain);
            const hasToken = txtRecords.some(records =>
                records.join('').includes(domain.verificationToken)
            );

            if (!hasToken) {
                return res.status(400).json({
                    success: false,
                    error: 'Verification TXT record not found. DNS propagation can take up to 48 hours.',
                    hint: `Add TXT record: _platform-verify = ${domain.verificationToken}`
                });
            }

            // Check A record points to our server
            const serverKey = project.serverKey || 'EC2';
            const serverIp = serverKey === 'EC2'
                ? process.env.EC2_IP || '129.154.255.90'
                : process.env.EC3_IP || '152.67.11.146';

            const aRecords = await dns.resolve4(domain.domain);

            if (!aRecords.includes(serverIp)) {
                return res.status(400).json({
                    success: false,
                    error: `A record should point to ${serverIp}`,
                    currentARecords: aRecords
                });
            }

            // Mark as verified
            domain.verified = true;
            domain.verifiedAt = new Date();
            domain.sslStatus = 'issuing';
            domain.sslEnabled = false;
            await project.save();

            // Automatically issue SSL certificate in background
            const sslAutomation = require('../../services/sslAutomation');
            sslAutomation.autoIssueCertificate(domain.domain, project._id)
                .then(async (result) => {
                    const Project = require('../../models/Project');
                    const updatedProject = await Project.findById(project._id);
                    const updatedDomain = updatedProject.domains.id(domainId);
                    if (updatedDomain) {
                        if (result.status === 'success') {
                            updatedDomain.sslEnabled = true;
                            updatedDomain.sslStatus = 'active';
                            updatedDomain.sslIssuedAt = new Date();
                            logger.info(`✅ SSL auto-issued for ${domain.domain}`);
                        } else {
                            updatedDomain.sslStatus = 'failed';
                            logger.error(`❌ SSL failed for ${domain.domain}: ${result.message}`);
                        }
                        await updatedProject.save();
                    }
                }).catch(err => logger.error('SSL error:', err));

            res.json({
                success: true,
                verified: true,
                sslAutomation: true,
                message: 'Domain verified! SSL certificate is being issued automatically (1-2 minutes).',
                nextSteps: [
                    '✅ Domain verified successfully',
                    '🔄 SSL certificate being issued automatically',
                    '🔒 HTTPS will be available in 1-2 minutes',
                    'Refresh this page to see SSL status'
                ]
            });


        } catch (dnsError) {
            res.status(400).json({
                success: false,
                error: 'DNS verification failed. Please check your DNS configuration.',
                details: dnsError.code || dnsError.message
            });
        }

    } catch (error) {
        logger.error('Verify domain error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify domain'
        });
    }
});

// POST /api/projects/:id/domains/:domainId/set-primary - Set as primary domain
router.post('/:domainId/set-primary', requireAuth, requireProjectAccess('admin'), async (req, res) => {
    try {
        const project = req.project;
        const domainId = req.params.domainId;

        const domain = project.domains?.id(domainId);
        if (!domain) {
            return res.status(404).json({
                success: false,
                error: 'Domain not found'
            });
        }

        if (!domain.verified) {
            return res.status(400).json({
                success: false,
                error: 'Domain must be verified before setting as primary'
            });
        }

        // Remove primary flag from all domains
        project.domains.forEach(d => {
            d.isPrimary = false;
        });

        // Set this domain as primary
        domain.isPrimary = true;
        await project.save();

        res.json({
            success: true,
            message: `${domain.domain} set as primary domain`
        });

    } catch (error) {
        logger.error('Set primary domain error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to set primary domain'
        });
    }
});

module.exports = router;
