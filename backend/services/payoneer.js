const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Configuration and constants
const config = {
  baseURL: process.env.PAYONEER_API_URL || 'https://api.payoneer.com',
  clientId: process.env.PAYONEER_CLIENT_ID,
  clientSecret: process.env.PAYONEER_CLIENT_SECRET,
  webhookSecret: process.env.PAYONEER_WEBHOOK_SECRET,
  environment: process.env.NODE_ENV || 'development'
};

const endpoints = {
  auth: '/v1/oauth/token',
  customers: '/v1/customers',
  payments: '/v1/payments',
  payouts: '/v1/payouts',
  webhooks: '/v1/webhooks'
};

// Authentication state (using module scope for simplicity)
let authState = {
  accessToken: null,
  tokenExpiry: null
};

// Helper functions
const isTokenValid = () => {
  return authState.accessToken && 
         authState.tokenExpiry && 
         new Date() < authState.tokenExpiry;
};

const createRequestHeaders = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
});

const createSuccessResponse = (data, additionalProps = {}) => ({
  success: true,
  ...additionalProps,
  data
});

const createErrorResponse = (error, fallbackMessage = 'Operation failed') => ({
  success: false,
  error: error?.response?.data?.message || error?.message || fallbackMessage
});

const logOperation = (operation, details, isError = false) => {
  const logMethod = isError ? 'error' : 'billing';
  logger[logMethod](`Payoneer: ${operation}`, details);
};

// Core authentication function
const authenticate = async () => {
  try {
    if (isTokenValid()) {
      return authState.accessToken;
    }

    const authPayload = {
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: 'payments payouts customers'
    };

    const authHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const response = await axios.post(
      `${config.baseURL}${endpoints.auth}`,
      authPayload,
      { headers: authHeaders }
    );

    // Update auth state
    authState.accessToken = response.data.access_token;
    authState.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
    
    logger.info('Payoneer authentication successful');
    return authState.accessToken;
  } catch (error) {
    logOperation('Authentication failed', error.response?.data || error.message, true);
    throw new Error('Failed to authenticate with Payoneer');
  }
};

// Get authenticated headers
const getAuthenticatedHeaders = async () => {
  const token = await authenticate();
  return createRequestHeaders(token);
};

// Payment method selection based on currency
const getPaymentMethodsForCurrency = (currency) => {
  const baseMethods = ['card'];
  
  const currencySpecificMethods = {
    PKR: [
      'nayapay_card',
      'sadapay_card', 
      'hbl_card',
      'meezan_card',
      'ubl_card',
      'bank_transfer_pk'
    ],
    default: [
      'payoneer_wallet',
      'bank_transfer',
      'wire_transfer'
    ]
  };
  
  return [
    ...baseMethods,
    ...(currencySpecificMethods[currency] || currencySpecificMethods.default)
  ];
};

// Customer management functions
const createCustomer = async (userData) => {
  try {
    const headers = await getAuthenticatedHeaders();
    
    const customerPayload = {
      reference_id: userData.userId,
      email: userData.email,
      first_name: userData.firstName || userData.displayName.split(' ')[0],
      last_name: userData.lastName || userData.displayName.split(' ').slice(1).join(' ') || 'User',
      country_code: userData.country || 'PK',
      currency: userData.currency || 'USD',
      metadata: {
        platform: 'vercel-clone',
        user_id: userData.userId,
        github_username: userData.username
      }
    };

    const response = await axios.post(
      `${config.baseURL}${endpoints.customers}`,
      customerPayload,
      { headers }
    );

    logOperation('Customer created', {
      userId: userData.userId,
      payoneerCustomerId: response.data.id,
      email: userData.email
    });

    return createSuccessResponse(response.data, {
      customerId: response.data.id
    });
  } catch (error) {
    logOperation('Failed to create customer', error.response?.data || error.message, true);
    return createErrorResponse(error, 'Failed to create customer');
  }
};

// Payment session management
const createPaymentSession = async (paymentData) => {
  try {
    const headers = await getAuthenticatedHeaders();
    
    const sessionPayload = {
      customer_id: paymentData.customerId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      description: paymentData.description || `Subscription payment for ${paymentData.planName}`,
      reference_id: paymentData.orderId,
      return_url: paymentData.returnUrl,
      cancel_url: paymentData.cancelUrl,
      webhook_url: paymentData.webhookUrl,
      metadata: {
        user_id: paymentData.userId,
        plan_id: paymentData.planId,
        plan_name: paymentData.planName,
        billing_cycle: paymentData.billingCycle || 'monthly'
      },
      payment_methods: getPaymentMethodsForCurrency(paymentData.currency),
      auto_conversion: {
        enabled: paymentData.currency === 'PKR',
        target_currency: 'USD'
      }
    };

    const response = await axios.post(
      `${config.baseURL}${endpoints.payments}/sessions`,
      sessionPayload,
      { headers }
    );

    logOperation('Payment session created', {
      userId: paymentData.userId,
      sessionId: response.data.id,
      amount: paymentData.amount,
      currency: paymentData.currency
    });

    return createSuccessResponse(response.data, {
      sessionId: response.data.id,
      checkoutUrl: response.data.checkout_url
    });
  } catch (error) {
    logOperation('Failed to create payment session', error.response?.data || error.message, true);
    return createErrorResponse(error, 'Failed to create payment session');
  }
};

// Recurring payment processing
const processRecurringPayment = async (subscriptionData) => {
  try {
    const headers = await getAuthenticatedHeaders();
    
    const paymentPayload = {
      customer_id: subscriptionData.customerId,
      payment_method_id: subscriptionData.paymentMethodId,
      amount: subscriptionData.amount,
      currency: subscriptionData.currency,
      description: `Monthly subscription - ${subscriptionData.planName}`,
      reference_id: `sub_${subscriptionData.subscriptionId}_${Date.now()}`,
      metadata: {
        subscription_id: subscriptionData.subscriptionId,
        user_id: subscriptionData.userId,
        billing_period: subscriptionData.billingPeriod
      }
    };

    const response = await axios.post(
      `${config.baseURL}${endpoints.payments}`,
      paymentPayload,
      { headers }
    );

    logOperation('Recurring payment processed', {
      userId: subscriptionData.userId,
      paymentId: response.data.id,
      amount: subscriptionData.amount,
      status: response.data.status
    });

    return createSuccessResponse(response.data, {
      paymentId: response.data.id,
      status: response.data.status
    });
  } catch (error) {
    logOperation('Failed to process recurring payment', error.response?.data || error.message, true);
    return createErrorResponse(error, 'Failed to process payment');
  }
};

// Payment retrieval
const getPayment = async (paymentId) => {
  try {
    const headers = await getAuthenticatedHeaders();
    
    const response = await axios.get(
      `${config.baseURL}${endpoints.payments}/${paymentId}`,
      { headers }
    );

    return createSuccessResponse(response.data);
  } catch (error) {
    logOperation('Failed to get payment details', error.response?.data || error.message, true);
    return createErrorResponse(error, 'Failed to get payment details');
  }
};

// Pakistani bank withdrawal
const withdrawToPakistanBank = async (withdrawalData) => {
  try {
    const headers = await getAuthenticatedHeaders();
    
    const payoutPayload = {
      recipient: {
        type: 'bank_account',
        bank_account: {
          account_number: withdrawalData.accountNumber,
          bank_code: withdrawalData.bankCode,
          account_holder_name: withdrawalData.accountHolderName,
          bank_name: withdrawalData.bankName
        },
        country: 'PK',
        currency: 'PKR'
      },
      amount: withdrawalData.amount,
      currency: 'USD',
      purpose: 'business_payment',
      reference_id: withdrawalData.referenceId,
      description: withdrawalData.description || 'Platform revenue withdrawal',
      metadata: {
        withdrawal_type: 'pakistan_bank',
        admin_id: withdrawalData.adminId,
        platform: 'vercel-clone'
      }
    };

    const response = await axios.post(
      `${config.baseURL}${endpoints.payouts}`,
      payoutPayload,
      { headers }
    );

    logOperation('Withdrawal to Pakistan bank initiated', {
      payoutId: response.data.id,
      amount: withdrawalData.amount,
      currency: 'USD->PKR',
      bankName: withdrawalData.bankName
    });

    return createSuccessResponse(response.data, {
      payoutId: response.data.id,
      status: response.data.status
    });
  } catch (error) {
    logOperation('Failed to initiate withdrawal', error.response?.data || error.message, true);
    return createErrorResponse(error, 'Failed to initiate withdrawal');
  }
};

// Exchange rate functions
const getExchangeRate = async (fromCurrency = 'USD', toCurrency = 'PKR') => {
  try {
    const headers = await getAuthenticatedHeaders();
    
    const response = await axios.get(
      `${config.baseURL}/v1/exchange-rates?from=${fromCurrency}&to=${toCurrency}`,
      { headers }
    );

    return {
      success: true,
      rate: response.data.rate,
      timestamp: response.data.timestamp
    };
  } catch (error) {
    logOperation('Failed to get exchange rate', error.response?.data || error.message, true);
    return {
      success: false,
      rate: 280, // Fallback rate
      error: 'Using fallback exchange rate'
    };
  }
};

const calculatePKRAmount = async (usdAmount) => {
  const rateResult = await getExchangeRate();
  const rate = rateResult.rate;
  const pkrAmount = Math.round(usdAmount * rate);
  
  return {
    usd: usdAmount,
    pkr: pkrAmount,
    rate: rate,
    formatted: {
      usd: `$${usdAmount}`,
      pkr: `Rs ${pkrAmount.toLocaleString()}`
    }
  };
};

// Webhook signature verification
const verifyWebhookSignature = (payload, signature) => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', config.webhookSecret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    logOperation('Webhook signature verification failed', error.message, true);
    return false;
  }
};

// Webhook event handlers
const handlePaymentCompleted = async (paymentData) => {
  const User = require('../models/User');
  const Plan = require('../models/Plan');
  const containerOrchestrator = require('./containerOrchestrator');
  
  try {
    const userId = paymentData.metadata?.user_id;
    const planId = paymentData.metadata?.plan_id;
    
    if (!userId || !planId) {
      return { success: true, handled: false, reason: 'Missing user or plan ID' };
    }

    const [user, plan] = await Promise.all([
      User.findById(userId),
      Plan.findById(planId)
    ]);
    
    if (!user || !plan) {
      return { success: false, error: 'User or plan not found' };
    }

    // Update user subscription status and clear suspension/deletion flags
    const userBeforeUpdate = await User.findById(userId);
    const hadResourcesDeleted = userBeforeUpdate?.resourcesDeleted;

    const updateFields = {
      plan: planId,
      subscriptionStatus: 'active',
      status: 'active',
      isTrialActive: false,
      suspendedAt: null,
      suspensionReason: null,
      autoSuspended: false
    };

    // If resources were deleted, reset container fields so a fresh one is allocated
    if (hadResourcesDeleted) {
      updateFields.resourcesDeleted = false;
      updateFields.resourcesDeletedAt = null;
      updateFields.oracleAccountId = null;
      updateFields.containerId = null;
      updateFields.containerName = null;
      updateFields.assignedServer = null;
      updateFields.assignedPort = null;
    }

    await User.findByIdAndUpdate(userId, updateFields);

    const upgradeResult = await containerOrchestrator.upgradeUserPlan(userId, plan);
    
    if (upgradeResult.success) {
      logOperation('User plan upgraded successfully after payment', {
        userId: userId,
        planName: plan.displayName,
        amount: paymentData.amount,
        currency: paymentData.currency,
        upgrade: upgradeResult.upgrade,
        dataPreserved: true
      });
      
      return { 
        success: true, 
        handled: true, 
        upgrade: upgradeResult.upgrade,
        message: 'User plan upgraded successfully with data preservation'
      };
    } else {
      logger.error('Plan upgrade failed after payment', {
        userId: userId,
        planName: plan.displayName,
        amount: paymentData.amount,
        error: upgradeResult.error
      });
      
      // For fallback, try to allocate container if user doesn't have one
      if (!user.oracleAccountId) {
        const containerResult = await containerOrchestrator.allocateContainer(user, plan);
        
        if (containerResult.success) {
          logOperation('Fallback: User container allocated after payment', {
            userId: userId,
            planName: plan.displayName,
            amount: paymentData.amount,
            currency: paymentData.currency,
            server: containerResult.container.server,
            fallback: true
          });
          
          return { 
            success: true, 
            handled: true, 
            container: containerResult.container,
            warning: 'Used fallback container allocation'
          };
        }
      }
      
      // Still consider payment handled, but log the upgrade issue
      return { 
        success: true, 
        handled: true, 
        warning: 'Payment processed but plan upgrade failed',
        upgradeError: upgradeResult.error
      };
    }
  } catch (error) {
    logOperation('Failed to handle payment completion', error.message, true);
    return { success: false, error: error.message };
  }
};

const handlePaymentFailed = async (paymentData) => {
  const User = require('../models/User');
  
  try {
    const userId = paymentData.metadata?.user_id;
    
    if (!userId) {
      return { success: true, handled: false, reason: 'Missing user ID' };
    }

    await User.findByIdAndUpdate(userId, {
      subscriptionStatus: 'past_due'
    });
    
    logOperation('Payment failed for user', {
      userId: userId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      reason: paymentData.failure_reason
    });
    
    return { success: true, handled: true };
  } catch (error) {
    logOperation('Failed to handle payment failure', error.message, true);
    return { success: false, error: error.message };
  }
};

const handleSubscriptionActivated = async (subscriptionData) => {
  // Implementation for subscription activation
  return { success: true, handled: true };
};

const handleSubscriptionCancelled = async (subscriptionData) => {
  // Implementation for subscription cancellation
  return { success: true, handled: true };
};

const handlePayoutCompleted = async (payoutData) => {
  logOperation('Payout completed', {
    payoutId: payoutData.id,
    amount: payoutData.amount,
    currency: payoutData.currency
  });
  return { success: true, handled: true };
};

const handlePayoutFailed = async (payoutData) => {
  logOperation('Payout failed', {
    payoutId: payoutData.id,
    amount: payoutData.amount,
    currency: payoutData.currency,
    reason: payoutData.failure_reason
  });
  return { success: true, handled: true };
};

// Main webhook handler with event routing
const handleWebhook = async (event) => {
  try {
    logOperation('Webhook received', {
      eventType: event.type,
      eventId: event.id,
      resourceId: event.data?.id
    });

    const eventHandlers = {
      'payment.completed': handlePaymentCompleted,
      'payment.failed': handlePaymentFailed,
      'subscription.activated': handleSubscriptionActivated,
      'subscription.cancelled': handleSubscriptionCancelled,
      'payout.completed': handlePayoutCompleted,
      'payout.failed': handlePayoutFailed
    };

    const handler = eventHandlers[event.type];
    
    if (!handler) {
      logger.warn('Unhandled webhook event type:', event.type);
      return { success: true, handled: false };
    }

    return await handler(event.data);
  } catch (error) {
    logOperation('Webhook handling failed', error.message, true);
    return { success: false, error: error.message };
  }
};

// Export all functions as a module
module.exports = {
  // Authentication
  authenticate,
  getAuthenticatedHeaders,
  
  // Customer management
  createCustomer,
  
  // Payment processing
  createPaymentSession,
  processRecurringPayment,
  getPayment,
  
  // Payouts
  withdrawToPakistanBank,
  
  // Exchange rates
  getExchangeRate,
  calculatePKRAmount,
  
  // Webhook handling
  verifyWebhookSignature,
  handleWebhook,
  
  // Utility functions
  getPaymentMethodsForCurrency,
  
  // Config access (for testing)
  getConfig: () => ({ ...config }),
  getEndpoints: () => ({ ...endpoints })
};
