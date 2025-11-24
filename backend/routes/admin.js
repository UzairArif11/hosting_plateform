const express = require('express');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Project = require('../models/Project');
const containerOrchestrator = require('../services/containerOrchestrator');
const logger = require('../utils/logger');
const { logAdminAction, requirePermission } = require('../middleware/admin');

const router = express.Router();

// Helper function for validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Dashboard overview
router.get('/dashboard', logAdminAction('view_dashboard'), async (req, res) => {
  try {
    const [totalUsers, sharedUsers, dedicatedUsers, totalProjects] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ containerType: 'shared' }),
      User.countDocuments({ containerType: 'dedicated' }),
      Project.countDocuments()
    ]);

    const dashboardData = {
      overview: {
        totalUsers,
        sharedUsers,
        dedicatedUsers,
        totalProjects
      },
      serverHealth: {
        status: 'healthy',
        uptime: process.uptime()
      }
    };

    res.json({ success: true, dashboard: dashboardData });
  } catch (error) {
    logger.error('Admin dashboard error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to load dashboard' });
  }
});

// Platform statistics
router.get('/stats', logAdminAction('view_stats'), async (req, res) => {
  try {
    const [totalUsers, activeUsers, totalProjects, totalDeployments] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'active' }),
      Project.countDocuments(),
      require('../models/Deployment').countDocuments({ status: 'success' })
    ]);

    const stats = {
      totalUsers,
      activeUsers,
      totalProjects,
      activeDeployments: totalDeployments,
      totalRevenue: 0 // Placeholder for billing integration
    };

    res.json(stats);
  } catch (error) {
    logger.error('Admin stats error:', error.message);
    res.status(500).json({ error: 'Failed to load statistics' });
  }
});

// User management
router.get('/users', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('containerType').optional().isIn(['shared', 'dedicated']),
  query('search').optional().isString()
], requirePermission('user.read'), logAdminAction('list_users'), async (req, res) => {
  try {
    const { page = 1, limit = 20, containerType, search } = req.query;

    const query = {};
    if (containerType) query.containerType = containerType;
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .populate('plan', 'displayName pricing')
      .select('username email containerType oracleAccountId resourceAllocation')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    logger.error('Admin list users error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// Update user plan and resources
router.put('/users/:id', [
  body('plan').optional().isMongoId(),
  body('resourceAllocation.cpu').optional().isFloat({ min: 0.5, max: 4 }),
  body('resourceAllocation.ram').optional().isInt({ min: 1, max: 24 })
], requirePermission('user.write'), logAdminAction('update_user'), handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const user = await User.findByIdAndUpdate(id, updates, { new: true })
      .populate('plan');

    logger.admin('User updated', { adminId: req.user._id, targetUserId: id });

    res.json({ success: true, user });
  } catch (error) {
    logger.error('Admin update user error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// Plan management
router.get('/plans', requirePermission('plan.read'), logAdminAction('list_plans'), async (req, res) => {
  try {
    const plans = await Plan.find({}).sort({ sortOrder: 1 });
    res.json({ success: true, plans });
  } catch (error) {
    logger.error('Admin list plans error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }
});

// Create new plan
router.post('/plans', [
  body('name').trim().isLength({ min: 1, max: 50 }),
  body('displayName').trim().isLength({ min: 1, max: 100 }),
  body('pricing.usd').isFloat({ min: 0 }),
  body('resources.cpu').isFloat({ min: 0.5, max: 4 }),
  body('resources.ram').isInt({ min: 1, max: 24 })
], requirePermission('plan.write'), logAdminAction('create_plan'), handleValidationErrors, async (req, res) => {
  try {
    const plan = new Plan(req.body);
    await plan.save();

    logger.admin('Plan created', { adminId: req.user._id, planId: plan._id });
    res.status(201).json({ success: true, plan });
  } catch (error) {
    logger.error('Admin create plan error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to create plan' });
  }
});

// Server monitoring
router.get('/servers', requirePermission('server.read'), logAdminAction('view_server_stats'), async (req, res) => {
  try {
    const [ec2Status, ec3Status] = await Promise.all([
      containerOrchestrator.getServerUtilization('EC2'),
      containerOrchestrator.getServerUtilization('EC3')
    ]);

    const [totalUsers, sharedUsers, dedicatedUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ containerType: 'shared' }),
      User.countDocuments({ containerType: 'dedicated' })
    ]);

    const serverStats = [
      {
        id: 'EC1',
        name: 'EC1 - Main API Server',
        type: 'api_main',
        status: 'healthy',
        description: 'Hosts all backend APIs, admin panel, and frontend'
      },
      {
        id: 'EC2',
        name: 'EC2 - Mixed Server',
        type: 'mixed_users',
        status: ec2Status.success ? 'healthy' : 'error',
        utilization: ec2Status.success ? ec2Status.utilization : null,
        error: ec2Status.success ? null : ec2Status.error
      },
      {
        id: 'EC3',
        name: 'EC3 - Mixed Server',
        type: 'mixed_users',
        status: ec3Status.success ? 'healthy' : 'error',
        utilization: ec3Status.success ? ec3Status.utilization : null,
        error: ec3Status.success ? null : ec3Status.error
      }
    ];

    res.json({
      success: true,
      servers: serverStats,
      summary: { totalUsers, sharedUsers, dedicatedUsers },
      architecture: {
        type: 'Load Balanced 3-Server Setup',
        description: 'EC1: API/Admin, EC2/EC3: Load balanced mixed containers'
      }
    });
  } catch (error) {
    logger.error('Admin server stats error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch server statistics' });
  }
});

// Resource status
router.get('/resources/status', requirePermission('server.read'), logAdminAction('view_resource_status'), async (req, res) => {
  try {
    const [ec2Status, ec3Status] = await Promise.all([
      containerOrchestrator.getServerUtilization('EC2'),
      containerOrchestrator.getServerUtilization('EC3')
    ]);

    const overallStatus = {
      ec2: ec2Status.success ? ec2Status.utilization : { error: ec2Status.error },
      ec3: ec3Status.success ? ec3Status.utilization : { error: ec3Status.error },
      combined: {
        totalUsers: (ec2Status.success ? ec2Status.utilization.totalUsers : 0) +
          (ec3Status.success ? ec3Status.utilization.totalUsers : 0),
        sharedUsers: (ec2Status.success ? ec2Status.utilization.sharedUsers : 0) +
          (ec3Status.success ? ec3Status.utilization.sharedUsers : 0),
        dedicatedUsers: (ec2Status.success ? ec2Status.utilization.dedicatedUsers : 0) +
          (ec3Status.success ? ec3Status.utilization.dedicatedUsers : 0)
      }
    };

    res.json({ success: true, status: overallStatus });
  } catch (error) {
    logger.error('Admin resource status error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch resource status' });
  }
});

// Upgrade user to dedicated container
router.post('/users/:userId/upgrade-dedicated', [
  body('planId').isMongoId().withMessage('Valid plan ID required')
], requirePermission('user.write'), logAdminAction('upgrade_user_dedicated'), handleValidationErrors, async (req, res) => {
  try {
    const { userId } = req.params;
    const { planId } = req.body;

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const result = await containerOrchestrator.upgradeUserToDedicated(userId, plan);

    if (result.success) {
      logger.admin('User upgraded to dedicated container', {
        adminId: req.user._id,
        targetUserId: userId,
        planId: planId
      });

      res.json({
        success: true,
        upgrade: result.upgrade,
        message: 'User successfully upgraded to dedicated container'
      });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    logger.error('User upgrade error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to upgrade user' });
  }
});

// Scale user container resources (without data loss)
router.post('/users/:userId/scale-resources', [
  body('resources.cpu').isFloat({ min: 0.5, max: 8 }).withMessage('CPU must be between 0.5 and 8'),
  body('resources.ram').isInt({ min: 1, max: 48 }).withMessage('RAM must be between 1 and 48 GB'),
  body('resources.storage').optional().isInt({ min: 10, max: 1000 }).withMessage('Storage must be between 10 and 1000 GB'),
  body('resources.bandwidth').optional().isInt({ min: 100, max: 10000 }).withMessage('Bandwidth must be between 100 and 10000 GB')
], requirePermission('user.write'), logAdminAction('scale_user_resources'), handleValidationErrors, async (req, res) => {
  try {
    const { userId } = req.params;
    const { resources } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    logger.admin('Starting resource scaling for user', {
      adminId: req.user._id,
      targetUserId: userId,
      currentResources: user.resourceAllocation,
      newResources: resources
    });

    const result = await containerOrchestrator.scaleContainerResources(userId, resources);

    if (result.success) {
      logger.admin('User container resources scaled successfully', {
        adminId: req.user._id,
        targetUserId: userId,
        method: result.method,
        newResources: resources
      });

      res.json({
        success: true,
        scaling: {
          method: result.method,
          container: result.container,
          resources: resources
        },
        message: result.message
      });
    } else {
      logger.error('Resource scaling failed', {
        adminId: req.user._id,
        targetUserId: userId,
        error: result.error
      });
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    logger.error('Resource scaling error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to scale user resources' });
  }
});

// Upgrade user plan with seamless transition
router.post('/users/:userId/upgrade-plan', [
  body('planId').isMongoId().withMessage('Valid plan ID required')
], requirePermission('user.write'), logAdminAction('upgrade_user_plan'), handleValidationErrors, async (req, res) => {
  try {
    const { userId } = req.params;
    const { planId } = req.body;

    const [user, plan] = await Promise.all([
      User.findById(userId).populate('plan'),
      Plan.findById(planId)
    ]);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    logger.admin('Starting plan upgrade for user', {
      adminId: req.user._id,
      targetUserId: userId,
      currentPlan: user.plan?.name || 'None',
      newPlan: plan.name,
      currentType: user.containerType
    });

    const result = await containerOrchestrator.upgradeUserPlan(userId, plan);

    if (result.success) {
      logger.admin('User plan upgraded successfully', {
        adminId: req.user._id,
        targetUserId: userId,
        upgrade: result.upgrade
      });

      res.json({
        success: true,
        upgrade: result.upgrade,
        message: 'User plan upgraded successfully with data preservation'
      });
    } else {
      logger.error('Plan upgrade failed', {
        adminId: req.user._id,
        targetUserId: userId,
        error: result.error
      });
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    logger.error('Plan upgrade error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to upgrade user plan' });
  }
});

// Get user container information
router.get('/users/:userId/container', requirePermission('user.read'), logAdminAction('view_user_container'), async (req, res) => {
  try {
    const { userId } = req.params;

    const containerInfo = await containerOrchestrator.getUserContainer(userId);

    if (containerInfo.success) {
      res.json({
        success: true,
        container: containerInfo.container,
        user: {
          username: containerInfo.user.username,
          containerType: containerInfo.user.containerType,
          oracleAccountId: containerInfo.user.oracleAccountId,
          resourceAllocation: containerInfo.user.resourceAllocation
        }
      });
    } else {
      res.status(404).json({ success: false, error: containerInfo.error });
    }
  } catch (error) {
    logger.error('Get user container error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to get user container information' });
  }
});

// Update user resources in database only (admin override)
router.put('/users/:userId/resources', [
  body('resourceAllocation.cpu').optional().isFloat({ min: 0.5, max: 8 }),
  body('resourceAllocation.ram').optional().isInt({ min: 1, max: 48 }),
  body('resourceAllocation.storage').optional().isInt({ min: 10, max: 1000 }),
  body('resourceAllocation.bandwidth').optional().isInt({ min: 100, max: 10000 })
], requirePermission('user.write'), logAdminAction('update_user_resources_db'), handleValidationErrors, async (req, res) => {
  try {
    const { userId } = req.params;
    const { resourceAllocation } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { resourceAllocation },
      { new: true }
    ).populate('plan');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    logger.admin('User resources updated in database', {
      adminId: req.user._id,
      targetUserId: userId,
      newResources: resourceAllocation
    });

    res.json({ success: true, user });
  } catch (error) {
    logger.error('Update user resources error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to update user resources' });
  }
});

module.exports = router;
