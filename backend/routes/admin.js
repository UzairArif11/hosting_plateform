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
const { getRemoteSystemStats, ORACLE_SERVERS } = require('../services/containerOrchestrator');
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
    const plan = new Plan(planData);
    await plan.save();
    res.json({ success: true, plan });
  } catch (error) {
    logger.error('Create plan error:', error);
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

module.exports = router;
