const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const resourceMonitoring = require('../services/resourceMonitoring');
const logger = require('../utils/logger');

/**
 * @route   GET /api/resources/usage
 * @desc    Get current resource usage
 * @access  Admin
 */
router.get('/usage', requireAuth, requireAdmin, async (req, res) => {
    try {
        const usage = await resourceMonitoring.getCurrentResourceUsage();
        res.json(usage);
    } catch (error) {
        logger.error('Get resource usage error:', error);
        res.status(500).json({ error: 'Failed to get resource usage' });
    }
});

/**
 * @route   GET /api/resources/capacity
 * @desc    Get capacity planning information
 * @access  Admin
 */
router.get('/capacity', requireAuth, requireAdmin, async (req, res) => {
    try {
        const capacity = await resourceMonitoring.calculateCapacity();
        res.json(capacity);
    } catch (error) {
        logger.error('Get capacity error:', error);
        res.status(500).json({ error: 'Failed to get capacity' });
    }
});

/**
 * @route   GET /api/resources/recommendations
 * @desc    Get capacity planning recommendations
 * @access  Admin
 */
router.get('/recommendations', requireAuth, requireAdmin, async (req, res) => {
    try {
        const recommendations = await resourceMonitoring.getCapacityRecommendations();
        res.json(recommendations);
    } catch (error) {
        logger.error('Get recommendations error:', error);
        res.status(500).json({ error: 'Failed to get recommendations' });
    }
});

/**
 * @route   GET /api/resources/limits
 * @desc    Get resource limits and configuration
 * @access  Admin
 */
router.get('/limits', requireAuth, requireAdmin, async (req, res) => {
    try {
        res.json({
            total: resourceMonitoring.TOTAL_RESOURCES,
            systemReserved: resourceMonitoring.SYSTEM_RESERVED,
            availableForUsers: resourceMonitoring.AVAILABLE_FOR_USERS,
            planResources: resourceMonitoring.PLAN_RESOURCES
        });
    } catch (error) {
        logger.error('Get limits error:', error);
        res.status(500).json({ error: 'Failed to get limits' });
    }
});

/**
 * @route   POST /api/resources/check-signup
 * @desc    Check if signup is allowed for a plan
 * @access  Public
 */
router.post('/check-signup', async (req, res) => {
    try {
        const { plan = 'free' } = req.body;
        const result = await resourceMonitoring.canSignupForPlan(plan);
        res.json(result);
    } catch (error) {
        logger.error('Check signup error:', error);
        res.status(500).json({ error: 'Failed to check signup availability' });
    }
});

module.exports = router;
