const cron = require('node-cron');
const User = require('../models/User');
const Settings = require('../models/Settings');
const logger = require('../utils/logger');
const { loadTemplate } = require('../utils/emailTemplates');

// Email sender helper — uses Settings.alertConfig (same as resourceEnforcer.js)
const sendEmail = async (to, subject, html) => {
  try {
    const nodemailer = require('nodemailer');
    const settings = await Settings.getSettings();

    if (!settings.alertConfig?.enabled || !settings.alertConfig?.email || !settings.alertConfig?.password) {
      logger.warn(`[SUBSCRIPTION] Email alerts not configured — skipping email to ${to}`);
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || undefined,
      port: process.env.SMTP_PORT || undefined,
      secure: process.env.SMTP_SECURE === 'true',
      service: !process.env.SMTP_HOST ? 'gmail' : undefined,
      auth: {
        user: settings.alertConfig.email,
        pass: settings.alertConfig.password
      }
    });

    await transporter.sendMail({
      from: `"${process.env.PLATFORM_NAME || 'RevsCore'}" <${settings.alertConfig.email}>`,
      to,
      subject,
      html
    });
    logger.info(`[SUBSCRIPTION] Email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    logger.error(`[SUBSCRIPTION] Failed to send email to ${to}:`, error.message);
    return false;
  }
};

const platformName = process.env.PLATFORM_NAME || 'RevsCore';
const renewUrl = `${process.env.FRONTEND_URL}/dashboard/billing`;

const checkSubscriptions = async () => {
  const now = new Date();
  logger.info('[SUBSCRIPTION] Running subscription lifecycle check...');

  try {
    const settings = await Settings.getSettings();

    // ──────────────────────────────────────────────
    // STEP 1: Warning emails 10 days before expiry
    // ──────────────────────────────────────────────
    const tenDaysFromNow = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const warningUsers = await User.find({
      subscriptionStatus: 'active',
      planExpiresAt: { $lte: tenDaysFromNow, $gt: now },
      $or: [
        { lastRenewalReminder: null },
        { lastRenewalReminder: { $lt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) } }
      ]
    }).populate('plan');

    for (const user of warningUsers) {
      const daysLeft = Math.ceil((user.planExpiresAt - now) / (1000 * 60 * 60 * 24));
      const html = loadTemplate('renewalWarning', {
        platformName,
        userName: user.displayName || user.username,
        planName: user.plan?.displayName || 'your plan',
        daysLeft: String(daysLeft),
        expiryDate: user.planExpiresAt.toLocaleDateString(),
        renewUrl
      });

      await sendEmail(user.email, `⚠️ Your subscription expires in ${daysLeft} days`, html);
      user.lastRenewalReminder = now;
      await user.save();
      logger.info(`[SUBSCRIPTION] Warning sent to ${user.email} — ${daysLeft} days left`);
    }

    // ──────────────────────────────────────────────
    // STEP 2: Expired subscriptions → enter grace period
    // ──────────────────────────────────────────────
    const expiredUsers = await User.find({
      subscriptionStatus: 'active',
      planExpiresAt: { $lte: now },
      gracePeriodEndsAt: null
    }).populate('plan');

    for (const user of expiredUsers) {
      let graceDays = 10;
      if (user.plan?.billingPeriods?.length > 0 && user.billingPeriod) {
        const periodConfig = user.plan.billingPeriods.find(p => p.months === user.billingPeriod);
        if (periodConfig?.gracePeriodDays) graceDays = periodConfig.gracePeriodDays;
      }
      const gracePeriodEnd = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);
      user.subscriptionStatus = 'past_due';
      user.gracePeriodEndsAt = gracePeriodEnd;
      user.lastGracePeriodReminder = null;
      await user.save();

      const html = loadTemplate('subscriptionExpired', {
        platformName,
        userName: user.displayName || user.username,
        graceDays: String(graceDays),
        gracePeriodEnd: gracePeriodEnd.toLocaleDateString(),
        renewUrl
      });

      await sendEmail(user.email, `🔴 Subscription expired — ${graceDays}-day grace period started`, html);
      logger.info(`[SUBSCRIPTION] Grace period started for ${user.email} — ends ${gracePeriodEnd.toLocaleDateString()}`);
    }

    // ──────────────────────────────────────────────
    // STEP 3: Grace period reminders every 3 days
    // ──────────────────────────────────────────────
    const gracePeriodUsers = await User.find({
      subscriptionStatus: 'past_due',
      gracePeriodEndsAt: { $gt: now },
      $or: [
        { lastGracePeriodReminder: null },
        { lastGracePeriodReminder: { $lt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) } }
      ]
    });

    for (const user of gracePeriodUsers) {
      const daysLeft = Math.ceil((user.gracePeriodEndsAt - now) / (1000 * 60 * 60 * 24));
      const html = loadTemplate('gracePeriodReminder', {
        platformName,
        userName: user.displayName || user.username,
        daysLeft: String(daysLeft),
        renewUrl
      });

      await sendEmail(user.email, `⏰ Grace period: ${daysLeft} days left to renew`, html);
      user.lastGracePeriodReminder = now;
      await user.save();
      logger.info(`[SUBSCRIPTION] Grace reminder sent to ${user.email} — ${daysLeft} days left`);
    }

    // ──────────────────────────────────────────────
    // STEP 4: Suspend accounts after grace period ends
    //         Docker STOP (not remove) — data preserved
    // ──────────────────────────────────────────────
    const { suspendUserContainer } = require('../services/freeTierContainer');

    const suspendUsers = await User.find({
      subscriptionStatus: 'past_due',
      gracePeriodEndsAt: { $lte: now }
    });

    for (const user of suspendUsers) {
      // Stop Docker container (preserve data)
      await suspendUserContainer(user);

      user.status = 'suspended';
      user.subscriptionStatus = 'expired';
      user.suspendedAt = now;
      user.suspensionReason = 'Subscription expired — grace period ended';
      user.autoSuspended = true;

      // Schedule deletion if admin has configured it
      if (settings.accountDeletion?.enabled && settings.accountDeletion?.daysAfterSuspension > 0) {
        const deletionDate = new Date(now.getTime() + settings.accountDeletion.daysAfterSuspension * 24 * 60 * 60 * 1000);
        user.scheduledDeletionAt = deletionDate;
        user.lastDeletionWarning = null;
      }

      await user.save();

      let deletionNotice = 'Your data will be preserved indefinitely. Renew anytime to reactivate.';
      if (user.scheduledDeletionAt) {
        const delDays = settings.accountDeletion.daysAfterSuspension;
        deletionNotice = `If not renewed within ${delDays} days, your account and data will be permanently deleted on ${user.scheduledDeletionAt.toLocaleDateString()}.`;
      }

      const html = loadTemplate('accountSuspended', {
        platformName,
        userName: user.displayName || user.username,
        renewUrl,
        deletionNotice
      });

      await sendEmail(user.email, `🚫 Account Suspended — Subscription not renewed`, html);
      logger.info(`[SUBSCRIPTION] Account suspended: ${user.email}${user.scheduledDeletionAt ? ` (deletion: ${user.scheduledDeletionAt.toLocaleDateString()})` : ' (no auto-delete)'}`);
    }

    // ──────────────────────────────────────────────
    // STEP 5: Deletion warning emails (3 emails, every 3 days)
    //         Only for accounts with scheduledDeletionAt set
    // ──────────────────────────────────────────────
    if (settings.accountDeletion?.enabled) {
      const warningDays = settings.accountDeletion.warningEmailDays || 10;
      const warningThreshold = new Date(now.getTime() + warningDays * 24 * 60 * 60 * 1000);

      const deletionWarningUsers = await User.find({
        status: 'suspended',
        scheduledDeletionAt: { $lte: warningThreshold, $gt: now },
        $or: [
          { lastDeletionWarning: null },
          { lastDeletionWarning: { $lt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) } }
        ]
      });

      for (const user of deletionWarningUsers) {
        const daysLeft = Math.ceil((user.scheduledDeletionAt - now) / (1000 * 60 * 60 * 24));
        const html = loadTemplate('deletionWarning', {
          platformName,
          userName: user.displayName || user.username,
          daysLeft: String(daysLeft),
          deletionDate: user.scheduledDeletionAt.toLocaleDateString(),
          renewUrl
        });

        await sendEmail(user.email, `⚠️ URGENT: Account will be deleted in ${daysLeft} days`, html);
        user.lastDeletionWarning = now;
        await user.save();
        logger.info(`[SUBSCRIPTION] Deletion warning sent to ${user.email} — ${daysLeft} days until deletion`);
      }
    }

    // ──────────────────────────────────────────────
    // STEP 6: Auto-delete accounts after scheduled date
    //         Remove Docker container + all project data
    // ──────────────────────────────────────────────
    if (settings.accountDeletion?.enabled) {
      const { removeUserContainer } = require('../services/freeTierContainer');
      const Project = require('../models/Project');
      const Deployment = require('../models/Deployment');

      const deleteUsers = await User.find({
        status: 'suspended',
        scheduledDeletionAt: { $lte: now }
      });

      for (const user of deleteUsers) {
        logger.info(`[SUBSCRIPTION] Auto-deleting account: ${user.email}`);

        // Remove Docker container and all data
        await removeUserContainer(user);

        // Delete all projects and deployments
        await Project.deleteMany({ owner: user._id });
        await Deployment.deleteMany({ userId: user._id });

        // Mark user as deleted (soft delete — keep email for records)
        user.status = 'deleted';
        user.subscriptionStatus = 'cancelled';
        user.resourcesDeleted = true;
        user.resourcesDeletedAt = now;
        user.containerName = null;
        user.containerId = null;
        user.assignedServer = null;
        user.assignedPort = null;
        await user.save();

        await sendEmail(
          user.email,
          `Account Deleted — ${platformName}`,
          loadTemplate('accountDeleted', {
            platformName,
            userName: user.displayName || user.username,
            signupUrl: `${process.env.FRONTEND_URL}/register`
          })
        );

        logger.info(`[SUBSCRIPTION] Account deleted: ${user.email}`);
      }
    }

    // ──────────────────────────────────────────────
    // STEP 7: Plan downgrades at period end
    // ──────────────────────────────────────────────
    const Plan = require('../models/Plan');
    const downgradeUsers = await User.find({
      scheduledDowngradeTo: { $ne: null },
      scheduledDowngradeAt: { $lte: now }
    }).populate('scheduledDowngradeTo');

    for (const user of downgradeUsers) {
      const newPlan = user.scheduledDowngradeTo;
      if (!newPlan) continue;

      logger.info(`[SUBSCRIPTION] Downgrading ${user.email} to ${newPlan.displayName}`);

      user.plan = newPlan._id;
      user.resourceAllocation = {
        cpu: newPlan.resources.cpu,
        ram: newPlan.resources.ram,
        storage: newPlan.resources.storage,
        bandwidth: newPlan.resources.bandwidth || 1024,
        projects: newPlan.resources.projects || 10
      };
      user.displayedResources = {
        cpu: newPlan.displayResources?.cpu || newPlan.resources.cpu,
        ram: newPlan.displayResources?.ram || newPlan.resources.ram,
        storage: newPlan.displayResources?.storage || newPlan.resources.storage,
        bandwidth: newPlan.displayResources?.bandwidth || newPlan.resources.bandwidth || 1024,
        projects: newPlan.displayResources?.projects || newPlan.resources.projects || 10
      };
      user.scheduledDowngradeTo = null;
      user.scheduledDowngradeAt = null;
      await user.save();

      await sendEmail(
        user.email,
        `Plan changed to ${newPlan.displayName}`,
        loadTemplate('renewalWarning', {
          platformName,
          userName: user.displayName || user.username,
          planName: newPlan.displayName,
          daysLeft: 'N/A',
          expiryDate: 'Your plan has been changed as requested.',
          renewUrl
        })
      );

      logger.info(`[SUBSCRIPTION] Downgrade complete: ${user.email} → ${newPlan.displayName}`);
    }

    logger.info(`[SUBSCRIPTION] Check complete: ${warningUsers.length} warnings, ${expiredUsers.length} new grace, ${gracePeriodUsers.length} grace reminders, ${suspendUsers.length} suspended${settings.accountDeletion?.enabled ? `, deletion checks ran` : ''}`);
  } catch (error) {
    logger.error('[SUBSCRIPTION] Subscription check error:', error.message);
  }
};

const startSubscriptionCron = () => {
  logger.info('[SUBSCRIPTION] Starting subscription lifecycle cron...');

  // Run daily at 9:00 AM
  cron.schedule('0 9 * * *', () => {
    checkSubscriptions();
  });

  // Also run on startup after 30 seconds
  setTimeout(() => {
    checkSubscriptions();
  }, 30000);

  logger.info('[SUBSCRIPTION] Subscription cron started (daily at 9 AM)');
};

module.exports = { startSubscriptionCron, checkSubscriptions };
