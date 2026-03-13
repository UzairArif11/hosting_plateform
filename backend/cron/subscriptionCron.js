const cron = require('node-cron');
const User = require('../models/User');
const logger = require('../utils/logger');

// Email sender helper
const sendEmail = async (to, subject, html) => {
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    await transporter.sendMail({
      from: `"${process.env.PLATFORM_NAME || 'RevsCore'}" <${process.env.SMTP_USER}>`,
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

const checkSubscriptions = async () => {
  const now = new Date();
  logger.info('[SUBSCRIPTION] Running subscription lifecycle check...');

  try {
    // 1. Send warning emails 10 days before expiry
    const tenDaysFromNow = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const warningUsers = await User.find({
      subscriptionStatus: 'active',
      planExpiresAt: { $lte: tenDaysFromNow, $gt: now },
      $or: [
        { lastRenewalReminder: null },
        { lastRenewalReminder: { $lt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) } } // Don't spam — wait 3 days between reminders
      ]
    }).populate('plan');

    for (const user of warningUsers) {
      const daysLeft = Math.ceil((user.planExpiresAt - now) / (1000 * 60 * 60 * 24));
      const planName = user.plan?.displayName || 'your plan';

      await sendEmail(
        user.email,
        `⚠️ Your ${planName} subscription expires in ${daysLeft} days`,
        `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #f59e0b;">⚠️ Subscription Renewal Reminder</h2>
          <p>Hi ${user.displayName || user.username},</p>
          <p>Your <strong>${planName}</strong> subscription will expire in <strong>${daysLeft} days</strong> (${user.planExpiresAt.toLocaleDateString()}).</p>
          <p>To continue using your resources without interruption, please renew your subscription before the expiry date.</p>
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/dashboard/billing" 
               style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Renew Now
            </a>
          </p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            After expiry, you'll have a grace period before your account is suspended.
          </p>
        </div>`
      );

      user.lastRenewalReminder = now;
      await user.save();
      logger.info(`[SUBSCRIPTION] Warning email sent to ${user.email} — ${daysLeft} days left`);
    }

    // 2. Handle expired subscriptions — enter grace period
    const expiredUsers = await User.find({
      subscriptionStatus: 'active',
      planExpiresAt: { $lte: now },
      gracePeriodEndsAt: null // Not yet in grace period
    }).populate('plan');

    for (const user of expiredUsers) {
      // Get admin-configured grace period days from the plan's billing periods
      let graceDays = 10; // default
      if (user.plan?.billingPeriods?.length > 0 && user.billingPeriod) {
        const periodConfig = user.plan.billingPeriods.find(p => p.months === user.billingPeriod);
        if (periodConfig?.gracePeriodDays) {
          graceDays = periodConfig.gracePeriodDays;
        }
      }
      const gracePeriodEnd = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);
      user.subscriptionStatus = 'past_due';
      user.gracePeriodEndsAt = gracePeriodEnd;
      user.lastGracePeriodReminder = null;
      await user.save();

      await sendEmail(
        user.email,
        `🔴 Your subscription has expired — ${graceDays}-day grace period started`,
        `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #ef4444;">🔴 Subscription Expired</h2>
          <p>Hi ${user.displayName || user.username},</p>
          <p>Your subscription has expired. You have a <strong>${graceDays}-day grace period</strong> (until ${gracePeriodEnd.toLocaleDateString()}) to renew.</p>
          <p><strong>After the grace period, your account will be suspended</strong> and your projects will be stopped.</p>
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/dashboard/billing" 
               style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Renew Now
            </a>
          </p>
        </div>`
      );

      logger.info(`[SUBSCRIPTION] Grace period started for ${user.email} — ends ${gracePeriodEnd.toLocaleDateString()}`);
    }

    // 3. Send grace period reminders every 3 days
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

      await sendEmail(
        user.email,
        `⏰ Grace period: ${daysLeft} days left to renew`,
        `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #f59e0b;">⏰ Grace Period Reminder</h2>
          <p>Hi ${user.displayName || user.username},</p>
          <p>You have <strong>${daysLeft} days</strong> left in your grace period. After that, your account will be suspended.</p>
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/dashboard/billing" 
               style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Renew Now
            </a>
          </p>
        </div>`
      );

      user.lastGracePeriodReminder = now;
      await user.save();
      logger.info(`[SUBSCRIPTION] Grace reminder sent to ${user.email} — ${daysLeft} days left`);
    }

    // 4. Suspend accounts after grace period ends
    const suspendUsers = await User.find({
      subscriptionStatus: 'past_due',
      gracePeriodEndsAt: { $lte: now }
    });

    for (const user of suspendUsers) {
      user.status = 'suspended';
      user.subscriptionStatus = 'expired';
      user.suspendedAt = now;
      user.suspensionReason = 'Subscription expired — grace period ended';
      user.autoSuspended = true;
      await user.save();

      await sendEmail(
        user.email,
        `🚫 Account Suspended — Subscription not renewed`,
        `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #ef4444;">🚫 Account Suspended</h2>
          <p>Hi ${user.displayName || user.username},</p>
          <p>Your account has been suspended because your subscription was not renewed during the grace period.</p>
          <p>Your projects are currently stopped. To reactivate your account, please renew your subscription.</p>
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/dashboard/billing" 
               style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Reactivate Account
            </a>
          </p>
        </div>`
      );

      logger.info(`[SUBSCRIPTION] Account suspended: ${user.email}`);
    }

    logger.info(`[SUBSCRIPTION] Check complete: ${warningUsers.length} warnings, ${expiredUsers.length} new grace, ${gracePeriodUsers.length} grace reminders, ${suspendUsers.length} suspended`);
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
