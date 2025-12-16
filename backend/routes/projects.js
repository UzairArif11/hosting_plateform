const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Project = require('../models/Project');
const User = require('../models/User');
const githubService = require('../services/github');
const logger = require('../utils/logger');
const { requireProjectAccess, requireResourceCapacity } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateProjectCreation = [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Project name is required and must be under 100 characters'),
  body('repository.url').isURL().withMessage('Valid repository URL is required'),
  body('repository.fullName').matches(/^[\w\-\.]+\/[\w\-\.]+$/).withMessage('Repository full name must be in format "owner/repo"'),
  body('repository.branch').optional().trim().isLength({ min: 1, max: 100 }),
  body('framework').isIn([
    'nextjs', 'react', 'vue', 'nuxt', 'svelte', 'angular',
    'express', 'fastify', 'nestjs', 'koa',
    'static', 'gatsby', 'hugo', 'jekyll',
    'laravel', 'symfony', 'django', 'flask',
    'custom'
  ]).withMessage('Invalid framework specified'),
];

const validateProjectUpdate = [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('repository.branch').optional().trim().isLength({ min: 1, max: 100 }),
  body('buildConfig.buildCommand').optional().isString(),
  body('buildConfig.outputDirectory').optional().isString(),
  body('buildConfig.installCommand').optional().isString(),
  body('buildConfig.nodeVersion').optional().isString(),
];

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

// Get all projects for current user
router.get('/', async (req, res) => {
  try {
    const { status = 'active', page = 1, limit = 20, sort = '-createdAt' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get user's own projects
    const ownProjects = await Project.findByOwner(req.user._id, status)
      .populate('latestDeployment')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get projects where user is a collaborator
    const collaboratorProjects = await Project.findByCollaborator(req.user._id)
      .populate('owner', 'username displayName avatar')
      .populate('latestDeployment')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const allProjects = [...ownProjects, ...collaboratorProjects];

    res.json({
      success: true,
      projects: allProjects,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: allProjects.length
      }
    });
  } catch (error) {
    logger.error('Get projects error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch projects' });
  }
});

// Get specific project
router.get('/:id', requireProjectAccess('viewer'), async (req, res) => {
  try {
    const project = req.project; // Set by requireProjectAccess middleware

    await project.populate([
      { path: 'owner', select: 'username displayName avatar' },
      { path: 'collaborators.user', select: 'username displayName avatar' },
      { path: 'latestDeployment' },
      { path: 'productionDeployment' }
    ]);

    res.json({
      success: true,
      project
    });
  } catch (error) {
    logger.error('Get project error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch project' });
  }
});

// Create new project
router.post('/',
  requireResourceCapacity('projects', 1),
  validateProjectCreation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, repository, framework, buildConfig = {}, environmentVariables = [] } = req.body;

      // Check if user has access to the repository
      const accessCheck = await githubService.checkRepositoryAccess(
        repository.fullName,
        req.user.githubAccessToken
      );

      if (!accessCheck.success || !accessCheck.data.hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to this repository'
        });
      }

      // Auto-detect framework if not provided
      let detectedFramework = framework;
      if (framework === 'custom' || !framework) {
        const detection = await githubService.detectFramework(
          repository.fullName,
          repository.branch || 'main',
          req.user.githubAccessToken
        );
        if (detection.success) {
          detectedFramework = detection.data.framework;
        }
      }

      // Create the project
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const project = new Project({
        name,
        slug,
        repository: {
          url: repository.url,
          fullName: repository.fullName,
          branch: repository.branch || 'main',
          provider: 'github',
          isPrivate: accessCheck.data.isPrivate
        },
        owner: req.user._id,
        framework: detectedFramework,
        buildConfig,
        environmentVariables: environmentVariables.map(env => ({
          ...env,
          environments: env.environments || ['production']
        })),
        domains: [{
          domain: `${slug}.${process.env.BASE_DOMAIN || 'vcp.dev'}`,
          isCustom: false,
          isPrimary: true,
          verified: true
        }]
      });

      await project.save();

      // Update user's project count
      req.user.currentUsage.projects += 1;
      await req.user.save();

      logger.deployment('Project created', {
        userId: req.user._id,
        projectId: project._id,
        projectName: project.name,
        repository: repository.fullName,
        framework: detectedFramework
      });

      res.status(201).json({
        success: true,
        project,
        message: 'Project created successfully'
      });
    } catch (error) {
      logger.error('Create project error:', error.message);
      res.status(500).json({ success: false, error: 'Failed to create project' });
    }
  }
);

// Update project
router.put('/:id',
  requireProjectAccess('admin'),
  validateProjectUpdate,
  handleValidationErrors,
  async (req, res) => {
    try {
      const project = req.project;
      const updates = req.body;

      // Update allowed fields
      const allowedUpdates = [
        'name', 'repository.branch', 'buildConfig', 'environmentVariables',
        'autoDeployEnabled', 'isPublic', 'settings'
      ];

      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          if (field.includes('.')) {
            const [parent, child] = field.split('.');
            project[parent][child] = updates[field];
          } else {
            project[field] = updates[field];
          }
        }
      });

      await project.save();

      logger.deployment('Project updated', {
        userId: req.user._id,
        projectId: project._id,
        updates: Object.keys(updates)
      });

      res.json({
        success: true,
        project,
        message: 'Project updated successfully'
      });
    } catch (error) {
      logger.error('Update project error:', error.message);
      res.status(500).json({ success: false, error: 'Failed to update project' });
    }
  }
);

// Delete project
router.delete('/:id', requireProjectAccess('admin'), async (req, res) => {
  try {
    const project = req.project;

    // Update user's project count
    if (project.owner.toString() === req.user._id.toString()) {
      req.user.currentUsage.projects = Math.max(0, req.user.currentUsage.projects - 1);
      await req.user.save();
    }

    await Project.findByIdAndDelete(project._id);

    logger.deployment('Project deleted', {
      userId: req.user._id,
      projectId: project._id,
      projectName: project.name
    });

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    logger.error('Delete project error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
});

// Add domain to project
router.post('/:id/domains', requireProjectAccess('admin'), async (req, res) => {
  try {
    const { domain, isPrimary = false } = req.body;
    const project = req.project;

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Domain is required'
      });
    }

    // Check if domain already exists
    const existingDomain = project.domains.find(d => d.domain === domain);
    if (existingDomain) {
      return res.status(400).json({
        success: false,
        error: 'Domain already added to this project'
      });
    }

    // If this should be primary, unset other primary domains
    if (isPrimary) {
      project.domains.forEach(d => d.isPrimary = false);
    }

    project.domains.push({
      domain,
      isCustom: true,
      isPrimary,
      verified: false
    });

    await project.save();

    res.json({
      success: true,
      project,
      message: 'Domain added successfully'
    });
  } catch (error) {
    logger.error('Add domain error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to add domain' });
  }
});

// Remove domain from project
router.delete('/:id/domains/:domainId', requireProjectAccess('admin'), async (req, res) => {
  try {
    const project = req.project;
    const { domainId } = req.params;

    project.domains = project.domains.filter(d => d._id.toString() !== domainId);
    await project.save();

    res.json({
      success: true,
      project,
      message: 'Domain removed successfully'
    });
  } catch (error) {
    logger.error('Remove domain error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to remove domain' });
  }
});

// Add collaborator to project
router.post('/:id/collaborators', requireProjectAccess('admin'), async (req, res) => {
  try {
    const { username, role = 'viewer' } = req.body;
    const project = req.project;

    const collaborator = await User.findOne({ username });
    if (!collaborator) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await project.addCollaborator(collaborator._id, role);

    res.json({
      success: true,
      message: 'Collaborator added successfully'
    });
  } catch (error) {
    logger.error('Add collaborator error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to add collaborator' });
  }
});

// Remove collaborator from project
router.delete('/:id/collaborators/:userId', requireProjectAccess('admin'), async (req, res) => {
  try {
    const project = req.project;
    const { userId } = req.params;

    await project.removeCollaborator(userId);

    res.json({
      success: true,
      message: 'Collaborator removed successfully'
    });
  } catch (error) {
    logger.error('Remove collaborator error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to remove collaborator' });
  }
});

// Get project analytics
router.get('/:id/analytics', requireProjectAccess('viewer'), async (req, res) => {
  try {
    const project = req.project;

    // This would integrate with your analytics service
    // For now, return basic stats
    const analytics = {
      deployments: {
        total: project.stats.totalDeployments,
        successful: project.stats.successfulDeployments,
        failed: project.stats.failedDeployments,
        successRate: project.stats.totalDeployments > 0
          ? Math.round((project.stats.successfulDeployments / project.stats.totalDeployments) * 100)
          : 0
      },
      usage: {
        storage: project.currentUsage.storage,
        bandwidth: project.currentUsage.bandwidth,
        builds: project.currentUsage.builds
      },
      performance: {
        averageBuildTime: project.stats.averageBuildTime,
        lastActivity: project.stats.lastActivity
      }
    };

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    logger.error('Get project analytics error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
