const cron = require('node-cron');
const accountLifecycle = require('../services/accountLifecycle');
const logger = require('../utils/logger');

/**
 * Cron Job Scheduler for Account Lifecycle Management
 */

function startCronJobs() {
    logger.info('Starting account lifecycle cron jobs...');

    // Run every day at 1 AM: Warn users whose trial expires within 5 days
    cron.schedule('0 1 * * *', async () => {
        try {
            logger.info('[CRON] Sending trial expiry warnings...');
            const result = await accountLifecycle.warnExpiringTrials();
            logger.info(`[CRON] Trial warnings sent to ${result.warned} users`);
        } catch (error) {
            logger.error('[CRON] Error sending trial warnings:', error);
        }
    });

    // Run every day at 2 AM: Check and suspend expired trials
    cron.schedule('0 2 * * *', async () => {
        try {
            logger.info('[CRON] Checking expired trials...');
            const result = await accountLifecycle.checkAndSuspendExpiredTrials();
            logger.info(`[CRON] Expired trials check complete: ${result.suspended} users suspended`);
        } catch (error) {
            logger.error('[CRON] Error checking expired trials:', error);
        }
    });

    // NOTE: Paid subscription expiry is handled by subscriptionCron.js (runs daily at 9 AM)
    // which implements the full grace-period lifecycle. The legacy
    // accountLifecycle.checkAndSuspendExpiredSubscriptions path queried
    // `subscriptionExpiry` + hard-coded planType values that are no longer set,
    // and would also bypass the grace period if it ever matched — do not re-enable.

    // Run every day at 4 AM: Delete resources for users suspended > 7 days
    cron.schedule('0 4 * * *', async () => {
        try {
            logger.info('[CRON] Deleting resources for long-suspended users...');
            const result = await accountLifecycle.deleteResourcesForLongSuspended();
            logger.info(`[CRON] Resource deletion complete: ${result.deleted} users processed`);
        } catch (error) {
            logger.error('[CRON] Error deleting resources:', error);
        }
    });

    // Run every day at 5 AM: Permanently delete users past recovery deadline
    cron.schedule('0 5 * * *', async () => {
        try {
            logger.info('[CRON] Permanently deleting expired accounts...');
            const result = await accountLifecycle.permanentlyDeleteExpiredAccounts();
            logger.info(`[CRON] Permanent deletion complete: ${result.deleted} users deleted`);
        } catch (error) {
            logger.error('[CRON] Error permanently deleting accounts:', error);
        }
    });

    logger.info('Account lifecycle cron jobs started successfully');
}

module.exports = { startCronJobs };
