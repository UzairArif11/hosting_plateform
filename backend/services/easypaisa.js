const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

// EasyPaisa Merchant API Configuration
const config = {
    storeId: process.env.EASYPAISA_STORE_ID || '',
    hashKey: process.env.EASYPAISA_HASH_KEY || '',
    accountNum: process.env.EASYPAISA_ACCOUNT_NUM || '',
    baseURL: process.env.EASYPAISA_API_URL || 'https://easypay.easypaisa.com.pk/easypay/Index.jsf',
    confirmURL: process.env.EASYPAISA_CONFIRM_URL || 'https://easypay.easypaisa.com.pk/easypay/Confirm.jsf',
    environment: process.env.NODE_ENV || 'development'
};

// Generate HMAC hash for request integrity
const generateHash = (dataString) => {
    return crypto
        .createHmac('sha256', config.hashKey)
        .update(dataString)
        .digest('hex');
};

// Format date for EasyPaisa (yyyyMMdd HHmmss)
const formatDate = (date = new Date()) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())} ${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

// Format expiry (add 1 hour from now)
const formatExpiry = () => {
    const expiry = new Date(Date.now() + 60 * 60 * 1000);
    return formatDate(expiry);
};

// Create payment session (hosted checkout)
const createPaymentSession = async (paymentData) => {
    try {
        const orderId = `EP-${Date.now()}`;
        const txnDateTime = formatDate();
        const expiryDateTime = formatExpiry();
        const amount = paymentData.amount.toFixed(1); // EasyPaisa wants 1 decimal

        // Build hash string (storeId, amount, orderId, postbackUrl, expiryDate, merchantHashedReq)
        const hashString = [
            amount,
            paymentData.returnUrl || `${process.env.BACKEND_URL}/api/webhooks/easypaisa`,
            expiryDateTime,
            orderId,
            config.storeId
        ].join('&');

        const secureHash = generateHash(hashString);

        // EasyPaisa hosted checkout form data
        const formData = {
            storeId: config.storeId,
            amount: amount,
            postBackURL: paymentData.returnUrl || `${process.env.BACKEND_URL}/api/webhooks/easypaisa`,
            orderRefNum: orderId,
            expiryDate: expiryDateTime,
            autoRedirect: '1',
            paymentMethod: 'MA_PAYMENT_METHOD', // Mobile account
            emailAddr: paymentData.email || '',
            mobileNum: paymentData.mobileNumber || '',
            merchantHashedReq: secureHash
        };

        // Store metadata for later verification
        const metadata = {
            userId: paymentData.userId,
            planId: paymentData.planId,
            planName: paymentData.planName,
            orderId: orderId
        };

        logger.info('EasyPaisa payment session created', {
            orderId,
            amount: paymentData.amount,
            userId: paymentData.userId
        });

        return {
            success: true,
            sessionId: orderId,
            checkoutUrl: config.baseURL,
            formData: formData,
            metadata: metadata,
            method: 'POST' // EasyPaisa uses form POST to redirect
        };
    } catch (error) {
        logger.error('EasyPaisa session creation error:', error.message);
        return {
            success: false,
            error: error.message || 'Failed to create EasyPaisa payment session'
        };
    }
};

// Verify callback/webhook data
const verifySignature = (data) => {
    try {
        const receivedHash = data.merchantHashedReq || data.hash;
        if (!receivedHash) return false;

        const hashString = [
            data.amount,
            data.postBackURL || '',
            data.expiryDate || '',
            data.orderRefNum,
            config.storeId
        ].join('&');

        const calculatedHash = generateHash(hashString);
        return calculatedHash === receivedHash;
    } catch (error) {
        logger.error('EasyPaisa signature verification failed:', error.message);
        return false;
    }
};

// Handle callback from EasyPaisa
const handleCallback = async (data) => {
    try {
        const responseCode = data.responseCode || data.status;
        const orderId = data.orderRefNum;
        const status = responseCode === '0000' ? 'completed' : 'failed';

        logger.info('EasyPaisa callback received', {
            orderId,
            responseCode,
            status,
            amount: data.amount
        });

        return {
            success: true,
            status,
            orderId,
            amount: parseFloat(data.amount || '0'),
            responseCode,
            responseMessage: data.responseDesc || data.responseMessage,
            transactionId: data.transactionId || data.transId
        };
    } catch (error) {
        logger.error('EasyPaisa callback handling failed:', error.message);
        return { success: false, error: error.message };
    }
};

// Check payment status via API
const checkPaymentStatus = async (orderId) => {
    try {
        const hashString = [orderId, config.storeId, config.accountNum].join('&');
        const secureHash = generateHash(hashString);

        const response = await axios.post(config.confirmURL, {
            orderId: orderId,
            storeId: config.storeId,
            accountNum: config.accountNum,
            merchantHashedReq: secureHash
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const result = response.data;

        return {
            success: true,
            status: result.responseCode === '0000' ? 'completed' : 'pending',
            data: result
        };
    } catch (error) {
        logger.error('EasyPaisa status check failed:', error.message);
        return { success: false, error: error.message };
    }
};

module.exports = {
    createPaymentSession,
    verifySignature,
    handleCallback,
    checkPaymentStatus,
    getConfig: () => ({ ...config, hashKey: '***' })
};
