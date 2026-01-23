const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const Project = require('../models/Project');
const User = require('../models/User');
const Deployment = require('../models/Deployment');
const buildQueue = require('../services/buildQueue');

// Helper functions
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

// Get deployments for a project or all user deployments
router.get('/', async (req, res) => {
  try {
    const { projectId, status, page = 1, limit = 20 } = req.query;

    // If no projectId, return all deployments for the user
    if (!projectId) {
      const deployments = await Deployment.find({ userId: req.user._id })
        .populate('projectId', 'name repository')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

      const total = await Deployment.countDocuments({ userId: req.user._id });

      return res.json({
        success: true,
        deployments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total
        }
      });
    }

    // Validate projectId format
    if (typeof projectId !== 'string' || !projectId.match(/^[0-9a-fA-F]{24}$/)) {
      logger.error('Invalid projectId format:', { projectId, type: typeof projectId });
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID format'
      });
    }

    // Verify user has access to the project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    if (!project.hasAccess(req.user._id, 'viewer')) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    // Get deployments
    const deployments = await Deployment.findByProject(projectId, {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      environment: status
    });

    const total = await Deployment.countDocuments({ projectId });

    res.json({
      success: true,
      deployments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total
      }
    });
  } catch (error) {
    logger.error('Get deployments error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch deployments' });
  }
});

// Get all deployments for the current user
// This route must come before /:id to avoid matching "user" as an ID
router.get('/user', async (req, res) => {
  try {
    const { page = 1, limit = 20, status = null } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { userId: req.user._id };
    if (status) {
      query.status = status;
    }

    const deployments = await Deployment.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('projectId', 'name repository')
      .select('_id status createdAt completedAt deploymentUrl branch commitSha commitMessage error projectId');

    const total = await Deployment.countDocuments(query);

    res.json({
      success: true,
      deployments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total
      }
    });
  } catch (error) {
    logger.error('Get user deployments error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user deployments' });
  }
});

// Get deployment status (lightweight endpoint for polling)
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await Deployment.findById(id)
      .select('_id status projectId createdAt completedAt deploymentUrl error buildLogs');

    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Verify user has access to the project
    const project = await Project.findById(deployment.projectId);
    if (!project || !project.hasAccess(req.user._id, 'viewer')) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    res.json({
      success: true,
      deployment: {
        _id: deployment._id,
        status: deployment.status,
        deploymentUrl: deployment.deploymentUrl,
        error: deployment.error,
        createdAt: deployment.createdAt,
        completedAt: deployment.completedAt,
        isComplete: ['success', 'failed', 'cancelled'].includes(deployment.status),
        hasLogs: deployment.buildLogs && deployment.buildLogs.length > 0
      }
    });
  } catch (error) {
    logger.error('Get deployment status error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch deployment status' });
  }
});

// Get specific deployment
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await Deployment.findById(id)
      .populate('userId', 'username email avatar')
      .populate('projectId', 'name repository');

    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Verify user has access to the project
    const project = await Project.findById(deployment.projectId);
    if (!project || !project.hasAccess(req.user._id, 'viewer')) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    res.json({
      success: true,
      deployment
    });
  } catch (error) {
    logger.error('Get deployment error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch deployment' });
  }
});

// Create new deployment
router.post('/', [
  body('projectId').isMongoId().withMessage('Valid project ID is required'),
  body('branch').optional().trim().isLength({ min: 1, max: 100 }),
  body('commitSha').optional().isString(),
  body('isPreview').optional().isBoolean()
], handleValidationErrors, async (req, res) => {
  try {
    const { projectId, branch, commitSha, commitMessage, isPreview = false } = req.body;

    // Verify user has access to the project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    if (!project.hasAccess(req.user._id, 'developer')) {
      return res.status(403).json({
        success: false,
        error: 'Developer permissions required'
      });
    }

    // Check user's resource capacity
    if (!req.user.hasResourceCapacity('deployments', 1)) {
      return res.status(403).json({
        success: false,
        error: 'Deployment limit exceeded'
      });
    }

    // Check for ANY active deployment for this USER (Global Lock)
    // ONLY enforce for Free Tier users. Paid users can run parallel builds.

    // Dynamic DB Check: Is user on a paid plan?
    const Plan = require('../models/Plan');
    let isPaidUser = false;

    if (req.user.plan) {
      try {
        // Cache this if performance becomes an issue
        const userPlan = await Plan.findById(req.user.plan);
        // Any plan with cost > 0 is considered Paid
        if (userPlan && (userPlan.pricing?.usd > 0 || userPlan.pricing?.pkr > 0)) {
          isPaidUser = true;
        }
      } catch (e) {
        logger.warn('Failed to fetch user plan for check', e);
      }
    }

    // Fallback: Check planType string if DB check was inconclusive
    if (!isPaidUser) {
      isPaidUser = ['pro', 'business', 'enterprise'].includes(req.user.planType);
    }

    if (!isPaidUser) {
      const activeDeployment = await Deployment.findOne({
        userId: req.user._id,
        status: { $in: ['queued', 'building', 'deploying'] }
      });

      if (activeDeployment) {
        // PRO-ACTIVE FIX: Check if the project for this "active" deployment still exists
        const activeProjectExists = await Project.exists({ _id: activeDeployment.projectId });

        if (!activeProjectExists) {
          logger.warn(`Found ghost deployment ${activeDeployment._id} for non-existent project. Cleaning up.`);
          await activeDeployment.updateStatus('failed', { error: { message: 'Project deleted during deployment' } });
          // Allow the current request to proceed
        } else {
          return res.status(409).json({
            success: false,
            error: 'Free tier is limited to 1 concurrent deployment. Please upgrade to Pro for parallel builds.',
            activeDeploymentId: activeDeployment._id,
            projectId: activeDeployment.projectId
          });
        }
      }
    }

    // Check if deployment is blocked due to storage violations
    if (req.user.deploymentBlocked) {
      return res.status(403).json({
        success: false,
        error: 'Deployment blocked',
        message: req.user.deploymentBlockedReason || 'Your deployments have been blocked due to repeated storage limit violations.',
        blockedAt: req.user.deploymentBlockedAt,
        action: 'Please clean up your files and contact support to unblock'
      });
    }

    // Create deployment
    const deployment = await Deployment.create({
      projectId,
      userId: req.user._id,
      branch: branch || project.repository.branch,
      commitSha: commitSha || `manual_${Date.now()}`,
      commitMessage: commitMessage || 'Manual deployment',
      status: 'queued',
      isPreview,
      environment: isPreview ? 'preview' : 'production',
      trigger: 'manual'
    });

    // Add to build queue with PRIORITY for paid users
    // Priority 1 = High, 10 = Low
    const queuePriority = isPaidUser ? 1 : 10;

    await buildQueue.addDeployment(
      deployment._id.toString(),
      projectId,
      req.user._id.toString(),
      { priority: queuePriority }
    );

    // Update project stats
    project.stats.totalDeployments += 1;
    project.deploymentCount = (project.deploymentCount || 0) + 1; // Sync new field
    await project.save();

    // Update user usage
    req.user.currentUsage.deployments += 1;
    await req.user.save();

    // Emit real-time update via Socket.IO
    if (req.io) {
      req.io.to(`user-${req.user._id}`).emit('deployment-created', {
        deploymentId: deployment._id,
        projectId,
        status: deployment.status
      });
    }

    logger.info('Deployment created', {
      deploymentId: deployment._id,
      projectId,
      userId: req.user._id,
      branch: deployment.branch,
      isPreview
    });

    res.status(201).json({
      success: true,
      deployment,
      message: 'Deployment created and queued successfully'
    });
  } catch (error) {
    logger.error('Create deployment error:', error);
    res.status(500).json({ success: false, error: 'Failed to create deployment' });
  }
});

// Cancel deployment
router.post('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Verify user has access to the project
    const project = await Project.findById(deployment.projectId);
    if (!project || !project.hasAccess(req.user._id, 'developer')) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    if (!['queued', 'building', 'deploying'].includes(deployment.status)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel deployment in current status'
      });
    }

    // Cancel in queue
    await buildQueue.cancelDeployment(deployment._id.toString());

    // Update deployment status
    await deployment.updateStatus('cancelled');

    // Emit real-time update
    if (req.io) {
      req.io.to(`deployment-${deployment._id}`).emit('deployment-cancelled', {
        deploymentId: deployment._id,
        status: deployment.status
      });
    }

    logger.info('Deployment cancelled', {
      deploymentId: deployment._id,
      projectId: deployment.projectId,
      userId: req.user._id
    });

    res.json({
      success: true,
      deployment,
      message: 'Deployment cancelled successfully'
    });
  } catch (error) {
    logger.error('Cancel deployment error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel deployment' });
  }
});

// Retry deployment
router.post('/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Verify user has access to the project
    const project = await Project.findById(deployment.projectId);
    if (!project || !project.hasAccess(req.user._id, 'developer')) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    if (deployment.status !== 'failed') {
      return res.status(400).json({
        success: false,
        error: 'Can only retry failed deployments'
      });
    }

    // Check user's resource capacity
    if (!req.user.hasResourceCapacity('deployments', 1)) {
      return res.status(403).json({
        success: false,
        error: 'Deployment limit exceeded'
      });
    }

    // Create new deployment
    const newDeployment = await Deployment.create({
      projectId: deployment.projectId,
      userId: req.user._id,
      branch: deployment.branch,
      commitSha: deployment.commitSha,
      commitMessage: `Retry: ${deployment.commitMessage}`,
      status: 'queued',
      isPreview: deployment.isPreview,
      environment: deployment.environment,
      trigger: 'retry',
      retryOf: deployment._id,
      retryCount: (deployment.retryCount || 0) + 1
    });

    // Add to build queue
    await buildQueue.retryDeployment(
      newDeployment._id.toString(),
      deployment.projectId.toString(),
      req.user._id.toString()
    );

    // Update user usage
    req.user.currentUsage.deployments += 1;
    await req.user.save();

    logger.info('Deployment retried', {
      originalDeploymentId: deployment._id,
      newDeploymentId: newDeployment._id,
      projectId: deployment.projectId,
      userId: req.user._id
    });

    res.json({
      success: true,
      deployment: newDeployment,
      message: 'Deployment retry initiated'
    });
  } catch (error) {
    logger.error('Retry deployment error:', error);
    res.status(500).json({ success: false, error: 'Failed to retry deployment' });
  }
});

// Get deployment logs
router.get('/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Verify user has access to the project
    const project = await Project.findById(deployment.projectId);
    if (!project || !project.hasAccess(req.user._id, 'viewer')) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    res.json({
      success: true,
      logs: deployment.buildLogs || [],
      deployment: {
        id: deployment._id,
        status: deployment.status,
        isComplete: ['success', 'failed', 'cancelled'].includes(deployment.status)
      }
    });
  } catch (error) {
    logger.error('Get deployment logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch deployment logs' });
  }
});

// Stream deployment logs (Server-Sent Events)
router.get('/:id/logs/stream', async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Verify user has access to the project
    const project = await Project.findById(deployment.projectId);
    if (!project || !project.hasAccess(req.user._id, 'viewer')) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send existing logs
    if (deployment.buildLogs && deployment.buildLogs.length > 0) {
      deployment.buildLogs.forEach(log => {
        res.write(`data: ${JSON.stringify(log)}\n\n`);
      });
    }

    // Listen for new logs via Socket.IO
    const logHandler = (log) => {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    };

    if (req.io) {
      req.io.on(`deployment-${id}-log`, logHandler);
    }

    // Handle client disconnect
    req.on('close', () => {
      if (req.io) {
        req.io.off(`deployment-${id}-log`, logHandler);
      }
      res.end();
    });

    // Send completion event if deployment is done
    if (['success', 'failed', 'cancelled'].includes(deployment.status)) {
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        status: deployment.status
      })}\n\n`);
      res.end();
    }

  } catch (error) {
    logger.error('Stream deployment logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to stream deployment logs' });
  }
});

// Promote preview deployment to production
router.post('/:id/promote', async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Verify user has access to the project
    const project = await Project.findById(deployment.projectId);
    if (!project || !project.hasAccess(req.user._id, 'admin')) {
      return res.status(403).json({
        success: false,
        error: 'Admin permissions required'
      });
    }

    if (!deployment.isPreview) {
      return res.status(400).json({
        success: false,
        error: 'Can only promote preview deployments'
      });
    }

    if (deployment.status !== 'success') {
      return res.status(400).json({
        success: false,
        error: 'Can only promote successful deployments'
      });
    }

    // Update deployment
    deployment.promotedToProduction = true;
    deployment.promotedAt = new Date();
    deployment.environment = 'production';
    await deployment.save();

    // Update project's production deployment
    project.productionDeployment = deployment._id;
    await project.save();

    logger.info('Deployment promoted to production', {
      deploymentId: deployment._id,
      projectId: deployment.projectId,
      userId: req.user._id
    });

    res.json({
      success: true,
      deployment,
      message: 'Deployment promoted to production successfully'
    });
  } catch (error) {
    logger.error('Promote deployment error:', error);
    res.status(500).json({ success: false, error: 'Failed to promote deployment' });
  }
});

// Get deployment stats
router.get('/stats/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { timeRange = 30 } = req.query;

    // Verify user has access to the project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    if (!project.hasAccess(req.user._id, 'viewer')) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const stats = await Deployment.getStats(projectId, parseInt(timeRange));

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Get deployment stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch deployment stats' });
  }
});

// Get deployment history for a project
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 10, skip = 0 } = req.query;

    // Verify project exists and user has access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    if (project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get deployments
    const deployments = await Deployment.find({ projectId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select('_id status createdAt completedAt deploymentUrl branch commitSha commitMessage error');

    const total = await Deployment.countDocuments({ projectId });

    res.json({
      success: true,
      deployments,
      total,
      hasMore: total > (parseInt(skip) + parseInt(limit))
    });

  } catch (error) {
    logger.error('Get deployment history error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch deployment history' });
  }
});

// Delete deployment
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    // Verify user has access to the project
    const project = await Project.findById(deployment.projectId);
    if (!project || !project.hasAccess(req.user._id, 'admin')) {
      return res.status(403).json({
        success: false,
        error: 'Admin permissions required to delete deployment'
      });
    }

    // Remove Nginx location block if deployment has URL
    if (deployment.deploymentUrl && deployment.serverKey) {
      try {
        const nginxRouter = require('../services/nginxRouter');
        const serverKey = deployment.serverKey; // 'EC2', 'EC3', etc.
        const serverHost = process.env[`${serverKey}_SERVER_IP`] ||
          (serverKey === 'EC2' ? process.env.EC2_SERVER_IP : process.env.EC3_SERVER_IP);

        if (serverHost) {
          await nginxRouter.removeNginxRouting(
            deployment._id.toString(),
            serverHost,
            serverKey
          );
          logger.info(`Removed Nginx config for deployment ${deployment._id}`);
        }
      } catch (nginxError) {
        logger.warn(`Failed to remove Nginx config for deployment ${deployment._id}: ${nginxError.message}`);
        // Continue with deletion even if Nginx cleanup fails
      }
    }

    // Stop PM2 process if running
    if (deployment.containerName && deployment.serverKey) {
      try {
        const freeTierContainer = require('../services/freeTierContainer');
        const containerOrchestrator = require('../services/containerOrchestrator');
        const server = containerOrchestrator.ORACLE_SERVERS[deployment.serverKey];

        if (server) {
          await freeTierContainer.removeProjectFromUserContainer(
            project,
            deployment.containerName,
            server.host,
            deployment.serverKey
          );
          logger.info(`Removed PM2 process for deployment ${deployment._id}`);
        }
      } catch (pm2Error) {
        logger.warn(`Failed to remove PM2 process for deployment ${deployment._id}: ${pm2Error.message}`);
        // Continue with deletion
      }
    }

    // Optional: Clean user's database if requested
    // Note: User's database is their responsibility, but we can optionally clean it
    const { cleanUserDatabase = false } = req.body;
    
    if (cleanUserDatabase && project.environmentVariables) {
      const dbUrl = project.environmentVariables.find(env => 
        env.key === 'DATABASE_URL' || env.key === 'MONGODB_URI'
      );
      
      if (dbUrl?.value) {
        try {
          // Note: This is optional - user's database cleanup
          // In production, you might want to add a confirmation step
          logger.info('User requested database cleanup', {
            deploymentId: id,
            projectId: deployment.projectId
          });
          // Database cleanup would be implemented here if needed
          // For now, we just log it - user manages their own database
        } catch (dbError) {
          logger.warn('Database cleanup failed (user manages their own DB)', {
            error: dbError.message
          });
          // Continue with deletion even if DB cleanup fails
        }
      }
    }

    // Clean platform data (automatic)
    // 1. Delete deployment from database
    await Deployment.findByIdAndDelete(id);

    // 2. Update project stats
    if (project.deploymentCount > 0) {
      project.deploymentCount -= 1;
      await project.save();
    }

    logger.info('Deployment deleted', {
      deploymentId: id,
      projectId: deployment.projectId,
      userId: req.user._id,
      cleanUserDatabase: cleanUserDatabase
    });

    res.json({
      success: true,
      message: 'Deployment deleted successfully',
      note: cleanUserDatabase 
        ? 'Platform data cleaned. User database cleanup attempted (user manages their own database).'
        : 'Platform data cleaned. User database unchanged (user manages their own database).'
    });
  } catch (error) {
    logger.error('Delete deployment error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete deployment' });
  }
});

// POST /:id/rollback - Rollback to a previous deployment
router.post('/:id/rollback', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the deployment to rollback to
    const targetDeployment = await Deployment.findById(id).populate('projectId');

    if (!targetDeployment) {
      return res.status(404).json({ success: false, error: 'Deployment not found' });
    }

    // Verify deployment was successful
    if (targetDeployment.status !== 'success') {
      return res.status(400).json({
        success: false,
        error: 'Can only rollback to successful deployments'
      });
    }

    const project = targetDeployment.projectId;

    // Check user access (developer or admin required)
    if (!project.hasAccess(req.user._id, 'developer')) {
      return res.status(403).json({
        success: false,
        error: 'Developer access required to rollback'
      });
    }

    // CHECK PLAN FEATURE - Rollback
    const owner = await User.findById(project.owner).populate('plan');
    if (!owner || !owner.plan) {
      return res.status(403).json({ success: false, error: 'Plan information unavailable' });
    }

    // Check rollback feature using centralized utility
    const { hasFeature } = require('../utils/featureCheck');
    if (!hasFeature(owner.plan, 'rollback')) {
      return res.status(403).json({
        success: false,
        error: 'Rollback not available in your plan',
        upgradeRequired: true
      });
    }
    
    // Get feature config for retention limits
    const rollbackFeature = owner.plan.features?.find(f => 
        (typeof f === 'string' && f === 'rollback') || 
        (f.name === 'rollback')
    );

    // Check rollback retention (how far back can we go?)
    const retentionDays = rollbackFeature.config?.retentionDays || 30;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    if (targetDeployment.createdAt < cutoffDate) {
      return res.status(403).json({
        success: false,
        error: `Can only rollback to deployments within the last ${retentionDays} days`,
        upgrade: true
      });
    }

    // Create new deployment with rollback flag
    const newDeployment = await Deployment.create({
      projectId: project._id,
      userId: req.user._id,
      branch: targetDeployment.branch,
      commitSha: targetDeployment.commitSha,
      commitMessage: targetDeployment.commitMessage || 'Rollback deployment',
      commitAuthor: targetDeployment.commitAuthor,
      environment: targetDeployment.environment,
      trigger: 'rollback',
      rollbackFrom: targetDeployment._id,
      status: 'queued',
      buildCommand: targetDeployment.buildCommand,
      installCommand: targetDeployment.installCommand,
      outputDirectory: targetDeployment.outputDirectory,
      framework: targetDeployment.framework
    });

    // Add to build queue
    await buildQueue.addDeployment(
      newDeployment._id.toString(),
      project._id.toString(),
      req.user._id.toString(),
      { priority: 5 } // High priority for rollbacks
    );

    logger.info('Rollback initiated', {
      projectId: project._id,
      userId: req.user._id,
      targetDeploymentId: targetDeployment._id,
      newDeploymentId: newDeployment._id
    });

    res.json({
      success: true,
      deployment: newDeployment,
      message: `Rolling back to deployment from ${targetDeployment.createdAt.toLocaleString()}`
    });

  } catch (error) {
    logger.error('Rollback error:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate rollback' });
  }
});

module.exports = router;
