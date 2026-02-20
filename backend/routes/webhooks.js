const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../utils/logger');
const Project = require('../models/Project');
const Deployment = require('../models/Deployment');
const { hasFeature } = require('../utils/featureCheck');

/**
 * Verify GitHub webhook signature
 */
function verifyGitHubSignature(req, secret) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

/**
 * POST /api/webhooks/github - Handle GitHub webhooks
 */
router.post('/github', express.json(), async (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    const payload = req.body;

    // Quick acknowledgment
    res.status(200).json({ received: true });

    // Handle different events
    if (event === 'pull_request') {
      await handlePullRequest(payload);
    } else if (event === 'push') {
      await handlePush(payload);
    }

  } catch (error) {
    logger.error('GitHub webhook error:', error);
    // Don't fail the webhook
  }
});

/**
 * Handle Pull Request events
 */
async function handlePullRequest(payload) {
  const action = payload.action; // opened, synchronize, closed, etc.
  const pr = payload.pull_request;
  const repo = payload.repository;

  logger.info(`PR ${action}: ${repo.full_name} #${pr.number}`);

  // Find project by repository
  const project = await Project.findOne({
    'github.fullName': repo.full_name
  }).populate('owner');

  if (!project) {
    logger.warn(`No project found for repo: ${repo.full_name}`);
    return;
  }

  // Check if user's plan has preview deployments feature
  if (!hasFeature(project.owner.plan, 'previewDeployments')) {
    logger.info(`Preview deployments not enabled for project: ${project.name}`);
    return;
  }

  // Handle different PR actions
  if (action === 'opened' || action === 'synchronize') {
    await createPreviewDeployment(project, pr);
  } else if (action === 'closed') {
    await cleanupPreviewDeployment(project, pr);
  }
}

/**
 * Create preview deployment for PR
 */
async function createPreviewDeployment(project, pr) {
  try {
    const prNumber = pr.number;
    const branch = pr.head.ref;
    const commitSHA = pr.head.sha;

    logger.info(`Creating preview deployment for PR #${prNumber} on ${project.name}`);

    // Check preview deployment limits
    const previewFeature = project.owner.plan?.features?.find(f => f.name === 'previewDeployments');
    const maxPreviews = previewFeature?.config?.maxConcurrent || 3; // Default 3

    // Count active previews
    const activePreviewsCount = await Deployment.countDocuments({
      projectId: project._id,
      'metadata.isPreview': true,
      status: { $nin: ['failed', 'cancelled', 'cleaned_up'] }
    });

    if (activePreviewsCount >= maxPreviews) {
      logger.warn(`Preview limit reached for project ${project.name}: ${activePreviewsCount}/${maxPreviews}`);
      await postLimitComment(project, pr, activePreviewsCount, maxPreviews);
      return;
    }

    // Check if preview already exists
    let deployment = await Deployment.findOne({
      projectId: project._id,
      'metadata.prNumber': prNumber,
      status: { $nin: ['failed', 'cancelled'] }
    });

    if (deployment && action === 'synchronize') {
      // Cancel existing deployment
      deployment.status = 'cancelled';
      await deployment.save();
    }

    // Create new preview deployment
    deployment = await Deployment.create({
      projectId: project._id,
      userId: project.owner._id,
      commitSHA,
      commitMessage: pr.title,
      branch,
      trigger: 'preview',
      status: 'pending',
      metadata: {
        prNumber,
        prTitle: pr.title,
        prUrl: pr.html_url,
        isPreview: true
      }
    });

    // Trigger deployment
    const buildExecutor = require('../services/buildExecutor');
    buildExecutor.executeBuild(deployment._id, {
      onProgress: (progress) => {
        deployment.progress = progress;
        deployment.save().catch(() => { });
      },
      onLog: (level, message) => {
        logger.info(`[PR #${prNumber}] ${message}`);
      }
    }).then(async (result) => {
      if (result.success) {
        // Post comment on PR with preview URL
        await postPreviewComment(project, pr, deployment);
      }
    });

    logger.info(`Preview deployment created: ${deployment._id}`);

  } catch (error) {
    logger.error(`Failed to create preview deployment:`, error);
  }
}

/**
 * Cleanup preview deployment when PR is closed/merged
 */
async function cleanupPreviewDeployment(project, pr) {
  try {
    const prNumber = pr.number;

    logger.info(`Cleaning up preview deployment for PR #${prNumber}`);

    // Find all preview deployments for this PR
    const deployments = await Deployment.find({
      projectId: project._id,
      'metadata.prNumber': prNumber
    });

    for (const deployment of deployments) {
      // Stop and remove container
      if (deployment.containerId) {
        const docker = require('../services/docker');
        try {
          await docker.stopContainer(deployment.containerId);
          await docker.removeContainer(deployment.containerId);
        } catch (err) {
          logger.warn(`Failed to cleanup container: ${err.message}`);
        }
      }

      // Mark as cleaned up
      deployment.status = 'cleaned_up';
      await deployment.save();
    }

    // Post cleanup comment on PR
    await postCleanupComment(project, pr);

    logger.info(`Preview deployment cleaned up for PR #${prNumber}`);

  } catch (error) {
    logger.error(`Failed to cleanup preview deployment:`, error);
  }
}

/**
 * Post preview URL comment on GitHub PR
 */
async function postPreviewComment(project, pr, deployment) {
  try {
    const previewUrl = getPreviewUrl(project, pr.number);

    const comment = `## ✅ Preview Deployment Ready

Your preview deployment is ready!

🔗 **Preview URL:** ${previewUrl}

📊 **Deployment Details:**
- Commit: \`${deployment.commitSHA.substring(0, 7)}\`
- Branch: \`${deployment.branch}\`
- Status: ${deployment.status}

This preview will be automatically deleted when the PR is closed or merged.`;

    await postGitHubComment(project, pr.number, comment);

  } catch (error) {
    logger.error('Failed to post preview comment:', error);
  }
}

/**
 * Post cleanup comment on GitHub PR
 */
async function postCleanupComment(project, pr) {
  try {
    const comment = `## 🧹 Preview Deployment Cleaned Up

The preview deployment for this PR has been automatically removed.`;

    await postGitHubComment(project, pr.number, comment);

  } catch (error) {
    logger.error('Failed to post cleanup comment:', error);
  }
}

/**
 * Post limit reached comment on GitHub PR
 */
async function postLimitComment(project, pr, current, max) {
  try {
    const comment = `## ⚠️ Preview Deployment Limit Reached

Cannot create preview deployment - you have reached the maximum concurrent preview limit.

**Current previews:** ${current}/${max}

Please close or merge some PRs to free up preview slots, or upgrade your plan for more concurrent previews.`;

    await postGitHubComment(project, pr.number, comment);

  } catch (error) {
    logger.error('Failed to post limit comment:', error);
  }
}

/**
 * Post comment to GitHub PR
 */
async function postGitHubComment(project, prNumber, body) {
  try {
    const { Octokit } = require('@octokit/rest');
    const octokit = new Octokit({
      auth: project.github?.accessToken || process.env.GITHUB_TOKEN
    });

    const [owner, repo] = project.github.fullName.split('/');

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body
    });

    logger.info(`Posted comment on PR #${prNumber}`);

  } catch (error) {
    logger.error('Failed to post GitHub comment:', error);
  }
}

/**
 * Generate preview URL for PR
 */
function getPreviewUrl(project, prNumber) {
  const subdomain = `pr-${prNumber}-${project.slug}`;
  const domain = process.env.PREVIEW_DOMAIN || 'preview.platform.com';
  return `https://${subdomain}.${domain}`;
}

/**
 * Handle Push events (for auto-deploy)
 */
async function handlePush(payload) {
  const branch = payload.ref.replace('refs/heads/', '');
  const repo = payload.repository;

  // Find projects with auto-deploy enabled for this branch
  const projects = await Project.find({
    'github.fullName': repo.full_name,
    'autoDeploy.enabled': true,
    'autoDeploy.branch': branch
  }).populate('owner');

  for (const project of projects) {
    logger.info(`Auto-deploying ${project.name} on push to ${branch}`);

    await Deployment.create({
      projectId: project._id,
      userId: project.owner._id,
      commitSHA: payload.head_commit.id,
      commitMessage: payload.head_commit.message,
      branch,
      trigger: 'webhook',
      status: 'pending'
    });

    // Trigger build...
  }
}

module.exports = router;
