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
            default: 'ec3.foodpanda.site'
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

    // Server Registration Control (Admin toggle per server)
    serverConfig: {
        EC2: {
            acceptNewUsers: { type: Boolean, default: true },
            notes: { type: String, default: '' }
        },
        EC3: {
            acceptNewUsers: { type: Boolean, default: true },
            notes: { type: String, default: '' }
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

    deploymentLimits: {
        maxPerUser: {
            type: Number,
            default: 10
        },
        maxBuildTime: {
            type: Number,
            default: 900000 // 15 minutes in ms
        }
    },

    // Resource Limits (Admin Configurable)
    resourceLimits: {
        warnThreshold: { type: Number, default: 80 }, // % Usage for Warning
        stopThreshold: { type: Number, default: 90 },  // % Usage for Stopping
        signupCapacityLimit: { type: Number, default: 200 } // % of allocated resources before signups are blocked (user-based, not htop)
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

    // Alert Configuration
    alertConfig: {
        email: {
            type: String,
            default: ''
        },
        password: {
            type: String, // SMTP password or App Password
            default: ''
        },
        enabled: {
            type: Boolean,
            default: false
        }
    },

    // Payment Methods Configuration (Admin toggles)
    paymentConfig: {
        // Paddle (Merchant of Record — card/PayPal)
        paddle: {
            enabled: { type: Boolean, default: false },
            testMode: { type: Boolean, default: true }, // true=sandbox, false=live

            // Sandbox credentials
            sandboxSellerId: { type: String, default: '' },
            sandboxApiKey: { type: String, default: '' },         // pdl_sdbx_...
            sandboxClientToken: { type: String, default: '' },    // test_...
            sandboxWebhookSecret: { type: String, default: '' },  // pdl_ntfset_...

            // Live credentials
            liveSellerId: { type: String, default: '' },
            liveApiKey: { type: String, default: '' },            // pdl_live_...
            liveClientToken: { type: String, default: '' },       // live_...
            liveWebhookSecret: { type: String, default: '' },     // pdl_ntfset_...

            // Fee settings
            processingFeePercent: { type: Number, default: 5 },   // passed to customer
            cryptoDiscountPercent: { type: Number, default: 3 }    // discount for crypto payments
        },
        btcpay: {
            enabled: { type: Boolean, default: false },
            serverUrl: { type: String, default: '' },       // e.g. https://pay.yourdomain.com
            apiKey: { type: String, default: '' },
            storeId: { type: String, default: '' },
            webhookSecret: { type: String, default: '' },
            testMode: { type: Boolean, default: true }      // true = testnet, false = mainnet
        },
        jazzcashEasypaisa: {
            enabled: { type: Boolean, default: false }
        },
        // Manual payment methods (admin verifies)
        manualBank: {
            enabled: { type: Boolean, default: false },
            accounts: [{
                bankName: { type: String, required: true },
                accountTitle: { type: String, required: true },
                accountNumber: { type: String, required: true },
                iban: { type: String, default: '' },
                currency: { type: String, default: 'PKR' },
                isActive: { type: Boolean, default: true }
            }]
        },
        crypto: {
            enabled: { type: Boolean, default: false },
            wallets: [{
                coinName: { type: String, required: true },   // e.g. USDT, USDC, BTC
                network: { type: String, required: true },    // e.g. TRC20, ERC20, BEP20
                walletAddress: { type: String, required: true },
                isActive: { type: Boolean, default: true }
            }]
        }
    },

    // Account Deletion Settings (admin-configurable)
    accountDeletion: {
        enabled: { type: Boolean, default: false },        // false = never auto-delete suspended accounts
        daysAfterSuspension: { type: Number, default: 30 }, // days after suspension before deletion
        warningEmailDays: { type: Number, default: 10 }     // start warnings X days before scheduled deletion
    },

    // Currency Configuration
    currencyConfig: {
        displayCurrency: {
            type: String,
            enum: ['usd', 'pkr', 'eur', 'gbp'],
            default: 'usd'
        },
        exchangeRates: {
            usdToPkr: { type: Number, default: 278 },
            usdToEur: { type: Number, default: 0.92 },
            usdToGbp: { type: Number, default: 0.79 }
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
        // Create blank defaults. Per-server domains are stored on the Server
        // model and managed entirely from the Admin Panel — never seeded here.
        settings = await this.create({
            baseDomain: process.env.BASE_DOMAIN || '',
            serverDomains: {},
            sslEmail: process.env.SSL_EMAIL || '',
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

/**
 * Get the live domain for a server key.
 * Resolution order:
 *   1. Server model (admin-managed, source of truth)
 *   2. legacy Settings.serverDomains map (backward compat)
 *   3. baseDomain
 */
settingsSchema.statics.getDomainForServer = async function (serverKey) {
    if (!serverKey) return '';
    const key = String(serverKey).toUpperCase();

    try {
        const Server = mongoose.model('Server');
        const srv = await Server.findOne({ key }).lean();
        if (srv?.domain) return srv.domain;
    } catch (_) { /* model may not be registered yet */ }

    const settings = await this.getSettings();
    if (settings.serverDomains && settings.serverDomains[key]) {
        return settings.serverDomains[key];
    }
    return settings.baseDomain || '';
};

module.exports = mongoose.model('Settings', settingsSchema);
