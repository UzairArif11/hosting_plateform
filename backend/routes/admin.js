const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const User = require('../models/User');
const Project = require('../models/Project');
const Deployment = require('../models/Deployment');
const docker = require('../services/docker');
const logger = require('../utils/logger');
const { getRemoteSystemStats } = require('../services/containerOrchestrator');

// Get dashboard aggregated stats
router.get('/dashboard-stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      deletedUsers,
      totalProjects,
      totalDeployments,
      failedDeployments
    ] = await Promise.all([
      User.countDocuments({ status: { $ne: 'deleted' } }),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'suspended' }),
      User.countDocuments({ status: 'deleted' }),
      Project.countDocuments({}),
      Deployment.countDocuments({}),
      Deployment.countDocuments({ status: 'failed' })
    ]);

    // Cleanup stats (re-using logic or simplifying)
    const stats = {
      totalUsers,
      activeUsers,
      suspendedUsers,
      deletedUsers,
      totalProjects,
      totalDeployments,
      failedDeployments,
      cleanupStats: {
        suspended: suspendedUsers,
        softDeleted: deletedUsers,
        totalResourcesCanFree: {
          users: suspendedUsers + deletedUsers,
          // Estimates based on averages
          estimatedContainers: suspendedUsers + deletedUsers,
        }
      }
    };

    res.json({ success: true, stats });

  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
  }
});

// Get system-wide stats (Host CPU, RAM, Disk)
router.get('/system-stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Currently hardcoded to check EC3, but could check all servers
    const stats = await getRemoteSystemStats('EC3');

    if (!stats) {
      return res.status(500).json({ success: false, error: 'Failed to retrieve system stats' });
    }

    res.json({
      success: true,
      system: stats,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error fetching system stats:', error);
    res.status(500).json({ success: false, error: 'Server error retrieving stats' });
  }
});

// Get all containers with their resource usage
router.get('/containers', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Get all users with containers
    const users = await User.find({
      containerName: { $exists: true, $ne: null }
    }).select('_id email username containerName assignedServer resourceAllocation currentResourceUsage storageViolations deploymentBlocked');

    const containersData = [];

    for (const user of users) {
      try {
        const containerName = user.containerName;
        const server = user.assignedServer;

        // Get real-time stats from Docker
        let stats = {
          cpu: user.currentResourceUsage?.cpu || 0,
          ram: user.currentResourceUsage?.ram || 0,
          storage: 0,
          status: 'unknown'
        };

        // Try to get live stats
        try {
          const containerStats = await docker.getContainerStats(containerName, server);
          if (containerStats) {
            stats = {
              cpu: containerStats.cpu || 0,
              ram: containerStats.memory || 0,
              storage: containerStats.storage || 0,
              status: 'running'
            };
          }
        } catch (err) {
          logger.warn(`Failed to get stats for ${containerName}:`, err.message);
        }

        containersData.push({
          userId: user._id,
          email: user.email,
          username: user.username,
          containerName: containerName,
          server: server || 'Unknown',

          // Current usage
          usage: {
            cpu: stats.cpu,
            cpuPercent: user.resourceAllocation?.cpu ? (stats.cpu / user.resourceAllocation.cpu) * 100 : 0,
            ram: stats.ram,
            ramPercent: user.resourceAllocation?.ram ? (stats.ram / (user.resourceAllocation.ram * 1024)) * 100 : 0,
            storage: stats.storage,
            storagePercent: user.resourceAllocation?.storage ? (stats.storage / (user.resourceAllocation.storage * 1024)) * 100 : 0
          },

          // Limits
          limits: {
            cpu: user.resourceAllocation?.cpu || 0.5,
            ram: user.resourceAllocation?.ram || 1,
            storage: user.resourceAllocation?.storage || 2
          },

          // Violations
          violations: {
            count: user.storageViolations?.length || 0,
            recentCount: user.storageViolations?.filter(v =>
              v.timestamp > new Date(Date.now() - 60 * 60 * 1000)
            ).length || 0,
            lastViolation: user.storageViolations?.[user.storageViolations.length - 1]?.timestamp || null
          },

          // Status
          deploymentBlocked: user.deploymentBlocked || false,
          status: stats.status,
          lastChecked: user.currentResourceUsage?.lastChecked || new Date()
        });
      } catch (error) {
        logger.error(`Error processing user ${user.email}:`, error);
      }
    }

    res.json({
      success: true,
      totalContainers: containersData.length,
      containers: containersData,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error fetching container stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch container statistics'
    });
  }
});

// Unblock a user's deployment
router.post('/containers/:userId/unblock', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.deploymentBlocked = false;
    user.deploymentBlockedReason = '';
    user.deploymentBlockedAt = null;
    await user.save();

    logger.info(`Admin ${req.user.email} unblocked deployments for ${user.email}`);

    res.json({
      success: true,
      message: `Deployments unblocked for ${user.email}`
    });

  } catch (error) {
    logger.error('Error unblocking user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unblock user'
    });
  }
});

// Toggle resource stats visibility for a user
router.post('/users/:userId/toggle-stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { show } = req.body; // true or false
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    user.showResourceStats = show === true;
    await user.save();

    logger.info(`Admin ${req.user.email} set showResourceStats=${show} for ${user.email}`);

    res.json({
      success: true,
      message: `Resource stats visibility set to ${show} for ${user.email}`,
      showResourceStats: user.showResourceStats
    });

  } catch (error) {
    logger.error('Error toggling stats visibility:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle stats' });
  }
});

// --- User Management Routes ---

// Get all users
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, plan, search, limit = 50, page = 1 } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (plan && plan !== 'all') query.planType = plan;
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({ success: true, users, total });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// Suspend User
router.put('/users/:userId/suspend', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.status = 'suspended';
    user.suspensionReason = reason || 'Admin action';
    user.suspendedAt = new Date();
    await user.save();

    res.json({ success: true, message: 'User suspended' });
  } catch (error) {
    logger.error('Suspend user error:', error);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

// Unsuspend User
router.put('/users/:userId/unsuspend', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.status = 'active';
    user.suspendedAt = null;
    await user.save();

    res.json({ success: true, message: 'User unsuspended' });
  } catch (error) {
    logger.error('Unsuspend user error:', error);
    res.status(500).json({ error: 'Failed to unsuspend user' });
  }
});

// Change Plan
router.put('/users/:userId/plan', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { plan } = req.body; // 'free', 'pro', etc.
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.planType = plan;
    await user.save();

    res.json({ success: true, message: `Plan updated to ${plan}` });
  } catch (error) {
    logger.error('Change plan error:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// Delete User (Soft)
router.delete('/users/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.status = 'deleted';
    user.deletedAt = new Date();
    user.recoveryDeadline = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days
    await user.save();

    res.json({ success: true, message: 'User deleted (soft)' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get all projects
router.get('/projects', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { limit = 50, page = 1, search } = req.query;
    const query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const projects = await Project.find(query)
      .populate('owner', 'email username')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Project.countDocuments(query);

    res.json({ success: true, projects, total });
  } catch (error) {
    logger.error('Error fetching all projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Recover User
router.put('/users/:userId/recover', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.status !== 'deleted') return res.status(400).json({ error: 'User is not deleted' });

    user.status = 'active';
    user.deletedAt = null;
    user.recoveryDeadline = null;
    await user.save();

    res.json({ success: true, message: 'User recovered' });
  } catch (error) {
    logger.error('Recover user error:', error);
    res.status(500).json({ error: 'Failed to recover user' });
  }
});

module.exports = router;
