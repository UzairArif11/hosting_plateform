const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    // Domain Configuration
    baseDomain: {
        type: String,
        default: 'foodpanda.site',
        required: true
    },

    // Server-specific domains (subdomains)
    serverDomains: {
        EC2: {
            type: String,
            default: 'ec2.foodpanda.site'
        },
        EC3: {
            type: String,
            default: 'foodpanda.site'
        },
        EC4: {
            type: String,
            default: 'ec4.foodpanda.site'
        },
        EC5: {
            type: String,
            default: 'ec5.foodpanda.site'
        }
    },

    // SSL Configuration
    sslEmail: {
        type: String,
        default: 'admin@foodpanda.site'
    },

    // Protocol (http or https)
    protocol: {
        type: String,
        enum: ['http', 'https'],
        default: 'https'
    },

    // Deployment Settings
    maxDeploymentsPerUser: {
        type: Number,
        default: 10
    },

    maxBuildTime: {
        type: Number,
        default: 900000 // 15 minutes in ms
    },

    // Feature Flags
    features: {
        autoSSL: {
            type: Boolean,
            default: true
        },
        customDomains: {
            type: Boolean,
            default: false
        },
        analytics: {
            type: Boolean,
            default: true
        }
    },

    // IP-based Container/Resource Restrictions
    ipRestrictions: {
        enabled: {
            type: Boolean,
            default: true,
            description: 'Enable IP-based container creation limits'
        },
        maxFreeAccountsPerIP: {
            type: Number,
            default: 3,
            min: 1,
            max: 10,
            description: 'Maximum number of free containers/projects allowed per IP address'
        },
        blockDeletedEmailReuse: {
            type: Boolean,
            default: true,
            description: 'Prevent deleted email addresses from being reused for account creation'
        },
        exemptPaidAccounts: {
            type: Boolean,
            default: true,
            description: 'Paid accounts can create unlimited containers (not counted towards IP limit)'
        }
    },

    // Metadata
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Singleton pattern - only one settings document
settingsSchema.statics.getSettings = async function () {
    let settings = await this.findOne();

    if (!settings) {
        // Create default settings if none exist
        settings = await this.create({
            baseDomain: process.env.BASE_DOMAIN || 'foodpanda.site',
            serverDomains: {
                EC2: process.env.EC2_DOMAIN || 'ec2.foodpanda.site',
                EC3: process.env.EC3_DOMAIN || 'foodpanda.site',
                EC4: process.env.EC4_DOMAIN || 'ec4.foodpanda.site',
                EC5: process.env.EC5_DOMAIN || 'ec5.foodpanda.site'
            },
            sslEmail: process.env.SSL_EMAIL || 'admin@foodpanda.site',
            protocol: process.env.PROTOCOL || 'https'
        });
    }

    return settings;
};

// Update settings
settingsSchema.statics.updateSettings = async function (updates, userId) {
    let settings = await this.getSettings();

    Object.assign(settings, updates);
    settings.updatedBy = userId;
    settings.updatedAt = new Date();

    await settings.save();
    return settings;
};

// Get domain for specific server
settingsSchema.statics.getDomainForServer = async function (serverKey) {
    const settings = await this.getSettings();
    return settings.serverDomains[serverKey] || settings.baseDomain;
};

module.exports = mongoose.model('Settings', settingsSchema);
