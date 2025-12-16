const mongoose = require('mongoose');

const deploymentSchema = new mongoose.Schema({
  // References
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Deployment Status
  status: {
    type: String,
    enum: ['queued', 'building', 'deploying', 'success', 'failed', 'cancelled'],
    default: 'queued',
    required: true,
    index: true
  },

  // Git Information
  branch: {
    type: String,
    required: true
  },
  commitSha: {
    type: String,
    required: true
  },
  commitMessage: {
    type: String,
    default: ''
  },
  commitAuthor: {
    name: String,
    email: String,
    avatar: String
  },

  // Deployment Configuration
  environment: {
    type: String,
    enum: ['production', 'preview'],
    default: 'production',
    required: true
  },
  trigger: {
    type: String,
    enum: ['manual', 'webhook', 'retry', 'rollback'],
    default: 'manual',
    required: true
  },

  // Build Information
  buildLogs: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    level: {
      type: String,
      enum: ['info', 'warn', 'error', 'success'],
      default: 'info'
    },
    message: String
  }],
  buildCommand: String,
  installCommand: String,
  outputDirectory: String,
  framework: String,

  // Deployment URLs
  deploymentUrl: {
    type: String,
    index: true
  },
  previewUrl: String,
  aliasUrls: [String],

  // Container Information
  containerId: String,
  containerName: String,
  port: Number,
  serverKey: {
    type: String,
    enum: ['EC2', 'EC3']
  },

  // Preview/Production
  isPreview: {
    type: Boolean,
    default: false
  },
  promotedToProduction: {
    type: Boolean,
    default: false
  },
  promotedAt: Date,

  // Retry/Rollback
  retryOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deployment'
  },
  retryCount: {
    type: Number,
    default: 0
  },
  rollbackFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deployment'
  },

  // Timing
  startedAt: Date,
  finishedAt: Date,
  duration: {
    type: Number, // in milliseconds
    default: 0
  },
  queuedDuration: Number,
  buildDuration: Number,
  deployDuration: Number,

  // Error Information
  error: {
    message: String,
    stack: String,
    code: String,
    phase: {
      type: String,
      enum: ['queue', 'clone', 'install', 'build', 'deploy']
    }
  },

  // Metadata
  metadata: {
    buildSize: Number, // in bytes
    filesCount: Number,
    nodeVersion: String,
    npmVersion: String,
    dependencies: mongoose.Schema.Types.Mixed,
    envVarsCount: Number,
    buildCache: Boolean
  },

  // Analytics
  analytics: {
    buildTime: Number,
    deployTime: Number,
    totalTime: Number,
    cacheHit: Boolean,
    cacheSaved: Number // bytes saved
  }
}, {
  timestamps: true
});

// Indexes for performance
deploymentSchema.index({ projectId: 1, createdAt: -1 });
deploymentSchema.index({ userId: 1, createdAt: -1 });
deploymentSchema.index({ status: 1, createdAt: -1 });
// deploymentUrl index removed (duplicate)
deploymentSchema.index({ environment: 1, status: 1 });

// Virtual for deployment duration in human-readable format
deploymentSchema.virtual('durationFormatted').get(function () {
  if (!this.duration) return '0s';

  const seconds = Math.floor(this.duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
});

// Virtual for status badge
deploymentSchema.virtual('statusBadge').get(function () {
  const badges = {
    queued: { color: 'gray', text: 'Queued' },
    building: { color: 'blue', text: 'Building' },
    deploying: { color: 'yellow', text: 'Deploying' },
    success: { color: 'green', text: 'Success' },
    failed: { color: 'red', text: 'Failed' },
    cancelled: { color: 'gray', text: 'Cancelled' }
  };
  return badges[this.status] || badges.queued;
});

// Instance Methods

// Add build log
deploymentSchema.methods.addLog = function (level, message) {
  this.buildLogs.push({
    timestamp: new Date(),
    level,
    message
  });
  return this.save();
};

// Update status
deploymentSchema.methods.updateStatus = async function (status, additionalData = {}) {
  this.status = status;

  if (status === 'building' && !this.startedAt) {
    this.startedAt = new Date();
    this.queuedDuration = this.startedAt - this.createdAt;
  }

  if (status === 'success' || status === 'failed' || status === 'cancelled') {
    this.finishedAt = new Date();
    if (this.startedAt) {
      this.duration = this.finishedAt - this.startedAt;
    }
  }

  Object.assign(this, additionalData);
  return this.save();
};

// Set error
deploymentSchema.methods.setError = function (error, phase = 'build') {
  this.error = {
    message: error.message || String(error),
    stack: error.stack,
    code: error.code,
    phase
  };
  return this.updateStatus('failed');
};

// Calculate analytics
deploymentSchema.methods.calculateAnalytics = function () {
  if (this.startedAt && this.finishedAt) {
    this.analytics = {
      buildTime: this.buildDuration || 0,
      deployTime: this.deployDuration || 0,
      totalTime: this.duration,
      cacheHit: this.metadata?.buildCache || false,
      cacheSaved: this.metadata?.cacheSaved || 0
    };
  }
  return this.save();
};

// Static Methods

// Find by project
deploymentSchema.statics.findByProject = function (projectId, options = {}) {
  const { limit = 20, skip = 0, environment = null } = options;

  const query = { projectId };
  if (environment) {
    query.environment = environment;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('userId', 'username email avatar')
    .populate('projectId', 'name repository');
};

// Find by user
deploymentSchema.statics.findByUser = function (userId, options = {}) {
  const { limit = 20, skip = 0 } = options;

  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('projectId', 'name repository');
};

// Find active deployments
deploymentSchema.statics.findActive = function () {
  return this.find({
    status: { $in: ['queued', 'building', 'deploying'] }
  }).sort({ createdAt: 1 });
};

// Find latest successful deployment
deploymentSchema.statics.findLatestSuccessful = function (projectId, environment = 'production') {
  return this.findOne({
    projectId,
    environment,
    status: 'success'
  }).sort({ createdAt: -1 });
};

// Get deployment stats
deploymentSchema.statics.getStats = async function (projectId, timeRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  const stats = await this.aggregate([
    {
      $match: {
        projectId: mongoose.Types.ObjectId(projectId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgDuration: { $avg: '$duration' }
      }
    }
  ]);

  return {
    total: stats.reduce((sum, s) => sum + s.count, 0),
    success: stats.find(s => s._id === 'success')?.count || 0,
    failed: stats.find(s => s._id === 'failed')?.count || 0,
    avgDuration: stats.find(s => s._id === 'success')?.avgDuration || 0,
    stats
  };
};

// Middleware

// Pre-save: Calculate duration
deploymentSchema.pre('save', function (next) {
  if (this.startedAt && this.finishedAt && !this.duration) {
    this.duration = this.finishedAt - this.startedAt;
  }
  next();
});

// Pre-remove: Clean up associated resources
deploymentSchema.pre('remove', async function (next) {
  // Add cleanup logic here (e.g., remove container, clean build files)
  next();
});

const Deployment = mongoose.model('Deployment', deploymentSchema);

module.exports = Deployment;
