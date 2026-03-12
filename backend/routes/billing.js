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
const payoneerService = require('../services/payoneer');
const jazzcashService = require('../services/jazzcash');
const easypaisaService = require('../services/easypaisa');
const logger = require('../utils/logger');

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
    const formattedPlans = plans.map(plan => ({
      id: plan._id,
      name: plan.name,
      displayName: plan.displayName,
      description: plan.description,
      price: plan.getPricingForCurrency(currency),
      formattedPrice: plan.formattedPricing[currency.toLowerCase()],
      resources: plan.displayResources || plan.resources, // Use display resources for frontend
      actualResources: plan.resources, // Keep actual resources if needed for debugging
      features: plan.features.filter(f => f.enabled),
      billingCycle: plan.billingCycle,
      isDefault: plan.isDefault,
      isTrial: plan.isTrial
    }));

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

    const billingInfo = {
      currentPlan: user.plan ? {
        id: user.plan._id,
        name: user.plan.displayName,
        price: user.plan.formattedPricing,
        resources: user.plan.resources,
        features: user.plan.features.filter(f => f.enabled)
      } : null,
      subscriptionStatus: user.subscriptionStatus,
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
      }))
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

// Create payment session for plan upgrade
router.post('/create-session', [
  body('planId').isMongoId().withMessage('Valid plan ID is required'),
  body('currency').optional().isIn(['USD', 'PKR', 'EUR', 'GBP']).withMessage('Invalid currency'),
  body('returnUrl').optional().isURL().withMessage('Invalid return URL'),
  body('cancelUrl').optional().isURL().withMessage('Invalid cancel URL')
], handleValidationErrors, async (req, res) => {
  try {
    const { planId, currency = 'USD', returnUrl, cancelUrl } = req.body;
    const user = req.user;

    // Get the selected plan
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found or inactive'
      });
    }

    // Check if user can upgrade to this plan
    if (user.plan && !plan.canUpgradeFrom(user.plan)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot downgrade to a lower plan'
      });
    }

    // Create Payoneer customer if doesn't exist
    if (!user.payoneerCustomerId) {
      const customerResult = await payoneerService.createCustomer({
        userId: user._id,
        email: user.email,
        displayName: user.displayName,
        username: user.username,
        country: currency === 'PKR' ? 'PK' : 'US',
        currency: currency
      });

      if (customerResult.success) {
        user.payoneerCustomerId = customerResult.customerId;
        await user.save();
      } else {
        return res.status(500).json({
          success: false,
          error: 'Failed to create payment profile'
        });
      }
    }

    // Get plan price for selected currency
    const amount = plan.getPricingForCurrency(currency.toLowerCase());

    if (amount === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot create payment session for free plan'
      });
    }

    // Create payment session
    const sessionResult = await payoneerService.createPaymentSession({
      customerId: user.payoneerCustomerId,
      amount: amount,
      currency: currency,
      description: `${plan.displayName} Plan - Monthly Subscription`,
      planId: plan._id,
      planName: plan.displayName,
      userId: user._id,
      orderId: `upgrade_${user._id}_${plan._id}_${Date.now()}`,
      returnUrl: returnUrl || `${process.env.FRONTEND_URL}/dashboard/billing?success=true`,
      cancelUrl: cancelUrl || `${process.env.FRONTEND_URL}/dashboard/billing?cancelled=true`,
      webhookUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/webhooks/payoneer`,
      billingCycle: plan.billingCycle
    });

    if (!sessionResult.success) {
      logger.error('Payment session creation failed:', sessionResult.error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create payment session'
      });
    }

    // Record pending payment in database
    try {
      await Payment.createFromSession({
        userId: user._id,
        sessionId: sessionResult.sessionId,
        amount: amount,
        currency: currency,
        type: 'subscription',
        planId: plan._id,
        planName: plan.displayName,
        billingCycle: plan.billingCycle || 'monthly',
        description: `${plan.displayName} Plan - Monthly Subscription`
      });
    } catch (paymentDbError) {
      logger.error('Failed to record pending payment:', paymentDbError.message);
      // Don't fail the session creation if DB record fails
    }

    logger.billing('Payment session created', {
      userId: user._id,
      planId: plan._id,
      amount: amount,
      currency: currency,
      sessionId: sessionResult.sessionId
    });

    res.json({
      success: true,
      session: {
        id: sessionResult.sessionId,
        checkoutUrl: sessionResult.checkoutUrl
      },
      plan: {
        name: plan.displayName,
        price: amount,
        currency: currency
      }
    });
  } catch (error) {
    logger.error('Create payment session error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to create payment session' });
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
      payoneerPaymentId: p.payoneerPaymentId,
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
  body('type').isIn(['card', 'payoneer_wallet']).withMessage('Invalid payment method type'),
  body('payoneerPaymentMethodId').isString().withMessage('Payment method ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { type, payoneerPaymentMethodId, makeDefault = false } = req.body;
    const user = req.user;

    // If making this the default, set all others to non-default
    if (makeDefault) {
      user.paymentMethods.forEach(pm => pm.isDefault = false);
    }

    // Add new payment method
    user.paymentMethods.push({
      type,
      payoneerPaymentMethodId,
      isDefault: makeDefault || user.paymentMethods.length === 0,
      // These would normally come from Payoneer
      last4: '****',
      brand: type === 'card' ? 'visa' : 'payoneer'
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

// Get exchange rates (for PKR users)
router.get('/exchange-rates', async (req, res) => {
  try {
    const { from = 'USD', to = 'PKR' } = req.query;

    const rateResult = await payoneerService.getExchangeRate(from, to);

    res.json({
      success: true,
      exchangeRate: {
        from: from,
        to: to,
        rate: rateResult.rate,
        timestamp: rateResult.timestamp
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
      payoneer: { enabled: config.payoneer?.enabled || false },
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

    res.json({ success: true, paymentConfig: response });
  } catch (error) {
    logger.error('Get payment config error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch payment configuration' });
  }
});

// Submit manual bank transfer or crypto payment
router.post('/manual-payment', upload.single('screenshot'), async (req, res) => {
  try {
    const { planId, bankAccountId, cryptoWalletId, senderName, senderAccount, transactionId, paymentType } = req.body;
    const user = req.user;
    const isCrypto = paymentType === 'crypto' || !!cryptoWalletId;

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

      const amount = plan.getPricingForCurrency('usd') || plan.pricing.usd;

      paymentRecord = await ManualPayment.create({
        user: user._id,
        plan: plan._id,
        planName: plan.displayName,
        amount: amount,
        currency: cryptoWallet.coinName || 'CRYPTO',
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
      const amount = plan.getPricingForCurrency(bankCurrency.toLowerCase()) || plan.getPricingForCurrency('usd');

      paymentRecord = await ManualPayment.create({
        user: user._id,
        plan: plan._id,
        planName: plan.displayName,
        amount: amount,
        currency: bankCurrency,
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
        description: `${plan.displayName} Plan via JazzCash`
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
        description: `${plan.displayName} Plan via EasyPaisa`
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

module.exports = router;
