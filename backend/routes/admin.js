const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const User = require('../models/User');
const Project = require('../models/Project');
const Deployment = require('../models/Deployment');
const Plan = require('../models/Plan');
const ServerCapacity = require('../models/ServerCapacity');
const docker = require('../services/docker');
const containerUpgrade = require('../services/containerUpgrade');
const logger = require('../utils/logger');
const notify = require('../services/notificationService');
const rateLimit = require('express-rate-limit');
const { getRemoteSystemStats, getServerUtilization, getRemoteDockerStats, getRemoteContainerLogs, ORACLE_SERVERS } = require('../services/containerOrchestrator');
const buildQueue = require('../services/buildQueue');


// --- Rate Limiters ---
// Strict limiter for test deployments to prevent Docker container spam
const testDeployLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // restrict to 5 test deployments per 10 minutes
  message: { error: 'Too many test deployments. Please wait 10 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Moderate limiter for fetching server logs/health
const serverLogsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // restrict to 30 requests per minute
  message: { error: 'Too many log requests. Please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ... imports remain the same ...

// Get container logs
router.get('/servers/:serverKey/containers/:containerId/logs', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { serverKey, containerId } = req.params;

    // validate server key
    if (!ORACLE_SERVERS[serverKey]) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    const result = await getRemoteContainerLogs(serverKey, containerId);

    if (!result) {
      return res.status(500).json({ success: false, error: 'Failed to connect to server' });
    }

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      logs: result.logs
    });
  } catch (error) {
    logger.error('Get container logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch container logs' });
  }
});

// ==================== SERVER CAPACITY MANAGEMENT ====================

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

// ==========================================
// CLEANUP ROUTES (used by /admin/cleanup page)
// ==========================================

// GET /api/admin/users/cleanup-stats — Counts of suspended/soft-deleted users
router.get('/users/cleanup-stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [suspended, softDeleted, suspendedOver7Days] = await Promise.all([
      User.countDocuments({ status: 'suspended' }),
      User.countDocuments({ status: 'deleted' }),
      User.countDocuments({
        status: 'suspended',
        suspendedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
    ]);

    // Count users past the 15-day recovery deadline
    const pastRecoveryDeadline = await User.countDocuments({
      status: 'deleted',
      deletedAt: { $lt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) }
    });

    // Estimate resources that can be freed
    const totalCleanable = suspended + softDeleted;
    const estimatedProjects = await Project.countDocuments({
      owner: {
        $in: await User.find({
          status: { $in: ['suspended', 'deleted'] }
        }).distinct('_id')
      }
    });

    res.json({
      suspended,
      softDeleted,
      suspendedOver7Days,
      pastRecoveryDeadline,
      totalResourcesCanFree: {
        users: totalCleanable,
        estimatedProjects,
        estimatedDeployments: estimatedProjects * 3, // rough estimate
        estimatedContainers: totalCleanable
      }
    });
  } catch (error) {
    logger.error('Error fetching cleanup stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch cleanup stats' });
  }
});

// POST /api/admin/users/delete-all-suspended — Bulk delete all suspended users
router.post('/users/delete-all-suspended', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { confirm } = req.body;
    if (confirm !== 'DELETE ALL SUSPENDED') {
      return res.status(400).json({ success: false, error: 'Confirmation text required' });
    }

    const suspendedUsers = await User.find({ status: 'suspended', role: { $ne: 'admin' } });
    const results = { deleted: 0, failed: 0, details: [] };

    for (const user of suspendedUsers) {
      try {
        // Delete user's containers on remote servers
        if (user.containerName && user.assignedServer) {
          try {
            const freeTierContainer = require('../services/freeTierContainer');
            await freeTierContainer.removeUserContainer(user);
          } catch (containerErr) {
            logger.warn(`Failed to remove container for ${user.email}: ${containerErr.message}`);
          }
        }

        // Deallocate server capacity
        if (user.assignedServer && user.allocatedResources) {
          try {
            const serverCap = await ServerCapacity.findOne({ serverName: user.assignedServer });
            if (serverCap) {
              await serverCap.deallocate({
                cpu: user.allocatedResources.cpu || 0,
                ram: user.allocatedResources.ram || 0,
                storage: user.allocatedResources.storage || 0,
                bandwidth: user.allocatedResources.bandwidth || 0
              });
            }
          } catch (capErr) {
            logger.warn(`Failed to deallocate capacity for ${user.email}: ${capErr.message}`);
          }
        }

        // Delete user's projects and deployments
        const projectCount = await Project.countDocuments({ owner: user._id });
        const deploymentCount = await Deployment.countDocuments({ userId: user._id });
        await Project.deleteMany({ owner: user._id });
        await Deployment.deleteMany({ userId: user._id });
        await User.findByIdAndDelete(user._id);

        results.deleted++;
        results.details.push({
          email: user.email,
          projects: projectCount,
          deployments: deploymentCount,
          containers: user.containerName ? 1 : 0
        });
      } catch (userErr) {
        results.failed++;
        logger.error(`Failed to delete suspended user ${user.email}:`, userErr);
      }
    }

    logger.info(`Cleanup: Deleted ${results.deleted} suspended users`, results);
    res.json({ success: true, results });
  } catch (error) {
    logger.error('Error deleting suspended users:', error);
    res.status(500).json({ success: false, error: 'Failed to delete suspended users' });
  }
});

// POST /api/admin/users/delete-all-soft-deleted — Bulk delete all soft-deleted users
router.post('/users/delete-all-soft-deleted', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { confirm } = req.body;
    if (confirm !== 'DELETE ALL SOFT DELETED') {
      return res.status(400).json({ success: false, error: 'Confirmation text required' });
    }

    const deletedUsers = await User.find({ status: 'deleted', role: { $ne: 'admin' } });
    const results = { deleted: 0, failed: 0, details: [] };

    for (const user of deletedUsers) {
      try {
        // Remove containers
        if (user.containerName && user.assignedServer) {
          try {
            const freeTierContainer = require('../services/freeTierContainer');
            await freeTierContainer.removeUserContainer(user);
          } catch (containerErr) {
            logger.warn(`Failed to remove container for ${user.email}: ${containerErr.message}`);
          }
        }

        // Deallocate server capacity
        if (user.assignedServer && user.allocatedResources) {
          try {
            const serverCap = await ServerCapacity.findOne({ serverName: user.assignedServer });
            if (serverCap) {
              await serverCap.deallocate({
                cpu: user.allocatedResources.cpu || 0,
                ram: user.allocatedResources.ram || 0,
                storage: user.allocatedResources.storage || 0,
                bandwidth: user.allocatedResources.bandwidth || 0
              });
            }
          } catch (capErr) {
            logger.warn(`Failed to deallocate capacity for ${user.email}: ${capErr.message}`);
          }
        }

        // Delete projects and deployments
        const projectCount = await Project.countDocuments({ owner: user._id });
        const deploymentCount = await Deployment.countDocuments({ userId: user._id });
        await Project.deleteMany({ owner: user._id });
        await Deployment.deleteMany({ userId: user._id });
        await User.findByIdAndDelete(user._id);

        results.deleted++;
        results.details.push({
          email: user.email,
          projects: projectCount,
          deployments: deploymentCount,
          containers: user.containerName ? 1 : 0
        });
      } catch (userErr) {
        results.failed++;
        logger.error(`Failed to delete soft-deleted user ${user.email}:`, userErr);
      }
    }

    logger.info(`Cleanup: Deleted ${results.deleted} soft-deleted users`, results);
    res.json({ success: true, results });
  } catch (error) {
    logger.error('Error deleting soft-deleted users:', error);
    res.status(500).json({ success: false, error: 'Failed to delete soft-deleted users' });
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

    try {
      await notify.accountSuspended(user, reason || 'Your account has been suspended by an administrator.');
      await notify.adminSuspendedUser(user);
    } catch (notifyErr) {
      logger.error('Suspend notification failed:', notifyErr.message);
    }

    res.json({ success: true, message: 'User suspended' });
  } catch (error) {
    logger.error('Suspend user error:', error);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

// Unsuspend User
router.put('/users/:userId/unsuspend', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate('plan');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const hadResourcesDeleted = user.resourcesDeleted;

    user.status = 'active';
    user.suspendedAt = null;
    user.suspensionReason = null;
    user.autoSuspended = false;
    await user.save();

    // If resources were previously deleted, reset the flags and attempt container allocation
    if (hadResourcesDeleted) {
      user.resourcesDeleted = false;
      user.resourcesDeletedAt = null;
      user.oracleAccountId = null;
      user.containerId = null;
      user.containerName = null;
      user.assignedServer = null;
      user.assignedPort = null;
      await user.save();

      logger.info(`User ${user.email} unsuspended with resource reset - new container will be allocated on next deployment`);
    } else {
      // Restart existing containers
      try {
        const accountLifecycle = require('../services/accountLifecycle');
        await accountLifecycle.restartUserContainers(user._id);
      } catch (containerErr) {
        logger.warn(`Could not restart containers for ${user.email}: ${containerErr.message}`);
      }
    }

    try {
      await notify.accountReactivated(user);
      await notify.adminUnsuspendedUser(user);
    } catch (notifyErr) {
      logger.error('Unsuspend notification failed:', notifyErr.message);
    }

    res.json({
      success: true,
      message: hadResourcesDeleted
        ? 'User unsuspended. Resources were deleted — new container will be allocated on next deployment.'
        : 'User unsuspended and containers restarted.'
    });
  } catch (error) {
    logger.error('Unsuspend user error:', error);
    res.status(500).json({ error: 'Failed to unsuspend user' });
  }
});

// Change Plan & Sync Resources
router.put('/users/:userId/plan', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { plan: planName } = req.body; // 'free', 'pro', etc.
    const user = await User.findById(req.params.userId).populate('plan');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newPlan = await Plan.findOne({ name: planName });
    if (!newPlan) return res.status(404).json({ error: 'Plan not found' });

    const oldPlanName = user.plan?.name || user.planType;

    // Update DB record
    user.plan = newPlan._id;
    user.planType = newPlan.name;
    user.resourceAllocation = newPlan.resources;
    user.displayedResources = newPlan.displayResources;
    await user.save();

    // IMMEDIATE: Update existing container resource limits (memory/CPU) in-place
    // This is the PRIMARY mechanism — fast and reliable, no restart needed
    let containerUpdateResult = null;
    if (user.containerName && user.assignedServer) {
      try {
        const docker = require('../services/docker');
        const host = process.env[`${user.assignedServer}_HOST`] || process.env.EC3_SERVER_IP;
        const ramGB = newPlan.actualResources?.ram || newPlan.resources?.ram || 0.5;
        const cpu = newPlan.actualResources?.cpu || newPlan.resources?.cpu || 0.5;
        const memoryMB = ramGB * 1024; // GB to MB

        containerUpdateResult = await docker.updateContainerResources(user.containerName, {
          memory: memoryMB,
          cpu: cpu
        }, host);

        if (containerUpdateResult.success) {
          logger.info(`✅ Container ${user.containerName} resources updated immediately: ${memoryMB}MB RAM, ${cpu} CPU`);
        } else {
          logger.warn(`⚠️ Container ${user.containerName} in-place update failed: ${containerUpdateResult.error}`);
        }
      } catch (dockerErr) {
        logger.warn(`⚠️ Direct container update failed for ${user.email}: ${dockerErr.message}`);
      }
    }

    // BACKGROUND: Full migration (creates new container if architecture change needed)
    // This handles shared↔dedicated transitions, data migration, Nginx updates
    logger.info(`Admin triggering container upgrade for ${user.email} due to plan change: ${oldPlanName} -> ${newPlan.name}`);
    containerUpgrade.upgradeUserContainer(user._id, oldPlanName, newPlan.name)
      .catch(err => logger.error(`Background container upgrade failed for ${user.email}:`, err));

    // Build admin-facing message with resource update details
    let resourceMsg = '';
    if (!user.containerName || !user.assignedServer) {
      resourceMsg = ' No active container found — resources will apply on next deployment.';
    } else if (containerUpdateResult?.success) {
      const ramGB = newPlan.actualResources?.ram || newPlan.resources?.ram || 0.5;
      const cpu = newPlan.actualResources?.cpu || newPlan.resources?.cpu || 0.5;
      resourceMsg = ` ✅ Container resources updated: ${ramGB * 1024}MB RAM, ${cpu} CPU.`;
    } else {
      resourceMsg = ` ⚠️ Container resource update failed: ${containerUpdateResult?.error || 'Unknown error'}. Background migration in progress.`;
    }

    res.json({
      success: true,
      message: `Plan updated to ${newPlan.displayName}.${resourceMsg}`,
      containerUpdate: containerUpdateResult || { skipped: true, reason: 'No active container' },
      user: {
        id: user._id,
        plan: newPlan.name,
        status: user.status
      }
    });
  } catch (error) {
    logger.error('Change plan error:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// Delete User (Soft) — stops containers, blocks login, 15-day recovery
router.delete('/users/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Protect admin accounts from deletion
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete admin accounts' });
    }

    // Protect flagged accounts
    if (user.isProtected) {
      return res.status(403).json({ error: 'This account is protected. Remove protection first.' });
    }

    // Stop user's Docker container to free resources
    if (user.containerName && user.assignedServer) {
      try {
        const freeTierContainer = require('../services/freeTierContainer');
        await freeTierContainer.suspendUserContainer(user);
        logger.info(`Suspended container for soft-deleted user ${user.email}`);
      } catch (containerErr) {
        logger.warn(`Failed to suspend container for ${user.email}: ${containerErr.message}`);
      }
    }

    user.status = 'deleted';
    user.deletedAt = new Date();
    user.recoveryDeadline = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days
    await user.save();

    // Force-logout the deleted user's active browser session via WebSocket
    try {
      const websocketService = require('../services/websocket');
      const io = websocketService.getIO();
      if (io) {
        io.to(`user-${user._id}`).emit('force-logout', {
          reason: 'Your account has been deleted by an administrator.'
        });
      }
    } catch (wsErr) {
      logger.warn(`Failed to emit force-logout for ${user.email}: ${wsErr.message}`);
    }

    // Force-logout the deleted user's active browser session via WebSocket
    try {
      const websocketService = require('../services/websocket');
      const io = websocketService.getIO();
      if (io) {
        io.to(`user-${user._id}`).emit('force-logout', {
          reason: 'Your account has been deleted by an administrator.'
        });
      }
    } catch (wsErr) {
      logger.warn(`Failed to emit force-logout for ${user.email}: ${wsErr.message}`);
    }

    res.json({ success: true, message: 'User soft-deleted. Container stopped. 15-day recovery period.' });
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

// Recover User — restores account and restarts containers
router.put('/users/:userId/recover', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.status !== 'deleted') return res.status(400).json({ error: 'User is not deleted' });

    user.status = 'active';
    user.deletedAt = null;
    user.recoveryDeadline = null;
    user.recoveredAt = new Date();
    await user.save();

    // Restart user's Docker container and restore PM2 processes
    if (user.containerName && user.assignedServer) {
      try {
        const freeTierContainer = require('../services/freeTierContainer');
        await freeTierContainer.reactivateUserContainer(user);
        logger.info(`Reactivated container for recovered user ${user.email}`);
      } catch (containerErr) {
        logger.warn(`Could not reactivate container for ${user.email}: ${containerErr.message}`);
      }
    }

    res.json({ success: true, message: 'User recovered. Container restarted.' });
  } catch (error) {
    logger.error('Recover user error:', error);
    res.status(500).json({ error: 'Failed to recover user' });
  }
});

// Hard Delete User (Permanent) — removes ALL data, projects, deployments, containers
router.delete('/users/:userId/permanent', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot permanently delete admin accounts' });
    }

    if (user.isProtected) {
      return res.status(403).json({ error: 'This account is protected. Remove protection first.' });
    }

    const cleanup = { containers: 0, projects: 0, deployments: 0 };

    // 1. Remove Docker container from server
    if (user.containerName && user.assignedServer) {
      try {
        const freeTierContainer = require('../services/freeTierContainer');
        await freeTierContainer.removeUserContainer(user);
        cleanup.containers = 1;
        logger.info(`Removed container for permanently deleted user ${user.email}`);
      } catch (containerErr) {
        logger.warn(`Failed to remove container for ${user.email}: ${containerErr.message}`);
      }
    }

    // 2. Deallocate server capacity
    if (user.assignedServer && user.allocatedResources) {
      try {
        const serverCap = await ServerCapacity.findOne({ serverName: user.assignedServer });
        if (serverCap) {
          await serverCap.deallocate({
            cpu: user.allocatedResources.cpu || 0,
            ram: user.allocatedResources.ram || 0,
            storage: user.allocatedResources.storage || 0,
            bandwidth: user.allocatedResources.bandwidth || 0
          });
        }
      } catch (capErr) {
        logger.warn(`Failed to deallocate capacity for ${user.email}: ${capErr.message}`);
      }
    }

    // 3. Delete all projects and deployments from DB
    cleanup.projects = await Project.countDocuments({ owner: user._id });
    cleanup.deployments = await Deployment.countDocuments({ userId: user._id });
    await Project.deleteMany({ owner: user._id });
    await Deployment.deleteMany({ userId: user._id });

    // 4. Force-logout the user's active browser session via WebSocket BEFORE deleting
    try {
      const websocketService = require('../services/websocket');
      const io = websocketService.getIO();
      if (io) {
        io.to(`user-${user._id}`).emit('force-logout', {
          reason: 'Your account has been permanently deleted.'
        });
      }
    } catch (wsErr) {
      logger.warn(`Failed to emit force-logout for ${user.email}: ${wsErr.message}`);
    }

    // 5. Delete user record permanently
    await User.findByIdAndDelete(user._id);

    logger.info(`PERMANENT DELETE: ${user.email} — ${cleanup.projects} projects, ${cleanup.deployments} deployments, ${cleanup.containers} containers removed`);

    res.json({
      success: true,
      message: `User ${user.email} permanently deleted`,
      cleanup
    });
  } catch (error) {
    logger.error('Permanent delete user error:', error);
    res.status(500).json({ error: 'Failed to permanently delete user' });
  }
});

// --- Plan Management Routes ---

// Get all plans
router.get('/plans', requireAuth, requireAdmin, async (req, res) => {
  try {
    const plans = await Plan.find().sort({ sortOrder: 1 });
    res.json({ success: true, plans });
  } catch (error) {
    logger.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Get single plan
router.get('/plans/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ success: true, plan });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

// Create Plan
router.post('/plans', requireAuth, requireAdmin, async (req, res) => {
  try {
    const planData = req.body;
    logger.info('Attempting to create plan:', { ...planData, features: planData.features?.length }); // Log data
    const plan = new Plan(planData);
    await plan.save();
    res.json({ success: true, plan });
  } catch (error) {
    logger.error('Create plan error:', error);
    // Be verbose about validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      logger.error('Validation Messages:', messages);
      return res.status(400).json({ error: 'Validation Error', details: messages });
    }
    res.status(500).json({ error: 'Failed to create plan', details: error.message });
  }
});

// Update Plan
router.put('/plans/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ success: true, plan });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// Delete Plan
router.delete('/plans/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    // Check if any users are on this plan
    const userCount = await User.countDocuments({ plan: plan._id });
    if (userCount > 0) {
      return res.status(400).json({ error: `Cannot delete plan. ${userCount} users are still assigned to it.` });
    }

    await Plan.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Plan deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete plan' });
  }
});

// Sync all users on a plan to updated resources
router.post('/plans/:id/sync', requireAuth, requireAdmin, async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const users = await User.find({ plan: plan._id });

    logger.info(`Mass syncing resources for ${users.length} users on plan ${plan.name}`);

    // Trigger upgrades in batches or sequentially
    // For now, we fire them all off. In a massive system, we'd use a queue (Bull).
    // Trigger upgrades and wait for results
    const results = await Promise.all(users.map(user =>
      containerUpgrade.upgradeUserContainer(user._id, plan.name, plan.name)
        .catch(err => ({ success: false, userId: user._id, error: err.message }))
    ));

    const stats = {
      total: users.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success && (!r.skippedCount || r.error)).length,
      skippedDeployments: results.reduce((sum, r) => sum + (r.skippedCount || 0), 0),
      zombies: results.filter(r => !r.success && !(r.migratedDeployments > 0)).length
    };

    logger.info(`Sync stats: ${JSON.stringify(stats)}`);

    res.json({
      success: true,
      message: `Sync Complete: ${stats.success} updated, ${stats.failed} failed, ${stats.zombies} no-deployment/zombies found.`,
      usersAffected: users.length,
      details: stats
    });
  } catch (error) {
    logger.error('Plan sync error:', error);
    res.status(500).json({ error: 'Failed to sync users for plan' });
  }
});

// --- Infrastructure Scanning & Pruning ---

// Scan for Orphans and Zombies
router.get('/infra/scan', requireAuth, requireAdmin, async (req, res) => {
  try {
    const servers = ['EC2', 'EC3']; // Could dynamic list from ORACLE_SERVERS keys
    const infraData = {
      orphans: [],
      zombies: [],
      active: [],
      stats: {
        totalContainers: 0,
        orphanCount: 0,
        zombieCount: 0,
        serverUsage: {}
      }
    };

    // 1. Get all containers from all servers
    const serverContainers = {};
    for (const sKey of servers) {
      try {
        const host = ORACLE_SERVERS[sKey]?.host;
        if (!host) continue;

        const containers = await docker.listContainers(host, true);
        serverContainers[sKey] = containers;
        infraData.stats.totalContainers += containers.length;
        infraData.stats.serverUsage[sKey] = containers.length;
      } catch (err) {
        logger.error(`Failed to scan server ${sKey}:`, err.message);
      }
    }

    // 2. Get all users from DB that should have containers
    const users = await User.find({
      containerName: { $exists: true, $ne: null }
    }).select('email username containerName assignedServer status');

    const dbContainerMap = new Map();
    users.forEach(u => dbContainerMap.set(u.containerName, u));

    // 3. Find Orphans (On server but not in DB)
    for (const [sKey, containers] of Object.entries(serverContainers)) {
      for (const c of containers) {
        const name = c.Names[0].replace(/^\//, '');

        // We only care about user containers or our system containers
        if (!name.startsWith('EC2-') && !name.startsWith('EC3-')) continue;

        if (!dbContainerMap.has(name)) {
          infraData.orphans.push({
            name,
            server: sKey,
            image: c.Image,
            status: c.Status,
            state: c.State,
            created: new Date(c.Created * 1000)
          });
        } else {
          dbContainerMap.delete(name); // Remove found containers from map
          infraData.active.push({
            name,
            server: sKey,
            user: users.find(u => u.containerName === name)?.email
          });
        }
      }
    }

    // 4. Remaining items in dbContainerMap are Zombies (In DB but not on server)
    dbContainerMap.forEach((user, name) => {
      infraData.zombies.push({
        name,
        email: user.email,
        userId: user._id,
        assignedServer: user.assignedServer,
        userStatus: user.status
      });
    });

    infraData.stats.orphanCount = infraData.orphans.length;
    infraData.stats.zombieCount = infraData.zombies.length;

    res.json({ success: true, ...infraData });
  } catch (error) {
    logger.error('Infra scan error:', error);
    res.status(500).json({ error: 'Failed to scan infrastructure' });
  }
});

// Force delete any container from any server
router.delete('/infra/containers/:server/:name', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { server: sKey, name } = req.params;
    const host = ORACLE_SERVERS[sKey]?.host;

    if (!host) return res.status(400).json({ error: 'Invalid server' });

    logger.warn(`Admin force deleting container ${name} from ${sKey}`);

    await docker.stopContainer(name, host).catch(() => { });
    await docker.removeContainer(name, host);

    res.json({ success: true, message: `Container ${name} pruned from ${sKey}` });
  } catch (error) {
    logger.error('Force delete error:', error);
    res.status(500).json({ error: `Failed to delete container: ${error.message}` });
  }
});

// Force rebuild project
router.post('/projects/:id/rebuild', requireAuth, requireAdmin, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Create a new deployment record
    const deployment = await Deployment.create({
      projectId: project._id,
      userId: project.owner,
      branch: project.repository?.branch || 'main',
      commitSha: `admin_rebuild_${Date.now()}`,
      commitMessage: 'Force rebuild triggered by Administrator',
      status: 'queued',
      environment: 'production',
      trigger: 'manual'
    });

    // Add to build queue
    await buildQueue.addDeployment(
      deployment._id.toString(),
      project._id.toString(),
      project.owner.toString()
    );

    logger.info(`Admin triggered force rebuild for project ${project.name} (${project._id})`);

    res.json({
      success: true,
      message: 'Force rebuild queued',
      deploymentId: deployment._id
    });
  } catch (error) {
    logger.error('Force rebuild error:', error);
    res.status(500).json({ error: 'Failed to queue rebuild' });
  }
});

// Toggle Protection for User
router.put('/users/:id/protection', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { isProtected } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { isProtected }, { new: true });
    res.json({ success: true, isProtected: user.isProtected });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update protection' });
  }
});

// Toggle Protection for Project
router.put('/projects/:id/protection', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { isProtected } = req.body;
    const project = await Project.findByIdAndUpdate(req.params.id, { isProtected }, { new: true });
    res.json({ success: true, isProtected: project.isProtected });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update protection' });
  }
});

// Get detailed user container & resource info
router.get('/users/:id/containers', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('plan');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get user's deployments
    const deployments = await Deployment.find({
      userId: user._id,
      status: 'success'
    }).populate('projectId').sort({ createdAt: -1 }).limit(50);

    // Get user's projects
    const projects = await Project.find({ owner: user._id });

    // Get container stats if user has a container
    let containerStats = null;
    if (user.containerName && user.assignedServer) {
      try {
        const host = ORACLE_SERVERS[user.assignedServer]?.host;
        if (host) {
          const containers = await docker.listContainers(host, false);
          const userContainer = containers.find(c =>
            c.Names && c.Names[0] && c.Names[0].replace(/^\//, '') === user.containerName
          );

          if (userContainer) {
            // Get live stats
            const statsResult = await docker.getContainerStats(userContainer.Id, host);
            containerStats = {
              id: userContainer.Id,
              name: user.containerName,
              state: userContainer.State,
              status: userContainer.Status,
              created: new Date(userContainer.Created * 1000),
              image: userContainer.Image,
              stats: statsResult.success ? statsResult.stats : null
            };
          }
        }
      } catch (err) {
        logger.error(`Failed to fetch container stats for ${user.email}:`, err);
      }
    }

    // Calculate resource allocation
    const planResources = user.plan ? {
      cpu: user.plan.resources?.cpu || 0.5,
      ram: user.plan.resources?.ram || 0.5,
      storage: user.plan.resources?.storage || 10,
      bandwidth: user.plan.resources?.bandwidth || 100
    } : {
      cpu: 0.5,
      ram: 0.5,
      storage: 10,
      bandwidth: 100
    };

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        plan: user.plan?.name || user.planType,
        status: user.status,
        isProtected: user.isProtected
      },
      container: containerStats,
      resources: {
        allocated: planResources,
        current: user.currentUsage,
        percentages: {
          storage: user.currentUsage.storage / planResources.storage * 100,
          bandwidth: user.currentUsage.bandwidth / planResources.bandwidth * 100
        }
      },
      deployments: deployments.map(d => ({
        id: d._id,
        projectName: d.projectId?.name,
        status: d.status,
        url: d.url,
        createdAt: d.createdAt,
        containerId: d.containerId,
        port: d.port
      })),
      projects: projects.map(p => ({
        id: p._id,
        name: p.name,
        status: p.status,
        framework: p.framework
      })),
      stats: {
        totalProjects: projects.length,
        totalDeployments: deployments.length,
        activeDeployments: deployments.filter(d => d.status === 'success').length
      }
    });
  } catch (error) {
    logger.error('Get user containers error:', error);
    res.status(500).json({ error: 'Failed to fetch user container info' });
  }
});

// --- Capacity Management Routes ---

// Get Server Capacity Dashboard
router.get('/capacity', requireAuth, requireAdmin, async (req, res) => {
  try {
    const servers = await ServerCapacity.find({ isActive: true });

    // Calculate projections for each server
    const projections = servers.map(server => {
      const available = server.availableResources;
      const total = server.totalResources;
      const allocated = server.allocatedResources;
      const warnings = server.getWarnings();

      return {
        serverName: server.serverName,
        resources: {
          total,
          allocated,
          available,
          reserved: server.reservedResources
        },
        usage: server.usagePercentage,
        warnings,
        planLimits: server.planLimits,
        lastUpdated: server.lastUpdated
      };
    });

    res.json({ success: true, servers: projections });
  } catch (error) {
    logger.error('Capacity dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch capacity data' });
  }
});

// Update Plan Limits for a Server
router.put('/capacity/:serverName/limits', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { limits } = req.body; // Array of { planName, maxUsers }
    const server = await ServerCapacity.findOne({ serverName: req.params.serverName });

    if (!server) return res.status(404).json({ error: 'Server not found' });

    // Update limits
    limits.forEach(limit => {
      const existingLimit = server.planLimits.find(p => p.planName === limit.planName);
      if (existingLimit) {
        existingLimit.maxUsers = limit.maxUsers;
      } else {
        server.planLimits.push({ planName: limit.planName, maxUsers: limit.maxUsers });
      }
    });

    await server.save();

    // Recalculate projections
    // Get all plans to calculate theoretical max usage
    const plans = await Plan.find({ name: { $in: server.planLimits.map(l => l.planName) } });

    const projection = {
      reservedResources: { cpu: 0, ram: 0, storage: 0 },
      maxUsersTotal: 0
    };

    server.planLimits.forEach(limit => {
      if (limit.maxUsers > 0) {
        const plan = plans.find(p => p.name === limit.planName);
        if (plan) {
          projection.reservedResources.cpu += plan.resources.cpu * limit.maxUsers;
          projection.reservedResources.ram += plan.resources.ram * limit.maxUsers;
          projection.reservedResources.storage += plan.resources.storage * limit.maxUsers;
          projection.maxUsersTotal += limit.maxUsers;
        }
      }
    });

    res.json({
      success: true,
      server,
      projection: {
        totalPotentiallyUsed: projection.reservedResources,
        remainingAfterLimits: {
          cpu: server.totalResources.cpu - server.reservedResources.cpu - projection.reservedResources.cpu,
          ram: server.totalResources.ram - server.reservedResources.ram - projection.reservedResources.ram,
          storage: server.totalResources.storage - server.reservedResources.storage - projection.reservedResources.storage
        }
      }
    });


  } catch (error) {
    logger.error('Update limits error:', error);
    res.status(500).json({ error: 'Failed to update limits' });
  }
});

// ==================== PLAN MANAGEMENT ROUTES ====================

// Get all plans
router.get('/plans', requireAuth, requireAdmin, async (req, res) => {
  try {
    const plans = await Plan.find({}).sort({ 'pricing.usd': 1 });

    // Get user count for each plan
    const plansWithUserCount = await Promise.all(
      plans.map(async (plan) => {
        const userCount = await User.countDocuments({ plan: plan._id });
        return {
          ...plan.toObject(),
          activeUsers: userCount
        };
      })
    );

    res.json({
      success: true,
      plans: plansWithUserCount
    });
  } catch (error) {
    logger.error('Get plans error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }
});

// Get single plan
router.get('/plans/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const userCount = await User.countDocuments({ plan: plan._id });

    res.json({
      success: true,
      plan: {
        ...plan.toObject(),
        activeUsers: userCount
      }
    });
  } catch (error) {
    logger.error('Get plan error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plan' });
  }
});

// Create new plan
router.post('/plans', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      displayName,
      description,
      pricing,
      resources,
      features,
      isTrial,
      isActive,
      billingCycle,
      oracleConfig
    } = req.body;

    // Validate required fields
    if (!name || !displayName || !description || !pricing || !resources) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, displayName, description, pricing, resources'
      });
    }

    // Check if plan name already exists
    const existing = await Plan.findOne({ name });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Plan with name "${name}" already exists`
      });
    }

    const plan = new Plan({
      name,
      displayName,
      description,
      pricing,
      resources,
      features: features || [],
      isTrial: isTrial || false,
      isActive: isActive !== undefined ? isActive : true,
      billingCycle: billingCycle || 'monthly',
      oracleConfig: oracleConfig || { accountType: 'shared' },
      paddlePriceIds: req.body.paddlePriceIds || undefined
    });

    await plan.save();

    logger.info('Plan created by admin', {
      adminId: req.user._id,
      planId: plan._id,
      planName: plan.name
    });

    res.status(201).json({
      success: true,
      plan,
      message: 'Plan created successfully'
    });
  } catch (error) {
    logger.error('Create plan error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create plan'
    });
  }
});

// Update plan
router.put('/plans/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    // Check how many users are on this plan
    const userCount = await User.countDocuments({ plan: plan._id });

    const {
      displayName,
      description,
      pricing,
      resources,
      features,
      isActive,
      billingCycle,
      oracleConfig,
      paddlePriceIds
    } = req.body;

    // Update allowed fields
    if (displayName) plan.displayName = displayName;
    if (description) plan.description = description;
    if (pricing) plan.pricing = pricing;
    if (resources) plan.resources = resources;
    if (features) plan.features = features;
    if (isActive !== undefined) plan.isActive = isActive;
    if (billingCycle) plan.billingCycle = billingCycle;
    if (oracleConfig) plan.oracleConfig = oracleConfig;
    if (paddlePriceIds) plan.paddlePriceIds = paddlePriceIds;

    await plan.save();

    logger.info('Plan updated by admin', {
      adminId: req.user._id,
      planId: plan._id,
      planName: plan.name,
      affectedUsers: userCount
    });

    res.json({
      success: true,
      plan,
      message: `Plan updated successfully. ${userCount} users affected.`
    });
  } catch (error) {
    logger.error('Update plan error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update plan'
    });
  }
});

// Delete (deactivate) plan
router.delete('/plans/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    // Check if any users are using this plan
    const userCount = await User.countDocuments({ plan: plan._id });

    if (userCount > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete plan "${plan.name}". ${userCount} users are currently using this plan.`,
        affectedUsers: userCount,
        suggestion: 'Deactivate the plan instead or migrate users to another plan first.'
      });
    }

    // Safe to delete since no users
    await plan.deleteOne();

    logger.warn('Plan deleted by admin', {
      adminId: req.user._id,
      planId: plan._id,
      planName: plan.name
    });

    res.json({
      success: true,
      message: `Plan "${plan.name}" deleted successfully`
    });
  } catch (error) {
    logger.error('Delete plan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete plan'
    });
  }
});

// ==================== SERVER MANAGEMENT ROUTES ====================

// Get all servers with real-time stats
router.get('/servers', requireAuth, requireAdmin, async (req, res) => {
  try {
    const servers = ['EC2', 'EC3'];

    const serverStats = await Promise.all(
      servers.map(async (serverKey) => {
        const stats = await getRemoteSystemStats(serverKey);
        const utilization = await getServerUtilization(serverKey);

        // Count containers on this server
        const containerCount = await User.countDocuments({ assignedServer: serverKey });

        return {
          serverKey,
          serverInfo: ORACLE_SERVERS[serverKey],
          systemStats: stats || { success: false, error: 'Unable to fetch stats' },
          utilization: utilization || { success: false },
          containerCount,
          isOnline: stats?.success || false
        };
      })
    );

    res.json({
      success: true,
      servers: serverStats,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Get servers error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch server stats' });
  }
});

// Get specific server details
router.get('/servers/:serverKey', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { serverKey } = req.params;

    if (!ORACLE_SERVERS[serverKey]) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    const [stats, utilization] = await Promise.all([
      getRemoteSystemStats(serverKey),
      getServerUtilization(serverKey)
    ]);

    // Get all users on this server
    const users = await User.find({ assignedServer: serverKey })
      .select('_id email username containerName resourceAllocation currentResourceUsage')
      .limit(100);

    res.json({
      success: true,
      server: {
        key: serverKey,
        info: ORACLE_SERVERS[serverKey],
        stats,
        utilization,
        users: {
          count: users.length,
          list: users
        }
      }
    });
  } catch (error) {
    logger.error('Get server details error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch server details' });
  }
});

// Get detailed Docker stats for a server
router.get('/servers/:serverKey/docker-stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { serverKey } = req.params;
    const server = ORACLE_SERVERS[serverKey];

    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    // Fetch system info, container list, and REAL resource stats in parallel
    const [systemInfo, containersResult, realStats] = await Promise.all([
      getRemoteSystemStats(serverKey),
      docker.listContainers(server.host, true), // true = all containers
      getRemoteDockerStats(serverKey) // SSH-based real stats
    ]);

    if (!containersResult.success) {
      throw new Error(containersResult.error || 'Failed to list containers');
    }

    // Create a map of real stats for easy lookup (key = container name)
    const statsMap = {};
    if (realStats && Array.isArray(realStats)) {
      realStats.forEach(stat => {
        statsMap[stat.name] = stat;
      });
    }

    // Process containers using real stats where available
    const containerList = containersResult.containers.map(c => {
      const name = c.names[0].replace(/^\//, ''); // Remove leading slash
      const realStat = statsMap[name];

      // Default empty stats
      let stats = {
        cpu: '0%',
        memory: { usage: '0 MB', limit: '0 GB', percent: '0%' },
        network: { rx: '0 MB', tx: '0 MB' }
      };

      // Populate if available (usually only for running containers)
      if (realStat) {
        // Parse Memory string "18.36MiB / 7.63GiB"
        let memUsage = realStat.memUsage || '0B / 0B';
        let [usage, limit] = memUsage.split(' / ');

        // Parse Net I/O "1.2kB / 0B"
        let netIO = realStat.netIO || '0B / 0B';
        let [rx, tx] = netIO.split(' / ');

        stats = {
          cpu: realStat.cpu || '0%',
          memory: {
            usage: usage || '0B',
            limit: limit || '0B',
            percent: realStat.memPerc || '0%'
          },
          network: {
            rx: rx || '0B',
            tx: tx || '0B'
          }
        };
      }

      return {
        id: c.id.substring(0, 12),
        name: name,
        image: c.image,
        state: c.state,
        status: c.status,
        stats: stats
      };
    });

    // --- Resolve user details from container names ---
    // Container names follow pattern: EC2-user-{mongoObjectId}
    const userIdMap = {};
    containerList.forEach(c => {
      const match = c.name.match(/^EC\d+-user-([a-f0-9]{24})$/i);
      if (match) userIdMap[match[1]] = c.name;
    });

    const userIds = Object.keys(userIdMap);
    let usersMap = {};
    if (userIds.length > 0) {
      try {
        const users = await User.find({ _id: { $in: userIds } })
          .select('_id email displayName username planType status createdAt')
          .lean();
        users.forEach(u => {
          usersMap[u._id.toString()] = {
            email: u.email,
            displayName: u.displayName || u.username || 'Unknown',
            plan: u.planType || 'free',
            status: u.status || 'active',
            createdAt: u.createdAt
          };
        });
      } catch (e) {
        logger.warn('Failed to lookup users for containers:', e.message);
      }
    }

    // Attach user info to each container
    const enrichedList = containerList.map(c => {
      const match = c.name.match(/^EC\d+-user-([a-f0-9]{24})$/i);
      const userId = match ? match[1] : null;
      return {
        ...c,
        userId: userId,
        user: userId && usersMap[userId] ? usersMap[userId] : null
      };
    });

    const running = enrichedList.filter(c => c.state === 'running').length;

    res.json({
      success: true,
      docker: {
        containers: {
          total: enrichedList.length,
          running,
          stopped: enrichedList.length - running,
          list: enrichedList
        },
        system: systemInfo.success ? {
          version: systemInfo.version || 'Unknown',
          operatingSystem: systemInfo.os || 'Linux',
          cpus: systemInfo.cpuCount || 0,
          totalMemory: systemInfo.totalMem || 'Unknown',
        } : {
          version: 'Unreachable',
          operatingSystem: 'Unreachable',
          cpus: 0,
          totalMemory: '0 GB'
        }
      }
    });
  } catch (error) {
    logger.error('Get Docker stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch Docker stats' });
  }
});

// ==================== SERVER CAPACITY MANAGEMENT ====================

// Get server capacity configuration
router.get('/servers/:serverKey/capacity', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { serverKey } = req.params;

    if (!['EC2', 'EC3'].includes(serverKey)) {
      return res.status(400).json({ success: false, error: 'Invalid server key' });
    }

    let capacity = await ServerCapacity.findOne({ serverName: serverKey });

    // Create if doesn't exist
    if (!capacity) {
      const defaults = {
        EC2: { cpu: 4, ram: 24, storage: 200, bandwidth: 5000 },
        EC3: { cpu: 8, ram: 48, storage: 400, bandwidth: 10000 }
      };

      capacity = new ServerCapacity({
        serverName: serverKey,
        totalResources: defaults[serverKey]
      });
      await capacity.save();
    }

    // Get current user counts per plan
    const planCounts = await User.aggregate([
      { $match: { assignedServer: serverKey } },
      {
        $lookup: {
          from: 'plans',
          localField: 'plan',
          foreignField: '_id',
          as: 'planInfo'
        }
      },
      { $unwind: { path: '$planInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$planInfo.name',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      capacity: {
        ...capacity.toObject(),
        availableResources: capacity.availableResources,
        usagePercentage: capacity.usagePercentage,
        warnings: capacity.getWarnings(),
        currentPlanCounts: planCounts
      }
    });
  } catch (error) {
    logger.error('Get capacity error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch capacity' });
  }
});

// Update server total resources
router.put('/servers/:serverKey/capacity/resources', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { serverKey } = req.params;
    const { totalResources, reservedResources, warningThresholds, overselling } = req.body;

    let capacity = await ServerCapacity.findOne({ serverName: serverKey });
    if (!capacity) {
      return res.status(404).json({ success: false, error: 'Server capacity not found' });
    }

    // Update total resources
    if (totalResources) {
      capacity.totalResources = { ...capacity.totalResources, ...totalResources };
    }

    // Update reserved resources
    if (reservedResources) {
      capacity.reservedResources = { ...capacity.reservedResources, ...reservedResources };
    }

    // Update warning thresholds
    if (warningThresholds) {
      capacity.warningThresholds = { ...capacity.warningThresholds, ...warningThresholds };
    }

    // Update overselling settings
    if (overselling) {
      capacity.overselling = { ...capacity.overselling, ...overselling };
    }

    await capacity.save();

    logger.info('Server capacity updated', {
      adminId: req.user._id,
      serverKey,
      changes: { totalResources, reservedResources, warningThresholds, overselling }
    });

    res.json({
      success: true,
      capacity: {
        ...capacity.toObject(),
        availableResources: capacity.availableResources,
        usagePercentage: capacity.usagePercentage
      },
      message: `${serverKey} capacity updated successfully`
    });
  } catch (error) {
    logger.error('Update capacity error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update plan limits (max users per plan per server)
router.put('/servers/:serverKey/capacity/plan-limits', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { serverKey } = req.params;
    const { planName, maxUsers, priority } = req.body;

    if (!planName) {
      return res.status(400).json({ success: false, error: 'planName is required' });
    }

    let capacity = await ServerCapacity.findOne({ serverName: serverKey });
    if (!capacity) {
      return res.status(404).json({ success: false, error: 'Server capacity not found' });
    }

    // Find or create plan limit
    let planLimit = capacity.planLimits.find(p => p.planName === planName);

    if (planLimit) {
      // Update existing
      if (maxUsers !== undefined) planLimit.maxUsers = maxUsers;
      if (priority !== undefined) planLimit.priority = priority;
    } else {
      // Add new
      capacity.planLimits.push({
        planName,
        maxUsers: maxUsers || -1,
        currentUsers: 0,
        priority: priority || 5
      });
    }

    await capacity.save();

    // Get current user count for this plan
    const currentCount = await User.countDocuments({
      assignedServer: serverKey,
      planType: planName
    });

    logger.info('Plan limit updated', {
      adminId: req.user._id,
      serverKey,
      planName,
      maxUsers,
      currentUsers: currentCount
    });

    res.json({
      success: true,
      capacity,
      currentUsers: currentCount,
      message: `Plan limit for "${planName}" updated on ${serverKey}`
    });
  } catch (error) {
    logger.error('Update plan limit error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Calculate capacity for a plan
router.post('/servers/:serverKey/capacity/calculate', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { serverKey } = req.params;
    const { planResources } = req.body;

    if (!planResources || !planResources.cpu || !planResources.ram) {
      return res.status(400).json({
        success: false,
        error: 'Plan resources required (cpu, ram, storage, bandwidth)'
      });
    }

    const result = await ServerCapacity.calculatePlanCapacity(serverKey, planResources);

    res.json(result);
  } catch (error) {
    logger.error('Calculate capacity error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate capacity' });
  }
});

// Get detailed Docker stats for a server
router.get('/servers/:serverKey/docker-stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { serverKey } = req.params;

    if (!ORACLE_SERVERS[serverKey]) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    const host = ORACLE_SERVERS[serverKey].host;
    const dockerClient = docker.getDockerClient(host);

    // Get all containers
    const containers = await dockerClient.listContainers({ all: true });

    // Get detailed stats for each container
    const containerStats = await Promise.all(
      containers.map(async (containerInfo) => {
        try {
          const container = dockerClient.getContainer(containerInfo.Id);

          // Get stats (1 second sample)
          const stats = await container.stats({ stream: false });

          // Calculate CPU %
          const cpuDelta = stats.cpu_stats.cpu_usage.total_usage -
            (stats.precpu_stats.cpu_usage?.total_usage || 0);
          const systemDelta = stats.cpu_stats.system_cpu_usage -
            (stats.precpu_stats.system_cpu_usage || 0);
          const cpuPercent = systemDelta > 0
            ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100
            : 0;

          // Calculate Memory %
          const memUsage = stats.memory_stats.usage || 0;
          const memLimit = stats.memory_stats.limit || 1;
          const memPercent = (memUsage / memLimit) * 100;

          // Network I/O
          const networks = stats.networks || {};
          const networkIO = Object.values(networks).reduce((acc, net) => ({
            rx_bytes: acc.rx_bytes + (net.rx_bytes || 0),
            tx_bytes: acc.tx_bytes + (net.tx_bytes || 0)
          }), { rx_bytes: 0, tx_bytes: 0 });

          return {
            id: containerInfo.Id.substring(0, 12),
            name: containerInfo.Names[0]?.replace(/^\//, ''),
            image: containerInfo.Image,
            state: containerInfo.State,
            status: containerInfo.Status,
            created: new Date(containerInfo.Created * 1000),
            stats: {
              cpu: cpuPercent.toFixed(2) + '%',
              memory: {
                usage: (memUsage / 1024 / 1024).toFixed(2) + ' MB',
                limit: (memLimit / 1024 / 1024).toFixed(2) + ' MB',
                percent: memPercent.toFixed(2) + '%'
              },
              network: {
                rx: (networkIO.rx_bytes / 1024 / 1024).toFixed(2) + ' MB',
                tx: (networkIO.tx_bytes / 1024 / 1024).toFixed(2) + ' MB'
              },
              pids: stats.pids_stats?.current || 0
            }
          };
        } catch (statsError) {
          // If stats fail, return basic info
          return {
            id: containerInfo.Id.substring(0, 12),
            name: containerInfo.Names[0]?.replace(/^\//, ''),
            image: containerInfo.Image,
            state: containerInfo.State,
            status: containerInfo.Status,
            stats: { error: 'Stats unavailable (container may be stopped)' }
          };
        }
      })
    );

    // Get Docker system info
    const systemInfo = await dockerClient.info();

    res.json({
      success: true,
      server: serverKey,
      docker: {
        containers: {
          total: containerStats.length,
          running: containerStats.filter(c => c.state === 'running').length,
          stopped: containerStats.filter(c => c.state === 'exited').length,
          list: containerStats
        },
        system: {
          version: systemInfo.ServerVersion,
          kernelVersion: systemInfo.KernelVersion,
          operatingSystem: systemInfo.OperatingSystem,
          architecture: systemInfo.Architecture,
          cpus: systemInfo.NCPU,
          totalMemory: (systemInfo.MemTotal / 1024 / 1024 / 1024).toFixed(2) + ' GB',
          images: systemInfo.Images,
          driver: systemInfo.Driver
        }
      },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Get Docker stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Docker stats',
      details: error.message
    });
  }
});

// ==================== ADMIN PROJECT REBUILD ====================

// Force rebuild a project (admin only)
router.post('/projects/:projectId/rebuild', requireAuth, requireAdmin, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId).populate('userId', 'username email');
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Create a new deployment record
    const deployment = await Deployment.create({
      projectId: project._id,
      userId: project.userId._id || project.userId,
      branch: project.repository?.branch || 'main',
      commitSha: `admin_rebuild_${Date.now()}`,
      commitMessage: `Admin force rebuild by ${req.user.email}`,
      status: 'queued',
      isPreview: false,
      environment: 'production',
      trigger: 'admin'
    });

    // Add to build queue with high priority
    await buildQueue.addDeployment(
      deployment._id.toString(),
      project._id.toString(),
      (project.userId._id || project.userId).toString(),
      { priority: 1 }
    );

    logger.info('Admin force rebuild queued', {
      projectId: project._id,
      deploymentId: deployment._id,
      adminUser: req.user.email
    });

    res.json({
      success: true,
      deployment,
      message: 'Rebuild queued successfully'
    });
  } catch (error) {
    logger.error('Admin rebuild error:', error);
    res.status(500).json({ success: false, error: 'Failed to queue rebuild' });
  }
});

// Get deployment queue stats
router.get('/deployment-queue/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const queueStats = await buildQueue.getQueueStats();
    const activeJobs = await buildQueue.getActiveJobs();
    const waitingJobs = await buildQueue.getWaitingJobs();

    res.json({
      success: true,
      queue: {
        stats: queueStats,
        active: activeJobs.map(job => ({
          id: job.id,
          deploymentId: job.data.deploymentId,
          projectId: job.data.projectId,
          userId: job.data.userId,
          progress: job.progress,
          timestamp: job.timestamp,
          attemptsMade: job.attemptsMade
        })),
        waiting: waitingJobs.map(job => ({
          id: job.id,
          deploymentId: job.data.deploymentId,
          projectId: job.data.projectId,
          userId: job.data.userId,
          priority: job.opts.priority,
          timestamp: job.timestamp
        }))
      }
    });
  } catch (error) {
    logger.error('Get queue stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch queue stats' });
  }
});

// ==================== MANUAL PAYMENT MANAGEMENT ====================

const ManualPayment = require('../models/ManualPayment');
const Payment = require('../models/Payment');

// Get all manual payments (admin)
router.get('/manual-payments', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status = 'all', page = 1, limit = 20 } = req.query;
    const result = await ManualPayment.getAllPayments({
      status,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    // Count pending for badge
    const pendingCount = await ManualPayment.countDocuments({ status: 'pending' });

    res.json({
      success: true,
      payments: result.payments,
      pendingCount,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    logger.error('Admin get manual payments error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch manual payments' });
  }
});

// Verify (approve) manual payment
router.post('/manual-payments/:id/verify', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { notes } = req.body;
    const payment = await ManualPayment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({ success: false, error: `Payment is already ${payment.status}` });
    }

    // Verify the payment
    await payment.verify(req.user._id, notes);

    // Upgrade the user's plan
    const user = await User.findById(payment.user);
    const plan = await Plan.findById(payment.plan);

    if (user && plan) {
      if (user.resourcesDeleted) {
        user.resourcesDeleted = false;
        user.resourcesDeletedAt = null;
        user.oracleAccountId = null;
        user.containerId = null;
        user.containerName = null;
        user.assignedServer = null;
        user.assignedPort = null;
      }
      user.plan = plan._id;
      user.planType = plan.isTrial || plan.pricing.usd === 0 ? 'free' : plan.name;
      user.subscriptionStatus = 'active';
      user.status = 'active';
      user.isTrialActive = false;
      user.suspendedAt = null;
      user.suspensionReason = null;
      user.autoSuspended = false;

      // Clear deletion scheduling on reactivation
      user.scheduledDeletionAt = null;
      user.lastDeletionWarning = null;
      user.scheduledDowngradeTo = null;
      user.scheduledDowngradeAt = null;

      // Update resource allocation to match new plan
      if (plan.resources) {
        user.resourceAllocation = {
          cpu: plan.resources.cpu,
          ram: plan.resources.ram,
          storage: plan.resources.storage,
          bandwidth: plan.resources.bandwidth || 1024,
          projects: plan.resources.projects || 10
        };
        user.displayedResources = {
          cpu: plan.displayResources?.cpu || plan.resources.cpu,
          ram: plan.displayResources?.ram || plan.resources.ram,
          storage: plan.displayResources?.storage || plan.resources.storage,
          bandwidth: plan.displayResources?.bandwidth || plan.resources.bandwidth || 1024,
          projects: plan.displayResources?.projects || plan.resources.projects || 10
        };
        user.allocatedResources = {
          cpu: plan.actualResources?.cpu || plan.resources.cpu,
          ram: plan.actualResources?.ram || plan.resources.ram,
          storage: plan.actualResources?.storage || plan.resources.storage,
          bandwidth: plan.actualResources?.bandwidth || plan.resources.bandwidth || 1024,
          projects: plan.actualResources?.projects || plan.resources.projects || 10
        };
      }

      // Set subscription expiry based on billing period
      const billingPeriodMonths = payment.billingPeriod || 1;
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + billingPeriodMonths);
      user.planExpiresAt = expiresAt;
      user.billingPeriod = billingPeriodMonths;
      user.gracePeriodEndsAt = null;
      user.lastRenewalReminder = null;

      await user.save();

      // Reactivate Docker container if user was suspended (restart container + PM2 processes)
      if (user.resourcesDeleted !== true) {
        try {
          const { reactivateUserContainer } = require('../services/freeTierContainer');
          await reactivateUserContainer(user);
          logger.info(`[VERIFY] Reactivated container for ${user.email}`);
        } catch (reactivateErr) {
          logger.warn(`[VERIFY] Container reactivation failed for ${user.email}: ${reactivateErr.message}`);
          // Don't fail the verify — container will be auto-created on next deploy
        }
      }

      // IMMEDIATE: Update container resource limits to match new plan
      if (user.containerName && user.assignedServer) {
        try {
          const docker = require('../services/docker');
          const host = process.env[`${user.assignedServer}_HOST`] || process.env.EC3_SERVER_IP;
          const ramGB = plan.actualResources?.ram || plan.resources?.ram || 0.5;
          const cpu = plan.actualResources?.cpu || plan.resources?.cpu || 0.5;
          await docker.updateContainerResources(user.containerName, { memory: ramGB * 1024, cpu }, host);
          logger.info(`[VERIFY] ✅ Container ${user.containerName} resources updated: ${ramGB * 1024}MB RAM, ${cpu} CPU`);
        } catch (dockerErr) {
          logger.warn(`[VERIFY] Container resource update failed for ${user.email}: ${dockerErr.message}`);
        }
      }

      // Also create a formal Payment record for billing history
      try {
        await Payment.create({
          user: user._id,
          amount: payment.amount,
          currency: payment.currency,
          status: 'completed',
          type: 'subscription',
          plan: plan._id,
          planName: plan.displayName,
          description: `${plan.displayName} Plan - ${payment.paymentType === 'crypto' ? 'Crypto Payment' : 'Manual Bank Transfer'}`,
          paymentMethod: payment.paymentType === 'crypto' ? 'crypto' : 'bank_transfer',
          completedAt: new Date(),
          metadata: {
            manualPaymentId: payment._id,
            verifiedBy: req.user._id,
            ...(payment.paymentType === 'crypto'
              ? { coinName: payment.cryptoWallet?.coinName, network: payment.cryptoWallet?.network }
              : { bankName: payment.bankAccount?.bankName }
            )
          }
        });
      } catch (paymentErr) {
        logger.error('Failed to create Payment record for manual payment:', paymentErr.message);
      }

      // Try to upgrade container resources
      try {
        const containerOrchestrator = require('../services/containerOrchestrator');
        await containerOrchestrator.upgradeUserPlan(user._id, plan);
      } catch (upgradeErr) {
        logger.error('Failed to upgrade container after manual payment:', upgradeErr.message);
      }

      logger.billing('Manual payment verified and plan upgraded', {
        userId: user._id,
        planName: plan.displayName,
        amount: payment.amount,
        verifiedBy: req.user._id
      });

      try {
        await notify.paymentVerified(user, plan.displayName, payment.amount, payment.currency);
        await notify.planUpgraded(user, plan.displayName);
      } catch (notifyErr) {
        logger.error('Payment verified notification failed:', notifyErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Payment verified and user plan upgraded successfully',
      payment: {
        id: payment._id,
        status: payment.status,
        verifiedAt: payment.verifiedAt
      }
    });
  } catch (error) {
    logger.error('Verify manual payment error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to verify payment' });
  }
});

// Reject manual payment
router.post('/manual-payments/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const payment = await ManualPayment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({ success: false, error: `Payment is already ${payment.status}` });
    }

    await payment.reject(req.user._id, reason || 'Payment rejected by admin');

    logger.billing('Manual payment rejected', {
      manualPaymentId: payment._id,
      userId: payment.user,
      reason: reason || 'Payment rejected by admin',
      rejectedBy: req.user._id
    });

    try {
      const paymentUser = await User.findById(payment.user);
      if (paymentUser) {
        await notify.paymentRejected(paymentUser, payment.planName, reason || 'Payment rejected by admin');
      }
    } catch (notifyErr) {
      logger.error('Payment rejected notification failed:', notifyErr.message);
    }

    res.json({
      success: true,
      message: 'Payment rejected',
      payment: {
        id: payment._id,
        status: payment.status,
        rejectedAt: payment.rejectedAt,
        adminNotes: payment.adminNotes
      }
    });
  } catch (error) {
    logger.error('Reject manual payment error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to reject payment' });
  }
});

// Get system health for all servers
router.get('/servers/health', requireAuth, requireAdmin, serverLogsLimiter, async (req, res) => {
  try {
    const { ORACLE_SERVERS } = require('../services/containerOrchestrator');
    const { testSSHConnection } = require('../services/remoteBuild');
    const sshTunnelManager = require('../services/sshTunnelManager');

    const healthStatus = {};

    for (const [key, server] of Object.entries(ORACLE_SERVERS)) {
      if (key === 'EC1') {
        healthStatus[key] = {
          status: 'active',
          ssh: true,
          docker: true,
          type: server.type
        };
        continue;
      }

      // Test SSH
      const sshResult = await testSSHConnection(server.host, key);
      
      // Check Tunnel
      const tunnelActive = sshTunnelManager.isTunnelActive(key);

      healthStatus[key] = {
        status: sshResult.success ? 'active' : 'offline',
        ssh: sshResult.success,
        tunnelActive,
        dockerVersion: sshResult.dockerVersion,
        diskSpace: sshResult.diskSpace,
        error: sshResult.error,
        type: server.type,
        host: server.host
      };
    }

    res.json({ success: true, servers: healthStatus });
  } catch (err) {
    logger.error('Error fetching server health:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Run a manual test deployment on a specific server
router.post('/servers/:serverKey/test-deploy', requireAuth, requireAdmin, testDeployLimiter, async (req, res) => {
  try {
    const { serverKey } = req.params;
    const { ORACLE_SERVERS } = require('../services/containerOrchestrator');
    const { NodeSSH } = require('node-ssh');
    const { getSSHConfig } = require('../services/remoteBuild');

    const server = ORACLE_SERVERS[serverKey];
    if (!server || serverKey === 'EC1') {
      return res.status(400).json({ success: false, error: 'Invalid server for test deployment' });
    }

    const logs = [];
    const log = (msg) => {
      logs.push(`[${new Date().toISOString()}] ${msg}`);
      logger.info(`[TEST_DEPLOY ${serverKey}] ${msg}`);
    };

    log(`Starting test deployment on ${serverKey} (${server.host})...`);

    const ssh = new NodeSSH();
    const config = getSSHConfig(serverKey, server.host);

    log(`Connecting via SSH...`);
    await ssh.connect(config);
    log(`SSH connected successfully.`);

    log(`Checking Docker Daemon...`);
    const dockerCheck = await ssh.execCommand('docker info');
    if (dockerCheck.code !== 0) throw new Error('Docker daemon not running');
    log(`Docker is running.`);

    log(`Checking for node-pm2-alpine image...`);
    const imageCheck = await ssh.execCommand('docker images node-pm2-alpine:v2 -q');
    if (!imageCheck.stdout.trim()) {
      log(`Image node-pm2-alpine:v2 not found. Building it now (~60s)...`);
      const buildDocker = `
mkdir -p /tmp/pm2-image
cat > /tmp/pm2-image/Dockerfile << 'EOF'
FROM node:18-alpine
RUN apk add --no-cache openssl
RUN npm install -g pm2@latest --no-audit --no-fund --silent --prefer-offline --no-optional
RUN pm2 --version
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
EOF
cd /tmp/pm2-image && docker build -t node-pm2-alpine:v2 .
rm -rf /tmp/pm2-image
`;
      const buildRes = await ssh.execCommand(buildDocker);
      if (buildRes.code !== 0) throw new Error(`Image build failed: ${buildRes.stderr}`);
      log(`PM2 image built successfully.`);
    } else {
      log(`PM2 image found in cache.`);
    }

    const testContainerName = `test-deploy-${Date.now()}`;
    log(`Creating test container: ${testContainerName}...`);
    
    // Create actual container using Docker CLI over SSH
    const runCmd = `docker run -d --name ${testContainerName} -m 256m --cpus 0.5 node-pm2-alpine:v2 pm2-runtime start /dev/null --name keepalive`;
    const runRes = await ssh.execCommand(runCmd);
    
    if (runRes.code !== 0) {
      throw new Error(`Failed to create test container: ${runRes.stderr}`);
    }
    log(`Container created. ID: ${runRes.stdout.trim().substring(0, 12)}`);

    log(`Verifying container is running...`);
    await new Promise(r => setTimeout(r, 2000)); // wait 2s
    const statusCheck = await ssh.execCommand(`docker inspect -f '{{.State.Running}}' ${testContainerName}`);
    if (statusCheck.stdout.trim() !== 'true') {
      throw new Error('Test container failed to stay running');
    }
    log(`Container is RUNNING! Test deployment successful.`);

    log(`Cleaning up test container...`);
    await ssh.execCommand(`docker rm -f ${testContainerName}`);
    log(`Cleanup complete.`);

    ssh.dispose();

    res.json({
      success: true,
      message: `Test deployment on ${serverKey} completed successfully`,
      logs
    });

  } catch (err) {
    logger.error(`Test deploy error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get recent server logs and stats
router.get('/servers/:serverKey/logs', requireAuth, requireAdmin, serverLogsLimiter, async (req, res) => {
  try {
    const { serverKey } = req.params;
    const { ORACLE_SERVERS } = require('../services/containerOrchestrator');
    const { NodeSSH } = require('node-ssh');
    const { getSSHConfig } = require('../services/remoteBuild');

    const server = ORACLE_SERVERS[serverKey];
    if (!server || serverKey === 'EC1') {
      return res.status(400).json({ success: false, error: 'Invalid server' });
    }

    const ssh = new NodeSSH();
    const config = getSSHConfig(serverKey, server.host);
    await ssh.connect(config);

    // Run a bunch of diagnostic commands
    const cmds = [
      { name: 'uptime', cmd: 'uptime -p' },
      { name: 'memory', cmd: 'free -m' },
      { name: 'disk', cmd: 'df -h /' },
      { name: 'containers', cmd: 'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Size}}"' }
    ];

    const results = {};
    for (const item of cmds) {
      const exec = await ssh.execCommand(item.cmd);
      results[item.name] = exec.stdout.trim() || exec.stderr.trim();
    }

    ssh.dispose();

    res.json({ success: true, server: serverKey, stats: results });

  } catch (err) {
    logger.error(`Server logs error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
