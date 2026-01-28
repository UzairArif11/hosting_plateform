const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { requireResourceCapacity } = require('../middleware/auth');
const Template = require('../models/Template');
const templateDeployer = require('../services/templateDeployer');
const logger = require('../utils/logger');

// Get all templates
router.get('/', async (req, res) => {
    try {
        const { category, tag, search, includeUnpublished } = req.query;

        let query = {};

        // Only enforce isPublished if not explicitly asked to include unpublished (and caller is admin)
        // Since this is a public route, we need to be careful.
        // Simplification: Clients must be authenticated to see unpublished.
        const token = req.headers.authorization?.split(' ')[1] || req.cookies?.auth_token;
        let isAdmin = false;

        if (token) {
            try {
                const jwt = require('jsonwebtoken'); // Lazy load
                const decoded = jwt.decode(token);
                if (decoded && decoded.role === 'admin') {
                    isAdmin = true;
                }
            } catch (e) { }
        }

        if (!isAdmin || String(includeUnpublished) !== 'true') {
            query.isPublished = true;
        }

        if (category) {
            query.category = category;
        }

        if (tag) {
            query.tags = tag;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { displayName: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const templates = await Template.find(query)
            .sort({ 'rating.count': -1, deployCount: -1 })
            .select('-buildConfig.installCommand -buildConfig.devCommand'); // Exclude heavy fields if not needed

        res.json({
            success: true,
            count: templates.length,
            templates
        });
    } catch (error) {
        logger.error('Failed to fetch templates:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch templates' });
    }
});

// Get single template
router.get('/:id', async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);

        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        res.json({
            success: true,
            template
        });
    } catch (error) {
        logger.error('Failed to fetch template:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch template' });
    }
});

// Deploy a template
router.post('/:id/deploy', requireAuth, requireResourceCapacity('projects', 1), async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);
        const user = req.user;

        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        // Legacy isPremium field is deprecated - use minPlan instead

        const PLAN_LEVELS = { 'free': 0, 'pro': 1, 'enterprise': 2 };

        // Populate user plan if not already
        const User = require('../models/User');
        const fullUser = await User.findById(user._id).populate('plan');

        // Determine user plan level (default to free)
        // plan.name should match 'free', 'pro', 'enterprise'
        // If plan names are different (e.g. 'Starter', 'Growth'), we need mapping.
        // Assuming plan.name is lowercase slug.
        const userPlanName = fullUser.plan?.name?.toLowerCase() || 'free';
        const userLevel = PLAN_LEVELS[userPlanName] || 0;
        const templateLevel = PLAN_LEVELS[template.minPlan || 'free'] || 0;

        if (userLevel < templateLevel) {
            return res.status(403).json({
                success: false,
                error: `This template requires the ${template.minPlan} plan.`,
                upgradeRequired: true,
                minPlan: template.minPlan
            });
        }

        // Check templates feature using centralized utility
        const { hasFeature } = require('../utils/featureCheck');
        if (!hasFeature(fullUser.plan, 'templates')) {
            return res.status(403).json({
                success: false,
                error: 'Template deployment is not available in your current plan',
                upgradeRequired: true
            });
        }

        const { name, environmentVariables, mode } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Project name is required' });
        }

        const result = await templateDeployer.deployTemplate({
            template,
            user: fullUser,
            projectName: name,
            environmentVariables,
            mode: mode || null // Smart Template mode (lite/pro)
        });

        if (result.success) {
            // Increment deploy count
            template.deployCount += 1;
            await template.save();

            res.status(201).json({
                success: true,
                project: result.project,
                deployment: result.deployment,
                message: 'Template deployment started'
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        logger.error('Template deployment route failed:', error);
        res.status(500).json({ success: false, error: 'Failed to initiate template deployment' });
    }
});

// Admin: Create template
router.post('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const template = await Template.create({
            ...req.body,
            createdBy: req.user._id
        });

        res.status(201).json({
            success: true,
            template
        });
    } catch (error) {
        logger.error('Failed to create template:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Admin: Update template
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const template = await Template.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: Date.now() },
            { new: true, runValidators: true }
        );

        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        res.json({
            success: true,
            template
        });
    } catch (error) {
        logger.error('Failed to update template:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Admin: Delete template
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const template = await Template.findByIdAndDelete(req.params.id);

        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        res.json({
            success: true,
            message: 'Template deleted successfully'
        });
    } catch (error) {
        logger.error('Failed to delete template:', error);
        res.status(500).json({ success: false, error: 'Failed to delete template' });
    }
});

// Admin: Deploy template as demo (creates internal live preview)
router.post('/:id/deploy-demo', requireAuth, requireAdmin, async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);
        
        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        const { environmentVariables } = req.body;

        // Create demo project name with "demo-" prefix
        const demoProjectName = `demo-${template.name}`;

        // Deploy template as admin user's project (same as regular deployments)
        const result = await templateDeployer.deployTemplate({
            template,
            user: req.user,
            projectName: demoProjectName,
            environmentVariables: environmentVariables || [],
            mode: 'lite' // Use lite mode for demos
        });

        if (result.success) {
            // Demo URL will be generated automatically like regular deployments
            // Format: https://foodpanda.site/demo-templatename-abc123/
            const demoUrl = result.deployment.deploymentUrl;

            // Update template with demo deployment info
            template.demoDeploymentUrl = demoUrl;
            template.demoProjectId = result.project._id;
            template.demoDeploymentId = result.deployment._id;
            await template.save();

            logger.info(`Admin ${req.user.email} deployed demo for template ${template.name} at ${demoUrl}`);

            res.status(201).json({
                success: true,
                message: 'Template demo deployed successfully',
                demoUrl,
                project: result.project,
                deployment: result.deployment
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error || 'Failed to deploy demo'
            });
        }

    } catch (error) {
        logger.error('Failed to deploy template demo:', error);
        res.status(500).json({ success: false, error: 'Failed to deploy template demo' });
    }
});

// Admin: Remove template demo
router.delete('/:id/demo', requireAuth, requireAdmin, async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);

        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        // Remove demo project if exists
        if (template.demoProjectId) {
            const Project = require('../models/Project');
            await Project.findByIdAndDelete(template.demoProjectId);
        }

        // Clear demo URL
        template.demoDeploymentUrl = undefined;
        template.demoProjectId = undefined;
        await template.save();

        logger.info(`Admin ${req.user.email} removed demo for template ${template.name}`);

        res.json({
            success: true,
            message: 'Template demo removed successfully'
        });
    } catch (error) {
        logger.error('Failed to remove template demo:', error);
        res.status(500).json({ success: false, error: 'Failed to remove template demo' });
    }
});

module.exports = router;
