const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Payment provider info
    payoneerPaymentId: {
        type: String,
        index: true
    },
    payoneerSessionId: {
        type: String
    },

    // Amount & currency
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        required: true,
        default: 'USD',
        enum: ['USD', 'PKR', 'EUR', 'GBP', 'USDT', 'USDC', 'BTC', 'ETH', 'CRYPTO']
    },

    // Status
    status: {
        type: String,
        required: true,
        enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
        default: 'pending',
        index: true
    },

    // What the payment is for
    type: {
        type: String,
        required: true,
        enum: ['subscription', 'upgrade', 'renewal', 'one_time'],
        default: 'subscription'
    },

    // Plan info
    plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan'
    },
    planName: {
        type: String
    },
    billingCycle: {
        type: String,
        enum: ['monthly', 'yearly'],
        default: 'monthly'
    },

    // Description
    description: {
        type: String
    },

    // Payment method used
    paymentMethod: {
        type: String,
        default: 'card'
    },

    // Failure info (if failed)
    failureReason: {
        type: String
    },

    // Refund info
    refundedAt: {
        type: Date
    },
    refundAmount: {
        type: Number
    },
    refundReason: {
        type: String
    },

    // Invoice
    invoiceNumber: {
        type: String,
        unique: true,
        sparse: true
    },

    // Payoneer metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Timestamps
    completedAt: {
        type: Date
    },
    failedAt: {
        type: Date
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ invoiceNumber: 1 });

// Virtual: formatted amount
paymentSchema.virtual('formattedAmount').get(function () {
    const symbols = { USD: '$', PKR: '₨', EUR: '€', GBP: '£' };
    const symbol = symbols[this.currency] || '$';
    return `${symbol}${this.amount.toFixed(2)}`;
});

// Pre-save: auto-generate invoice number
paymentSchema.pre('save', async function (next) {
    if (!this.invoiceNumber && this.status === 'completed') {
        const year = new Date().getFullYear();
        const count = await this.constructor.countDocuments({
            status: 'completed',
            createdAt: { $gte: new Date(year, 0, 1) }
        });
        this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;
    }
    next();
});

// Static: find user payments with pagination
paymentSchema.statics.findUserPayments = async function (userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
        this.find({ user: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('plan', 'displayName name')
            .lean(),
        this.countDocuments({ user: userId })
    ]);

    return { payments, total, page, limit, totalPages: Math.ceil(total / limit) };
};

// Static: find user invoices (completed payments only)
paymentSchema.statics.findUserInvoices = async function (userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
        this.find({ user: userId, status: 'completed' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('plan', 'displayName name')
            .lean(),
        this.countDocuments({ user: userId, status: 'completed' })
    ]);

    return { invoices, total, page, limit, totalPages: Math.ceil(total / limit) };
};

// Static: create payment from Payoneer session
paymentSchema.statics.createFromSession = async function (sessionData) {
    return this.create({
        user: sessionData.userId,
        payoneerSessionId: sessionData.sessionId,
        amount: sessionData.amount,
        currency: sessionData.currency,
        status: 'pending',
        type: sessionData.type || 'subscription',
        plan: sessionData.planId,
        planName: sessionData.planName,
        billingCycle: sessionData.billingCycle || 'monthly',
        description: sessionData.description,
        metadata: sessionData.metadata || {}
    });
};

// Static: mark payment as completed
paymentSchema.statics.markCompleted = async function (payoneerPaymentId, paymentData = {}) {
    const payment = await this.findOne({
        $or: [
            { payoneerPaymentId },
            { payoneerSessionId: paymentData.sessionId }
        ]
    });

    if (payment) {
        payment.status = 'completed';
        payment.payoneerPaymentId = payoneerPaymentId;
        payment.completedAt = new Date();
        payment.paymentMethod = paymentData.paymentMethod || 'card';
        if (paymentData.metadata) payment.metadata = { ...payment.metadata, ...paymentData.metadata };
        return payment.save();
    }

    // If no pending payment found, create a new completed one
    return this.create({
        user: paymentData.userId,
        payoneerPaymentId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        status: 'completed',
        type: 'subscription',
        plan: paymentData.planId,
        planName: paymentData.planName,
        description: paymentData.description,
        completedAt: new Date(),
        paymentMethod: paymentData.paymentMethod || 'card',
        metadata: paymentData.metadata || {}
    });
};

// Static: mark payment as failed
paymentSchema.statics.markFailed = async function (payoneerPaymentId, failureReason) {
    return this.findOneAndUpdate(
        { $or: [{ payoneerPaymentId }, { payoneerSessionId: payoneerPaymentId }] },
        {
            status: 'failed',
            failureReason,
            failedAt: new Date()
        },
        { new: true }
    );
};

module.exports = mongoose.model('Payment', paymentSchema);
