const mongoose = require('mongoose');
const crypto = require('crypto');

const invitationSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    inviterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    role: {
        type: String,
        enum: ['admin', 'developer', 'viewer'],
        default: 'viewer',
        required: true
    },
    token: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'expired', 'cancelled'],
        default: 'pending'
    },
    expiresAt: {
        type: Date,
        required: true
    },
    acceptedAt: {
        type: Date
    },
    acceptedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Compound indexes
invitationSchema.index({ projectId: 1, email: 1 });
invitationSchema.index({ projectId: 1, status: 1 });
invitationSchema.index({ token: 1, status: 1 });

// Auto-expire invitations
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Generate unique token before save
invitationSchema.pre('save', function (next) {
    if (this.isNew && !this.token) {
        this.token = crypto.randomBytes(32).toString('hex');
    }
    next();
});

// Static method to generate token
invitationSchema.statics.generateToken = function () {
    return crypto.randomBytes(32).toString('hex');
};

// Instance method to check if expired
invitationSchema.methods.isExpired = function () {
    return new Date() > this.expiresAt;
};

// Instance method to accept invitation
invitationSchema.methods.accept = async function (userId) {
    if (this.isExpired()) {
        this.status = 'expired';
        await this.save();
        throw new Error('Invitation has expired');
    }

    if (this.status !== 'pending') {
        throw new Error('Invitation is not pending');
    }

    this.status = 'accepted';
    this.acceptedAt = new Date();
    this.acceptedBy = userId;

    return this.save();
};

module.exports = mongoose.model('Invitation', invitationSchema);
