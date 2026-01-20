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

        if (template.isPremium) {
            // Legacy check, handled by minPlan now but kept for safety
        }

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

        const planFeatures = fullUser.plan?.features || [];
        const templatesFeature = planFeatures.find(f => f.name === 'templates') || planFeatures.find(f => f === 'templates');
        const isEnabled = templatesFeature && (typeof templatesFeature === 'string' || templatesFeature.enabled !== false);

        if (!isEnabled) {
            return res.status(403).json({
                success: false,
                error: 'Template deployment is not available in your current plan',
                upgradeRequired: true
            });
        }

        const { name, environmentVariables } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Project name is required' });
        }

        const result = await templateDeployer.deployTemplate({
            template,
            user: fullUser,
            projectName: name,
            environmentVariables
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

module.exports = router;
