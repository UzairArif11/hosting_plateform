const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const ManualPayment = require('../models/ManualPayment');
const Settings = require('../models/Settings');
const jazzcashService = require('../services/jazzcash');
const easypaisaService = require('../services/easypaisa');
const logger = require('../utils/logger');
const notify = require('../services/notificationService');

// Multer config for screenshot uploads
const uploadsDir = path.join(__dirname, '..', 'uploads', 'payments');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `payment_${req.user._id}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (jpg, png, webp) and PDF files are allowed'));
    }
  }
});

const router = express.Router();

// Helper functions
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Get available plans
router.get('/plans', async (req, res) => {
  try {
    const { currency = 'usd' } = req.query;

    const plans = await Plan.findActivePlans();

    // Format plans with pricing for requested currency
    const formattedPlans = plans.map(plan => {
      const basePrice = plan.getPricingForCurrency(currency);
      // Build billing period options with calculated prices
      const defaultPeriods = [
        { months: 1, discountPercent: 0, gracePeriodDays: 10, enabled: true },
        { months: 3, discountPercent: 5, gracePeriodDays: 15, enabled: true },
        { months: 6, discountPercent: 10, gracePeriodDays: 20, enabled: true },
        { months: 12, discountPercent: 20, gracePeriodDays: 30, enabled: true }
      ];
      const periods = (plan.billingPeriods && plan.billingPeriods.length > 0)
        ? plan.billingPeriods.filter(p => p.enabled)
        : defaultPeriods;

      // Free/trial plans only get monthly — no quarterly/annual options
      const isFreeOrTrial = plan.isTrial || basePrice === 0;
      const applicablePeriods = isFreeOrTrial
        ? periods.filter(p => p.months === 1)
        : periods;

      const billingPeriods = applicablePeriods.map(p => ({
        months: p.months,
        discountPercent: p.discountPercent || 0,
        gracePeriodDays: p.gracePeriodDays || 10,
        monthlyPrice: Math.round(basePrice * (1 - (p.discountPercent || 0) / 100) * 100) / 100,
        totalPrice: Math.round(basePrice * p.months * (1 - (p.discountPercent || 0) / 100) * 100) / 100,
        savings: Math.round(basePrice * p.months * (p.discountPercent || 0) / 100 * 100) / 100,
        label: p.months === 1 ? 'Monthly' : p.months === 3 ? 'Quarterly' : p.months === 6 ? 'Semi-Annual' : 'Annual'
      }));

      return {
        id: plan._id,
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        price: basePrice,
        formattedPrice: plan.formattedPricing[currency.toLowerCase()],
        resources: plan.displayResources || plan.resources,
        actualResources: plan.resources,
        features: plan.features.filter(f => f.enabled),
        billingCycle: plan.billingCycle,
        billingPeriods,
        isDefault: plan.isDefault,
        isTrial: plan.isTrial
      };
    });

    res.json({
      success: true,
      plans: formattedPlans,
      currency: currency.toUpperCase()
    });
  } catch (error) {
    logger.error('Get plans error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }
});

// Get current user's billing information
router.get('/info', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('plan');

    // Get enabled payment methods from settings
    const settings = await Settings.getSettings();
    const paymentConfig = settings.paymentConfig || {};

    const billingInfo = {
      currentPlan: user.plan ? {
        id: user.plan._id,
        name: user.plan.displayName,
        price: user.plan.formattedPricing,
        resources: user.plan.resources,
        features: user.plan.features.filter(f => f.enabled)
      } : null,
      subscriptionStatus: user.subscriptionStatus,
      // Subscription lifecycle
      planExpiresAt: user.planExpiresAt || null,
      billingPeriod: user.billingPeriod || 1,
      gracePeriodEndsAt: user.gracePeriodEndsAt || null,
      trialInfo: {
        isActive: user.isTrialActive,
        daysRemaining: user.trialDaysRemaining,
        expiry: user.trialExpiry
      },
      usage: {
        current: user.currentUsage,
        limits: user.resourceAllocation,
        percentages: user.resourceUsagePercentage
      },
      paymentMethods: user.paymentMethods.map(pm => ({
        id: pm._id,
        type: pm.type,
        last4: pm.last4,
        brand: pm.brand,
        isDefault: pm.isDefault,
        createdAt: pm.createdAt
      })),
      // Enabled payment gateways (for frontend to show/hide options)
      enabledGateways: {
        paddle: paymentConfig.paddle?.enabled || false,
        btcpay: paymentConfig.btcpay?.enabled || false,
        jazzcashEasypaisa: paymentConfig.jazzcashEasypaisa?.enabled || false,
        manualBank: paymentConfig.manualBank?.enabled || false,
        manualCrypto: paymentConfig.crypto?.enabled || false
      },
      // Paddle-specific config for frontend
      paddleConfig: paymentConfig.paddle?.enabled ? {
        clientToken: paymentConfig.paddle.testMode !== false
          ? paymentConfig.paddle.sandboxClientToken
          : paymentConfig.paddle.liveClientToken,
        environment: paymentConfig.paddle.testMode !== false ? 'sandbox' : 'production',
        processingFeePercent: paymentConfig.paddle.processingFeePercent ?? 5,
        cryptoDiscountPercent: paymentConfig.paddle.cryptoDiscountPercent ?? 3,
        testMode: paymentConfig.paddle.testMode !== false
      } : null
    };

    res.json({
      success: true,
      billing: billingInfo
    });
  } catch (error) {
    logger.error('Get billing info error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch billing information' });
  }
});

// Create Paddle checkout transaction (card/PayPal)
router.post('/create-paddle-checkout', [
  body('planId').isMongoId().withMessage('Valid plan ID is required'),
  body('billingPeriod').optional().isInt({ min: 1, max: 12 }).withMessage('Invalid billing period'),
  body('currency').optional().isIn(['USD', 'PKR', 'EUR', 'GBP']).withMessage('Invalid currency')
], handleValidationErrors, async (req, res) => {
  try {
    const paddleService = require('../services/paddle');
    const { planId, billingPeriod = 1, currency = 'USD' } = req.body;
    const user = req.user;

    // Check if Paddle is enabled
    const settings = await Settings.getSettings();
    if (!settings.paymentConfig?.paddle?.enabled) {
      return res.status(400).json({ success: false, error: 'Paddle payments are not enabled' });
    }

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, error: 'Plan not found or inactive' });
    }

    const basePrice = plan.getPricingForCurrency(currency.toLowerCase());
    if (basePrice === 0) {
      return res.status(400).json({ success: false, error: 'Cannot create payment for free plan' });
    }

    // Determine which Paddle Price ID to use
    const isTest = settings.paymentConfig.paddle.testMode !== false;
    const env = isTest ? 'sandbox' : 'live';
    const periodMap = { 1: 'monthly', 3: 'quarterly', 6: 'semiannual', 12: 'annual' };
    const periodKey = periodMap[billingPeriod] || 'monthly';
    const priceId = plan.paddlePriceIds?.[env]?.[periodKey];

    if (!priceId) {
      return res.status(400).json({
        success: false,
        error: `No Paddle Price ID configured for ${plan.displayName} - ${periodKey} (${env}). Admin must set this in Plans settings.`
      });
    }

    // Create Paddle transaction
    const result = await paddleService.createTransaction({
      userId: user._id,
      planId: plan._id,
      priceId,
      customerEmail: user.email,
      billingPeriod,
      planName: plan.displayName
    });

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    // Record pending payment
    const periodConfig = plan.billingPeriods?.find(p => p.months === billingPeriod && p.enabled);
    const discount = periodConfig?.discountPercent || 0;
    const totalPrice = Math.round(basePrice * billingPeriod * (1 - discount / 100) * 100) / 100;

    // Add processing fee for display
    const processingFee = settings.paymentConfig.paddle.processingFeePercent || 5;
    const totalWithFee = Math.round(totalPrice * (1 + processingFee / 100) * 100) / 100;

    try {
      await Payment.createFromSession({
        userId: user._id,
        transactionId: result.transactionId,
        amount: totalWithFee,
        currency,
        type: 'subscription',
        gateway: 'paddle',
        planId: plan._id,
        planName: plan.displayName,
        billingCycle: billingPeriod === 12 ? 'yearly' : 'monthly',
        description: `${plan.displayName} Plan - ${billingPeriod} month(s) via Paddle`
      });
    } catch (dbErr) {
      logger.error('Failed to record pending Paddle payment:', dbErr.message);
    }

    // Get client token for frontend
    const credentials = await paddleService.getActiveCredentials();

    logger.billing('Paddle checkout created', {
      userId: user._id, planId: plan._id, transactionId: result.transactionId, amount: totalWithFee, currency
    });

    res.json({
      success: true,
      transactionId: result.transactionId,
      clientToken: credentials.clientToken,
      environment: credentials.environment,
      plan: { name: plan.displayName, price: totalWithFee, currency }
    });
  } catch (error) {
    logger.error('Create Paddle checkout error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to create Paddle checkout' });
  }
});

// Cancel Paddle subscription
router.post('/paddle-subscription-cancel', async (req, res) => {
  try {
    const paddleService = require('../services/paddle');
    const user = await User.findById(req.user._id);

    if (!user.paddleSubscriptionId) {
      return res.status(400).json({ success: false, error: 'No active Paddle subscription found' });
    }

    const result = await paddleService.cancelSubscription(user.paddleSubscriptionId);
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    // Don't change status here — webhook will handle it
    logger.billing('Paddle subscription cancel requested', {
      userId: user._id, subscriptionId: user.paddleSubscriptionId
    });

    res.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the current billing period'
    });
  } catch (error) {
    logger.error('Paddle subscription cancel error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to cancel subscription' });
  }
});

// Update Paddle subscription (change plan)
router.post('/paddle-subscription-update', [
  body('newPlanId').isMongoId().withMessage('Valid plan ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const paddleService = require('../services/paddle');
    const { newPlanId } = req.body;
    const user = await User.findById(req.user._id);

    if (!user.paddleSubscriptionId) {
      return res.status(400).json({ success: false, error: 'No active Paddle subscription found' });
    }

    const newPlan = await Plan.findById(newPlanId);
    if (!newPlan || !newPlan.isActive) {
      return res.status(404).json({ success: false, error: 'Plan not found or inactive' });
    }

    // Get the new price ID
    const settings = await Settings.getSettings();
    const isTest = settings.paymentConfig?.paddle?.testMode !== false;
    const env = isTest ? 'sandbox' : 'live';
    const newPriceId = newPlan.paddlePriceIds?.[env]?.monthly; // default to monthly for updates

    if (!newPriceId) {
      return res.status(400).json({ success: false, error: 'No Paddle Price ID configured for this plan' });
    }

    const result = await paddleService.updateSubscription(user.paddleSubscriptionId, newPriceId);
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    logger.billing('Paddle subscription update requested', {
      userId: user._id, subscriptionId: user.paddleSubscriptionId, newPlanId
    });

    res.json({
      success: true,
      message: `Subscription will be updated to ${newPlan.displayName}`
    });
  } catch (error) {
    logger.error('Paddle subscription update error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to update subscription' });
  }
});

// Verify Paddle Price ID (admin use)
router.post('/verify-paddle-price', [
  body('priceId').isString().withMessage('Price ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const paddleService = require('../services/paddle');
    const { priceId } = req.body;

    const result = await paddleService.verifyPriceId(priceId);
    res.json(result);
  } catch (error) {
    logger.error('Verify Paddle price error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to verify price ID' });
  }
});

// Create BTCPay invoice for plan upgrade (crypto)
router.post('/create-btcpay-invoice', [
  body('planId').isMongoId().withMessage('Valid plan ID is required'),
  body('currency').optional().isIn(['USD', 'PKR', 'EUR', 'GBP']).withMessage('Invalid currency'),
  body('billingPeriod').optional().isInt({ min: 1, max: 12 }).withMessage('Invalid billing period')
], handleValidationErrors, async (req, res) => {
  try {
    const btcpayService = require('../services/btcpay');
    const { planId, currency = 'USD', billingPeriod = 1 } = req.body;
    const user = req.user;

    // Check if BTCPay is enabled
    const settings = await Settings.getSettings();
    if (!settings.paymentConfig?.btcpay?.enabled) {
      return res.status(400).json({ success: false, error: 'BTCPay crypto payments are not enabled' });
    }

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, error: 'Plan not found or inactive' });
    }

    // Calculate price with billing period discount
    const basePrice = plan.getPricingForCurrency(currency.toLowerCase());
    if (basePrice === 0) {
      return res.status(400).json({ success: false, error: 'Cannot create payment for free plan' });
    }

    const periodConfig = plan.billingPeriods?.find(p => p.months === billingPeriod && p.enabled);
    const discount = periodConfig?.discountPercent || 0;
    const totalPrice = Math.round(basePrice * billingPeriod * (1 - discount / 100) * 100) / 100;

    // Create BTCPay invoice
    const invoiceResult = await btcpayService.createInvoice({
      userId: user._id,
      planId: plan._id,
      planName: plan.displayName,
      amount: totalPrice,
      currency: currency,
      billingPeriod,
      buyerEmail: user.email,
      returnUrl: `${process.env.FRONTEND_URL}/dashboard/billing?payment=success&gateway=btcpay`
    });

    if (!invoiceResult.success) {
      return res.status(500).json({ success: false, error: invoiceResult.error });
    }

    // Record pending payment
    try {
      await Payment.createFromSession({
        userId: user._id,
        invoiceId: invoiceResult.invoiceId,
        amount: totalPrice,
        currency: currency,
        type: 'subscription',
        gateway: 'btcpay',
        planId: plan._id,
        planName: plan.displayName,
        billingCycle: billingPeriod === 12 ? 'yearly' : 'monthly',
        description: `${plan.displayName} Plan - ${billingPeriod} month(s) (Crypto)`
      });
    } catch (dbErr) {
      logger.error('Failed to record pending BTCPay payment:', dbErr.message);
    }

    logger.billing('BTCPay invoice created', {
      userId: user._id, planId: plan._id, invoiceId: invoiceResult.invoiceId, amount: totalPrice
    });

    res.json({
      success: true,
      invoiceId: invoiceResult.invoiceId,
      checkoutUrl: invoiceResult.checkoutUrl,
      expirationTime: invoiceResult.expirationTime,
      plan: { name: plan.displayName, price: totalPrice, currency }
    });
  } catch (error) {
    logger.error('Create BTCPay invoice error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to create BTCPay invoice' });
  }
});

// Cancel subscription
router.post('/cancel', async (req, res) => {
  try {
    const user = req.user;

    if (user.subscriptionStatus === 'trial') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel trial subscription'
      });
    }

    if (user.subscriptionStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Subscription already cancelled'
      });
    }

    // Update user subscription status
    user.subscriptionStatus = 'cancelled';
    await user.save();

    logger.billing('Subscription cancelled', {
      userId: user._id,
      planId: user.plan,
      cancelledAt: new Date()
    });

    try {
      await notify.subscriptionCancelled(user);
    } catch (notifyErr) {
      logger.warn('Subscription cancellation notification failed:', notifyErr.message);
    }

    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    logger.error('Cancel subscription error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to cancel subscription' });
  }
});

// Get payment history
router.get('/payments', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const user = req.user;

    const result = await Payment.findUserPayments(user._id, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    const payments = result.payments.map(p => ({
      id: p._id,
      paymentId: p.paddleTransactionId || p.payoneerPaymentId || p.btcpayInvoiceId || p._id,
      gateway: p.gateway || 'manual',
      amount: p.amount,
      currency: p.currency,
      formattedAmount: p.formattedAmount,
      status: p.status,
      type: p.type,
      description: p.description || p.planName,
      planName: p.planName,
      paymentMethod: p.paymentMethod,
      invoiceNumber: p.invoiceNumber,
      createdAt: p.createdAt,
      completedAt: p.completedAt,
      failedAt: p.failedAt,
      failureReason: p.failureReason
    }));

    res.json({
      success: true,
      payments,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    logger.error('Get payment history error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch payment history' });
  }
});

// Get invoices
router.get('/invoices', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const user = req.user;

    const result = await Payment.findUserInvoices(user._id, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    const invoices = result.invoices.map(p => ({
      id: p._id,
      number: p.invoiceNumber,
      amount: p.amount,
      currency: p.currency,
      formattedAmount: p.formattedAmount,
      status: 'paid',
      description: p.description || `${p.planName} - ${p.billingCycle} subscription`,
      planName: p.planName,
      issuedAt: p.createdAt,
      paidAt: p.completedAt,
      downloadUrl: null // Can be implemented later for PDF invoices
    }));

    res.json({
      success: true,
      invoices,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    logger.error('Get invoices error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
  }
});

// Update payment method
router.post('/payment-method', [
  body('type').isIn(['card', 'paddle', 'btcpay', 'jazzcash', 'easypaisa']).withMessage('Invalid payment method type'),
  body('paymentMethodId').optional().isString().withMessage('Payment method ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { type, paymentMethodId, makeDefault = false } = req.body;
    const user = req.user;

    // If making this the default, set all others to non-default
    if (makeDefault) {
      user.paymentMethods.forEach(pm => pm.isDefault = false);
    }

    // Add new payment method
    user.paymentMethods.push({
      type,
      paymentMethodId,
      isDefault: makeDefault || user.paymentMethods.length === 0,
      last4: '****',
      brand: type
    });

    await user.save();

    logger.billing('Payment method added', {
      userId: user._id,
      type: type,
      isDefault: makeDefault
    });

    res.json({
      success: true,
      message: 'Payment method added successfully'
    });
  } catch (error) {
    logger.error('Add payment method error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to add payment method' });
  }
});

// Remove payment method
router.delete('/payment-method/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const initialLength = user.paymentMethods.length;
    user.paymentMethods = user.paymentMethods.filter(pm => pm._id.toString() !== id);

    if (user.paymentMethods.length === initialLength) {
      return res.status(404).json({
        success: false,
        error: 'Payment method not found'
      });
    }

    // If we removed the default payment method, make the first one default
    if (user.paymentMethods.length > 0 && !user.paymentMethods.some(pm => pm.isDefault)) {
      user.paymentMethods[0].isDefault = true;
    }

    await user.save();

    logger.billing('Payment method removed', {
      userId: user._id,
      paymentMethodId: id
    });

    res.json({
      success: true,
      message: 'Payment method removed successfully'
    });
  } catch (error) {
    logger.error('Remove payment method error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to remove payment method' });
  }
});

// Get exchange rates (from settings config)
router.get('/exchange-rates', async (req, res) => {
  try {
    const { from = 'USD', to = 'PKR' } = req.query;

    const settings = await Settings.getSettings();
    const rates = settings.currencyConfig?.exchangeRates || {};

    // Map currency pair to stored rate
    const rateMap = {
      'USD-PKR': rates.usdToPkr || 278,
      'USD-EUR': rates.usdToEur || 0.92,
      'USD-GBP': rates.usdToGbp || 0.79,
      'PKR-USD': 1 / (rates.usdToPkr || 278),
      'EUR-USD': 1 / (rates.usdToEur || 0.92),
      'GBP-USD': 1 / (rates.usdToGbp || 0.79)
    };

    const rate = rateMap[`${from}-${to}`] || 1;

    res.json({
      success: true,
      exchangeRate: {
        from,
        to,
        rate,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Get exchange rates error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch exchange rates' });
  }
});

// Get public payment configuration (which methods are enabled)
router.get('/payment-config', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const config = settings.paymentConfig || {};
    const currencyConfig = settings.currencyConfig || { displayCurrency: 'usd', exchangeRates: { usdToPkr: 278, usdToEur: 0.92, usdToGbp: 0.79 } };

    const response = {
      paddle: {
        enabled: config.paddle?.enabled || false,
        clientToken: config.paddle?.enabled
          ? (config.paddle.testMode !== false ? config.paddle.sandboxClientToken : config.paddle.liveClientToken)
          : null,
        environment: config.paddle?.testMode !== false ? 'sandbox' : 'production',
        processingFeePercent: config.paddle?.processingFeePercent ?? 5,
        cryptoDiscountPercent: config.paddle?.cryptoDiscountPercent ?? 3,
        testMode: config.paddle?.testMode !== false
      },
      btcpay: { enabled: config.btcpay?.enabled || false },
      jazzcashEasypaisa: { enabled: config.jazzcashEasypaisa?.enabled || false },
      manualBank: {
        enabled: config.manualBank?.enabled || false,
        accounts: (config.manualBank?.accounts || []).filter(a => a.isActive !== false).map(a => ({
          id: a._id?.toString() || a.id || String(Math.random()),
          bankName: a.bankName,
          accountTitle: a.accountTitle,
          accountNumber: a.accountNumber,
          iban: a.iban,
          currency: a.currency || 'PKR'
        }))
      },
      crypto: {
        enabled: config.crypto?.enabled || false,
        wallets: (config.crypto?.wallets || []).filter(w => w.isActive !== false).map(w => ({
          id: w._id?.toString() || w.id || String(Math.random()),
          coinName: w.coinName,
          network: w.network,
          walletAddress: w.walletAddress
        }))
      },
      currencyConfig: {
        displayCurrency: currencyConfig.displayCurrency || 'usd',
        exchangeRates: currencyConfig.exchangeRates || {}
      }
    };

    // Auto-enable payment methods if accounts/wallets exist (user-friendly fallback)
    if (response.manualBank.accounts.length > 0 && !response.manualBank.enabled) {
      response.manualBank.enabled = true;
    }
    if (response.crypto.wallets.length > 0 && !response.crypto.enabled) {
      response.crypto.enabled = true;
    }

    res.json({ success: true, paymentConfig: response });
  } catch (error) {
    logger.error('Get payment config error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch payment configuration' });
  }
});

// Submit manual bank transfer or crypto payment
router.post('/manual-payment', upload.single('screenshot'), async (req, res) => {
  try {
    const { planId, bankAccountId, cryptoWalletId, senderName, senderAccount, transactionId, paymentType, billingPeriod: billingPeriodStr } = req.body;
    const user = req.user;
    const isCrypto = paymentType === 'crypto' || !!cryptoWalletId;
    const billingPeriod = parseInt(billingPeriodStr) || 1;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Screenshot is required' });
    }

    if (!planId) {
      return res.status(400).json({ success: false, error: 'Plan is required' });
    }

    if (!isCrypto && (!bankAccountId || !senderName)) {
      return res.status(400).json({ success: false, error: 'Bank account and sender name are required' });
    }

    if (isCrypto && !cryptoWalletId) {
      return res.status(400).json({ success: false, error: 'Crypto wallet selection is required' });
    }

    // Get plan
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    // Get settings for account/wallet lookup
    const settings = await Settings.getSettings();

    // Check if user already has a pending manual payment
    const existingPending = await ManualPayment.findOne({ user: user._id, status: 'pending' });
    if (existingPending) {
      return res.status(400).json({
        success: false,
        error: 'You already have a pending payment verification. Please wait for admin approval.'
      });
    }

    let paymentRecord;

    if (isCrypto) {
      // Crypto payment
      const cryptoWallet = settings.paymentConfig?.crypto?.wallets?.id(cryptoWalletId);
      if (!cryptoWallet) {
        return res.status(404).json({ success: false, error: 'Crypto wallet not found' });
      }

      const baseAmount = plan.getPricingForCurrency('usd') || plan.pricing.usd;
      const periodConfig = (plan.billingPeriods || []).find(p => p.months === billingPeriod);
      const discount = periodConfig?.discountPercent || 0;
      const amount = Math.round(baseAmount * billingPeriod * (1 - discount / 100) * 100) / 100;

      paymentRecord = await ManualPayment.create({
        user: user._id,
        plan: plan._id,
        planName: plan.displayName,
        amount: amount,
        currency: cryptoWallet.coinName || 'CRYPTO',
        billingPeriod: billingPeriod,
        paymentType: 'crypto',
        cryptoWallet: {
          coinName: cryptoWallet.coinName,
          network: cryptoWallet.network,
          walletAddress: cryptoWallet.walletAddress
        },
        senderName: senderName || 'Crypto Payment',
        transactionId: transactionId || '',
        screenshot: `/uploads/payments/${req.file.filename}`
      });
    } else {
      // Bank transfer
      const bankAccount = settings.paymentConfig?.manualBank?.accounts?.id(bankAccountId);
      if (!bankAccount) {
        return res.status(404).json({ success: false, error: 'Bank account not found' });
      }

      const bankCurrency = bankAccount.currency || 'PKR';
      const baseAmount = plan.getPricingForCurrency(bankCurrency.toLowerCase()) || plan.getPricingForCurrency('usd');
      const periodConfig = (plan.billingPeriods || []).find(p => p.months === billingPeriod);
      const discount = periodConfig?.discountPercent || 0;
      const amount = Math.round(baseAmount * billingPeriod * (1 - discount / 100) * 100) / 100;

      paymentRecord = await ManualPayment.create({
        user: user._id,
        plan: plan._id,
        planName: plan.displayName,
        amount: amount,
        currency: bankCurrency,
        billingPeriod: billingPeriod,
        paymentType: 'bank',
        bankAccount: {
          bankName: bankAccount.bankName,
          accountTitle: bankAccount.accountTitle,
          accountNumber: bankAccount.accountNumber,
          iban: bankAccount.iban
        },
        senderName,
        senderAccount: senderAccount || '',
        transactionId: transactionId || '',
        screenshot: `/uploads/payments/${req.file.filename}`
      });
    }

    logger.billing('Manual payment submitted', {
      userId: user._id,
      planId: plan._id,
      paymentType: isCrypto ? 'crypto' : 'bank',
      paymentId: paymentRecord._id
    });

    // Notify admins + send user confirmation (email + real-time)
    try {
      await notify.paymentSubmitted(user, plan.displayName, isCrypto ? 'crypto' : 'bank');
      await notify.paymentReceived(user, plan.displayName, paymentRecord.amount, paymentRecord.currency, isCrypto ? 'crypto' : 'bank');
    } catch (notifyErr) {
      logger.error('Failed to send payment notifications:', notifyErr);
    }

    res.json({
      success: true,
      message: 'Payment submitted successfully. Admin will verify your payment shortly.',
      payment: {
        id: paymentRecord._id,
        status: paymentRecord.status,
        amount: paymentRecord.amount,
        planName: paymentRecord.planName,
        createdAt: paymentRecord.createdAt
      }
    });
  } catch (error) {
    logger.error('Manual payment submission error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to submit payment' });
  }
});

// Get user's manual payment history
router.get('/manual-payments', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await ManualPayment.getUserPayments(req.user._id, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      payments: result.payments,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    logger.error('Get manual payments error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch manual payments' });
  }
});

// Create JazzCash payment session
router.post('/create-session-jazzcash', [
  body('planId').isMongoId().withMessage('Valid plan ID is required'),
  body('mobileNumber').isString().withMessage('Mobile number is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { planId, mobileNumber } = req.body;
    const user = req.user;

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const amount = plan.getPricingForCurrency('pkr');
    if (!amount || amount === 0) {
      return res.status(400).json({ success: false, error: 'PKR pricing not available for this plan' });
    }

    const sessionResult = await jazzcashService.createPaymentSession({
      amount,
      mobileNumber,
      userId: user._id.toString(),
      planId: plan._id.toString(),
      planName: plan.displayName,
      description: `${plan.displayName} Plan - Monthly`,
      returnUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/webhooks/jazzcash`
    });

    if (!sessionResult.success) {
      return res.status(500).json({ success: false, error: sessionResult.error });
    }

    // Record pending payment
    try {
      await Payment.createFromSession({
        userId: user._id,
        sessionId: sessionResult.sessionId,
        amount,
        currency: 'PKR',
        type: 'subscription',
        planId: plan._id,
        planName: plan.displayName,
        description: `${plan.displayName} Plan via JazzCash`,
        gateway: 'jazzcash'
      });
    } catch (err) {
      logger.error('Failed to record JazzCash pending payment:', err.message);
    }

    res.json({
      success: true,
      session: {
        id: sessionResult.sessionId,
        checkoutUrl: sessionResult.checkoutUrl
      },
      plan: { name: plan.displayName, price: amount, currency: 'PKR' }
    });
  } catch (error) {
    logger.error('JazzCash session error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to create JazzCash payment session' });
  }
});

// Create EasyPaisa payment session
router.post('/create-session-easypaisa', [
  body('planId').isMongoId().withMessage('Valid plan ID is required'),
  body('mobileNumber').optional().isString()
], handleValidationErrors, async (req, res) => {
  try {
    const { planId, mobileNumber } = req.body;
    const user = req.user;

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const amount = plan.getPricingForCurrency('pkr');
    if (!amount || amount === 0) {
      return res.status(400).json({ success: false, error: 'PKR pricing not available for this plan' });
    }

    const sessionResult = await easypaisaService.createPaymentSession({
      amount,
      mobileNumber: mobileNumber || '',
      email: user.email,
      userId: user._id.toString(),
      planId: plan._id.toString(),
      planName: plan.displayName,
      returnUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/webhooks/easypaisa`
    });

    if (!sessionResult.success) {
      return res.status(500).json({ success: false, error: sessionResult.error });
    }

    // Record pending payment
    try {
      await Payment.createFromSession({
        userId: user._id,
        sessionId: sessionResult.sessionId,
        amount,
        currency: 'PKR',
        type: 'subscription',
        planId: plan._id,
        planName: plan.displayName,
        description: `${plan.displayName} Plan via EasyPaisa`,
        gateway: 'easypaisa'
      });
    } catch (err) {
      logger.error('Failed to record EasyPaisa pending payment:', err.message);
    }

    res.json({
      success: true,
      session: {
        id: sessionResult.sessionId,
        checkoutUrl: sessionResult.checkoutUrl,
        formData: sessionResult.formData,
        method: sessionResult.method
      },
      plan: { name: plan.displayName, price: amount, currency: 'PKR' }
    });
  } catch (error) {
    logger.error('EasyPaisa session error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to create EasyPaisa payment session' });
  }
});

// Schedule plan downgrade at period end
router.post('/schedule-downgrade', async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ success: false, error: 'Plan ID required' });

    const Plan = require('../models/Plan');
    const newPlan = await Plan.findById(planId);
    if (!newPlan) return res.status(404).json({ success: false, error: 'Plan not found' });

    const user = await User.findById(req.user._id);
    if (!user.planExpiresAt) {
      return res.status(400).json({ success: false, error: 'No active subscription period found' });
    }

    // Check it's actually a downgrade (lower price)
    const currentPlan = await Plan.findById(user.plan);
    if (currentPlan && newPlan.pricing.usd >= currentPlan.pricing.usd) {
      return res.status(400).json({ success: false, error: 'This is not a downgrade. Use upgrade instead.' });
    }

    user.scheduledDowngradeTo = newPlan._id;
    user.scheduledDowngradeAt = user.planExpiresAt; // Downgrade at period end
    await user.save();

    res.json({
      success: true,
      message: `Plan will be downgraded to ${newPlan.displayName} on ${user.planExpiresAt.toLocaleDateString()}`,
      downgradeDate: user.planExpiresAt,
      newPlan: newPlan.displayName
    });
  } catch (error) {
    logger.error('Schedule downgrade error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to schedule downgrade' });
  }
});

// Cancel scheduled downgrade
router.delete('/cancel-downgrade', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.scheduledDowngradeTo = null;
    user.scheduledDowngradeAt = null;
    await user.save();
    res.json({ success: true, message: 'Scheduled downgrade cancelled' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to cancel downgrade' });
  }
});

module.exports = router;
