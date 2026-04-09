const { Paddle, Environment, EventName } = require('@paddle/paddle-node-sdk');
const Settings = require('../models/Settings');
const logger = require('../utils/logger');

let paddleClient = null;
let lastEnvironment = null;
let lastApiKey = null;

/**
 * Get or create Paddle client based on current settings
 */
async function getPaddleClient() {
  const settings = await Settings.getSettings();
  const paddle = settings.paymentConfig?.paddle;

  if (!paddle?.enabled) {
    throw new Error('Paddle payments are not enabled');
  }

  const isTest = paddle.testMode !== false; // default to test
  const apiKey = isTest ? paddle.sandboxApiKey : paddle.liveApiKey;
  const environment = isTest ? Environment.sandbox : Environment.production;

  if (!apiKey) {
    throw new Error(`Paddle ${isTest ? 'sandbox' : 'live'} API key is not configured`);
  }

  // Reuse client if config hasn't changed
  if (paddleClient && lastApiKey === apiKey && lastEnvironment === environment) {
    return paddleClient;
  }

  paddleClient = new Paddle(apiKey, { environment });
  lastApiKey = apiKey;
  lastEnvironment = environment;

  return paddleClient;
}

/**
 * Get the active credentials based on test mode
 */
async function getActiveCredentials() {
  const settings = await Settings.getSettings();
  const paddle = settings.paymentConfig?.paddle;

  if (!paddle) {
    return { enabled: false };
  }

  const isTest = paddle.testMode !== false;
  return {
    enabled: paddle.enabled || false,
    testMode: isTest,
    sellerId: isTest ? paddle.sandboxSellerId : paddle.liveSellerId,
    apiKey: isTest ? paddle.sandboxApiKey : paddle.liveApiKey,
    clientToken: isTest ? paddle.sandboxClientToken : paddle.liveClientToken,
    webhookSecret: isTest ? paddle.sandboxWebhookSecret : paddle.liveWebhookSecret,
    environment: isTest ? 'sandbox' : 'production',
    processingFeePercent: paddle.processingFeePercent ?? 5,
    cryptoDiscountPercent: paddle.cryptoDiscountPercent ?? 3
  };
}

/**
 * Create a Paddle checkout transaction
 */
async function createTransaction({ userId, planId, priceId, customerEmail, billingPeriod, planName }) {
  const client = await getPaddleClient();

  const transactionData = {
    items: [{
      priceId: priceId,
      quantity: 1
    }],
    customData: {
      userId: userId.toString(),
      planId: planId.toString(),
      billingPeriod: String(billingPeriod || 1),
      planName: planName || ''
    }
  };

  // Add customer email if provided
  if (customerEmail) {
    transactionData.customerEmail = customerEmail;
  }

  try {
    const transaction = await client.transactions.create(transactionData);
    return {
      success: true,
      transactionId: transaction.id,
      status: transaction.status
    };
  } catch (error) {
    logger.error('Paddle create transaction error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get transaction details
 */
async function getTransaction(transactionId) {
  const client = await getPaddleClient();

  try {
    const transaction = await client.transactions.get(transactionId);
    return { success: true, transaction };
  } catch (error) {
    logger.error('Paddle get transaction error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get subscription details
 */
async function getSubscription(subscriptionId) {
  const client = await getPaddleClient();

  try {
    const subscription = await client.subscriptions.get(subscriptionId);
    return { success: true, subscription };
  } catch (error) {
    logger.error('Paddle get subscription error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel a subscription (at end of billing period)
 */
async function cancelSubscription(subscriptionId) {
  const client = await getPaddleClient();

  try {
    const subscription = await client.subscriptions.cancel(subscriptionId, {
      effectiveFrom: 'next_billing_period'
    });
    return { success: true, subscription };
  } catch (error) {
    logger.error('Paddle cancel subscription error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Update a subscription (change plan/price)
 */
async function updateSubscription(subscriptionId, newPriceId) {
  const client = await getPaddleClient();

  try {
    const subscription = await client.subscriptions.update(subscriptionId, {
      items: [{
        priceId: newPriceId,
        quantity: 1
      }],
      prorationBillingMode: 'prorated_immediately'
    });
    return { success: true, subscription };
  } catch (error) {
    logger.error('Paddle update subscription error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Verify Paddle price ID exists and return its details
 */
async function verifyPriceId(priceId) {
  const client = await getPaddleClient();

  try {
    const price = await client.prices.get(priceId);
    return {
      success: true,
      price: {
        id: price.id,
        name: price.name || price.description,
        amount: price.unitPrice?.amount ? parseInt(price.unitPrice.amount) / 100 : 0,
        currency: price.unitPrice?.currencyCode || 'USD',
        billingCycle: price.billingCycle ? `${price.billingCycle.interval} ${price.billingCycle.frequency}` : 'one-time',
        status: price.status
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Price ID not found'
    };
  }
}

/**
 * Verify webhook signature (HMAC-SHA256)
 * Paddle sends webhook-signature header with ts=timestamp;h1=hash format
 */
function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) {
    return false;
  }

  try {
    // Parse the signature header: ts=timestamp;h1=hash
    const parts = {};
    signatureHeader.split(';').forEach(part => {
      const [key, value] = part.split('=');
      parts[key] = value;
    });

    const timestamp = parts.ts;
    const expectedHash = parts.h1;

    if (!timestamp || !expectedHash) {
      return false;
    }

    // Build the signed payload: timestamp:rawBody
    const crypto = require('crypto');
    const signedPayload = `${timestamp}:${rawBody}`;
    const computedHash = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(computedHash),
      Buffer.from(expectedHash)
    );
  } catch (error) {
    logger.error('Paddle webhook signature verification error:', error.message);
    return false;
  }
}

module.exports = {
  getPaddleClient,
  getActiveCredentials,
  createTransaction,
  getTransaction,
  getSubscription,
  cancelSubscription,
  updateSubscription,
  verifyPriceId,
  verifyWebhookSignature
};
