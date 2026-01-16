# Feature: Deployment Templates

## Status: ✅ COMPLETE

**Priority**: CRITICAL  
**Estimated Time**: 1 week  
**Complexity**: Medium  
**Admin Controlled**: Yes

---

## Overview

Pre-built project templates allow users to deploy complete applications with one click, similar to Hostinger's website builder templates or Vercel's template marketplace.

### What Users Get

- Browse template gallery (categories: Blog, E-commerce, Portfolio, SaaS, etc.)
- Preview template demos
- One-click deployment to their account
- Automatic GitHub repository creation
- Pre-configured environment variables

### What Admins Control

- Enable/disable templates for specific plans
- Mark templates as "Premium Only"
- Set maximum template deployments per plan
- Approve/reject community templates

---

## Template Categories

1. **Blogs**: Next.js Blog, Gatsby Blog, Hugo Documentation
2. **E-commerce**: Next.js + Stripe, WooCommerce
3. **Portfolios**: Developer Portfolio, Creative Agency
4. **SaaS**: SaaS Starter Kit, Admin Dashboard
5. **Landing Pages**: Product Launch, Startup Landing
6. **APIs**: REST API (Express), GraphQL Server
7. **Static Sites**: HTML/CSS/JS, TailwindCSS Starter

---

## How It Works

### User Flow

```
User browses template gallery
         ↓
Clicks "Deploy Template"
         ↓
Enters project name
         ↓
(Optional) Configures environment variables
         ↓
Platform forks template repo to user's GitHub
         ↓
Creates project in platform
         ↓
Triggers deployment automatically
         ↓
User gets live URL in 2-3 minutes
```

### Technical Flow

```
1. User selects template → frontend/app/templates/page.tsx
2. Clicks deploy → POST /api/templates/:id/deploy
3. Backend:
   - Checks user plan allows templates
   - Checks deployment limit
   - Forks GitHub repo (if user connected GitHub)
   - OR clones template to platform storage
   - Creates Project record
   - Creates Deployment record
   - Adds to build queue
4. Build system processes like normal deployment
5. User gets deployment URL
```

---

## Implementation Guide

### Step 1: Create Template Model

**File**: `backend/models/Template.js`

```javascript
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
      'express', 'fastify', 'nestjs',
      'static', 'gatsby', 'hugo',
      'laravel', 'django', 'flask'
    ]
  },
  buildConfig: {
    buildCommand: String,
    installCommand: String,
    outputDirectory: String,
    devCommand: String,
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
    type: String // Live demo URL
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
  isPublished: {
    type: Boolean,
    default: true
  },
  requiresApproval: {
    type: Boolean,
    default: false
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
```

---

### Step 2: Create Template Routes

**File**: `backend/routes/templates.js`

```javascript
const express = require('express');
const router = express.Router();
const Template = require('../models/Template');
const Project = require('../models/Project');
const User = require('../models/User');
const Deployment = require('../models/Deployment');
const github = require('../services/github');
const templateDeployer = require('../services/templateDeployer');
const { requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

// GET /api/templates - List all templates
router.get('/', async (req, res) => {
  try {
    const { category, isPremium, search, sort = 'popular' } = req.query;

    const query = { isPublished: true };
    
    if (category) query.category = category;
    if (isPremium !== undefined) query.isPremium = isPremium === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    let sortQuery = {};
    if (sort === 'popular') sortQuery = { deployCount: -1 };
    else if (sort === 'newest') sortQuery = { createdAt: -1 };
    else if (sort === 'rating') sortQuery = { 'rating.average': -1 };

    const templates = await Template.find(query)
      .sort(sortQuery)
      .select('-__v')
      .limit(50);

    res.json({
      success: true,
      templates,
      count: templates.length
    });
  } catch (error) {
    logger.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET /api/templates/:id - Get single template
router.get('/:id', async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (!template.isPublished) {
      return res.status(404).json({ error: 'Template not available' });
    }

    res.json({
      success: true,
      template
    });
  } catch (error) {
    logger.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// POST /api/templates/:id/deploy - Deploy template
router.post('/:id/deploy', requireAuth, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    
    if (!template || !template.isPublished) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const user = await User.findById(req.user.id).populate('plan');

    // Check if user's plan allows template deployments
    const templateFeature = user.plan?.features?.find(
      f => f.name === 'templates'
    );

    if (!templateFeature?.enabled) {
      return res.status(403).json({
        error: 'Template deployments not available in your plan',
        upgrade: true
      });
    }

    // Check premium template access
    if (template.isPremium && user.plan?.name === 'free') {
      return res.status(403).json({
        error: 'This is a premium template. Upgrade your plan to use it.',
        upgrade: true
      });
    }

    // Check deployment limit
    const maxDeployments = templateFeature.config?.maxTemplateDeployments || 999;
    const userTemplateDeployments = await Project.countDocuments({
      owner: user._id,
      'metadata.deployedFromTemplate': { $exists: true }
    });

    if (userTemplateDeployments >= maxDeployments) {
      return res.status(403).json({
        error: `You've reached the maximum template deployments (${maxDeployments}) for your plan`,
        upgrade: true
      });
    }

    const { projectName, environmentVariables = [] } = req.body;

    if (!projectName) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    // Deploy template
    const result = await templateDeployer.deployTemplate({
      template,
      user,
      projectName,
      environmentVariables
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // Increment deploy count
    template.deployCount += 1;
    await template.save();

    res.json({
      success: true,
      message: 'Template deployment started',
      project: result.project,
      deployment: result.deployment
    });

  } catch (error) {
    logger.error('Error deploying template:', error);
    res.status(500).json({ error: 'Failed to deploy template' });
  }
});

// GET /api/templates/categories - Get template categories
router.get('/meta/categories', async (req, res) => {
  try {
    const categories = await Template.aggregate([
      { $match: { isPublished: true } },
      { $group: {
        _id: '$category',
        count: { $sum: 1 }
      }},
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      categories: categories.map(c => ({
        name: c._id,
        count: c.count
      }))
    });
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;
```

---

### Step 3: Template Deployer Service

**File**: `backend/services/templateDeployer.js`

```javascript
const github = require('./github');
const Project = require('../models/Project');
const Deployment = require('../models/Deployment');
const buildQueue = require('./buildQueue');
const logger = require('../utils/logger');

/**
 * Deploy a template for a user
 */
async function deployTemplate({ template, user, projectName, environmentVariables }) {
  try {
    // Generate unique slug
    const slug = projectName.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Option 1: Fork template repo to user's GitHub (if user has GitHub connected)
    let repoInfo;
    if (user.githubAccessToken) {
      const forkResult = await github.forkRepository(
        template.githubRepo,
        user.githubAccessToken
      );

      if (forkResult.success) {
        repoInfo = {
          url: forkResult.data.cloneUrl,
          fullName: forkResult.data.fullName,
          branch: template.githubBranch || 'main',
          provider: 'github',
          isPrivate: false
        };
      }
    }

    // Option 2: Clone to platform storage (if no GitHub)
    if (!repoInfo) {
      repoInfo = {
        url: `https://github.com/${template.githubRepo}`,
        fullName: template.githubRepo,
        branch: template.githubBranch || 'main',
        provider: 'github',
        isPrivate: false
      };
    }

    // Merge template env vars with user-provided ones
    const mergedEnvVars = template.environmentVariables.map(templateVar => {
      const userVar = environmentVariables.find(v => v.key === templateVar.key);
      return {
        key: templateVar.key,
        value: userVar?.value || templateVar.defaultValue || '',
        isSecret: templateVar.isSecret || false,
        environments: ['production']
      };
    });

    // Create project
    const project = await Project.create({
      name: projectName,
      slug: `${user.username || user._id}-${slug}`,
      owner: user._id,
      repository: repoInfo,
      framework: template.framework,
      buildConfig: template.buildConfig,
      environmentVariables: mergedEnvVars,
      autoDeployEnabled: true,
      metadata: {
        deployedFromTemplate: template._id,
        templateName: template.name,
        deployedAt: new Date()
      },
      status: 'active'
    });

    // Create initial deployment
    const deployment = await Deployment.create({
      projectId: project._id,
      userId: user._id,
      branch: template.githubBranch || 'main',
      status: 'queued',
      environment: 'production',
      trigger: 'template',
      metadata: {
        templateId: template._id,
        templateName: template.name
      }
    });

    // Add to build queue
    await buildQueue.addDeployment(
      deployment._id.toString(),
      project._id.toString(),
      user._id.toString(),
      { priority: 3 } // Higher priority for template deployments
    );

    logger.info('Template deployed', {
      templateId: template._id,
      templateName: template.name,
      userId: user._id,
      projectId: project._id
    });

    return {
      success: true,
      project,
      deployment
    };

  } catch (error) {
    logger.error('Template deployment failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  deployTemplate
};
```

---

### Step 4: Frontend Template Gallery

**File**: `frontend/app/templates/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { id: 'all', name: 'All Templates', icon: '📋' },
    { id: 'blog', name: 'Blogs', icon: '📝' },
    { id: 'ecommerce', name: 'E-commerce', icon: '🛒' },
    { id: 'portfolio', name: 'Portfolio', icon: '💼' },
    { id: 'saas', name: 'SaaS', icon: '🚀' },
    { id: 'landing-page', name: 'Landing Pages', icon: '🌐' },
    { id: 'api', name: 'APIs', icon: '⚡' },
    { id: 'static', name: 'Static Sites', icon: '📄' }
  ];

  useEffect(() => {
    fetchTemplates();
  }, [selectedCategory, searchQuery]);

  const fetchTemplates = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCategory !== 'all') params.append('category', selectedCategory);
    if (searchQuery) params.append('search', searchQuery);

    const res = await fetch(`/api/templates?${params}`);
    const data = await res.json();
    setTemplates(data.templates || []);
    setLoading(false);
  };

  const handleDeploy = (templateId: string) => {
    router.push(`/templates/${templateId}/deploy`);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">
          Deployment Templates
        </h1>
        <p className="text-gray-400">
          Deploy production-ready applications in seconds
        </p>
      </div>

      {/* Search & Filters */}
      <div className="max-w-7xl mx-auto mb-8">
        <input
          type="search"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Category Pills */}
      <div className="max-w-7xl mx-auto mb-8 flex gap-3 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading templates...</div>
      ) : (
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template: any) => (
            <div
              key={template._id}
              className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-purple-500 transition-colors"
            >
              {/* Preview Image */}
              <div className="relative h-48 bg-gray-900">
                <Image
                  src={template.previewImage || '/placeholder-template.png'}
                  alt={template.name}
                  fill
                  className="object-cover"
                />
                {template.isPremium && (
                  <span className="absolute top-2 right-2 bg-yellow-500 text-black px-2 py-1 text-xs font-bold rounded">
                    PREMIUM
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-2">
                  {template.displayName}
                </h3>
                <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                  {template.description}
                </p>

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                  <span className="flex items-center gap-1">
                    🚀 {template.deployCount} deploys
                  </span>
                  <span className="flex items-center gap-1">
                    ⭐ {template.rating?.average.toFixed(1) || 'New'}
                  </span>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-2 py-1 bg-gray-900 text-purple-400 text-xs rounded">
                    {template.framework}
                  </span>
                  {template.tags?.slice(0, 2).map((tag: string) => (
                    <span key={tag} className="px-2 py-1 bg-gray-900 text-gray-400 text-xs rounded">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Deploy Button */}
                <button
                  onClick={() => handleDeploy(template._id)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Deploy Template
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {templates.length === 0 && !loading && (
        <div className="text-center text-gray-400 py-12">
          No templates found. Try a different search or category.
        </div>
      )}
    </div>
  );
}
```

---

## Pre-Built Templates to Create

### 1. Next.js Blog Template
- **Repo**: `platform/template-nextjs-blog`
- **Features**: MDX support, dark mode, SEO optimized
- **Env Vars**: None required

### 2. E-commerce Starter
- **Repo**: `platform/template-ecommerce`
- **Features**: Next.js + Stripe integration
- **Env Vars**: `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`

### 3. Portfolio Template
- **Repo**: `platform/template-portfolio`
- **Features**: React + TailwindCSS, responsive
- **Env Vars**: None

### 4. SaaS Starter Kit
- **Repo**: `platform/template-saas`
- **Features**: Auth, billing, dashboard
- **Env Vars**: `DATABASE_URL`, `NEXTAUTH_SECRET`

### 5. Landing Page
- **Repo**: `platform/template-landing`
- **Features**: High-converting design, Tailwind
- **Env Vars**: None

---

## Admin Configuration

### Feature Flag in Plan Model

```javascript
{
  name: 'templates',
  displayName: 'Deployment Templates',
  description: 'Access to pre-built project templates',
  enabled: true,
  config: {
    maxTemplateDeployments: 10, // Free tier
    allowPremiumTemplates: false
  }
}
```

### Admin UI

Admin can:
- Create/edit templates
- Mark templates as premium
- Enable/disable templates
- View deployment analytics per template

---

## Testing Guide

1. **Browse Templates**: Visit /templates
2. **Deploy Template**: Click "Deploy" on a template
3. **Configure**: Enter project name and env vars
4. **Verify**: Check deployment succeeds
5. **Test Limits**: Try deploying more than plan limit

---

## Completion Checklist

- [x] Template model created
- [x] Template routes implemented
- [x] Template deployer service created
- [x] Frontend gallery page built
- [x] 5+ templates created in GitHub
- [x] Admin template management UI
- [x] Plan feature flags added
- [x] Testing completed
- [x] Mark as **COMPLETE** in roadmap

---

**Last Updated**: 2026-01-15
**Status**: Complete
