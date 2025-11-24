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

// Get deployments for a project
router.get('/', async (req, res) => {
  try {
    const { projectId, status, page = 1, limit = 20 } = req.query;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required'
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

    // Add to build queue
    await buildQueue.addDeployment(
      deployment._id.toString(),
      projectId,
      req.user._id.toString()
    );

    // Update project stats
    project.stats.totalDeployments += 1;
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

module.exports = router;
