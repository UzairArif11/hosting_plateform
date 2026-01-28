const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
    // Basic Info
    name: {
        type: String,
        required: true,
        unique: true
    },
    slug: {
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
    longDescription: {
        type: String,
        default: ''
    },

    // Categorization
    category: {
        type: String,
        enum: [
            'blog',
            'ecommerce',
            'portfolio',
            'saas',
            'landing-page',
            'api',
            'static',
            'dashboard',
            'documentation',
            'other'
        ],
        required: true
    },
    tags: [{
        type: String
    }],

    // Template Source
    githubRepo: {
        type: String,
        required: true // e.g., "platform/template-nextjs-blog"
    },
    githubBranch: {
        type: String,
        default: 'main'
    },

    // Technical Details
    framework: {
        type: String,
        required: true,
        enum: [
            'nextjs', 'react', 'vue', 'nuxt', 'svelte', 'angular',
            'express', 'fastify', 'nestjs', 'koa',
            'static', 'gatsby', 'hugo', 'jekyll',
            'laravel', 'django', 'flask',
            'custom'
        ]
    },
    // Feature Modes (Lite = JSON, Pro = SQL)
    supportedModes: {
        type: [String],
        enum: ['lite', 'pro'],
        default: ['lite', 'pro']
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

    // Environment Variables Template
    environmentVariables: [{
        key: String,
        description: String,
        defaultValue: String,
        isRequired: Boolean,
        isSecret: Boolean
    }],

    // Media
    previewImage: {
        type: String, // URL to screenshot
        required: true
    },
    previewUrl: {
        type: String // Live demo URL (external, for reference)
    },
    demoDeploymentUrl: {
        type: String // Admin-deployed demo URL (path-based like /demo-template-abc123/)
    },
    demoProjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project' // Reference to admin-created demo project
    },
    demoDeploymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Deployment' // Reference to demo deployment
    },
    screenshots: [{
        url: String,
        caption: String
    }],

    // Access Control
    isPremium: {
        type: Boolean,
        default: false
    },
    minPlan: {
        type: String,
        enum: ['free', 'pro', 'enterprise'],
        default: 'free'
    },
    isPublished: {
        type: Boolean,
        default: true
    },
    requiresApproval: {
        type: Boolean,
        default: false
    },

    // Resource Limits (Admin Configurable)
    resourceLimits: {
        maxListings: {
            type: Number,
            default: null // null = unlimited (user uses their own DB)
        },
        maxImageSize: {
            type: Number, // in MB
            default: 5 // 5MB default
        },
        maxImageResolution: {
            width: {
                type: Number,
                default: 1920 // pixels
            },
            height: {
                type: Number,
                default: 1080 // pixels
            }
        },
        maxStoragePerProject: {
            type: Number, // in MB
            default: 100 // 100MB default
        },
        maxFilesPerProject: {
            type: Number,
            default: 1000
        }
    },

    // Stats
    deployCount: {
        type: Number,
        default: 0
    },
    rating: {
        average: {
            type: Number,
            default: 0
        },
        count: {
            type: Number,
            default: 0
        }
    },

    // Metadata
    author: {
        type: String,
        default: 'Platform Team'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
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

// Indexes
templateSchema.index({ category: 1, isPublished: 1 });
templateSchema.index({ isPremium: 1 });
templateSchema.index({ deployCount: -1 });

module.exports = mongoose.model('Template', templateSchema);
