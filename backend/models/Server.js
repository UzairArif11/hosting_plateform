const mongoose = require('mongoose');

/**
 * Server model — canonical source of truth for all worker nodes.
 * Replaces the static ORACLE_SERVERS constant in containerOrchestrator.js.
 * Admins manage servers 100% through the Admin Panel; no .env restart needed.
 */
const serverSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,  // EC1, EC2, EC3, EC4 …
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
        // No unique constraint — admins are free to rename without conflicts.
        // The `key` field is the unique identifier.
    },
    host: {
        type: String,
        required: true  // IP address
    },
    domain: {
        type: String,
        default: ''     // e.g. ec2.foodpanda.site
    },
    type: {
        type: String,
        enum: ['api_main', 'mixed_users', 'dedicated_only'],
        default: 'mixed_users'
    },
    description: {
        type: String,
        default: ''
    },

    // Operational flags
    isActive: {
        type: Boolean,
        default: true
    },
    enabled: {
        type: Boolean,
        default: true
    },
    acceptNewUsers: {
        type: Boolean,
        default: true
    },
    notes: {
        type: String,
        default: ''
    },

    // SSH access
    sshKey: {
        type: String,   // path to private key file, e.g. /home/ubuntu/.ssh/id_rsa
        default: ''
    },
    sshKeyEnvVar: {
        type: String,   // name of the env var that holds the path, e.g. SSH_EC2_KEY
        default: ''
    },

    // Resources
    totalCPU: {
        type: Number,
        default: 4
    },
    totalRAM: {
        type: Number,   // GB
        default: 24
    },
    maxContainers: {
        type: Number,
        default: 200
    },

    // Pool configuration
    sharedPool: {
        maxUsers:  { type: Number, default: 150 },
        cpuLimit:  { type: Number, default: 2 },
        ramLimit:  { type: Number, default: 12 }
    },
    dedicatedPool: {
        maxUsers:  { type: Number, default: 50 },
        cpuLimit:  { type: Number, default: 2 },
        ramLimit:  { type: Number, default: 12 }
    },

    // Metadata
    region: { type: String, default: '' },
    priority: { type: Number, default: 10 },  // lower = preferred
    healthStatus: {
        type: String,
        enum: ['healthy', 'degraded', 'down'],
        default: 'healthy'
    },
    lastHealthCheck: { type: Date }
}, {
    timestamps: true
});

serverSchema.index({ isActive: 1, priority: 1 });

/**
 * Return all active servers as a key→object map (same shape as ORACLE_SERVERS).
 */
serverSchema.statics.getServersMap = async function () {
    const servers = await this.find({}).lean();
    const map = {};
    for (const s of servers) {
        map[s.key] = {
            name:          s.name,
            host:          s.host,
            domain:        s.domain || '',
            type:          s.type,
            description:   s.description || '',
            isActive:      s.isActive,
            enabled:       s.enabled,
            acceptNewUsers: s.acceptNewUsers,
            notes:         s.notes || '',
            sshKey:        s.sshKey || '',
            sshKeyEnvVar:  s.sshKeyEnvVar || '',
            totalCPU:      s.totalCPU,
            totalRAM:      s.totalRAM,
            maxContainers: s.maxContainers,
            sharedPool:    s.sharedPool,
            dedicatedPool: s.dedicatedPool,
            region:        s.region || '',
            priority:      s.priority
        };
    }
    return map;
};

module.exports = mongoose.model('Server', serverSchema);
