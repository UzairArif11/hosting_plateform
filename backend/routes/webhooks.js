const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../utils/logger');
const Project = require('../models/Project');
const Deployment = require('../models/Deployment');
const Payment = require('../models/Payment');
const payoneerService = require('../services/payoneer');
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
 * Supports per-project webhook secrets with global fallback
 */
router.post('/github', express.json(), async (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    const payload = req.body;

    // Identify the repository from the payload
    const repoFullName = payload.repository?.full_name;

    // Look up the project to get per-project webhook secret
    let projectSecret = null;
    if (repoFullName) {
      const project = await Project.findOne({ 'repository.fullName': repoFullName }).select('webhookSecret');
      if (project?.webhookSecret) {
        projectSecret = project.webhookSecret;
      }
    }

    // Verify signature: prefer per-project secret, fall back to global
    const secret = projectSecret || process.env.GITHUB_WEBHOOK_SECRET;
    if (secret) {
      if (!verifyGitHubSignature(req, secret)) {
        // If per-project secret failed, also try global as fallback
        // (in case project was recently migrated but GitHub still uses old secret)
        const globalSecret = process.env.GITHUB_WEBHOOK_SECRET;
        if (!projectSecret || !globalSecret || !verifyGitHubSignature(req, globalSecret)) {
          logger.error('GitHub webhook: Invalid signature', { repo: repoFullName });
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }
    }

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
    await createPreviewDeployment(project, pr, action);
  } else if (action === 'closed') {
    await cleanupPreviewDeployment(project, pr);
  }
}

/**
 * Create preview deployment for PR
 */
async function createPreviewDeployment(project, pr, action) {
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
        const { ORACLE_SERVERS } = require('../services/containerOrchestrator');
        
        // Resolve target host for remote deployments (EC2/EC3)
        let host = null;
        if (deployment.serverKey && ORACLE_SERVERS[deployment.serverKey]) {
          host = ORACLE_SERVERS[deployment.serverKey].host;
        }

        try {
          await docker.stopContainer(deployment.containerId, host);
          await docker.removeContainer(deployment.containerId, host);
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

/**
 * POST /api/webhooks/payoneer - Handle Payoneer payment webhooks
 */
router.post('/payoneer', express.json(), async (req, res) => {
  try {
    const signature = req.headers['x-payoneer-signature'] || req.headers['x-webhook-signature'];
    const payload = JSON.stringify(req.body);

    // Verify webhook signature
    if (signature) {
      const isValid = payoneerService.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        logger.error('Payoneer webhook: Invalid signature');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    // Quick acknowledgment (Payoneer expects fast response)
    res.status(200).json({ received: true });

    const event = req.body;

    logger.info('Payoneer webhook received', {
      type: event.type,
      id: event.id,
      resourceId: event.data?.id
    });

    // Record payment in database based on event type
    if (event.type === 'payment.completed' && event.data) {
      try {
        await Payment.markCompleted(event.data.id, {
          sessionId: event.data.reference_id,
          userId: event.data.metadata?.user_id,
          planId: event.data.metadata?.plan_id,
          planName: event.data.metadata?.plan_name,
          amount: event.data.amount,
          currency: event.data.currency,
          description: event.data.description,
          paymentMethod: event.data.payment_method || 'card',
          metadata: event.data.metadata
        });
        logger.info('Payment recorded in database', { paymentId: event.data.id });
      } catch (dbError) {
        logger.error('Failed to record payment in database:', dbError.message);
      }
    } else if (event.type === 'payment.failed' && event.data) {
      try {
        await Payment.markFailed(event.data.id, event.data.failure_reason || 'Payment failed');
        logger.info('Payment failure recorded', { paymentId: event.data.id });
      } catch (dbError) {
        logger.error('Failed to record payment failure:', dbError.message);
      }
    }

    // Delegate to payoneer service for plan upgrades, status changes, etc.
    const result = await payoneerService.handleWebhook(event);

    if (!result.success) {
      logger.error('Payoneer webhook handler returned error:', result.error);
    } else {
      logger.info('Payoneer webhook processed successfully', {
        type: event.type,
        handled: result.handled
      });
    }

  } catch (error) {
    logger.error('Payoneer webhook error:', error.message);
    // Don't fail — Payoneer will retry on 5xx
  }
});

/**
 * POST /api/webhooks/jazzcash - Handle JazzCash payment callbacks
 */
router.post('/jazzcash', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const jazzcashService = require('../services/jazzcash');
    const data = req.body;

    logger.info('JazzCash webhook received', { txnRefNo: data.pp_TxnRefNo, responseCode: data.pp_ResponseCode });

    // Quick acknowledgment
    res.status(200).json({ received: true });

    // Verify signature
    if (!jazzcashService.verifySignature(data)) {
      logger.error('JazzCash webhook: Invalid signature');
      return;
    }

    // Handle callback
    const result = await jazzcashService.handleCallback(data);

    if (result.success && result.status === 'completed') {
      // Record payment
      try {
        await Payment.markCompleted(result.txnRefNo, {
          sessionId: result.txnRefNo,
          userId: result.metadata?.user_id,
          planId: result.metadata?.plan_id,
          planName: result.metadata?.plan_name,
          amount: result.amount,
          currency: 'PKR',
          paymentMethod: 'jazzcash',
          metadata: result.metadata
        });
      } catch (dbErr) {
        logger.error('Failed to record JazzCash payment:', dbErr.message);
      }

      // Upgrade user plan
      if (result.metadata?.user_id && result.metadata?.plan_id) {
        try {
          const User = require('../models/User');
          const Plan = require('../models/Plan');
          const user = await User.findById(result.metadata.user_id);
          const plan = await Plan.findById(result.metadata.plan_id);

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
            user.subscriptionStatus = 'active';
            user.status = 'active';
            user.isTrialActive = false;
            user.suspendedAt = null;
            user.suspensionReason = null;
            user.autoSuspended = false;
            await user.save();

            logger.info('User plan upgraded via JazzCash', {
              userId: user._id,
              planName: plan.displayName,
              amount: result.amount
            });
          }
        } catch (upgradeErr) {
          logger.error('Failed to upgrade user after JazzCash payment:', upgradeErr.message);
        }
      }
    } else if (result.success && result.status === 'failed') {
      try {
        await Payment.markFailed(result.txnRefNo, result.responseMessage || 'JazzCash payment failed');
      } catch (dbErr) {
        logger.error('Failed to record JazzCash failure:', dbErr.message);
      }
    }
  } catch (error) {
    logger.error('JazzCash webhook error:', error.message);
  }
});

/**
 * POST /api/webhooks/easypaisa - Handle EasyPaisa payment callbacks
 */
router.post('/easypaisa', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const easypaisaService = require('../services/easypaisa');
    const data = req.body;

    logger.info('EasyPaisa webhook received', { orderRefNum: data.orderRefNum, responseCode: data.responseCode });

    // Quick acknowledgment
    res.status(200).json({ received: true });

    // Handle callback
    const result = await easypaisaService.handleCallback(data);

    if (result.success && result.status === 'completed') {
      // Record payment — we need to find the pending payment by orderId
      try {
        await Payment.markCompleted(result.orderId, {
          sessionId: result.orderId,
          amount: result.amount,
          currency: 'PKR',
          paymentMethod: 'easypaisa',
          metadata: { transactionId: result.transactionId }
        });
      } catch (dbErr) {
        logger.error('Failed to record EasyPaisa payment:', dbErr.message);
      }

      // Look up pending payment to get userId and planId
      const pendingPayment = await Payment.findOne({ payoneerSessionId: result.orderId });
      if (pendingPayment) {
        try {
          const User = require('../models/User');
          const Plan = require('../models/Plan');
          const user = await User.findById(pendingPayment.user);
          const plan = await Plan.findById(pendingPayment.plan);

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
            user.subscriptionStatus = 'active';
            user.status = 'active';
            user.isTrialActive = false;
            user.suspendedAt = null;
            user.suspensionReason = null;
            user.autoSuspended = false;
            await user.save();

            logger.info('User plan upgraded via EasyPaisa', {
              userId: user._id,
              planName: plan.displayName,
              amount: result.amount
            });
          }
        } catch (upgradeErr) {
          logger.error('Failed to upgrade user after EasyPaisa payment:', upgradeErr.message);
        }
      }
    } else if (result.success && result.status === 'failed') {
      try {
        await Payment.markFailed(result.orderId, result.responseMessage || 'EasyPaisa payment failed');
      } catch (dbErr) {
        logger.error('Failed to record EasyPaisa failure:', dbErr.message);
      }
    }
  } catch (error) {
    logger.error('EasyPaisa webhook error:', error.message);
  }
});

module.exports = router;
