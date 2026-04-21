const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../utils/logger');
const Project = require('../models/Project');
const Deployment = require('../models/Deployment');
const Payment = require('../models/Payment');
const { hasFeature } = require('../utils/featureCheck');
const notify = require('../services/notificationService');
const { resolveHost } = require('../utils/serverResolver');

/**
 * Verify GitHub webhook signature
 * IMPORTANT: Must use the raw request body, not JSON.stringify(req.body),
 * since re-serialization may not match GitHub's original bytes.
 */
function verifyGitHubSignature(req, secret) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  // req.rawBody is captured by the express.json verify callback in server.js
  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);

  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(rawBody).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    return false;
  }
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

    const deployment = await Deployment.create({
      projectId: project._id,
      userId: project.owner._id,
      commitSHA: payload.head_commit.id,
      commitMessage: payload.head_commit.message,
      branch,
      trigger: 'webhook',
      status: 'pending'
    });

    // Trigger build asynchronously (don't await - let webhook return quickly)
    const buildExecutor = require('../services/buildExecutor');
    buildExecutor.executeBuild(deployment._id, {
      onProgress: (progress) => {
        deployment.progress = progress;
        deployment.save().catch(() => { });
      },
      onLog: (level, message) => {
        logger.info(`[Auto-deploy ${project.name}] ${message}`);
      }
    }).catch(err => {
      logger.error(`Auto-deploy build failed for ${project.name}:`, err.message);
    });
  }
}


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
            const billingPeriod = parseInt(result.metadata?.billing_period) || 1;
            const expiryDate = new Date();
            expiryDate.setMonth(expiryDate.getMonth() + billingPeriod);

            user.plan = plan._id;
            user.planType = plan.isTrial || plan.pricing.usd === 0 ? 'free' : plan.name;
            user.subscriptionStatus = 'active';
            user.status = 'active';
            user.isTrialActive = false;
            user.billingPeriod = billingPeriod;
            user.planExpiresAt = expiryDate;
            user.suspendedAt = null;
            user.suspensionReason = null;
            user.autoSuspended = false;
            user.gracePeriodEndsAt = null;
            user.scheduledDeletionAt = null;
            user.scheduledDowngradeTo = null;
            user.scheduledDowngradeAt = null;

            user.resourceAllocation = {
              projects: plan.resources.projects,
              deployments: plan.limits?.deploymentsPerDay || 100,
              cpu: plan.resources.cpu,
              ram: plan.resources.ram,
              storage: plan.resources.storage,
              bandwidth: plan.resources.bandwidth,
              containers: plan.resources.containers
            };
            user.displayedResources = {
              cpu: plan.displayResources?.cpu || plan.resources.cpu,
              ram: plan.displayResources?.ram || plan.resources.ram,
              storage: plan.displayResources?.storage || plan.resources.storage,
              bandwidth: plan.displayResources?.bandwidth || plan.resources.bandwidth,
              projects: plan.displayResources?.projects || plan.resources.projects
            };
            user.allocatedResources = {
              cpu: plan.actualResources?.cpu || plan.resources.cpu,
              ram: plan.actualResources?.ram || plan.resources.ram,
              storage: plan.actualResources?.storage || plan.resources.storage,
              bandwidth: plan.actualResources?.bandwidth || plan.resources.bandwidth,
              projects: plan.actualResources?.projects || plan.resources.projects
            };

            await user.save();

            // IMMEDIATE: Update container resource limits
            if (user.containerName && user.assignedServer) {
              try {
                const docker = require('../services/docker');
                const host = resolveHost(user.assignedServer);
                const ramGB = plan.actualResources?.ram || plan.resources?.ram || 0.5;
                const cpu = plan.actualResources?.cpu || plan.resources?.cpu || 0.5;
                await docker.updateContainerResources(user.containerName, { memory: ramGB * 1024, cpu }, host);
                logger.info(`[JazzCash] ✅ Container ${user.containerName} resources updated: ${ramGB * 1024}MB RAM`);
              } catch (dockerErr) {
                logger.warn(`[JazzCash] Container resource update failed: ${dockerErr.message}`);
              }
            }

            logger.info('User plan upgraded via JazzCash', {
              userId: user._id,
              planName: plan.displayName,
              amount: result.amount
            });

            try {
              await notify.paymentVerified(user, plan.displayName, result.amount, 'PKR');
              await notify.planUpgraded(user, plan.displayName);
            } catch (notifyErr) {
              logger.warn('JazzCash payment notification failed:', notifyErr.message);
            }
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

    // Verify signature — REQUIRED to prevent forged callbacks unlocking paid plans
    if (!easypaisaService.verifySignature(data)) {
      logger.error('EasyPaisa webhook: Invalid signature', { orderRefNum: data.orderRefNum });
      return;
    }

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
      const pendingPayment = await Payment.findOne({
        $or: [
          { btcpayInvoiceId: result.orderId },
          { paddleTransactionId: result.orderId },
          { payoneerSessionId: result.orderId },
          { _id: result.orderId }
        ]
      });
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
            const billingPeriod = pendingPayment.billingPeriod || 1;
            const expiryDate = new Date();
            expiryDate.setMonth(expiryDate.getMonth() + billingPeriod);

            user.plan = plan._id;
            user.planType = plan.isTrial || plan.pricing.usd === 0 ? 'free' : plan.name;
            user.subscriptionStatus = 'active';
            user.status = 'active';
            user.isTrialActive = false;
            user.billingPeriod = billingPeriod;
            user.planExpiresAt = expiryDate;
            user.suspendedAt = null;
            user.suspensionReason = null;
            user.autoSuspended = false;
            user.gracePeriodEndsAt = null;
            user.scheduledDeletionAt = null;
            user.scheduledDowngradeTo = null;
            user.scheduledDowngradeAt = null;

            user.resourceAllocation = {
              projects: plan.resources.projects,
              deployments: plan.limits?.deploymentsPerDay || 100,
              cpu: plan.resources.cpu,
              ram: plan.resources.ram,
              storage: plan.resources.storage,
              bandwidth: plan.resources.bandwidth,
              containers: plan.resources.containers
            };
            user.displayedResources = {
              cpu: plan.displayResources?.cpu || plan.resources.cpu,
              ram: plan.displayResources?.ram || plan.resources.ram,
              storage: plan.displayResources?.storage || plan.resources.storage,
              bandwidth: plan.displayResources?.bandwidth || plan.resources.bandwidth,
              projects: plan.displayResources?.projects || plan.resources.projects
            };
            user.allocatedResources = {
              cpu: plan.actualResources?.cpu || plan.resources.cpu,
              ram: plan.actualResources?.ram || plan.resources.ram,
              storage: plan.actualResources?.storage || plan.resources.storage,
              bandwidth: plan.actualResources?.bandwidth || plan.resources.bandwidth,
              projects: plan.actualResources?.projects || plan.resources.projects
            };

            await user.save();

            // IMMEDIATE: Update container resource limits
            if (user.containerName && user.assignedServer) {
              try {
                const docker = require('../services/docker');
                const host = resolveHost(user.assignedServer);
                const ramGB = plan.actualResources?.ram || plan.resources?.ram || 0.5;
                const cpu = plan.actualResources?.cpu || plan.resources?.cpu || 0.5;
                await docker.updateContainerResources(user.containerName, { memory: ramGB * 1024, cpu }, host);
                logger.info(`[EasyPaisa] ✅ Container ${user.containerName} resources updated: ${ramGB * 1024}MB RAM`);
              } catch (dockerErr) {
                logger.warn(`[EasyPaisa] Container resource update failed: ${dockerErr.message}`);
              }
            }

            logger.info('User plan upgraded via EasyPaisa', {
              userId: user._id,
              planName: plan.displayName,
              amount: result.amount
            });

            try {
              await notify.paymentVerified(user, plan.displayName, result.amount, 'PKR');
              await notify.planUpgraded(user, plan.displayName);
            } catch (notifyErr) {
              logger.warn('EasyPaisa payment notification failed:', notifyErr.message);
            }
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

/**
 * POST /api/webhooks/btcpay - Handle BTCPay Server payment webhooks
 * Automatically verifies crypto payments via blockchain
 */
router.post('/btcpay', express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }), async (req, res) => {
  try {
    const btcpayService = require('../services/btcpay');
    const signature = req.headers['btcpay-sig'];
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);

    // Verify webhook signature — REQUIRED to prevent forged webhooks
    if (!signature) {
      logger.error('BTCPay webhook: Missing signature header');
      return res.status(401).json({ error: 'Missing signature header' });
    }
    const isValid = await btcpayService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.error('BTCPay webhook: Invalid signature');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    // Quick acknowledgment
    res.status(200).json({ received: true });

    const event = req.body;
    logger.info('BTCPay webhook received', { type: event.type, invoiceId: event.invoiceId });

    // Handle the webhook event
    const result = await btcpayService.handleWebhook(event);

    if (!result.success) {
      logger.error('BTCPay webhook handler error:', result.error);
      return;
    }

    // On payment settled (fully confirmed) - activate user plan
    if (result.action === 'payment_settled' || result.action === 'payment_confirmed') {
      const invoiceId = result.invoiceId;

      // Get invoice details from BTCPay to extract metadata
      const invoiceResult = await btcpayService.getInvoice(invoiceId);
      if (!invoiceResult.success) {
        logger.error('BTCPay: Failed to fetch invoice details', { invoiceId });
        return;
      }

      const metadata = invoiceResult.data.metadata || {};
      const userId = metadata.userId;
      const planId = metadata.planId;
      const billingPeriod = metadata.billingPeriod || 1;

      if (!userId || !planId) {
        logger.error('BTCPay webhook: Missing userId or planId in invoice metadata', { invoiceId });
        return;
      }

      // Record payment as completed
      try {
        await Payment.markCompleted(invoiceId, {
          gateway: 'btcpay',
          userId,
          planId,
          planName: metadata.planName,
          amount: invoiceResult.data.amount,
          currency: invoiceResult.data.currency,
          paymentMethod: 'crypto_btcpay',
          metadata: { invoiceId, btcpayStatus: invoiceResult.data.status }
        });
        logger.info('BTCPay payment recorded', { invoiceId, userId });
      } catch (dbError) {
        logger.error('Failed to record BTCPay payment:', dbError.message);
      }

      // Upgrade user plan
      try {
        const User = require('../models/User');
        const Plan = require('../models/Plan');
        const user = await User.findById(userId);
        const plan = await Plan.findById(planId);

        if (user && plan) {
          // Reset resource deletion flags if account was suspended
          if (user.resourcesDeleted) {
            user.resourcesDeleted = false;
            user.resourcesDeletedAt = null;
            user.oracleAccountId = null;
            user.containerId = null;
            user.containerName = null;
            user.assignedServer = null;
            user.assignedPort = null;
          }

          // Calculate plan expiry based on billing period
          const now = new Date();
          const expiryDate = new Date(now);
          expiryDate.setMonth(expiryDate.getMonth() + billingPeriod);

          user.plan = plan._id;
          user.planType = plan.isTrial || plan.pricing.usd === 0 ? 'free' : plan.name;
          user.subscriptionStatus = 'active';
          user.status = 'active';
          user.isTrialActive = false;
          user.billingPeriod = billingPeriod;
          user.planExpiresAt = expiryDate;
          user.suspendedAt = null;
          user.suspensionReason = null;
          user.autoSuspended = false;
          user.gracePeriodEndsAt = null;
          user.scheduledDeletionAt = null;
          user.scheduledDowngradeTo = null;
          user.scheduledDowngradeAt = null;

          // Set resource allocation from plan (must match Paddle webhook behavior)
          user.resourceAllocation = {
            projects: plan.resources.projects,
            deployments: plan.limits?.deploymentsPerDay || 100,
            cpu: plan.resources.cpu,
            ram: plan.resources.ram,
            storage: plan.resources.storage,
            bandwidth: plan.resources.bandwidth,
            containers: plan.resources.containers
          };

          user.displayedResources = {
            cpu: plan.displayResources?.cpu || plan.resources.cpu,
            ram: plan.displayResources?.ram || plan.resources.ram,
            storage: plan.displayResources?.storage || plan.resources.storage,
            bandwidth: plan.displayResources?.bandwidth || plan.resources.bandwidth,
            projects: plan.displayResources?.projects || plan.resources.projects
          };

          user.allocatedResources = {
            cpu: plan.actualResources?.cpu || plan.resources.cpu,
            ram: plan.actualResources?.ram || plan.resources.ram,
            storage: plan.actualResources?.storage || plan.resources.storage,
            bandwidth: plan.actualResources?.bandwidth || plan.resources.bandwidth,
            projects: plan.actualResources?.projects || plan.resources.projects
          };

          await user.save();

          // Update container resource limits if container exists
          if (user.containerName && user.assignedServer) {
            try {
              const docker = require('../services/docker');
              const host = resolveHost(user.assignedServer);
              const ramGB = plan.actualResources?.ram || plan.resources?.ram || 0.5;
              const cpu = plan.actualResources?.cpu || plan.resources?.cpu || 0.5;
              await docker.updateContainerResources(user.containerName, { memory: ramGB * 1024, cpu }, host);
              logger.info(`[BTCPay] Container ${user.containerName} resources updated`);
            } catch (dockerErr) {
              logger.warn(`[BTCPay] Container resource update failed: ${dockerErr.message}`);
            }
          }

          logger.info('User plan upgraded via BTCPay', {
            userId: user._id,
            planName: plan.displayName,
            amount: invoiceResult.data.amount
          });

          // Send notifications
          try {
            await notify.paymentVerified(user, plan.displayName, invoiceResult.data.amount, invoiceResult.data.currency);
            await notify.planUpgraded(user, plan.displayName);
          } catch (notifyErr) {
            logger.warn('BTCPay notification failed:', notifyErr.message);
          }
        }
      } catch (upgradeErr) {
        logger.error('Failed to upgrade user after BTCPay payment:', upgradeErr.message);
      }
    }

    // On invoice expired
    if (result.action === 'invoice_expired') {
      try {
        await Payment.markFailed(result.invoiceId, 'BTCPay invoice expired - customer did not pay in time');
      } catch (dbErr) {
        logger.error('Failed to record BTCPay expiry:', dbErr.message);
      }
    }

  } catch (error) {
    logger.error('BTCPay webhook error:', error.message);
  }
});

module.exports = router;
