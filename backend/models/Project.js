const mongoose = require('mongoose');
const crypto = require('crypto');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },

  // Repository information
  repository: {
    url: {
      type: String,
      required: true
    },
    fullName: {
      type: String,
      required: true // e.g. "username/repo-name"
    },
    branch: {
      type: String,
      default: 'main'
    },
    provider: {
      type: String,
      enum: ['github', 'gitlab'],
      default: 'github'
    },
    isPrivate: {
      type: Boolean,
      default: false
    }
  },

  // Owner and access
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborators: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['admin', 'developer', 'viewer'],
      default: 'viewer'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Framework and build configuration
  framework: {
    type: String,
    enum: [
      'nextjs', 'react', 'vue', 'nuxt', 'svelte', 'angular',
      'express', 'fastify', 'nestjs', 'koa',
      'static', 'gatsby', 'hugo', 'jekyll',
      'laravel', 'symfony', 'django', 'flask',
      'custom'
    ],
    required: true
  },
  buildConfig: {
    buildCommand: {
      type: String,
      default: ''
    },
    outputDirectory: {
      type: String,
      default: ''
    },
    installCommand: {
      type: String,
      default: ''
    },
    devCommand: {
      type: String,
      default: ''
    },
    nodeVersion: {
      type: String,
      default: '18'
    }
  },

  // Environment variables
  environmentVariables: [{
    key: {
      type: String,
      required: true
    },
    value: {
      type: String,
      required: false,  // Optional - allows empty values for Lite mode (e.g., DATABASE_URL)
      default: ''
    },
    isSecret: {
      type: Boolean,
      default: false
    },
    environments: [{
      type: String,
      enum: ['production', 'preview', 'development'],
      default: 'production'
    }]
  }],

  // Domain configuration
  domains: [{
    domain: {
      type: String,
      required: true
    },
    isCustom: {
      type: Boolean,
      default: false
    },
    isPrimary: {
      type: Boolean,
      default: false
    },
    sslEnabled: {
      type: Boolean,
      default: true
    },
    verified: {
      type: Boolean,
      default: false
    },
    verificationToken: {
      type: String
    },
    verifiedAt: {
      type: Date
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Project status and settings
  status: {
    type: String,
    enum: ['active', 'paused', 'archived', 'error', 'suspended', 'deploying'],
    default: 'active'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  autoDeployEnabled: {
    type: Boolean,
    default: true
  },
  isProtected: {
    type: Boolean,
    default: false
  },

  // Deployment References
  latestDeployment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deployment'
  },
  productionDeployment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deployment'
  },
  deploymentCount: {
    type: Number,
    default: 0
  },

  // Resource usage tracking
  currentUsage: {
    storage: {
      type: Number,
      default: 0 // in MB
    },
    bandwidth: {
      type: Number,
      default: 0 // in MB this month
    },
    builds: {
      type: Number,
      default: 0 // this month
    },
    deployments: {
      type: Number,
      default: 0 // this month
    },
    files: {
      type: Number,
      default: 0 // Total files count
    }
  },

  // Deployment configuration
  deploymentConfig: {
    region: {
      type: String,
      default: 'auto'
    },
    timeout: {
      type: Number,
      default: 300 // seconds
    },
    maxMemory: {
      type: Number,
      default: 512 // MB
    }
  },

  // Active container tracking (for cleanup)
  activeContainer: {
    id: { type: String },
    name: { type: String },
    updatedAt: { type: Date, default: Date.now }
  },

  // Latest deployment information
  latestDeployment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deployment',
    default: null
  },
  deploymentUrl: {
    type: String,
    default: null
  },
  productionDeployment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deployment',
    default: null
  },

  // Statistics
  stats: {
    totalDeployments: {
      type: Number,
      default: 0
    },
    successfulDeployments: {
      type: Number,
      default: 0
    },
    failedDeployments: {
      type: Number,
      default: 0
    },
    totalBuilds: {
      type: Number,
      default: 0
    },
    averageBuildTime: {
      type: Number,
      default: 0 // in seconds
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  },

  // Project settings
  settings: {
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      webhook: {
        url: String,
        events: [String]
      }
    },
    security: {
      passwordProtected: {
        type: Boolean,
        default: false
      },
      password: String,
      allowedIPs: [String]
    },
    analytics: {
      enabled: {
        type: Boolean,
        default: false
      },
      trackingId: String
    }
  },

  // Per-project webhook secret for GitHub signature verification
  webhookSecret: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
projectSchema.index({ owner: 1 });
// slug index removed (duplicate)
projectSchema.index({ 'repository.fullName': 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ framework: 1 });
projectSchema.index({ createdAt: -1 });
projectSchema.index({ 'stats.lastActivity': -1 });

// Compound indexes
projectSchema.index({ owner: 1, status: 1 });
projectSchema.index({ owner: 1, createdAt: -1 });
// Unique index: prevent duplicate project names per user
projectSchema.index({ name: 1, owner: 1 }, { unique: true });

// Virtual for default domain
projectSchema.virtual('defaultDomain').get(function () {
  if (this.domains && Array.isArray(this.domains)) {
    const primaryDomain = this.domains.find(d => d.isPrimary);
    if (primaryDomain) return primaryDomain.domain;
  }

  // Return the generated subdomain
  return `${this.slug}.${process.env.BASE_DOMAIN || 'vcp.dev'}`;
});

// Virtual for repository provider icon
projectSchema.virtual('repositoryIcon').get(function () {
  switch (this.repository.provider) {
    case 'github':
      return 'github';
    case 'gitlab':
      return 'gitlab';
    default:
      return 'git';
  }
});

// Virtual for framework icon/color
projectSchema.virtual('frameworkInfo').get(function () {
  const frameworks = {
    nextjs: { name: 'Next.js', color: '#000000', icon: 'nextjs' },
    react: { name: 'React', color: '#61DAFB', icon: 'react' },
    vue: { name: 'Vue.js', color: '#4FC08D', icon: 'vue' },
    nuxt: { name: 'Nuxt.js', color: '#00DC82', icon: 'nuxt' },
    svelte: { name: 'Svelte', color: '#FF3E00', icon: 'svelte' },
    angular: { name: 'Angular', color: '#DD0031', icon: 'angular' },
    express: { name: 'Express.js', color: '#000000', icon: 'nodejs' },
    fastify: { name: 'Fastify', color: '#000000', icon: 'nodejs' },
    nestjs: { name: 'NestJS', color: '#E0234E', icon: 'nestjs' },
    static: { name: 'Static Site', color: '#6B7280', icon: 'html' },
    gatsby: { name: 'Gatsby', color: '#663399', icon: 'gatsby' },
    hugo: { name: 'Hugo', color: '#FF4088', icon: 'hugo' },
    laravel: { name: 'Laravel', color: '#FF2D20', icon: 'laravel' },
    django: { name: 'Django', color: '#092E20', icon: 'django' },
    flask: { name: 'Flask', color: '#000000', icon: 'flask' },
    custom: { name: 'Custom', color: '#6B7280', icon: 'code' }
  };

  return frameworks[this.framework] || frameworks.custom;
});

// Pre-save middleware to generate slug
projectSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('name')) {
    let baseSlug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let counter = 1;

    // Ensure unique slug
    while (await this.constructor.findOne({ slug, _id: { $ne: this._id } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = slug;
  }

  // Auto-generate webhook secret for new projects
  if (this.isNew && !this.webhookSecret) {
    this.webhookSecret = crypto.randomBytes(32).toString('hex');
  }

  // Update last activity
  this.stats.lastActivity = new Date();

  next();
});

// Instance methods
projectSchema.methods.addCollaborator = function (userId, role = 'viewer') {
  const existingCollaborator = this.collaborators.find(
    c => c.user.toString() === userId.toString()
  );

  if (existingCollaborator) {
    existingCollaborator.role = role;
  } else {
    this.collaborators.push({ user: userId, role });
  }

  return this.save();
};

projectSchema.methods.removeCollaborator = function (userId) {
  this.collaborators = this.collaborators.filter(
    c => c.user.toString() !== userId.toString()
  );
  return this.save();
};

projectSchema.methods.hasAccess = function (userId, requiredRole = 'viewer') {
  if (this.owner.toString() === userId.toString()) {
    return true;
  }

  const collaborator = this.collaborators.find(
    c => c.user.toString() === userId.toString()
  );

  if (!collaborator) return false;

  const roleHierarchy = { viewer: 1, developer: 2, admin: 3 };
  return roleHierarchy[collaborator.role] >= roleHierarchy[requiredRole];
};

projectSchema.methods.incrementUsage = function (type, amount = 1) {
  if (this.currentUsage[type] !== undefined) {
    this.currentUsage[type] += amount;
    return this.save();
  }
};

projectSchema.methods.resetMonthlyUsage = function () {
  this.currentUsage.bandwidth = 0;
  this.currentUsage.builds = 0;
  this.currentUsage.deployments = 0;
  return this.save();
};

// Static methods
projectSchema.statics.findByOwner = function (userId, status = 'active') {
  const query = { owner: userId };
  if (status !== 'all') {
    query.status = status;
  }
  return this.find(query).sort({ 'stats.lastActivity': -1 });
};

projectSchema.statics.findByCollaborator = function (userId) {
  return this.find({
    'collaborators.user': userId,
    status: 'active'
  }).sort({ 'stats.lastActivity': -1 });
};

projectSchema.statics.findPublicProjects = function (limit = 10) {
  return this.find({
    isPublic: true,
    status: 'active'
  })
    .populate('owner', 'username displayName avatar')
    .sort({ 'stats.lastActivity': -1 })
    .limit(limit);
};

module.exports = mongoose.model('Project', projectSchema);
