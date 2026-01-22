const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const auditService = require('../services/auditService');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const logger = require('../utils/logger');

// Get current user's audit logs
router.get('/', requireAuth, async (req, res) => {
    try {
        const { page = 1, limit = 50, action } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const logs = await auditService.getUserLogs(req.user.id, {
            limit: parseInt(limit),
            skip,
            action
        });

        const total = await AuditLog.countDocuments({ userId: req.user.id });

        res.json({
            success: true,
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            }
        });
    } catch (error) {
        logger.error('Get audit logs error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
    }
});

// Get all audit logs (admin only)
router.get('/all', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 100, userId, action, resourceType } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = {};
        if (userId) query.userId = userId;
        if (action) query.action = action;
        if (resourceType) query.resourceType = resourceType;

        const logs = await AuditLog.find(query)
            .populate('userId', 'email displayName username')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .lean();

        const total = await AuditLog.countDocuments(query);

        res.json({
            success: true,
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            }
        });
    } catch (error) {
        logger.error('Get all audit logs error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
    }
});

// Get logs for a specific resource
router.get('/resource/:type/:id', requireAuth, async (req, res) => {
    try {
        const { type, id } = req.params;
        const { limit = 50 } = req.query;

        const logs = await auditService.getResourceLogs(type, id, {
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            logs
        });
    } catch (error) {
        logger.error('Get resource audit logs error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch resource audit logs' });
    }
});

module.exports = router;
