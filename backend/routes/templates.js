const express = require('express');
const router = express.Router();
const Template = require('../models/Template');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const logger = require('../utils/logger');
const templateDeployer = require('../services/templateDeployer');
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

        // Also remove demo project if exists
        if (template.demoProjectId) {
            try {
                const Project = require('../models/Project');
                const Deployment = require('../models/Deployment');
                await Project.findByIdAndDelete(template.demoProjectId);
                await Deployment.deleteMany({ projectId: template.demoProjectId });
                logger.info(`Deleted demo project for template: ${template.name}`);
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

// Admin: Deploy template as live demo (uses proper build queue)
router.post('/:id/deploy-demo', requireAuth, requireAdmin, async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);

        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

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

        // Deploy template using the proper build queue system
        // This will handle Socket.IO events at the RIGHT time (after deployment completes)
        const result = await templateDeployer.deployTemplate({
            template,
            user: req.user,
            projectName: `demo-${template.name}`,
            environmentVariables: req.body.environmentVariables || [],
            mode: req.body.mode || 'lite',
            isAdminDemo: true // Flag to indicate this is an admin demo deployment
        });

        if (result.success) {
            logger.info(`Admin ${req.user.email} deployed demo for template ${template.name}`);
            res.status(202).json({
                success: true,
                message: 'Template demo deployment started',
                status: 'deploying',
                templateId: template._id,
                deploymentId: result.deployment.id
            });
        } else {
            // Update template with error immediately
            template.demoStatus = 'failed';
            template.demoError = result.error || 'Failed to start deployment';
            await template.save();

            res.status(400).json(result);
        }
    } catch (error) {
        logger.error('Failed to start template demo deployment:', error);
        
        // Update template with error
        try {
            const template = await Template.findById(req.params.id);
            if (template) {
                template.demoStatus = 'failed';
                template.demoError = error.message;
                await template.save();
            }
        } catch (updateError) {
            logger.error('Failed to update template with error:', updateError);
        }
        
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

        // Remove demo project and deployments if exists
        if (template.demoProjectId) {
            const Project = require('../models/Project');
            const Deployment = require('../models/Deployment');
            
            await Project.findByIdAndDelete(template.demoProjectId);
            await Deployment.deleteMany({ projectId: template.demoProjectId });
            logger.info(`Deleted demo project and deployments for template: ${template.name}`);
        }

        // Clear template demo fields
        template.demoDeploymentUrl = null;
        template.demoProjectId = null;
        template.demoDeploymentId = null;
        template.demoStatus = 'none';
        template.demoProgress = 0;
        template.demoError = null;
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
