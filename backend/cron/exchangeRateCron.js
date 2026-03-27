const cron = require('node-cron');
const Settings = require('../models/Settings');
const logger = require('../utils/logger');

/**
 * Fetch live exchange rates from free API and update Settings
 * Uses exchangerate-api.com (free, no key needed for USD base)
 */
async function updateExchangeRates() {
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await response.json();

        if (data.result !== 'success' || !data.rates) {
            logger.warn('[EXCHANGE] API returned unexpected response:', data.result);
            return { success: false, error: 'API error' };
        }

        const rates = {
            usdToPkr: Math.round(data.rates.PKR * 100) / 100 || 278,
            usdToEur: Math.round(data.rates.EUR * 100) / 100 || 0.92,
            usdToGbp: Math.round(data.rates.GBP * 100) / 100 || 0.79
        };

        // Update Settings in database
        const settings = await Settings.getSettings();
        settings.currencyConfig = settings.currencyConfig || {};
        settings.currencyConfig.exchangeRates = rates;
        await settings.save();

        logger.info(`[EXCHANGE] Rates updated: PKR=${rates.usdToPkr}, EUR=${rates.usdToEur}, GBP=${rates.usdToGbp}`);
        return { success: true, rates };
    } catch (error) {
        logger.error('[EXCHANGE] Failed to fetch exchange rates:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Start the exchange rate cron job
 * Runs on startup + every 6 hours
 */
function startExchangeRateCron() {
    logger.info('[EXCHANGE] Starting exchange rate cron...');

    // Run immediately on startup (with 10s delay to let DB connect)
    setTimeout(() => {
        updateExchangeRates();
    }, 10000);

    // Run every 6 hours
    cron.schedule('0 */6 * * *', async () => {
        logger.info('[CRON] Updating exchange rates...');
        await updateExchangeRates();
    });

    logger.info('[EXCHANGE] Exchange rate cron started (every 6 hours)');
}

module.exports = { startExchangeRateCron, updateExchangeRates };
