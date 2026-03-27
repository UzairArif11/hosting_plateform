const nodemailer = require('nodemailer');
const Settings = require('../models/Settings');
const Notification = require('../models/Notification');
const User = require('../models/User');
const websocketService = require('./websocket');
const { loadTemplate } = require('../utils/emailTemplates');
const logger = require('../utils/logger');

let _transporter = null;

async function getTransporter() {
    if (_transporter) return _transporter;
    const settings = await Settings.getSettings();
    if (!settings.alertConfig?.enabled || !settings.alertConfig?.email || !settings.alertConfig?.password) {
        return null;
    }
    _transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || undefined,
        port: process.env.SMTP_PORT || undefined,
        secure: process.env.SMTP_SECURE === 'true',
        service: !process.env.SMTP_HOST ? 'gmail' : undefined,
        auth: {
            user: settings.alertConfig.email,
            pass: settings.alertConfig.password
        }
    });
    return _transporter;
}

function resetTransporter() { _transporter = null; }

async function sendEmail(to, subject, html) {
    try {
        const transporter = await getTransporter();
        if (!transporter) {
            logger.warn(`[NOTIFY] Email not configured — skipping: ${subject}`);
            return false;
        }
        const settings = await Settings.getSettings();
        await transporter.sendMail({
            from: `"${process.env.PLATFORM_NAME || 'DeployHub'}" <${settings.alertConfig.email}>`,
            to,
            subject,
            html
        });
        logger.info(`[NOTIFY] Email sent to ${to}: ${subject}`);
        return true;
    } catch (err) {
        logger.error(`[NOTIFY] Email failed to ${to}: ${err.message}`);
        return false;
    }
}

async function createNotification(userId, { title, message, type = 'info', resourceType = 'system', metadata = {} }) {
    try {
        const notif = await Notification.create({ userId, title, message, type, resourceType, metadata });
        websocketService.emitNotification(userId.toString(), { _id: notif._id, title, message, type, resourceType, createdAt: notif.createdAt });
        return notif;
    } catch (err) {
        logger.error(`[NOTIFY] DB notification failed for ${userId}: ${err.message}`);
    }
}

async function notifyAdmins({ title, message, type = 'warning', socketEvent = null }) {
    try {
        const admins = await User.find({ role: 'admin' }).select('_id');
        for (const admin of admins) {
            await createNotification(admin._id, { title, message, type });
        }
        if (socketEvent) {
            websocketService.emitAdminNotification({ type: socketEvent, title, message, timestamp: new Date().toISOString() });
        } else {
            websocketService.emitAdminNotification({ type: 'admin_alert', title, message, timestamp: new Date().toISOString() });
        }
    } catch (err) {
        logger.error(`[NOTIFY] Admin notification failed: ${err.message}`);
    }
}

const platformName = () => process.env.PLATFORM_NAME || 'DeployHub';
const frontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Check if user has opted in to a specific email category.
 * Critical emails (payment verified/rejected, account suspended/reactivated) always send.
 * Categories: 'deployments', 'billing', 'security', 'resources'
 */
function shouldSendEmail(user, category) {
    if (!category) return true;
    const prefs = user?.preferences?.notifications;
    if (!prefs) return true;
    return prefs[category] !== false;
}

// ─── BILLING ───────────────────────────────────────────────

async function paymentVerified(user, planName, amount, currency) {
    const title = 'Payment Verified';
    const msg = `Your ${currency} ${amount} payment for ${planName} has been verified. Your plan is now active.`;
    await createNotification(user._id, { title, message: msg, type: 'success' });
    await sendEmail(user.email, `✅ Payment Verified — ${planName} Plan Active`, loadTemplate('paymentVerified', {
        platformName: platformName(), userName: user.displayName || user.username,
        planName, amount: String(amount), currency, dashboardUrl: `${frontendUrl()}/dashboard`
    }));
}

async function paymentRejected(user, planName, reason) {
    const title = 'Payment Rejected';
    const msg = `Your payment for ${planName} was rejected. Reason: ${reason || 'Contact support for details.'}`;
    await createNotification(user._id, { title, message: msg, type: 'error' });
    await sendEmail(user.email, `❌ Payment Rejected — ${planName}`, loadTemplate('paymentRejected', {
        platformName: platformName(), userName: user.displayName || user.username,
        planName, reason: reason || 'Please contact support for more information.',
        billingUrl: `${frontendUrl()}/dashboard/billing`
    }));
}

async function planUpgraded(user, planName) {
    const title = 'Plan Upgraded';
    const msg = `Congratulations! Your plan has been upgraded to ${planName}.`;
    await createNotification(user._id, { title, message: msg, type: 'success' });
    if (!shouldSendEmail(user, 'billing')) return;
    await sendEmail(user.email, `🚀 Plan Upgraded to ${planName}`, loadTemplate('planUpgraded', {
        platformName: platformName(), userName: user.displayName || user.username,
        planName, dashboardUrl: `${frontendUrl()}/dashboard`
    }));
}

async function subscriptionCancelled(user) {
    await createNotification(user._id, {
        title: 'Subscription Cancelled',
        message: 'Your subscription has been cancelled. Your plan remains active until the current billing period ends.',
        type: 'warning'
    });
}

async function paymentSubmitted(user, planName, paymentType) {
    const typeLabel = paymentType === 'crypto' ? 'Crypto' : 'Bank Transfer';
    await notifyAdmins({
        title: `New ${typeLabel} Payment`,
        message: `${user.displayName || user.email} submitted ${typeLabel.toLowerCase()} for ${planName}. Verify in Admin → Payments.`,
        socketEvent: 'payment_submitted'
    });
}

// ─── ACCOUNT ───────────────────────────────────────────────

async function welcomeUser(user) {
    await createNotification(user._id, {
        title: 'Welcome to ' + platformName(),
        message: 'Your account is ready. Start by creating a project or browsing templates.',
        type: 'success'
    });
    await sendEmail(user.email, `Welcome to ${platformName()}!`, loadTemplate('welcome', {
        platformName: platformName(), userName: user.displayName || user.username || user.email,
        dashboardUrl: `${frontendUrl()}/dashboard`, templatesUrl: `${frontendUrl()}/templates`
    }));
}

async function trialExpiring(user, daysLeft) {
    await createNotification(user._id, {
        title: 'Trial Expiring Soon',
        message: `Your free trial expires in ${daysLeft} days. Upgrade to keep your projects running.`,
        type: 'warning'
    });
    await sendEmail(user.email, `⏰ Free trial expires in ${daysLeft} days`, loadTemplate('trialExpiring', {
        platformName: platformName(), userName: user.displayName || user.username,
        daysLeft: String(daysLeft), billingUrl: `${frontendUrl()}/dashboard/billing`
    }));
}

async function accountSuspended(user, reason) {
    await createNotification(user._id, {
        title: 'Account Suspended',
        message: reason || 'Your account has been suspended. Visit billing to reactivate.',
        type: 'error'
    });
    await sendEmail(user.email, `🔴 Account Suspended — ${platformName()}`, loadTemplate('accountSuspended', {
        platformName: platformName(), userName: user.displayName || user.username || user.email,
        reason: reason || 'Your subscription has expired or your trial period ended.',
        renewUrl: `${frontendUrl()}/dashboard/billing`,
        deletionNotice: 'If your account remains suspended for 30 days, your resources will be permanently deleted. Reactivate before then to keep your data.'
    }));
}

async function accountReactivated(user) {
    await createNotification(user._id, {
        title: 'Account Reactivated',
        message: 'Your account is active again. All your projects and deployments are restored.',
        type: 'success'
    });
    await sendEmail(user.email, `✅ Account Reactivated — ${platformName()}`, loadTemplate('accountReactivated', {
        platformName: platformName(), userName: user.displayName || user.username,
        dashboardUrl: `${frontendUrl()}/dashboard`
    }));
}

// ─── DEPLOYMENT ────────────────────────────────────────────

async function deploymentSucceeded(userId, projectName, url) {
    await createNotification(userId, {
        title: 'Deployment Live',
        message: `${projectName} is now live${url ? ` at ${url}` : ''}.`,
        type: 'success'
    });
}

async function deploymentFailed(userId, projectName, error) {
    await createNotification(userId, {
        title: 'Deployment Failed',
        message: `${projectName} build failed: ${error || 'Check logs for details.'}`,
        type: 'error'
    });
}

// ─── ADMIN ─────────────────────────────────────────────────

async function newUserSignup(user) {
    await notifyAdmins({
        title: 'New User Signup',
        message: `${user.displayName || user.email} just signed up via ${user.provider || 'email'}.`,
        type: 'info',
        socketEvent: 'new_user'
    });
}

async function adminSuspendedUser(targetUser) {
    await notifyAdmins({
        title: 'User Suspended',
        message: `${targetUser.displayName || targetUser.email} has been suspended by admin.`,
        type: 'warning'
    });
}

async function adminUnsuspendedUser(targetUser) {
    await notifyAdmins({
        title: 'User Unsuspended',
        message: `${targetUser.displayName || targetUser.email} has been unsuspended.`,
        type: 'success'
    });
}

// ─── PROJECT ───────────────────────────────────────────────

async function invitationSent(toEmail, projectName, inviterName, acceptUrl) {
    await sendEmail(toEmail, `You're invited to collaborate on ${projectName}`, loadTemplate('invitation', {
        platformName: platformName(), projectName, inviterName,
        acceptUrl, dashboardUrl: `${frontendUrl()}/dashboard`
    }));
}

async function projectDeleted(userId, projectName) {
    await createNotification(userId, {
        title: 'Project Deleted',
        message: `Project "${projectName}" has been permanently deleted.`,
        type: 'info'
    });
}

// ─── LIFECYCLE ─────────────────────────────────────────────

async function trialExpired(user) {
    await createNotification(user._id, {
        title: 'Free Trial Expired',
        message: 'Your free trial has expired. Your account is suspended. Upgrade to a paid plan to reactivate.',
        type: 'error'
    });
    await sendEmail(user.email, `🔴 Free Trial Expired — ${platformName()}`, loadTemplate('trialExpired', {
        platformName: platformName(), userName: user.displayName || user.username || user.email,
        billingUrl: `${frontendUrl()}/dashboard/billing`
    }));
}

async function subscriptionExpired(user) {
    await createNotification(user._id, {
        title: 'Subscription Expired',
        message: 'Your subscription has expired. Your account is suspended. Renew to reactivate.',
        type: 'error'
    });
    await sendEmail(user.email, `🔴 Subscription Expired — Account Suspended`, loadTemplate('accountSuspended', {
        platformName: platformName(), userName: user.displayName || user.username || user.email,
        renewUrl: `${frontendUrl()}/dashboard/billing`,
        deletionNotice: 'Your subscription has expired and your account has been suspended. Renew your plan to reactivate. Resources will be deleted after 30 days of suspension.'
    }));
}

async function resourcesDeleted(user) {
    await createNotification(user._id, {
        title: 'Resources Permanently Deleted',
        message: 'Your projects, deployments, and containers have been permanently removed after 30 days of suspension.',
        type: 'error'
    });
    await sendEmail(user.email, `🗑️ Resources Deleted — ${platformName()}`, loadTemplate('resourcesDeleted', {
        platformName: platformName(), userName: user.displayName || user.username || user.email,
        billingUrl: `${frontendUrl()}/dashboard/billing`
    }));
}

async function accountDeleted(user) {
    await sendEmail(user.email, `Account Deleted — ${platformName()}`, loadTemplate('accountDeleted', {
        platformName: platformName(), userName: user.displayName || user.username || user.email,
        recoveryDeadline: user.recoveryDeadline ? user.recoveryDeadline.toLocaleDateString() : '15 days',
        supportUrl: `${frontendUrl()}/support`
    }));
}

async function accountRecovered(user) {
    await createNotification(user._id, {
        title: 'Account Recovered',
        message: 'Your account has been successfully recovered. Welcome back!',
        type: 'success'
    });
    await sendEmail(user.email, `✅ Account Recovered — ${platformName()}`, loadTemplate('accountReactivated', {
        platformName: platformName(), userName: user.displayName || user.username || user.email,
        dashboardUrl: `${frontendUrl()}/dashboard`
    }));
}

async function paymentReceived(user, planName, amount, currency, paymentType) {
    const typeLabel = paymentType === 'crypto' ? 'Crypto' : 'Bank Transfer';
    await createNotification(user._id, {
        title: 'Payment Received',
        message: `Your ${typeLabel.toLowerCase()} payment of ${currency} ${amount} for ${planName} is under review. You'll be notified once verified.`,
        type: 'info'
    });
    if (!shouldSendEmail(user, 'billing')) return;
    await sendEmail(user.email, `📋 Payment Received — ${platformName()}`, loadTemplate('paymentReceived', {
        platformName: platformName(), userName: user.displayName || user.username || user.email,
        planName, amount: String(amount), currency, paymentType: typeLabel,
        billingUrl: `${frontendUrl()}/dashboard/billing`
    }));
}

async function deploymentSucceededEmail(user, projectName, url) {
    if (!shouldSendEmail(user, 'deployments')) return;
    await sendEmail(user.email, `🚀 ${projectName} is Live — ${platformName()}`, loadTemplate('deploymentSuccess', {
        platformName: platformName(), userName: user.displayName || user.username || user.email,
        projectName, deploymentUrl: url || '',
        dashboardUrl: `${frontendUrl()}/dashboard`
    }));
}

async function deploymentFailedEmail(user, projectName, error) {
    if (!shouldSendEmail(user, 'deployments')) return;
    await sendEmail(user.email, `❌ ${projectName} Deployment Failed — ${platformName()}`, loadTemplate('deploymentFailed', {
        platformName: platformName(), userName: user.displayName || user.username || user.email,
        projectName, error: error || 'Unknown error',
        dashboardUrl: `${frontendUrl()}/dashboard`
    }));
}

module.exports = {
    sendEmail, createNotification, notifyAdmins, resetTransporter,
    paymentVerified, paymentRejected, planUpgraded, subscriptionCancelled, paymentSubmitted,
    welcomeUser, trialExpiring, accountSuspended, accountReactivated,
    deploymentSucceeded, deploymentFailed,
    newUserSignup, adminSuspendedUser, adminUnsuspendedUser,
    invitationSent, projectDeleted,
    trialExpired, subscriptionExpired, resourcesDeleted,
    accountDeleted, accountRecovered, paymentReceived,
    deploymentSucceededEmail, deploymentFailedEmail
};
