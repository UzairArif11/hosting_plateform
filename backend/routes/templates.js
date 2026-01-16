const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { requireResourceCapacity } = require('../middleware/limit');
const Template = require('../models/Template');
const templateDeployer = require('../services/templateDeployer');
const logger = require('../utils/logger');

// Get all templates
router.get('/', async (req, res) => {
    try {
        const { category, tag, search } = req.query;

        let query = { isPublished: true };

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

        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        if (template.isPremium) {
            // Check if user has premium plan
            // For now, assuming all users can deploy free templates, but strictly restrict premium
            return res.status(403).json({ success: false, error: 'Premium templates are not yet supported for your plan.' });
        }

        const { name, environmentVariables } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Project name is required' });
        }

        // Check if user is allowed to use templates
        // Feature flag check
        const user = req.user;
        // Assuming fullUser populated plan in middleware or we fetch it here.
        // requireAuth usually puts user on req. 
        // We might need to populate plan to check 'templates' feature flag.
        const User = require('../models/User');
        const fullUser = await User.findById(user._id).populate('plan');

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

module.exports = router;
