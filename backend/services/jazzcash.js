const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

// JazzCash Merchant API Configuration
const config = {
    merchantId: process.env.JAZZCASH_MERCHANT_ID || '',
    password: process.env.JAZZCASH_PASSWORD || '',
    integritySalt: process.env.JAZZCASH_INTEGRITY_SALT || '',
    returnUrl: process.env.JAZZCASH_RETURN_URL || '',
    baseURL: process.env.JAZZCASH_API_URL || 'https://sandbox.jazzcash.com.pk/ApplicationAPI/API/Payment/DoTransaction',
    environment: process.env.NODE_ENV || 'development'
};

// Generate hash for request integrity
const generateHash = (dataString) => {
    return crypto
        .createHmac('sha256', config.integritySalt)
        .update(dataString)
        .digest('hex');
};

// Format date for JazzCash (YYYYMMDDHHmmss)
const formatDate = (date = new Date()) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

// Format expiry date (add 1 hour from now)
const formatExpiry = () => {
    const expiry = new Date(Date.now() + 60 * 60 * 1000);
    return formatDate(expiry);
};

// Create payment session
const createPaymentSession = async (paymentData) => {
    try {
        const txnRefNo = `T${Date.now()}`;
        const txnDateTime = formatDate();
        const expiryDateTime = formatExpiry();
        const amount = Math.round(paymentData.amount * 100).toString(); // In paisa

        // Build sorted hash string
        const hashString = [
            config.integritySalt,
            amount,
            paymentData.billReference || `BILL-${txnRefNo}`,
            paymentData.description || 'Platform Subscription',
            'EN',
            expiryDateTime,
            config.merchantId,
            config.password,
            paymentData.returnUrl || config.returnUrl,
            'MWALLET', // Mobile wallet
            txnDateTime,
            txnRefNo,
            '01' // Version
        ].join('&');

        const secureHash = generateHash(hashString);

        const payload = {
            pp_Version: '1.1',
            pp_TxnType: 'MWALLET',
            pp_Language: 'EN',
            pp_MerchantID: config.merchantId,
            pp_Password: config.password,
            pp_TxnRefNo: txnRefNo,
            pp_Amount: amount,
            pp_TxnCurrency: 'PKR',
            pp_TxnDateTime: txnDateTime,
            pp_TxnExpiryDateTime: expiryDateTime,
            pp_BillReference: paymentData.billReference || `BILL-${txnRefNo}`,
            pp_Description: paymentData.description || 'Platform Subscription',
            pp_ReturnURL: paymentData.returnUrl || config.returnUrl,
            pp_SecureHash: secureHash,
            ppmpf_1: paymentData.mobileNumber || '',
            ppmpf_2: paymentData.userId || '',
            ppmpf_3: paymentData.planId || '',
            ppmpf_4: paymentData.planName || '',
            ppmpf_5: ''
        };

        const response = await axios.post(config.baseURL, payload, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const result = response.data;

        if (result.pp_ResponseCode === '000') {
            logger.info('JazzCash payment session created', {
                txnRefNo,
                amount: paymentData.amount,
                userId: paymentData.userId
            });

            return {
                success: true,
                sessionId: txnRefNo,
                checkoutUrl: result.pp_RedirectURL || null,
                responseCode: result.pp_ResponseCode,
                responseMessage: result.pp_ResponseMessage
            };
        } else {
            logger.error('JazzCash payment session failed', {
                responseCode: result.pp_ResponseCode,
                responseMessage: result.pp_ResponseMessage
            });

            return {
                success: false,
                error: result.pp_ResponseMessage || 'Payment session creation failed',
                responseCode: result.pp_ResponseCode
            };
        }
    } catch (error) {
        logger.error('JazzCash API error:', error.message);
        return {
            success: false,
            error: error.message || 'Failed to connect to JazzCash'
        };
    }
};

// Verify webhook/callback signature
const verifySignature = (data) => {
    try {
        const receivedHash = data.pp_SecureHash;
        if (!receivedHash) return false;

        // Rebuild hash from sorted fields
        const sortedKeys = Object.keys(data)
            .filter(k => k !== 'pp_SecureHash' && data[k] !== '')
            .sort();

        const hashString = config.integritySalt + '&' + sortedKeys.map(k => data[k]).join('&');
        const calculatedHash = generateHash(hashString);

        return calculatedHash === receivedHash;
    } catch (error) {
        logger.error('JazzCash signature verification failed:', error.message);
        return false;
    }
};

// Handle webhook/callback from JazzCash
const handleCallback = async (data) => {
    try {
        const responseCode = data.pp_ResponseCode;
        const txnRefNo = data.pp_TxnRefNo;
        const status = responseCode === '000' ? 'completed' : 'failed';

        logger.info('JazzCash callback received', {
            txnRefNo,
            responseCode,
            status,
            amount: data.pp_Amount
        });

        return {
            success: true,
            status,
            txnRefNo,
            amount: parseInt(data.pp_Amount || '0') / 100,
            responseCode,
            responseMessage: data.pp_ResponseMessage,
            metadata: {
                user_id: data.ppmpf_2,
                plan_id: data.ppmpf_3,
                plan_name: data.ppmpf_4
            }
        };
    } catch (error) {
        logger.error('JazzCash callback handling failed:', error.message);
        return { success: false, error: error.message };
    }
};

// Check payment status
const checkPaymentStatus = async (txnRefNo) => {
    try {
        const txnDateTime = formatDate();
        const hashString = [
            config.integritySalt,
            config.merchantId,
            config.password,
            txnRefNo,
            txnDateTime
        ].join('&');

        const secureHash = generateHash(hashString);

        const payload = {
            pp_Version: '1.1',
            pp_MerchantID: config.merchantId,
            pp_Password: config.password,
            pp_TxnRefNo: txnRefNo,
            pp_TxnDateTime: txnDateTime,
            pp_SecureHash: secureHash
        };

        const statusURL = config.baseURL.replace('DoTransaction', 'TransactionLookup');

        const response = await axios.post(statusURL, payload, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        return {
            success: true,
            status: response.data.pp_ResponseCode === '000' ? 'completed' : 'pending',
            data: response.data
        };
    } catch (error) {
        logger.error('JazzCash status check failed:', error.message);
        return { success: false, error: error.message };
    }
};

module.exports = {
    createPaymentSession,
    verifySignature,
    handleCallback,
    checkPaymentStatus,
    getConfig: () => ({ ...config, password: '***', integritySalt: '***' })
};
