const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    key: {
        type: String,
        required: true,
        unique: true  // EC2, EC3, EC4, etc.
    },
    host: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['api_main', 'mixed_users', 'dedicated_only'],
        default: 'mixed_users'
    },
    enabled: {
        type: Boolean,
        default: true
    },
    totalCPU: {
        type: Number,
        default: 4
    },
    totalRAM: {
        type: Number,  // in GB
        default: 24
    },
    maxContainers: {
        type: Number,
        default: 200
    },
    sharedPool: {
        maxUsers: { type: Number, default: 150 },
        cpuLimit: { type: Number, default: 2 },
        ramLimit: { type: Number, default: 12 }
    },
    dedicatedPool: {
        maxUsers: { type: Number, default: 50 },
        cpuLimit: { type: Number, default: 2 },
        ramLimit: { type: Number, default: 12 }
    },
    sshKey: {
        type: String  // Path to SSH key or env variable name
    },
    sshPassword: {
        type: String  // Encrypted password
    },
    region: {
        type: String  // e.g., 'us-east', 'eu-west'
    },
    priority: {
        type: Number,
        default: 10  // Lower number = higher priority
    },
    healthStatus: {
        type: String,
        enum: ['healthy', 'degraded', 'down'],
        default: 'healthy'
    },
    lastHealthCheck: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

serverSchema.index({ enabled: 1, healthStatus: 1, priority: 1 });

module.exports = mongoose.model('Server', serverSchema);
