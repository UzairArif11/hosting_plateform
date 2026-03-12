const mongoose = require('mongoose');

const manualPaymentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Plan being purchased
    plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
        required: true
    },
    planName: {
        type: String,
        required: true
    },

    // Amount
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'PKR',
        enum: ['PKR', 'USD', 'EUR', 'GBP', 'USDT', 'USDC', 'BTC', 'ETH', 'CRYPTO']
    },

    // Payment type
    paymentType: {
        type: String,
        enum: ['bank', 'crypto'],
        default: 'bank'
    },

    // Which bank account user sent money to (for bank transfers)
    bankAccount: {
        bankName: { type: String },
        accountTitle: { type: String },
        accountNumber: { type: String },
        iban: { type: String }
    },

    // Crypto wallet details (for crypto payments)
    cryptoWallet: {
        coinName: { type: String },
        network: { type: String },
        walletAddress: { type: String }
    },

    // User's sender info
    senderName: {
        type: String,
        required: true
    },
    senderAccount: {
        type: String
    },
    transactionId: {
        type: String
    },

    // Screenshot proof
    screenshot: {
        type: String, // file path or URL
        required: true
    },

    // Status
    status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
        index: true
    },

    // Admin verification
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    verifiedAt: {
        type: Date
    },
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    rejectedAt: {
        type: Date
    },
    adminNotes: {
        type: String
    },

    // Email notification sent
    notificationSent: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
manualPaymentSchema.index({ status: 1, createdAt: -1 });
manualPaymentSchema.index({ user: 1, createdAt: -1 });

// Static: get pending payments for admin
manualPaymentSchema.statics.getPendingPayments = async function ({ page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
        this.find({ status: 'pending' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('user', 'username email displayName avatar')
            .populate('plan', 'displayName name')
            .lean(),
        this.countDocuments({ status: 'pending' })
    ]);

    return { payments, total, page, limit, totalPages: Math.ceil(total / limit) };
};

// Static: get all payments for admin (with status filter)
manualPaymentSchema.statics.getAllPayments = async function ({ status, page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    const query = status && status !== 'all' ? { status } : {};

    const [payments, total] = await Promise.all([
        this.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('user', 'username email displayName avatar')
            .populate('plan', 'displayName name')
            .lean(),
        this.countDocuments(query)
    ]);

    return { payments, total, page, limit, totalPages: Math.ceil(total / limit) };
};

// Static: get user's manual payments
manualPaymentSchema.statics.getUserPayments = async function (userId, { page = 1, limit = 20 } = {}) {
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

// Instance: verify payment
manualPaymentSchema.methods.verify = async function (adminId, notes) {
    this.status = 'verified';
    this.verifiedBy = adminId;
    this.verifiedAt = new Date();
    this.adminNotes = notes || '';
    return this.save();
};

// Instance: reject payment
manualPaymentSchema.methods.reject = async function (adminId, reason) {
    this.status = 'rejected';
    this.rejectedBy = adminId;
    this.rejectedAt = new Date();
    this.adminNotes = reason || 'Payment rejected';
    return this.save();
};

module.exports = mongoose.model('ManualPayment', manualPaymentSchema);
