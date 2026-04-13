const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const Settings = require('../models/Settings');

/**
 * BTCPay Server Service
 * Handles automatic crypto payments via self-hosted BTCPay Server
 */

// Get BTCPay config from Settings DB (admin UI) or fallback to env
const getConfig = async () => {
  try {
    const settings = await Settings.getSettings();
    const btcpayConfig = settings.paymentConfig?.btcpay || {};
    return {
      serverUrl: btcpayConfig.serverUrl || process.env.BTCPAY_SERVER_URL,
      apiKey: btcpayConfig.apiKey || process.env.BTCPAY_API_KEY,
      storeId: btcpayConfig.storeId || process.env.BTCPAY_STORE_ID,
      webhookSecret: btcpayConfig.webhookSecret || process.env.BTCPAY_WEBHOOK_SECRET,
      testMode: btcpayConfig.testMode !== undefined ? btcpayConfig.testMode : (process.env.BTCPAY_TEST_MODE === 'true'),
      enabled: btcpayConfig.enabled || false
    };
  } catch (error) {
    // Fallback to env if DB unavailable
    return {
      serverUrl: process.env.BTCPAY_SERVER_URL,
      apiKey: process.env.BTCPAY_API_KEY,
      storeId: process.env.BTCPAY_STORE_ID,
      webhookSecret: process.env.BTCPAY_WEBHOOK_SECRET,
      testMode: process.env.BTCPAY_TEST_MODE === 'true',
      enabled: false
    };
  }
};

// Create axios instance for BTCPay API
const createClient = (config) => {
  return axios.create({
    baseURL: `${config.serverUrl}/api/v1`,
    headers: {
      'Authorization': `token ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });
};

/**
 * Create a BTCPay invoice for a plan purchase
 * @param {Object} paymentData - { userId, planId, planName, amount, currency, billingPeriod, buyerEmail, returnUrl }
 * @returns {Object} - { success, invoiceId, checkoutUrl }
 */
const createInvoice = async (paymentData) => {
  try {
    const config = await getConfig();
    if (!config.serverUrl || !config.apiKey || !config.storeId) {
      return { success: false, error: 'BTCPay Server not configured' };
    }

    const client = createClient(config);

    const invoiceData = {
      amount: paymentData.amount,
      currency: paymentData.currency || 'USD',
      metadata: {
        userId: paymentData.userId.toString(),
        planId: paymentData.planId.toString(),
        planName: paymentData.planName,
        billingPeriod: paymentData.billingPeriod || 1,
        orderId: `plan_${paymentData.userId}_${paymentData.planId}_${Date.now()}`,
        testMode: config.testMode ? 'true' : 'false'
      },
      checkout: {
        redirectURL: paymentData.returnUrl || `${process.env.FRONTEND_URL}/dashboard/billing?payment=success`,
        redirectAutomatically: true,
        defaultLanguage: 'en'
      },
      receipt: {
        enabled: true,
        showQR: true
      },
      additionalSearchTerms: [
        paymentData.userId.toString(),
        paymentData.planName
      ]
    };

    // Add buyer email if available
    if (paymentData.buyerEmail) {
      invoiceData.buyer = { email: paymentData.buyerEmail };
    }

    const response = await client.post(`/stores/${config.storeId}/invoices`, invoiceData);

    logger.billing('BTCPay invoice created', {
      invoiceId: response.data.id,
      amount: paymentData.amount,
      currency: paymentData.currency,
      userId: paymentData.userId,
      planName: paymentData.planName
    });

    return {
      success: true,
      invoiceId: response.data.id,
      checkoutUrl: response.data.checkoutLink,
      status: response.data.status,
      expirationTime: response.data.expirationTime
    };

  } catch (error) {
    logger.error('BTCPay create invoice failed:', {
      message: error.response?.data?.message || error.message,
      status: error.response?.status
    });
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to create BTCPay invoice'
    };
  }
};

/**
 * Get invoice status from BTCPay
 * @param {string} invoiceId
 * @returns {Object} - { success, status, ... }
 */
const getInvoice = async (invoiceId) => {
  try {
    const config = await getConfig();
    const client = createClient(config);

    const response = await client.get(`/stores/${config.storeId}/invoices/${invoiceId}`);

    return {
      success: true,
      data: {
        id: response.data.id,
        status: response.data.status,
        additionalStatus: response.data.additionalStatus,
        amount: response.data.amount,
        currency: response.data.currency,
        metadata: response.data.metadata,
        createdTime: response.data.createdTime,
        expirationTime: response.data.expirationTime
      }
    };

  } catch (error) {
    logger.error('BTCPay get invoice failed:', error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
};

/**
 * Verify BTCPay webhook signature
 * @param {string} body - Raw request body
 * @param {string} signature - BTCPAY-SIG header value
 * @returns {boolean}
 */
const verifyWebhookSignature = async (body, signature) => {
  try {
    const config = await getConfig();
    if (!config.webhookSecret) {
      logger.error('BTCPay webhook secret not configured');
      return false;
    }

    // BTCPay uses HMAC-SHA256: sha256=<hex>
    const sigParts = signature.split('=');
    if (sigParts.length !== 2 || sigParts[0] !== 'sha256') {
      return false;
    }

    const expectedSig = crypto
      .createHmac('sha256', config.webhookSecret)
      .update(body)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(sigParts[1], 'hex'),
      Buffer.from(expectedSig, 'hex')
    );

  } catch (error) {
    logger.error('BTCPay signature verification error:', error.message);
    return false;
  }
};

/**
 * Handle BTCPay webhook event
 * @param {Object} event - Webhook payload from BTCPay
 * @returns {Object} - { success, handled, action }
 */
const handleWebhook = async (event) => {
  try {
    const eventType = event.type;
    const invoiceId = event.invoiceId;

    logger.billing('BTCPay webhook received', { type: eventType, invoiceId });

    switch (eventType) {
      case 'InvoiceReceivedPayment':
        // Payment detected but not yet confirmed
        logger.billing('BTCPay payment received (pending confirmation)', { invoiceId });
        return { success: true, handled: true, action: 'payment_received' };

      case 'InvoicePaymentSettled':
      case 'InvoiceProcessing':
        // Payment confirmed with enough confirmations
        logger.billing('BTCPay payment confirmed', { invoiceId });
        return { success: true, handled: true, action: 'payment_confirmed', invoiceId };

      case 'InvoiceSettled':
        // Fully settled - this is the main event to activate plan
        logger.billing('BTCPay invoice settled', { invoiceId });
        return { success: true, handled: true, action: 'payment_settled', invoiceId };

      case 'InvoiceExpired':
        logger.billing('BTCPay invoice expired', { invoiceId });
        return { success: true, handled: true, action: 'invoice_expired', invoiceId };

      case 'InvoiceInvalid':
        logger.error('BTCPay invoice invalid', { invoiceId });
        return { success: true, handled: true, action: 'invoice_invalid', invoiceId };

      default:
        logger.billing('BTCPay webhook unhandled event', { type: eventType });
        return { success: true, handled: false, action: 'unhandled' };
    }

  } catch (error) {
    logger.error('BTCPay webhook handler error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Test BTCPay Server connection
 * @returns {Object} - { success, serverInfo }
 */
const testConnection = async () => {
  try {
    const config = await getConfig();
    if (!config.serverUrl || !config.apiKey) {
      return { success: false, error: 'BTCPay Server not configured' };
    }

    const client = createClient(config);
    const response = await client.get('/server/info');

    return {
      success: true,
      serverInfo: {
        version: response.data.version,
        supportedPaymentMethods: response.data.supportedPaymentMethods
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Cannot connect to BTCPay Server'
    };
  }
};

module.exports = {
  createInvoice,
  getInvoice,
  verifyWebhookSignature,
  handleWebhook,
  testConnection,
  getConfig
};
