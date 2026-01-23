const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth, requireProjectAccess } = require('../../middleware/auth');
const { hasFeature } = require('../../utils/featureCheck');
const logger = require('../../utils/logger');

/**
 * PATCH /api/projects/:id/features - Toggle feature for project
 */
router.patch('/', requireAuth, requireProjectAccess('admin'), async (req, res) => {
    try {
        const { feature, enabled } = req.body;
        const project = req.project;
        const user = req.user;

        if (!feature || typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'Feature name and enabled status required'
            });
        }

        // Check if feature is available in user's plan
        const isAvailable = hasFeature(user.plan, feature);

        if (enabled && !isAvailable) {
            return res.status(403).json({
                success: false,
                error: `${feature} is not available in your plan`
            });
        }

        // Initialize settings if doesn't exist
        if (!project.settings) {
            project.settings = { features: {} };
        }
        if (!project.settings.features) {
            project.settings.features = {};
        }

        // Update feature setting
        project.settings.features[feature] = enabled;

        // Handle special features
        if (feature === 'autoDeploy') {
            if (!project.autoDeploy) {
                project.autoDeploy = {};
            }
            project.autoDeploy.enabled = enabled;
        }

        await project.save();

        logger.info(`Feature ${feature} ${enabled ? 'enabled' : 'disabled'} for project ${project.name}`);

        res.json({
            success: true,
            message: `${feature} ${enabled ? 'enabled' : 'disabled'}`,
            settings: project.settings.features
        });

    } catch (error) {
        logger.error('Feature toggle error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update feature'
        });
    }
});

/**
 * GET /api/projects/:id/features - Get project feature settings
 */
router.get('/', requireAuth, requireProjectAccess('viewer'), async (req, res) => {
    try {
        const project = req.project;
        const user = req.user;

        // Get plan features
        const planFeatures = user.plan?.features || [];

        // Get project settings
        const projectFeatures = project.settings?.features || {};

        res.json({
            success: true,
            planFeatures: planFeatures.map(f => ({
                name: f.name,
                displayName: f.displayName,
                enabled: f.enabled,
                config: f.config
            })),
            projectSettings: projectFeatures
        });

    } catch (error) {
        logger.error('Get features error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get features'
        });
    }
});

module.exports = router;
