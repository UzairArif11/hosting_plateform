const express = require('express');
const router = express.Router();
const Template = require('../models/Template');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');
const templateDeployer = require('../services/templateDeployer');
const adminDemoDeployer = require('../services/adminDemoDeployer');
const websocketService = require('../services/websocket');

// Admin: Get all templates
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const templates = await Template.find().sort({ createdAt: -1 });
        res.json({ success: true, templates });
    } catch (error) {
        logger.error('Failed to fetch templates:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch templates' });
    }
});

// Public: Get published templates for marketplace
router.get('/published', async (req, res) => {
    try {
        const templates = await Template.find({ isPublished: true }).sort({ createdAt: -1 });
        res.json({ success: true, templates });
    } catch (error) {
        logger.error('Failed to fetch published templates:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch templates' });
    }
});

// Public: Get single template details
router.get('/:id', async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }
        res.json({ success: true, template });
    } catch (error) {
        logger.error('Failed to fetch template:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch template' });
    }
});

// Admin: Create new template  
router.post('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const template = await Template.create(req.body);
        logger.info(`Template created: ${template.name}`);
        res.status(201).json({ success: true, template });
    } catch (error) {
        logger.error('Failed to create template:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to create template' });
    }
});

// Admin: Update template
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const template = await Template.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        logger.info(`Template updated: ${template.name}`);
        res.json({ success: true, template });
    } catch (error) {
        logger.error('Failed to update template:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to update template' });
    }
});

// Admin: Delete template
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const template = await Template.findByIdAndDelete(req.params.id);

        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        // Also remove demo if exists
        if (template.demoContainerName) {
            try {
                await adminDemoDeployer.removeAdminDemo({ template });
            } catch (err) {
                logger.warn(`Failed to remove demo for deleted template: ${err.message}`);
            }
        }

        logger.info(`Template deleted: ${template.name}`);
        res.json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
        logger.error('Failed to delete template:', error);
        res.status(500).json({ success: false, error: 'Failed to delete template' });
    }
});

// Admin: Deploy template as live demo (NEW - uses admin containers)
router.post('/:id/deploy-demo', requireAuth, requireAdmin, async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);

        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        // Generate unique deployment ID for tracking logs
        const deploymentId = require('mongoose').Types.ObjectId().toString();

        // Update template status immediately 
        template.demoStatus = 'deploying';
        template.demoProgress = 0;
        template.demoError = null;
        await template.save();

        // Emit initial status via Socket.IO
        const io = websocketService.getIO();
        if (io) {
            io.emit('template-demo-status', {
                templateId: template._id.toString(),
                status: 'deploying',
                progress: 0,
                message: 'Starting deployment...'
            });
        }

        // Return immediately - deployment continues in background
        res.status(202).json({
            success: true,
            message: 'Template demo deployment started',
            status: 'deploying',
            templateId: template._id,
            deploymentId
        });

        // Deploy asynchronously using new admin demo deployer
        adminDemoDeployer.deployAdminDemo({
            template,
            deploymentId
        }).then(async (result) => {
            // Update template with demo URL
            const updatedTemplate = await Template.findById(template._id);
            if (updatedTemplate) {
                updatedTemplate.demoDeploymentUrl = result.demoUrl;
                updatedTemplate.demoStatus = 'success';
                updatedTemplate.demoProgress = 100;
                updatedTemplate.demoError = null;
                updatedTemplate.demoContainerName = result.containerName;
                await updatedTemplate.save();

                // Emit success
                if (io) {
                    io.emit('template-demo-status', {
                        templateId: template._id.toString(),
                        status: 'success',
                        progress: 100,
                        demoUrl: result.demoUrl,
                        message: 'Deployment successful!'
                    });
                }

                logger.info(`✅ Admin demo deployed: ${template.name} → ${result.demoUrl}`);
            }
        }).catch(async (error) => {
            // Update template with error
            const updatedTemplate = await Template.findById(template._id);
            if (updatedTemplate) {
                updatedTemplate.demoStatus = 'failed';
                updatedTemplate.demoError = error.message;
                updatedTemplate.demoProgress = 0;
                await updatedTemplate.save();

                // Emit failure
                if (io) {
                    io.emit('template-demo-status', {
                        templateId: template._id.toString(),
                        status: 'failed',
                        progress: 0,
                        error: error.message,
                        message: 'Deployment failed'
                    });
                }

                logger.error(`❌ Admin demo failed: ${template.name}`, error);
            }
        });

    } catch (error) {
        logger.error('Failed to start template demo deployment:', error);
        res.status(500).json({ success: false, error: 'Failed to start template demo deployment' });
    }
});

// Admin: Remove demo deployment
router.delete('/:id/remove-demo', requireAuth, requireAdmin, async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);

        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        // Remove container if exists
        if (template.demoContainerName) {
            await adminDemoDeployer.removeAdminDemo({ template });
        }

        // Clear template demo fields
        template.demoDeploymentUrl = null;
        template.demoStatus = 'none';
        template.demoProgress = 0;
        template.demoError = null;
        template.demoContainerName = null;
        await template.save();

        logger.info(`Admin demo removed for template: ${template.name}`);
        res.json({ success: true, message: 'Demo removed successfully' });
    } catch (error) {
        logger.error('Failed to remove demo:', error);
        res.status(500).json({ success: false, error: 'Failed to remove demo' });
    }
});

// User: Deploy template to their account (creates a new project for them)
router.post('/:id/deploy', requireAuth, async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);

        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        if (!template.isPublished) {
            return res.status(403).json({ success: false, error: 'Template is not published' });
        }

        const { projectName, environmentVariables, mode } = req.body;

        if (!projectName) {
            return res.status(400).json({ success: false, error: 'Project name is required' });
        }

        // Deploy template for user (creates project in their account)
        const result = await templateDeployer.deployTemplate({
            template,
            user: req.user,
            projectName,
            environmentVariables: environmentVariables || [],
            mode: mode || 'lite'
        });

        if (result.success) {
            logger.info(`User ${req.user.email} deployed template ${template.name} as project ${projectName}`);
            res.status(202).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        logger.error('Failed to deploy template:', error);
        res.status(500).json({ success: false, error: 'Failed to deploy template' });
    }
});

module.exports = router;
