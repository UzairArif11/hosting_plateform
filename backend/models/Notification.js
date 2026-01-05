const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['info', 'warning', 'error', 'success'],
        default: 'info'
    },
    resourceType: {
        type: String,
        enum: ['cpu', 'ram', 'storage', 'bandwidth', 'system'],
        default: 'system'
    },
    read: {
        type: Boolean,
        default: false
    },
    metadata: {
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
        deploymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deployment' },
        value: Number,
        limit: Number
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 60 * 60 * 24 * 30 // Auto-delete after 30 days
    }
});

// Index for fetching user's unread notifications
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
