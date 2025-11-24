const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const User = require('../models/User');
const githubService = require('../services/github');
const logger = require('../utils/logger');
const { requireProjectAccess } = require('../middleware/auth');

const router = express.Router();

// Mock Deployment model until we create the actual model
const MockDeployment = {
  async create(data) {
    const deployment = {
      _id: `deploy_${Date.now()}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return deployment;
  },

  async findById(id) {
    return {
      _id: id,
      status: 'success',
      url: 'https://example.com',
      logs: ['Build started', 'Build completed'],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  },

  async find(query) {
    return [
      {
        _id: 'deploy_1',
        status: 'success',
        commitSha: 'abc123',
        commitMessage: 'Initial commit',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }
};

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

    // Build query
    const query = { projectId };
    if (status) {
      query.status = status;
    }

    const deployments = await MockDeployment.find(query);

    res.json({
      success: true,
      deployments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: deployments.length
      }
    });
  } catch (error) {
    logger.error('Get deployments error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch deployments' });
  }
});

// Get specific deployment
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await MockDeployment.findById(id);
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
    logger.error('Get deployment error:', error.message);
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
    const deploymentData = {
      projectId,
      userId: req.user._id,
      branch: branch || project.repository.branch,
      commitSha: commitSha || `auto_${Date.now()}`,
      commitMessage: commitMessage || 'Manual deployment',
      status: 'queued',
      isPreview,
      environment: isPreview ? 'preview' : 'production',
      trigger: 'manual',
      triggerBy: req.user.username
    };

    const deployment = await MockDeployment.create(deploymentData);

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

    logger.deployment('Deployment created', {
      deploymentId: deployment._id,
      projectId,
      userId: req.user._id,
      branch: deployment.branch,
      isPreview
    });

    res.status(201).json({
      success: true,
      deployment,
      message: 'Deployment created successfully'
    });
  } catch (error) {
    logger.error('Create deployment error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to create deployment' });
  }
});

// Cancel deployment
router.post('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await MockDeployment.findById(id);
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

    if (!['queued', 'building'].includes(deployment.status)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel deployment in current status'
      });
    }

    // Update deployment status
    deployment.status = 'cancelled';
    deployment.finishedAt = new Date();

    // Emit real-time update
    if (req.io) {
      req.io.to(`deployment-${deployment._id}`).emit('deployment-cancelled', {
        deploymentId: deployment._id,
        status: deployment.status
      });
    }

    logger.deployment('Deployment cancelled', {
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
    logger.error('Cancel deployment error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to cancel deployment' });
  }
});

// Retry deployment
router.post('/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await MockDeployment.findById(id);
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

    // Create new deployment based on the failed one
    const newDeploymentData = {
      projectId: deployment.projectId,
      userId: req.user._id,
      branch: deployment.branch,
      commitSha: deployment.commitSha,
      commitMessage: `Retry: ${deployment.commitMessage}`,
      status: 'queued',
      isPreview: deployment.isPreview,
      environment: deployment.environment,
      trigger: 'retry',
      triggerBy: req.user.username,
      retryOf: deployment._id
    };

    const newDeployment = await MockDeployment.create(newDeploymentData);

    // Update user usage
    req.user.currentUsage.deployments += 1;
    await req.user.save();

    logger.deployment('Deployment retried', {
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
    logger.error('Retry deployment error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to retry deployment' });
  }
});

// Get deployment logs
router.get('/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await MockDeployment.findById(id);
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

    // Mock logs for now
    const logs = [
      { timestamp: new Date(), level: 'info', message: 'Build started' },
      { timestamp: new Date(), level: 'info', message: 'Installing dependencies...' },
      { timestamp: new Date(), level: 'info', message: 'Running build command...' },
      { timestamp: new Date(), level: 'success', message: 'Build completed successfully' },
      { timestamp: new Date(), level: 'info', message: 'Deployment finished' }
    ];

    res.json({
      success: true,
      logs,
      deployment: {
        id: deployment._id,
        status: deployment.status,
        isComplete: ['success', 'failed', 'cancelled'].includes(deployment.status)
      }
    });
  } catch (error) {
    logger.error('Get deployment logs error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch deployment logs' });
  }
});

// Stream deployment logs (Server-Sent Events)
router.get('/:id/logs/stream', async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await MockDeployment.findById(id);
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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial logs
    const logs = [
      'Build started',
      'Installing dependencies...',
      'Running build command...',
      'Build completed successfully',
      'Deployment finished'
    ];

    logs.forEach((log, index) => {
      setTimeout(() => {
        res.write(`data: ${JSON.stringify({
          timestamp: new Date(),
          level: 'info',
          message: log
        })}\n\n`);
      }, index * 1000);
    });

    // Close connection after logs
    setTimeout(() => {
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        status: 'success'
      })}\n\n`);
      res.end();
    }, logs.length * 1000 + 500);

  } catch (error) {
    logger.error('Stream deployment logs error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to stream deployment logs' });
  }
});

// Promote preview deployment to production
router.post('/:id/promote', async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await MockDeployment.findById(id);
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

    // Update project's production deployment
    project.productionDeployment = deployment._id;
    await project.save();

    logger.deployment('Deployment promoted to production', {
      deploymentId: deployment._id,
      projectId: deployment.projectId,
      userId: req.user._id
    });

    res.json({
      success: true,
      message: 'Deployment promoted to production successfully'
    });
  } catch (error) {
    logger.error('Promote deployment error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to promote deployment' });
  }
});

module.exports = router;
