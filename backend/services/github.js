const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Configuration
const config = {
  apiUrl: 'https://api.github.com',
  token: process.env.GITHUB_API_TOKEN,
  webhookSecret: process.env.WEBHOOK_SECRET
};

// Helper functions
const createGitHubHeaders = (token = null) => ({
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'Vercel-Clone-Platform',
  ...(token && { 'Authorization': `Bearer ${token}` })
});

const createSuccessResponse = (data, additionalProps = {}) => ({
  success: true,
  ...additionalProps,
  data
});

const createErrorResponse = (error, fallbackMessage = 'GitHub operation failed') => ({
  success: false,
  error: error?.response?.data?.message || error?.message || fallbackMessage
});

const logGitHubOperation = (operation, details, isError = false) => {
  const logMethod = isError ? 'error' : 'info';
  logger[logMethod](`GitHub: ${operation}`, details);
};

// Repository information functions
const getRepositoryInfo = async (repoFullName, userToken = null) => {
  try {
    const token = userToken || config.token;
    const headers = createGitHubHeaders(token);

    const response = await axios.get(
      `${config.apiUrl}/repos/${repoFullName}`,
      { headers }
    );

    const repo = response.data;

    logGitHubOperation('Repository info retrieved', {
      repoFullName,
      isPrivate: repo.private,
      defaultBranch: repo.default_branch
    });

    return createSuccessResponse({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      sshUrl: repo.ssh_url,
      defaultBranch: repo.default_branch,
      isPrivate: repo.private,
      language: repo.language,
      size: repo.size,
      stargazersCount: repo.stargazers_count,
      forksCount: repo.forks_count,
      createdAt: repo.created_at,
      updatedAt: repo.updated_at,
      owner: {
        login: repo.owner.login,
        avatarUrl: repo.owner.avatar_url,
        type: repo.owner.type
      }
    });
  } catch (error) {
    logGitHubOperation('Failed to get repository info', {
      repoFullName,
      error: error.response?.data || error.message
    }, true);
    return createErrorResponse(error, 'Failed to fetch repository information');
  }
};

const listUserRepositories = async (userToken, page = 1, perPage = 30) => {
  try {
    const headers = createGitHubHeaders(userToken);

    const response = await axios.get(`${config.apiUrl}/user/repos`, {
      headers,
      params: {
        sort: 'updated',
        direction: 'desc',
        page,
        per_page: perPage,
        type: 'all'
      }
    });

    const repos = response.data.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      isPrivate: repo.private,
      language: repo.language,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
      owner: {
        login: repo.owner.login,
        avatarUrl: repo.owner.avatar_url
      }
    }));

    logGitHubOperation('User repositories listed', {
      count: repos.length,
      page,
      perPage
    });

    return createSuccessResponse(repos, {
      pagination: {
        page,
        perPage,
        hasNext: repos.length === perPage
      }
    });
  } catch (error) {
    logGitHubOperation('Failed to list user repositories', {
      error: error.response?.data || error.message
    }, true);
    return createErrorResponse(error, 'Failed to fetch repositories');
  }
};

const getRepositoryBranches = async (repoFullName, userToken = null) => {
  try {
    const token = userToken || config.token;
    const headers = createGitHubHeaders(token);

    const response = await axios.get(
      `${config.apiUrl}/repos/${repoFullName}/branches`,
      { headers }
    );

    const branches = response.data.map(branch => ({
      name: branch.name,
      commit: {
        sha: branch.commit.sha,
        url: branch.commit.url
      },
      protected: branch.protected
    }));

    logGitHubOperation('Repository branches retrieved', {
      repoFullName,
      branchCount: branches.length
    });

    return createSuccessResponse(branches);
  } catch (error) {
    logGitHubOperation('Failed to get repository branches', {
      repoFullName,
      error: error.response?.data || error.message
    }, true);
    return createErrorResponse(error, 'Failed to fetch repository branches');
  }
};

// Framework detection functions
const detectFrameworkFromPackageJson = (packageJson) => {
  try {
    const pkg = JSON.parse(packageJson);
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };

    // Framework detection based on dependencies
    if (dependencies['next']) return 'nextjs';
    if (dependencies['react'] && !dependencies['next']) return 'react';
    if (dependencies['vue']) return 'vue';
    if (dependencies['nuxt']) return 'nuxt';
    if (dependencies['svelte']) return 'svelte';
    if (dependencies['@angular/core']) return 'angular';
    if (dependencies['express']) return 'express';
    if (dependencies['fastify']) return 'fastify';
    if (dependencies['@nestjs/core']) return 'nestjs';
    if (dependencies['koa']) return 'koa';
    if (dependencies['gatsby']) return 'gatsby';

    return 'static';
  } catch (error) {
    return 'static';
  }
};

const detectFrameworkFromFiles = (files) => {
  const fileNames = files.map(f => f.name.toLowerCase());

  // Check for specific framework files
  if (fileNames.includes('next.config.js') || fileNames.includes('next.config.mjs')) {
    return 'nextjs';
  }

  if (fileNames.includes('nuxt.config.js') || fileNames.includes('nuxt.config.ts')) {
    return 'nuxt';
  }

  if (fileNames.includes('vue.config.js') || fileNames.includes('vite.config.js')) {
    return 'vue';
  }

  if (fileNames.includes('svelte.config.js')) {
    return 'svelte';
  }

  if (fileNames.includes('angular.json')) {
    return 'angular';
  }

  if (fileNames.includes('gatsby-config.js')) {
    return 'gatsby';
  }

  if (fileNames.includes('hugo.toml') || fileNames.includes('config.toml')) {
    return 'hugo';
  }

  if (fileNames.includes('_config.yml')) {
    return 'jekyll';
  }

  if (fileNames.includes('composer.json')) {
    return 'laravel'; // Could be improved to detect Laravel specifically
  }

  if (fileNames.includes('requirements.txt') || fileNames.includes('pyproject.toml')) {
    if (fileNames.some(f => f.includes('django'))) return 'django';
    if (fileNames.some(f => f.includes('flask'))) return 'flask';
  }

  return null;
};

const detectFramework = async (repoFullName, branch = 'main', userToken = null) => {
  try {
    const token = userToken || config.token;
    const headers = createGitHubHeaders(token);

    // First, try to get package.json
    try {
      const packageResponse = await axios.get(
        `${config.apiUrl}/repos/${repoFullName}/contents/package.json?ref=${branch}`,
        { headers }
      );

      if (packageResponse.data.content) {
        const packageJson = Buffer.from(packageResponse.data.content, 'base64').toString();
        const framework = detectFrameworkFromPackageJson(packageJson);

        if (framework !== 'static') {
          logGitHubOperation('Framework detected from package.json', {
            repoFullName,
            branch,
            framework
          });
          return createSuccessResponse({ framework, detectionMethod: 'package.json' });
        }
      }
    } catch (error) {
      // package.json might not exist, continue with file-based detection
    }

    // Get repository contents to detect framework from files
    const contentsResponse = await axios.get(
      `${config.apiUrl}/repos/${repoFullName}/contents?ref=${branch}`,
      { headers }
    );

    const framework = detectFrameworkFromFiles(contentsResponse.data) || 'static';

    logGitHubOperation('Framework detected from files', {
      repoFullName,
      branch,
      framework,
      fileCount: contentsResponse.data.length
    });

    return createSuccessResponse({ framework, detectionMethod: 'files' });
  } catch (error) {
    logGitHubOperation('Framework detection failed', {
      repoFullName,
      branch,
      error: error.response?.data || error.message
    }, true);

    // Default to static if detection fails
    return createSuccessResponse({ framework: 'static', detectionMethod: 'fallback' });
  }
};

// Webhook handling functions
const verifyWebhookSignature = (payload, signature) => {
  try {
    if (!config.webhookSecret) {
      logger.warn('Webhook secret not configured');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.webhookSecret)
      .update(payload)
      .digest('hex');

    const actualSignature = signature.replace('sha256=', '');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(actualSignature, 'hex')
    );
  } catch (error) {
    logGitHubOperation('Webhook signature verification failed', {
      error: error.message
    }, true);
    return false;
  }
};

const handlePushEvent = async (payload) => {
  try {
    const repoFullName = payload.repository.full_name;
    const branch = payload.ref.replace('refs/heads/', '');
    const commits = payload.commits;

    logGitHubOperation('Push event received', {
      repoFullName,
      branch,
      commitCount: commits.length,
      headCommit: payload.head_commit?.id
    });

    // Find projects that should be deployed
    const Project = require('../models/Project');
    const projects = await Project.find({
      'repository.fullName': repoFullName,
      'repository.branch': branch,
      autoDeployEnabled: true,
      status: 'active'
    }).populate('owner');

    if (projects.length === 0) {
      logGitHubOperation('No projects found for push event', {
        repoFullName,
        branch
      });
      return { success: true, message: 'No projects to deploy' };
    }

    // Trigger deployments - Create deployment records and add to queue
    const Deployment = require('../models/Deployment');
    const buildQueue = require('./buildQueue');

    const deploymentPromises = projects.map(async project => {
      try {
        // Create deployment record
        const deployment = await Deployment.create({
          projectId: project._id,
          userId: project.owner,
          branch,
          commitSha: payload.head_commit.id,
          commitMessage: payload.head_commit.message,
          commitAuthor: {
            name: payload.head_commit.author.name,
            email: payload.head_commit.author.email
          },
          status: 'queued',
          environment: 'production',
          trigger: 'webhook'
        });

        // Add to build queue
        await buildQueue.addDeployment(
          deployment._id.toString(),
          project._id.toString(),
          project.owner.toString(),
          { priority: 5 } // Medium priority for webhook deployments
        );

        // Update project stats
        project.stats.totalDeployments += 1;
        project.deploymentCount = (project.deploymentCount || 0) + 1;
        await project.save();

        return { success: true, deploymentId: deployment._id };
      } catch (error) {
        logger.error('Failed to create webhook deployment:', error);
        return { success: false, error: error.message, projectId: project._id };
      }
    });

    const deployments = await Promise.allSettled(deploymentPromises);

    logGitHubOperation('Deployments triggered from push', {
      repoFullName,
      branch,
      projectCount: projects.length,
      deploymentResults: deployments.map(d => ({
        status: d.status,
        success: d.status === 'fulfilled' ? d.value.success : false
      }))
    });

    return {
      success: true,
      projectsTriggered: projects.length,
      deployments: deployments.map(d => d.status === 'fulfilled' ? d.value : { success: false })
    };
  } catch (error) {
    logGitHubOperation('Push event handling failed', {
      error: error.message
    }, true);
    return { success: false, error: error.message };
  }
};

const handlePullRequestEvent = async (payload) => {
  try {
    const action = payload.action;
    const pr = payload.pull_request;
    const repoFullName = payload.repository.full_name;

    logGitHubOperation('Pull request event received', {
      repoFullName,
      action,
      prNumber: pr.number,
      branch: pr.head.ref
    });

    // Only handle opened and synchronize actions for preview deployments
    if (!['opened', 'synchronize'].includes(action)) {
      return { success: true, message: 'PR action not handled' };
    }

    // Find projects that should create preview deployments
    const Project = require('../models/Project');
    const projects = await Project.find({
      'repository.fullName': repoFullName,
      status: 'active'
    }).populate('owner');

    if (projects.length === 0) {
      return { success: true, message: 'No projects found for PR' };
    }

    // Trigger deployment for preview
    const Deployment = require('../models/Deployment');
    const buildQueue = require('./buildQueue');

    const deploymentPromises = projects.map(async project => {
      try {
        const deployment = await Deployment.create({
          projectId: project._id,
          userId: project.owner,
          branch: pr.head.ref,
          commitSha: pr.head.sha,
          commitMessage: pr.title,
          commitAuthor: {
            name: pr.user.login,
            email: pr.user.email || `${pr.user.login}@github.local` // GitHub API might not always provide email for PR user
          },
          status: 'queued',
          environment: 'preview',
          isPreview: true,
          trigger: 'webhook',
          pullRequest: {
            number: pr.number,
            title: pr.title,
            url: pr.html_url
          }
        });

        await buildQueue.addDeployment(
          deployment._id.toString(),
          project._id.toString(),
          project.owner.toString(),
          { priority: 5 } // Medium priority for webhook deployments
        );

        // Update project stats (optional, if preview deployments count towards total)
        // project.stats.totalDeployments += 1;
        // project.deploymentCount = (project.deploymentCount || 0) + 1;
        // await project.save();

        return { success: true, deploymentId: deployment._id };
      } catch (error) {
        logger.error(`Failed to create preview deployment for project ${project._id}:`, error);
        return { success: false, error: error.message, projectId: project._id };
      }
    });

    const deployments = await Promise.allSettled(deploymentPromises);

    logGitHubOperation('Preview deployments triggered from PR', {
      repoFullName,
      prNumber: pr.number,
      projectCount: projects.length
    });

    return {
      success: true,
      projectsTriggered: projects.length,
      deployments: deployments.map(d => d.status === 'fulfilled' ? d.value : { success: false })
    };
  } catch (error) {
    logGitHubOperation('PR event handling failed', {
      error: error.message
    }, true);
    return { success: false, error: error.message };
  }
};

const handleWebhookEvent = async (eventType, payload) => {
  try {
    logGitHubOperation('Webhook event received', {
      eventType,
      repository: payload.repository?.full_name
    });

    switch (eventType) {
      case 'push':
        return await handlePushEvent(payload);
      case 'pull_request':
        return await handlePullRequestEvent(payload);
      default:
        logGitHubOperation('Unhandled webhook event', { eventType });
        return { success: true, message: 'Event type not handled' };
    }
  } catch (error) {
    logGitHubOperation('Webhook event handling failed', {
      eventType,
      error: error.message
    }, true);
    return { success: false, error: error.message };
  }
};

// Repository access functions
const checkRepositoryAccess = async (repoFullName, userToken) => {
  try {
    const headers = createGitHubHeaders(userToken);

    const response = await axios.get(
      `${config.apiUrl}/repos/${repoFullName}`,
      { headers }
    );

    const permissions = response.data.permissions || {};

    return createSuccessResponse({
      hasAccess: true,
      permissions: {
        admin: permissions.admin || false,
        push: permissions.push || false,
        pull: permissions.pull || false
      },
      isPrivate: response.data.private
    });
  } catch (error) {
    if (error.response?.status === 404) {
      return createSuccessResponse({
        hasAccess: false,
        reason: 'Repository not found or no access'
      });
    }

    logGitHubOperation('Repository access check failed', {
      repoFullName,
      error: error.response?.data || error.message
    }, true);

    return createErrorResponse(error, 'Failed to check repository access');
  }
};

module.exports = {
  // Repository information
  getRepositoryInfo,
  listUserRepositories,
  getRepositoryBranches,
  checkRepositoryAccess,

  // Framework detection
  detectFramework,
  detectFrameworkFromPackageJson,
  detectFrameworkFromFiles,

  // Webhook handling
  verifyWebhookSignature,
  handleWebhookEvent,
  handlePushEvent,
  handlePullRequestEvent,

  // Utility functions
  createGitHubHeaders,
  createSuccessResponse,
  createErrorResponse,

  // Config access (for testing)
  getConfig: () => ({ ...config })
};
