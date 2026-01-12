const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // OAuth data (GitHub or Google)
  githubId: {
    type: String,
    sparse: true, // Allow null values, but enforce uniqueness when present
    unique: true
  },
  googleId: {
    type: String,
    sparse: true, // Allow null values, but enforce uniqueness when present
    unique: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: ''
  },

  // IP Tracking for account restrictions
  signupIP: {
    type: String,
    index: true,
    description: 'IP address used during signup'
  },
  lastLoginIP: {
    type: String,
    description: 'IP address of last login'
  },
  ipHistory: [{
    ip: String,
    timestamp: { type: Date, default: Date.now },
    action: { type: String, enum: ['signup', 'login'] }
  }],
  profileUrl: {
    type: String,
    default: ''
  },

  // OAuth tokens and provider
  githubAccessToken: {
    type: String,
    default: null
  },
  provider: {
    type: String,
    enum: ['github', 'google', 'local'],
    default: 'local'
  },

  // User role and status
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'banned', 'trial'],
    default: 'trial'
  },
  isProtected: {
    type: Boolean,
    default: false
  },

  // Billing and subscription
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    default: null
  },
  planType: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free',
    index: true
  },
  trialStarted: {
    type: Date,
    default: Date.now
  },
  trialExpiry: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  },
  isTrialActive: {
    type: Boolean,
    default: true
  },
  subscriptionStatus: {
    type: String,
    enum: ['trial', 'active', 'cancelled', 'expired', 'past_due'],
    default: 'trial'
  },

  // Payoneer payment info
  payoneerCustomerId: {
    type: String,
    default: null
  },
  paymentMethods: [{
    type: {
      type: String,
      enum: ['card', 'payoneer_wallet']
    },
    last4: String,
    brand: String,
    isDefault: {
      type: Boolean,
      default: false
    },
    payoneerPaymentMethodId: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Current usage and limits
  currentUsage: {
    projects: {
      type: Number,
      default: 0
    },
    deployments: {
      type: Number,
      default: 0
    },
    storage: {
      type: Number,
      default: 0 // in MB
    },
    bandwidth: {
      type: Number,
      default: 0 // in MB this month
    }
  },

  // Resource allocation (can be overridden by admin)
  resourceAllocation: {
    projects: {
      type: Number,
      default: 10 // Free users can create up to 10 projects
    },
    deployments: {
      type: Number,
      default: 100 // Deployments per month
    },
    cpu: {
      type: Number,
      default: 0.5 // OCPU
    },
    ram: {
      type: Number,
      default: 1 // GB
    },
    storage: {
      type: Number,
      default: 10 // GB
    },
    bandwidth: {
      type: Number,
      default: 1024 // GB/month
    },
    containers: {
      type: Number,
      default: 1
    },
    maxCpu: { type: Number, default: 0.2 },      // 10% cap for shared containers
    maxRam: { type: Number, default: 1.2 },      // 10% cap in GB 
    guaranteedCpu: { type: Number, default: 0.01 }, // Minimum guaranteed
    guaranteedRam: { type: Number, default: 0.08 }  // Minimum guaranteed in GB
  },

  // Real-time resource usage tracking
  currentResourceUsage: {
    cpu: { type: Number, default: 0 },           // Current CPU usage
    ram: { type: Number, default: 0 },           // Current RAM usage (MB)
    cpuPercent: { type: Number, default: 0 },    // CPU usage percentage
    ramPercent: { type: Number, default: 0 },    // RAM usage percentage
    lastChecked: { type: Date, default: Date.now }
  },

  // Storage violation tracking
  storageViolations: [{
    timestamp: { type: Date, default: Date.now },
    storageUsed: { type: Number }, // MB
    limit: { type: Number }, // MB
    action: { type: String, enum: ['stopped', 'warned'], default: 'stopped' }
  }],
  deploymentBlocked: {
    type: Boolean,
    default: false
  },
  deploymentBlockedReason: {
    type: String,
    default: ''
  },
  deploymentBlockedAt: {
    type: Date
  },

  // Admin controlled visibility settings
  showResourceStats: {
    type: Boolean,
    default: false
  },

  // What user SEES in UI
  displayedResources: {
    cpu: { type: Number },
    ram: { type: Number },
    storage: { type: Number },
    bandwidth: { type: Number },
    projects: { type: Number }
  },

  // What backend ACTUALLY enforces
  allocatedResources: {
    cpu: { type: Number },
    ram: { type: Number },
    storage: { type: Number },
    bandwidth: { type: Number },
    projects: { type: Number }
  },

  // Admin override for this specific user (highest priority)
  adminOverride: {
    enabled: { type: Boolean, default: false },
    reason: { type: String, default: '' },
    customCPU: { type: Number },
    customRAM: { type: Number },
    customStorage: { type: Number },
    customBandwidth: { type: Number },
    expiresAt: { type: Date },
    setBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    setAt: { type: Date }
  },

  // Active containers tracking
  containers: [{
    id: String,
    name: String,
    type: { type: String, enum: ['shared', 'dedicated', 'free'] },
    server: String,
    port: Number,
    resources: {
      cpu: Number,
      ram: Number
    },
    projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }],

  // Oracle Cloud server allocation (Load Balanced EC2/EC3 architecture)
  oracleAccountId: {
    type: String,
    enum: ['EC1', 'EC2', 'EC3', null],
    default: null, // EC1: API only, EC2/EC3: Mixed servers with load balancing
    description: 'Server assignment in load-balanced architecture'
  },
  containerType: {
    type: String,
    enum: ['shared', 'dedicated', 'free', null],
    default: null, // shared: Free users, dedicated: Paid users, free: Small dedicated containers
    description: 'Container allocation type (shared vs dedicated vs free)'
  },
  containerId: {
    type: String,
    default: null,
    description: 'Docker container ID for user\'s main container'
  },
  containerName: {
    type: String,
    default: null,
    description: 'Docker container name for user\'s main container'
  },
  assignedServer: {
    type: String,
    enum: ['EC2', 'EC3', null],
    default: null
  },
  assignedPort: {
    type: Number,
    default: null
  },
  serverAssignmentHistory: [{
    server: {
      type: String,
      enum: ['EC2', 'EC3']
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String,
      enum: ['initial_registration', 'paid_upgrade', 'admin_migration', 'downgrade']
    },
    planAtTime: {
      type: String
    }
  }],

  // User preferences
  preferences: {
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      deployments: {
        type: Boolean,
        default: true
      },
      billing: {
        type: Boolean,
        default: true
      }
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },

  // Security and access
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginCount: {
    type: Number,
    default: 1
  },
  apiKeys: [{
    name: String,
    key: String,
    lastUsed: Date,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Admin notes (only visible to admins)
  adminNotes: {
    type: String,
    default: ''
  },

  // Suspension tracking
  suspendedAt: {
    type: Date,
    default: null
  },
  suspendedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  suspensionReason: {
    type: String,
    default: ''
  },
  unsuspendedAt: {
    type: Date,
    default: null
  },
  unsuspendedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Lifecycle tracking
  autoSuspended: {
    type: Boolean,
    default: false
  },
  resourcesDeleted: {
    type: Boolean,
    default: false
  },
  resourcesDeletedAt: {
    type: Date,
    default: null
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  deletionReason: {
    type: String,
    default: ''
  },
  recoveryDeadline: {
    type: Date,
    default: null
  },
  recoveredAt: {
    type: Date,
    default: null
  },
  recoveredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  subscriptionExpiry: {
    type: Date,
    default: null
  },

}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      delete ret.apiKeys; // Never send API keys in JSON
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for performance (unique indexes already defined in schema)
userSchema.index({ status: 1 });
userSchema.index({ subscriptionStatus: 1 });
userSchema.index({ trialExpiry: 1 });
userSchema.index({ oracleAccountId: 1 });

// Virtual for trial days remaining
userSchema.virtual('trialDaysRemaining').get(function () {
  if (!this.isTrialActive || this.subscriptionStatus !== 'trial') {
    return 0;
  }
  const now = new Date();
  const expiry = new Date(this.trialExpiry);
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Virtual for resource usage percentage
userSchema.virtual('resourceUsagePercentage').get(function () {
  return {
    storage: Math.round((this.currentUsage.storage / (this.resourceAllocation.storage * 1024)) * 100),
    bandwidth: Math.round((this.currentUsage.bandwidth / (this.resourceAllocation.bandwidth * 1024)) * 100)
  };
});

// Pre-save middleware to check trial expiry
userSchema.pre('save', function (next) {
  if (this.isTrialActive && new Date() > this.trialExpiry) {
    this.isTrialActive = false;
    if (this.subscriptionStatus === 'trial') {
      this.subscriptionStatus = 'expired';
      this.status = 'suspended';
    }
  }
  next();
});

// Instance methods
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.apiKeys; // Never expose API keys
  return user;
};

userSchema.methods.generateApiKey = function () {
  const crypto = require('crypto');
  const key = crypto.randomBytes(32).toString('hex');
  return `vcp_${key}`; // Vercel Clone Platform prefix
};

userSchema.methods.hasResourceCapacity = function (resourceType, amount) {
  const current = this.currentUsage[resourceType] || 0;
  const limit = this.resourceAllocation[resourceType] || 0;

  if (resourceType === 'storage') {
    return (current + amount) <= (limit * 1024); // Convert GB to MB
  } else if (resourceType === 'bandwidth') {
    return (current + amount) <= (limit * 1024); // Convert GB to MB
  }

  return (current + amount) <= limit;
};

// Static methods
userSchema.statics.findByGithubId = function (githubId) {
  return this.findOne({ githubId });
};

userSchema.statics.findActiveUsers = function () {
  return this.find({
    status: { $in: ['active', 'trial'] },
    subscriptionStatus: { $in: ['trial', 'active'] }
  });
};

userSchema.statics.findExpiredTrials = function () {
  return this.find({
    isTrialActive: false,
    subscriptionStatus: 'trial',
    trialExpiry: { $lt: new Date() }
  });
};

module.exports = mongoose.model('User', userSchema);
