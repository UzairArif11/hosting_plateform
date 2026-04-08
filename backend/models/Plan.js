const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },

  // Pricing in different currencies
  pricing: {
    usd: {
      type: Number,
      required: true
    },
    pkr: {
      type: Number,
      required: true
    },
    eur: {
      type: Number,
      default: 0
    },
    gbp: {
      type: Number,
      default: 0
    }
  },

  // Resource allocations
  resources: {
    cpu: {
      type: Number,
      required: true, // OCPU allocation
      default: 1
    },
    ram: {
      type: Number,
      required: true, // GB allocation
      default: 4
    },
    storage: {
      type: Number,
      required: true, // GB allocation
      default: 50
    },
    bandwidth: {
      type: Number,
      required: true, // GB/month allocation
      default: 1024
    },
    containers: {
      type: Number,
      required: true, // Max containers
      default: 1
    },
    projects: {
      type: Number,
      required: true, // Max projects
      default: 10
    }
  },

  // What users SEE in UI (can be different from actual)
  displayResources: {
    cpu: {
      type: Number,
      default: function () { return this.resources?.cpu || 1; }
    },
    ram: {
      type: Number,
      default: function () { return this.resources?.ram || 4; }
    },
    storage: {
      type: Number,
      default: function () { return this.resources?.storage || 50; }
    },
    bandwidth: {
      type: Number,
      default: function () { return this.resources?.bandwidth || 1024; }
    },
    projects: {
      type: Number,
      default: function () { return this.resources?.projects || 10; }
    }
  },

  // What backend ACTUALLY enforces (can be less than display)
  actualResources: {
    cpu: {
      type: Number,
      default: function () { return this.resources?.cpu || 1; }
    },
    ram: {
      type: Number,
      default: function () { return this.resources?.ram || 4; }
    },
    storage: {
      type: Number,
      default: function () { return this.resources?.storage || 50; }
    },
    bandwidth: {
      type: Number,
      default: function () { return this.resources?.bandwidth || 1024; }
    },
    projects: {
      type: Number,
      default: function () { return this.resources?.projects || 10; }
    }
  },

  // Admin override settings for this plan
  resourceOverride: {
    enabled: {
      type: Boolean,
      default: false
    },
    percentage: {
      type: Number,
      default: 100,
      min: 1,
      max: 200
    },
    reason: {
      type: String,
      default: ''
    },
    expiresAt: {
      type: Date,
      default: null
    },
    setBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    setAt: {
      type: Date,
      default: null
    }
  },

  // Features included in this plan
  // Features included in this plan
  features: [{
    name: {
      type: String,
      required: true
    },
    displayName: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      required: true
    },
    enabled: {
      type: Boolean,
      default: true
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],

  // Plan configuration
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isTrial: {
    type: Boolean,
    default: false
  },
  sortOrder: {
    type: Number,
    default: 0
  },

  // Oracle Cloud configuration
  oracleConfig: {
    accountType: {
      type: String,
      enum: ['shared', 'dedicated'],
      default: 'dedicated'
    },
    instanceShape: {
      type: String,
      default: 'VM.Standard.A1.Flex'
    },
    dedicatedAccount: {
      type: Boolean,
      default: false
    }
  },

  // Limits and restrictions
  limits: {
    deploymentsPerDay: {
      type: Number,
      default: 100
    },
    buildsPerDay: {
      type: Number,
      default: 100
    },
    domainsPerProject: {
      type: Number,
      default: 1
    },
    environmentVariables: {
      type: Number,
      default: 50
    },
    logRetentionDays: {
      type: Number,
      default: 30
    },
    maxLiveProjects: {
      type: Number,
      default: 10 // Max active (non-deleted) projects at once
    },
    concurrentDeployments: {
      type: Number,
      default: 2 // Max simultaneous builds at a time
    }
  },

  // Admin settings
  adminOnly: {
    type: Boolean,
    default: false // Only admins can assign this plan
  },
  customPlan: {
    type: Boolean,
    default: false // Custom plan created for specific user
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // If this is a custom plan for a specific user
  },

  // Paddle Price ID mapping (sandbox + live)
  paddlePriceIds: {
    sandbox: {
      monthly: { type: String, default: '' },
      quarterly: { type: String, default: '' },
      semiannual: { type: String, default: '' },
      annual: { type: String, default: '' }
    },
    live: {
      monthly: { type: String, default: '' },
      quarterly: { type: String, default: '' },
      semiannual: { type: String, default: '' },
      annual: { type: String, default: '' }
    }
  },

  // Pricing strategy
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly', 'one-time'],
    default: 'monthly'
  },
  // Multi-month billing periods with discounts
  billingPeriods: [{
    months: { type: Number, enum: [1, 3, 6, 12], required: true },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    gracePeriodDays: { type: Number, default: 10, min: 1, max: 90 },
    enabled: { type: Boolean, default: true }
  }],

  trialDays: {
    type: Number,
    default: 0
  },

  // Statistics
  userCount: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes (name already has unique index from schema)
planSchema.index({ isActive: 1 });
planSchema.index({ sortOrder: 1 });
planSchema.index({ 'pricing.usd': 1 });
planSchema.index({ userCount: -1 });

// Virtual for formatted pricing
planSchema.virtual('formattedPricing').get(function () {
  return {
    usd: `$${this.pricing.usd}/month`,
    pkr: `Rs ${this.pricing.pkr.toLocaleString()}/month`,
    eur: `€${this.pricing.eur}/month`,
    gbp: `£${this.pricing.gbp}/month`
  };
});

// Virtual for resource summary
planSchema.virtual('resourceSummary').get(function () {
  return `${this.resources.cpu} OCPU, ${this.resources.ram}GB RAM, ${this.resources.storage}GB Storage`;
});

// Static methods
planSchema.statics.findActivePlans = function () {
  return this.find({ isActive: true, adminOnly: false })
    .sort({ sortOrder: 1, 'pricing.usd': 1 });
};

planSchema.statics.findDefaultPlan = function () {
  return this.findOne({ isDefault: true, isActive: true });
};

planSchema.statics.findTrialPlan = function () {
  return this.findOne({ isTrial: true, isActive: true });
};

planSchema.statics.createDefaultPlans = async function () {
  try {
    const existingPlans = await this.countDocuments();
    if (existingPlans > 0) {
      return;
    }

    const defaultPlans = [
      {
        name: 'free-trial',
        displayName: 'Free Trial',
        description: '1-month free trial with shared resources',
        pricing: { usd: 0, pkr: 0, eur: 0, gbp: 0 },
        resources: {
          cpu: 0.5,
          ram: 1,
          storage: 10,
          bandwidth: 100,
          containers: 1,
          projects: 3
        },
        features: [
          { name: 'Shared Resources', description: 'Shared container pool', enabled: true },
          { name: 'Basic Support', description: 'Community support', enabled: true },
          { name: 'SSL Certificates', description: 'Free SSL for all domains', enabled: true }
        ],
        isDefault: true,
        isTrial: true,
        oracleConfig: {
          accountType: 'shared',
          dedicatedAccount: false
        },
        sortOrder: 0,
        trialDays: 30
      },
      {
        name: 'starter',
        displayName: 'Starter',
        description: 'Perfect for small projects and personal use',
        pricing: { usd: 9, pkr: 2500, eur: 8, gbp: 7 },
        resources: {
          cpu: 1,
          ram: 4,
          storage: 50,
          bandwidth: 1024,
          containers: 2,
          projects: 10
        },
        features: [
          { name: 'Dedicated Resources', description: 'Your own container allocation', enabled: true },
          { name: 'Email Support', description: '24/7 email support', enabled: true },
          { name: 'Custom Domains', description: 'Use your own domain names', enabled: true },
          { name: 'Environment Variables', description: 'Secure config management', enabled: true }
        ],
        oracleConfig: {
          accountType: 'dedicated',
          dedicatedAccount: false
        },
        sortOrder: 1
      },
      {
        name: 'growth',
        displayName: 'Growth',
        description: 'Ideal for growing applications and teams',
        pricing: { usd: 29, pkr: 8000, eur: 25, gbp: 22 },
        resources: {
          cpu: 2,
          ram: 12,
          storage: 100,
          bandwidth: 2048,
          containers: 5,
          projects: 25
        },
        features: [
          { name: 'Enhanced Performance', description: 'More CPU and RAM allocation', enabled: true },
          { name: 'Priority Support', description: 'Priority email and chat support', enabled: true },
          { name: 'Advanced Analytics', description: 'Detailed usage metrics', enabled: true },
          { name: 'Team Collaboration', description: 'Share projects with team members', enabled: true }
        ],
        oracleConfig: {
          accountType: 'dedicated',
          dedicatedAccount: false
        },
        sortOrder: 2
      },
      {
        name: 'pro',
        displayName: 'Pro',
        description: 'For production applications and businesses',
        pricing: { usd: 59, pkr: 16000, eur: 50, gbp: 45 },
        resources: {
          cpu: 3,
          ram: 20,
          storage: 200,
          bandwidth: 4096,
          containers: 10,
          projects: 50
        },
        features: [
          { name: 'High Performance', description: 'Optimized for production workloads', enabled: true },
          { name: 'Phone Support', description: '24/7 phone and priority support', enabled: true },
          { name: 'Advanced Security', description: 'Enhanced security features', enabled: true },
          { name: 'API Access', description: 'Full REST API access', enabled: true },
          { name: 'SLA Guarantee', description: '99.9% uptime guarantee', enabled: true }
        ],
        oracleConfig: {
          accountType: 'dedicated',
          dedicatedAccount: true
        },
        sortOrder: 3
      },
      {
        name: 'enterprise',
        displayName: 'Enterprise',
        description: 'Custom solutions for large organizations',
        pricing: { usd: 199, pkr: 55000, eur: 170, gbp: 150 },
        resources: {
          cpu: 4,
          ram: 24,
          storage: 500,
          bandwidth: 10240,
          containers: 20,
          projects: 100
        },
        features: [
          { name: 'Maximum Performance', description: 'Highest resource allocation', enabled: true },
          { name: 'Dedicated Support', description: 'Dedicated account manager', enabled: true },
          { name: 'Custom Integrations', description: 'Custom API integrations', enabled: true },
          { name: 'Advanced Monitoring', description: 'Real-time monitoring and alerts', enabled: true },
          { name: 'SLA Guarantee', description: '99.99% uptime guarantee', enabled: true }
        ],
        oracleConfig: {
          accountType: 'dedicated',
          dedicatedAccount: true
        },
        sortOrder: 4
      }
    ];

    await this.insertMany(defaultPlans);
    console.log('✅ Default plans created successfully');
  } catch (error) {
    console.error('❌ Error creating default plans:', error);
  }
};

// Instance methods
planSchema.methods.getPricingForCurrency = function (currency = 'usd') {
  return this.pricing[currency.toLowerCase()] || this.pricing.usd;
};

planSchema.methods.canUpgradeFrom = function (currentPlan) {
  if (!currentPlan) return true;
  return this.pricing.usd > currentPlan.pricing.usd;
};

planSchema.methods.canDowngradeFrom = function (currentPlan) {
  if (!currentPlan) return false;
  return this.pricing.usd < currentPlan.pricing.usd;
};

// Pre-save middleware
planSchema.pre('save', function (next) {
  // Ensure only one default plan
  if (this.isDefault && this.isModified('isDefault')) {
    this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    ).exec();
  }
  next();
});

module.exports = mongoose.model('Plan', planSchema);
