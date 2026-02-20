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
const logger = require('../utils/logger');
const { getRemoteSystemStats, getServerUtilization, getRemoteDockerStats, getRemoteContainerLogs, ORACLE_SERVERS } = require('../services/containerOrchestrator');

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
const containerUpgrade = require('../services/containerUpgrade');
const buildQueue = require('../services/buildQueue');

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
    await user.save();

    // Trigger background upgrade if user has active deployments
    // We don't await this to keep the response fast, but we log the start
    logger.info(`Admin triggering container upgrade for ${user.email} due to plan change: ${oldPlanName} -> ${newPlan.name}`);
    containerUpgrade.upgradeUserContainer(user._id, oldPlanName, newPlan.name)
      .catch(err => logger.error(`Background container upgrade failed for ${user.email}:`, err));

    res.json({
      success: true,
      message: `Plan updated to ${newPlan.displayName}. Container resource migration started in background.`,
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
      oracleConfig: oracleConfig || { accountType: 'shared' }
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
      oracleConfig
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

    const running = containerList.filter(c => c.state === 'running').length;

    res.json({
      success: true,
      docker: {
        containers: {
          total: containerList.length,
          running,
          stopped: containerList.length - running,
          list: containerList
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

module.exports = router;


