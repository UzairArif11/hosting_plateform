const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const payoneerService = require('../services/payoneer');
const logger = require('../utils/logger');

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

module.exports = router;
