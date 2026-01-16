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

    // Debug log for data visibility issues
    if (allProjects.length > 0) {
      logger.info('Sending projects data:', {
        count: allProjects.length,
        firstProject: {
          id: allProjects[0]._id,
          deploymentCount: allProjects[0].deploymentCount,
          latestDeployment: allProjects[0].latestDeployment ? 'Present' : 'Missing',
          status: allProjects[0].status
        }
      });
    }

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

    logger.info('Sending single project data:', {
      id: project._id,
      deploymentCount: project.deploymentCount,
      latestDeployment: project.latestDeployment ? 'Present' : 'Missing'
    });

    res.json({
      success: true,
      project
    });
  } catch (error) {
    logger.error('Get project error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch project' });
  }
});

// Get available branches for a project
router.get('/:id/branches', requireProjectAccess('viewer'), async (req, res) => {
  try {
    const project = req.project;
    const user = req.user;

    // We need permission to access the repository on GitHub
    // Use the project owner's token if the current user doesn't have one or if they're just a viewer
    // But typically we want to use the requester's token if they are a developer
    let token = user.githubAccessToken;

    // If the user doesn't have a token, falls back to checking if they're the owner (handled by middleware)
    if (!token && project.owner.toString() === user._id.toString()) {
      // Logic to fetch owner's token if we stored it securely (currently we assume it's on req.user)
      // For now, if no token, return error or empty list
    }

    if (!token) {
      // If no token, maybe we can use the project owner's token from DB if we were storing it?
      // Current architecture seems to rely on session token. 
      // If user is collaborator, they might need their own token or use system token?
      // Let's assume user must have linked GitHub.
      return res.status(400).json({
        success: false,
        error: 'GitHub connection required to fetch branches'
      });
    }

    const result = await githubService.getRepositoryBranches(
      project.repository.fullName,
      token
    );

    if (result.success) {
      // Map the object response to simple string array for frontend
      const branches = result.data.branches ? result.data.branches.map(b => b.name) : [];
      res.json({
        success: true,
        branches
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error fetching branches:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch branches' });
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

      // Check if user can use free resources based on IP history
      const ipRestrictions = require('../services/ipRestrictions');
      const ipAddress = req.ip || req.connection.remoteAddress;
      const resourceCheck = await ipRestrictions.canUseFreeResources(ipAddress, req.user._id);

      if (!resourceCheck.allowed) {
        logger.warn('Project creation blocked - IP free account limit', {
          userId: req.user._id,
          ip: ipAddress,
          reason: resourceCheck.reason,
          currentCount: resourceCheck.currentCount,
          maxAllowed: resourceCheck.maxAllowed
        });

        return res.status(403).json({
          success: false,
          error: resourceCheck.reason,
          upgradeRequired: resourceCheck.upgradeRequired,
          currentCount: resourceCheck.currentCount,
          maxAllowed: resourceCheck.maxAllowed,
          message: resourceCheck.message || 'You already used free resources multiple times. Upgrade to use resources again.'
        });
      }

      // Check if user has GitHub token
      if (!req.user.githubAccessToken) {
        logger.error('Project creation failed - no GitHub token', {
          userId: req.user._id,
          username: req.user.username
        });
        return res.status(400).json({
          success: false,
          error: 'GitHub access token is required. Please reconnect your GitHub account.'
        });
      }

      // Check if user has access to the repository
      logger.info('Checking repository access', {
        userId: req.user._id,
        repository: repository.fullName,
        hasToken: !!req.user.githubAccessToken
      });

      const accessCheck = await githubService.checkRepositoryAccess(
        repository.fullName,
        req.user.githubAccessToken
      );

      logger.info('Repository access check result', {
        success: accessCheck.success,
        hasAccess: accessCheck.data?.hasAccess,
        error: accessCheck.error
      });

      if (!accessCheck.success || !accessCheck.data.hasAccess) {
        return res.status(403).json({
          success: false,
          error: accessCheck.error || 'You do not have access to this repository'
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
      let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      // Ensure global uniqueness of slug
      let slugExists = await Project.findOne({ slug });
      let attempts = 0;
      const originalSlug = slug;
      while (slugExists && attempts < 5) {
        slug = `${originalSlug}-${Math.random().toString(36).substring(2, 8)}`;
        slugExists = await Project.findOne({ slug });
        attempts++;
      }
      if (slugExists) {
        throw new Error('Could not generate unique project URL. Please try a different name.');
      }

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
      if (!req.user.currentUsage) {
        req.user.currentUsage = { projects: 0, deployments: 0, containers: 0, storage: 0, bandwidth: 0 };
      }
      req.user.currentUsage.projects = (req.user.currentUsage.projects || 0) + 1;
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
      logger.error('Create project error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        userId: req.user?._id,
        projectData: {
          name: req.body?.name,
          repository: req.body?.repository?.fullName,
          framework: req.body?.framework
        }
      });
      // Return specific error message for UI
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create project',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
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
      const user = req.user;

      // Check for auto-deploy feature flag if being enabled
      if (updates.autoDeployEnabled === true) {
        const User = require('../models/User'); // Ensure Model is loaded
        const fullUser = await User.findById(user._id).populate('plan');

        // Find the feature in the user's plan
        // Handle both simple string features and object features
        const planFeatures = fullUser.plan?.features || [];
        const autoDeployFeature = planFeatures.find(f => f.name === 'autoDeploy') ||
          planFeatures.find(f => f === 'autoDeploy');

        // Check if enabled (default to true if feature present as string, or if enabled prop is true)
        const isEnabled = autoDeployFeature && (typeof autoDeployFeature === 'string' || autoDeployFeature.enabled !== false);

        if (!isEnabled) {
          return res.status(403).json({
            success: false,
            error: 'Auto-deployment is not available in your current plan',
            upgradeRequired: true
          });
        }
      }

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

    // Stop and remove project container
    if (project.containerName && project.server) {
      try {
        const freeTierContainer = require('../services/freeTierContainer');
        const containerOrchestrator = require('../services/containerOrchestrator');
        const server = containerOrchestrator.ORACLE_SERVERS[project.server];

        if (server) {
          await freeTierContainer.removeProjectFromUserContainer(
            project,
            project.containerName,
            server.host,
            project.server  // Pass serverKey for SSH
          );
          logger.info('Project PM2 process removed', {
            projectId: project._id,
            containerName: project.containerName
          });
        }
      } catch (containerError) {
        logger.error('Failed to remove PM2 process:', containerError);
        // Continue with project deletion even if PM2 cleanup fails
      }
    }

    // Update user's project count (only if deleting own project, or if admin deleting someone else's project)
    const projectOwner = await User.findById(project.owner);
    if (projectOwner) {
      // If admin is deleting, update the project owner's count, not admin's
      // If owner is deleting, update their own count
      const userToUpdate = project.owner.toString() === req.user._id.toString() ? req.user : projectOwner;

      if (!userToUpdate.currentUsage) {
        userToUpdate.currentUsage = { projects: 0, deployments: 0, containers: 0, storage: 0, bandwidth: 0 };
      }
      userToUpdate.currentUsage.projects = Math.max(0, userToUpdate.currentUsage.projects - 1);

      // Auto-cleanup container if no projects left (Frees resources immediately)
      if (userToUpdate.currentUsage.projects === 0) {
        try {
          const freshUser = await User.findById(userToUpdate._id);

          const freeTierContainer = require('../services/freeTierContainer');
          const cleanupResult = await freeTierContainer.removeUserContainer(freshUser || userToUpdate);

          if (cleanupResult.success) {
            // Reset user resource tracking only if physically removed
            userToUpdate.assignedServer = null;
            userToUpdate.containerName = null;
            userToUpdate.containerId = null;
            logger.info(`[AUTO-CLEANUP] Physically removed empty container for user ${userToUpdate.email}`);
          } else {
            logger.info(`[AUTO-CLEANUP] No container found to remove for user ${userToUpdate.email} (Already clean)`);
          }
        } catch (e) {
          logger.warn(`Failed to cleanup empty container: ${e.message}`);
        }
      }

      await userToUpdate.save();
    }

    // 1. Find all active or queued deployments for this project
    const Deployment = require('../models/Deployment');
    const activeDeployments = await Deployment.find({
      projectId: project._id,
      status: { $in: ['queued', 'building', 'deploying'] }
    });

    // 2. Cancel them in the build queue to stop background processes
    const buildQueue = require('../services/buildQueue');
    for (const dep of activeDeployments) {
      try {
        await buildQueue.cancelDeployment(dep._id.toString());
        logger.info(`Cancelled active job for deployment: ${dep._id}`);
      } catch (err) {
        // Job might already be finished or not in queue, ignore
      }
    }

    // 3. Get all deployments before deleting to clean up Nginx
    const allDeployments = await Deployment.find({ projectId: project._id });

    // 4. Remove Nginx location blocks for each deployment
    const nginxRouter = require('../services/nginxRouter');
    const domainVerification = require('../services/domainVerification');
    for (const deployment of allDeployments) {
      if (deployment.deploymentUrl && deployment.serverKey) {
        try {
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
        } catch (err) {
          logger.warn(`Failed to remove Nginx config for deployment ${deployment._id}: ${err.message}`);
          // Continue with deletion even if Nginx cleanup fails
        }
      }
    }

    // 5. Delete all deployment records from DB
    await Deployment.deleteMany({ projectId: project._id });
    logger.info(`Deleted all deployment records for project: ${project._id}`);

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

    // CHECK PLAN FEATURE - Custom Domains
    const owner = await User.findById(project.owner).populate('plan');
    if (!owner || !owner.plan) {
      return res.status(403).json({
        success: false,
        error: 'Plan information unavailable'
      });
    }

    const domainsFeature = owner.plan.features?.find(f => f.name === 'customDomains');
    if (!domainsFeature || !domainsFeature.enabled) {
      return res.status(403).json({
        success: false,
        error: 'Custom domains not available in your plan',
        upgrade: true
      });
    }

    // Check domain limit if configured
    const maxDomains = domainsFeature.config?.maxCustomDomains || 10;
    const customDomainCount = project.domains.filter(d => d.isCustom).length;

    if (customDomainCount >= maxDomains) {
      return res.status(403).json({
        success: false,
        error: `Maximum custom domains (${maxDomains}) reached for your plan`,
        upgrade: true
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
      verified: false,
      verificationToken: domainVerification.generateVerificationToken()
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



// Verify domain
router.post('/:id/domains/:domainId/verify', requireProjectAccess('admin'), async (req, res) => {
  try {
    const project = req.project;
    const { domainId } = req.params;

    const domainEntry = project.domains.id(domainId);
    if (!domainEntry) {
      return res.status(404).json({ success: false, error: 'Domain not found in project' });
    }

    if (domainEntry.verified) {
      return res.json({ success: true, verified: true, message: 'Domain already verified' });
    }

    // Perform DNS Verification
    const isVerified = await domainVerification.verifyDnsRecord(
      domainEntry.domain,
      domainEntry.verificationToken
    );

    if (isVerified) {
      domainEntry.verified = true;
      domainEntry.verifiedAt = new Date();
      await project.save();

      // Configure Nginx for valid domain
      // If we are dealing with external IP pointing, we might also check A record
      // But for now, if TXT matches, we enable routing.

      const serverKey = project.activeContainer?.serverKey || 'EC2';
      const serverHost = process.env[`${serverKey}_SERVER_IP`] || process.env.EC2_SERVER_IP;

      if (serverHost) {
        try {
          const deployment = await Deployment.findOne({ projectId: project._id, status: 'active' });
          if (deployment) {
            // Optimization: Only update if there is an active deployment to route to
            // But strictly speaking, the nginxRouter handles the "current active" logic usually,
            // or we might need to manually trigger a re-route.
            // Ideally nginxRouter.addNginxRouting handles adding ALL domains for a deployment.
            // We'll call a re-apply or just add this specific domain.

            // Since nginxRouter typically takes a deploymentId, we might need to update the existing routing
            // For now, let's assume we trigger an update or just mark verified. 
            // The Nginx router usually iterates over all domains in the project.

            await nginxRouter.addNginxRouting(
              deployment._id,
              project.activeContainer.name,
              project.activeContainer.port,
              serverHost,
              serverKey
            );
          }
        } catch (err) {
          logger.error('Failed to update Nginx for new verified domain:', err);
          // Don't fail the verification response, just log
        }
      }

      return res.json({
        success: true,
        verified: true,
        message: 'Domain verified successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        verified: false,
        validParams: {
          domain: domainEntry.domain,
          token: domainEntry.verificationToken,
          host: `_vcp-challenge.${domainEntry.domain}`
        },
        error: 'DNS verification failed. TXT record not found.'
      });
    }

  } catch (error) {
    logger.error('Domain verification error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to verify domain' });
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
