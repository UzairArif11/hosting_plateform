const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    action: {
        type: String,
        required: true,
        enum: [
            // Auth actions
            'login', 'logout', 'register', 'password_change',
            // Project actions
            'project_create', 'project_update', 'project_delete',
            // Deployment actions
            'deployment_create', 'deployment_rollback',
            // Settings actions
            'settings_update', 'domain_add', 'domain_verify', 'domain_remove',
            // Team actions
            'member_invite', 'member_remove', 'member_role_change',
            // Admin actions
            'plan_change', 'user_suspend', 'user_delete',
            // Other
            'api_key_create', 'api_key_revoke'
        ]
    },
    resourceType: {
        type: String,
        enum: ['user', 'project', 'deployment', 'domain', 'invitation', 'plan', 'apiKey', 'system'],
        required: true
    },
    resourceId: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    resourceName: {
        type: String,
        default: ''
    },
    ip: {
        type: String,
        default: 'unknown'
    },
    userAgent: {
        type: String,
        default: ''
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    status: {
        type: String,
        enum: ['success', 'failure'],
        default: 'success'
    },
    errorMessage: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ createdAt: -1 });

// TTL index - automatically delete logs older than 90 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
