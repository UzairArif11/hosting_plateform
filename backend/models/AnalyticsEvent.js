const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true,
        expires: '365d' // Auto-delete after 1 year (can be adjustable per plan effectively by query filters, but hard TTL here for safety)
    },
    // Visitor ID (hashed, anonymous)
    visitorId: {
        type: String,
        required: true,
        index: true
    },
    // Page info
    path: {
        type: String,
        required: true
    },
    referrer: {
        type: String,
        default: ''
    },
    // User Agent parsed info
    browser: {
        type: String,
        default: 'Unknown'
    },
    os: {
        type: String,
        default: 'Unknown'
    },
    device: {
        type: String,
        enum: ['desktop', 'mobile', 'tablet', 'unknown'],
        default: 'unknown'
    },
    // Location
    country: {
        type: String,
        default: 'Unknown'
    },
    // Performance (Web Vitals) - Optional
    vitals: {
        lcp: Number, // Largest Contentful Paint
        fid: Number, // First Input Delay
        cls: Number  // Cumulative Layout Shift
    }
});

// Compound indexes for common aggregation queries
analyticsEventSchema.index({ projectId: 1, timestamp: -1 });
analyticsEventSchema.index({ projectId: 1, visitorId: 1, timestamp: 1 }); // For unique visitor calculation

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);
