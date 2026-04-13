const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');
const paddleService = require('../services/paddle');
const notify = require('../services/notificationService');

/**
 * POST /api/webhooks/paddle
 * Handles all Paddle webhook events
 *
 * Paddle sends webhooks for:
 * - transaction.completed / transaction.payment_failed
 * - subscription.created / updated / canceled / past_due / paused / resumed / activated
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Get raw body for signature verification
    const rawBody = typeof req.body === 'string' ? req.body : req.body.toString('utf8');
    const signatureHeader = req.headers['paddle-signature'];

    // Get webhook secret from settings
    const credentials = await paddleService.getActiveCredentials();
    const webhookSecret = credentials.webhookSecret;

    if (!webhookSecret) {
      logger.error('Paddle webhook: No webhook secret configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Verify signature
    if (!paddleService.verifyWebhookSignature(rawBody, signatureHeader, webhookSecret)) {
      logger.warn('Paddle webhook: Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse the event
    const event = JSON.parse(rawBody);
    const eventType = event.event_type;
    const data = event.data;

    logger.info(`Paddle webhook received: ${eventType}`, { eventId: event.event_id });

    // Handle each event type
    switch (eventType) {
      case 'transaction.completed':
        await handleTransactionCompleted(data);
        break;

      case 'transaction.payment_failed':
        await handleTransactionFailed(data);
        break;

      case 'subscription.created':
        await handleSubscriptionCreated(data);
        break;

      case 'subscription.updated':
        await handleSubscriptionUpdated(data);
        break;

      case 'subscription.canceled':
        await handleSubscriptionCanceled(data);
        break;

      case 'subscription.past_due':
        await handleSubscriptionPastDue(data);
        break;

      case 'subscription.paused':
        await handleSubscriptionPaused(data);
        break;

      case 'subscription.resumed':
        await handleSubscriptionResumed(data);
        break;

      case 'subscription.activated':
        await handleSubscriptionActivated(data);
        break;

      default:
        logger.info(`Paddle webhook: Unhandled event type: ${eventType}`);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Paddle webhook error:', error.message);
    // Return 200 even on error to prevent Paddle from retrying indefinitely
    res.status(200).json({ received: true, error: error.message });
  }
});

/**
 * Handle transaction.completed — payment succeeded
 */
async function handleTransactionCompleted(data) {
  const transactionId = data.id;
  const customData = data.custom_data || {};
  const userId = customData.userId;
  const planId = customData.planId;
  const billingPeriod = parseInt(customData.billingPeriod) || 1;
  const subscriptionId = data.subscription_id;
  const customerId = data.customer_id;

  if (!userId || !planId) {
    logger.warn('Paddle transaction.completed: Missing userId or planId in custom_data', { transactionId });
    return;
  }

  try {
    // Idempotency check — Paddle retries on failed acks; reject duplicate processing
    const existingPayment = await Payment.findOne({ paddleTransactionId: transactionId, status: 'completed' });
    if (existingPayment) {
      logger.info('Paddle transaction.completed: Already processed (idempotency hit)', { transactionId });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      logger.error('Paddle transaction.completed: User not found', { userId, transactionId });
      return;
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      logger.error('Paddle transaction.completed: Plan not found', { planId, transactionId });
      return;
    }

    // Calculate amount from transaction
    const amount = data.details?.totals?.total
      ? parseInt(data.details.totals.total) / 100
      : 0;
    const currency = data.currency_code || 'USD';

    // Create/update payment record
    await Payment.markCompleted(transactionId, {
      userId: user._id,
      amount,
      currency,
      planId: plan._id,
      planName: plan.displayName,
      description: `${plan.displayName} Plan - ${billingPeriod} month(s) via Paddle`,
      gateway: 'paddle',
      paymentMethod: 'card',
      subscriptionId,
      customerId
    });

    // Update user's Paddle IDs
    if (customerId) user.paddleCustomerId = customerId;
    if (subscriptionId) user.paddleSubscriptionId = subscriptionId;

    // Reset suspension/deletion flags if user was previously suspended
    if (user.resourcesDeleted) {
      user.resourcesDeleted = false;
      user.resourcesDeletedAt = null;
      user.oracleAccountId = null;
      user.containerId = null;
      user.containerName = null;
      user.assignedServer = null;
      user.assignedPort = null;
    }

    // Activate plan
    user.plan = plan._id;
    user.planType = plan.isTrial || plan.pricing.usd === 0 ? 'free' : plan.name;
    user.subscriptionStatus = 'active';
    user.status = 'active';
    user.isTrialActive = false;
    user.billingPeriod = billingPeriod;

    // Set expiration using calendar months (not 30-day approximation)
    const now = new Date();
    user.planExpiresAt = new Date(now.getTime() + billingPeriod * 30 * 24 * 60 * 60 * 1000);
    user.gracePeriodEndsAt = null;
    user.scheduledDeletionAt = null;
    user.scheduledDowngradeTo = null;
    user.scheduledDowngradeAt = null;

    // Set resource allocation from plan
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

    // Immediately update container resource limits if container exists
    if (user.containerName && user.assignedServer) {
      try {
        const docker = require('../services/docker');
        const host = process.env[`${user.assignedServer}_HOST`] || process.env.EC3_SERVER_IP;
        const ramGB = plan.actualResources?.ram || plan.resources?.ram || 0.5;
        const cpu = plan.actualResources?.cpu || plan.resources?.cpu || 0.5;
        await docker.updateContainerResources(user.containerName, { memory: ramGB * 1024, cpu }, host);
        logger.info(`[Paddle] Container ${user.containerName} resources updated: ${ramGB}GB RAM, ${cpu} CPU`);
      } catch (dockerErr) {
        logger.warn(`[Paddle] Container resource update failed: ${dockerErr.message}`);
      }
    }

    // Update plan user count
    await Plan.findByIdAndUpdate(planId, { $inc: { userCount: 1 } });

    logger.billing('Paddle payment completed - plan activated', {
      userId: user._id,
      planId: plan._id,
      planName: plan.displayName,
      amount,
      currency,
      transactionId,
      subscriptionId
    });

    // Send notification
    try {
      await notify.planUpgraded(user, plan.displayName);
    } catch (notifyErr) {
      logger.warn('Plan upgrade notification failed:', notifyErr.message);
    }
  } catch (error) {
    logger.error('Paddle handleTransactionCompleted error:', error.message);
  }
}

/**
 * Handle transaction.payment_failed
 */
async function handleTransactionFailed(data) {
  const transactionId = data.id;
  const customData = data.custom_data || {};
  const userId = customData.userId;

  logger.warn('Paddle payment failed', { transactionId, userId });

  // Mark payment as failed if it exists
  try {
    await Payment.markFailed(transactionId, 'Payment failed via Paddle');
  } catch (error) {
    logger.error('Failed to mark Paddle payment as failed:', error.message);
  }

  // Notify user
  if (userId) {
    try {
      const user = await User.findById(userId);
      if (user) {
        await notify.paymentFailed(user, 'Your payment could not be processed. Please try again or use a different payment method.');
      }
    } catch (error) {
      logger.error('Failed to notify user of payment failure:', error.message);
    }
  }
}

/**
 * Handle subscription.created
 */
async function handleSubscriptionCreated(data) {
  const subscriptionId = data.id;
  const customerId = data.customer_id;
  const customData = data.custom_data || {};
  const userId = customData.userId;

  if (!userId) return;

  try {
    await User.findByIdAndUpdate(userId, {
      paddleSubscriptionId: subscriptionId,
      paddleCustomerId: customerId
    });
    logger.info('Paddle subscription created', { userId, subscriptionId });
  } catch (error) {
    logger.error('Paddle handleSubscriptionCreated error:', error.message);
  }
}

/**
 * Handle subscription.updated — plan change
 */
async function handleSubscriptionUpdated(data) {
  const subscriptionId = data.id;
  const customData = data.custom_data || {};
  const userId = customData.userId;

  logger.info('Paddle subscription updated', { subscriptionId, userId });

  // If there's a new plan in custom_data, update accordingly
  if (userId && customData.planId) {
    try {
      const plan = await Plan.findById(customData.planId);
      if (plan) {
        const user = await User.findById(userId);
        if (user) {
          user.plan = plan._id;
          await user.save();

          // Update container resources if container exists
          if (user.containerName && user.assignedServer) {
            try {
              const docker = require('../services/docker');
              const host = process.env[`${user.assignedServer}_HOST`] || process.env.EC3_SERVER_IP;
              const ramGB = plan.actualResources?.ram || plan.resources?.ram || 0.5;
              const cpu = plan.actualResources?.cpu || plan.resources?.cpu || 0.5;
              await docker.updateContainerResources(user.containerName, { memory: ramGB * 1024, cpu }, host);
              logger.info(`[Paddle] Container ${user.containerName} resources updated on subscription change`);
            } catch (dockerErr) {
              logger.warn(`[Paddle] Container resource update failed on subscription change: ${dockerErr.message}`);
            }
          }

          logger.info('User plan updated via subscription change', { userId, planId: plan._id });
        }
      }
    } catch (error) {
      logger.error('Paddle handleSubscriptionUpdated error:', error.message);
    }
  }
}

/**
 * Handle subscription.canceled — user canceled
 */
async function handleSubscriptionCanceled(data) {
  const subscriptionId = data.id;

  try {
    const user = await User.findOne({ paddleSubscriptionId: subscriptionId });
    if (!user) {
      logger.warn('Paddle subscription.canceled: User not found', { subscriptionId });
      return;
    }

    // Schedule downgrade at end of current period (don't immediately cancel)
    user.subscriptionStatus = 'cancelled';
    // planExpiresAt stays the same — user keeps access until period ends
    await user.save();

    logger.billing('Paddle subscription canceled', {
      userId: user._id,
      subscriptionId,
      accessUntil: user.planExpiresAt
    });

    try {
      await notify.subscriptionCancelled(user);
    } catch (notifyErr) {
      logger.warn('Subscription cancellation notification failed:', notifyErr.message);
    }
  } catch (error) {
    logger.error('Paddle handleSubscriptionCanceled error:', error.message);
  }
}

/**
 * Handle subscription.past_due — payment overdue
 */
async function handleSubscriptionPastDue(data) {
  const subscriptionId = data.id;

  try {
    const user = await User.findOne({ paddleSubscriptionId: subscriptionId }).populate('plan');
    if (!user) return;

    user.subscriptionStatus = 'past_due';

    // Initialize grace period if not already set — gives user time to update payment
    if (!user.gracePeriodEndsAt) {
      let graceDays = 10;
      if (user.plan?.billingPeriods?.length > 0 && user.billingPeriod) {
        const periodConfig = user.plan.billingPeriods.find(p => p.months === user.billingPeriod);
        if (periodConfig?.gracePeriodDays) graceDays = periodConfig.gracePeriodDays;
      }
      user.gracePeriodEndsAt = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000);
    }

    await user.save();

    logger.warn('Paddle subscription past due', { userId: user._id, subscriptionId });

    try {
      await notify.paymentFailed(user, 'Your subscription payment is overdue. Please update your payment method to avoid service interruption.');
    } catch (notifyErr) {
      logger.warn('Past due notification failed:', notifyErr.message);
    }
  } catch (error) {
    logger.error('Paddle handleSubscriptionPastDue error:', error.message);
  }
}

/**
 * Handle subscription.paused
 */
async function handleSubscriptionPaused(data) {
  const subscriptionId = data.id;

  try {
    const user = await User.findOne({ paddleSubscriptionId: subscriptionId });
    if (!user) return;

    user.subscriptionStatus = 'cancelled'; // treat paused as cancelled
    user.status = 'suspended';
    await user.save();

    logger.info('Paddle subscription paused', { userId: user._id, subscriptionId });
  } catch (error) {
    logger.error('Paddle handleSubscriptionPaused error:', error.message);
  }
}

/**
 * Handle subscription.resumed
 */
async function handleSubscriptionResumed(data) {
  const subscriptionId = data.id;

  try {
    const user = await User.findOne({ paddleSubscriptionId: subscriptionId });
    if (!user) return;

    user.subscriptionStatus = 'active';
    user.status = 'active';
    await user.save();

    logger.info('Paddle subscription resumed', { userId: user._id, subscriptionId });
  } catch (error) {
    logger.error('Paddle handleSubscriptionResumed error:', error.message);
  }
}

/**
 * Handle subscription.activated
 */
async function handleSubscriptionActivated(data) {
  const subscriptionId = data.id;

  try {
    const user = await User.findOne({ paddleSubscriptionId: subscriptionId });
    if (!user) return;

    user.subscriptionStatus = 'active';
    user.status = 'active';
    await user.save();

    logger.info('Paddle subscription activated', { userId: user._id, subscriptionId });
  } catch (error) {
    logger.error('Paddle handleSubscriptionActivated error:', error.message);
  }
}

module.exports = router;
