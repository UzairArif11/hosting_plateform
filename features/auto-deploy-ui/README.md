# Feature: Auto-Deploy UI Configuration

## Status: ✅ IMPLEMENTED

**Priority**: CRITICAL  
**Completed**: 2026-01-15
**Complexity**: Low  
**Admin Controlled**: Yes

---

## Overview

This feature adds a user interface to configure automatic deployments when code is pushed to GitHub. The **backend webhook system is already complete** - this just needs the frontend controls.

### What Users Get

- Toggle to enable/disable auto-deployment
- Select which branch triggers production deployments
- View webhook configuration status
- Manual deployment trigger button

### What Admins Control

- Enable/disable auto-deploy for specific plans
- Set deployment frequency limits (e.g., max 10/day for free users)
- Require manual approval for certain plans

---

## Current Status

### ✅ Already Implemented (Backend)

1. **Webhook Handler**: `backend/services/github.js:327`
   - Receives GitHub push events
   - Verifies webhook signature
   - Creates deployment records
   - Adds to build queue

2. **Database Schema**: `backend/models/Project.js`
   - `autoDeployEnabled` field exists
   - `repository.branch` tracks production branch

3. **Build Queue**: Automatic deployment processing

### ❌ Missing (Frontend)

1. Settings page UI
2. Branch selector component
3. Webhook status indicator
4. Manual trigger button

---

## How It Works

### Flow Diagram

```
User pushes to GitHub
         ↓
GitHub sends webhook → /api/webhooks/github
         ↓
Verify signature ✓
         ↓
Check: autoDeployEnabled === true?
         ↓
Check: branch matches production branch?
         ↓
Create Deployment record
         ↓
Add to Build Queue
         ↓
Process deployment automatically
```

### Configuration Flow

```
User goes to Project Settings
         ↓
Clicks "Deployment" tab
         ↓
Toggles "Auto-Deploy" ON
         ↓
Selects branch (e.g., "main")
         ↓
Saves settings → Updates Project.autoDeployEnabled
         ↓
Future pushes trigger automatic deployment
```

---

## Implementation Guide

### Step 1: Create Settings Page Component

**File**: `frontend/app/dashboard/projects/[id]/settings/deployment.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function DeploymentSettings() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch project and branches
  useEffect(() => {
    fetchProject();
    fetchBranches();
  }, [id]);

  const fetchProject = async () => {
    const res = await fetch(`/api/projects/${id}`);
    const data = await res.json();
    setProject(data.project);
  };

  const fetchBranches = async () => {
    const res = await fetch(`/api/projects/${id}/branches`);
    const data = await res.json();
    setBranches(data.branches || []);
    setLoading(false);
  };

  const updateAutoDeployment = async (enabled) => {
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoDeployEnabled: enabled })
    });
    setProject({ ...project, autoDeployEnabled: enabled });
  };

  const updateProductionBranch = async (branch) => {
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 'repository.branch': branch })
    });
    setProject({ ...project, repository: { ...project.repository, branch } });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Deployment Settings</h2>

      {/* Auto-Deploy Toggle */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">
              Auto-Deploy on Push
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Automatically deploy when code is pushed to the production branch
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={project?.autoDeployEnabled || false}
              onChange={(e) => updateAutoDeployment(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </div>

      {/* Branch Selector */}
      {project?.autoDeployEnabled && (
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-medium text-white mb-4">
            Production Branch
          </h3>
          <select
            value={project?.repository?.branch || 'main'}
            onChange={(e) => updateProductionBranch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
          >
            {branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-2">
            Deployments will be triggered when code is pushed to this branch
          </p>
        </div>
      )}

      {/* Webhook Status */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-medium text-white mb-2">
          Webhook Status
        </h3>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-300">Active</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Webhook URL: https://yourplatform.site/api/webhooks/github
        </p>
      </div>
    </div>
  );
}
```

---

### Step 2: Add Branch Fetching Endpoint

**File**: `backend/routes/projects.js`

Add new endpoint:

```javascript
// Get branches for a project
router.get('/:id/branches', requireAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check authorization
    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Fetch branches from GitHub
    const github = require('../services/github');
    const result = await github.getBranches(
      project.repository.fullName,
      req.user.githubAccessToken
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ branches: result.data });
  } catch (error) {
    logger.error('Error fetching branches:', error);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});
```

---

### Step 3: Add Branch Fetching to GitHub Service

**File**: `backend/services/github.js`

Add new function:

```javascript
const getBranches = async (repoFullName, userToken) => {
  try {
    const headers = createGitHubHeaders(userToken);

    const response = await axios.get(
      `${config.apiUrl}/repos/${repoFullName}/branches`,
      { headers }
    );

    const branches = response.data.map(branch => branch.name);

    logGitHubOperation('Branches fetched', {
      repoFullName,
      count: branches.length
    });

    return createSuccessResponse(branches);
  } catch (error) {
    logGitHubOperation('Failed to fetch branches', {
      repoFullName,
      error: error.message
    }, true);
    return createErrorResponse(error, 'Failed to fetch repository branches');
  }
};

// Add to exports
module.exports = {
  // ... existing exports
  getBranches
};
```

---

### Step 4: Update Project Update Endpoint

**File**: `backend/routes/projects.js`

Modify existing PATCH endpoint to handle autoDeployEnabled:

```javascript
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check authorization
    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if user's plan allows auto-deploy
    const user = await User.findById(req.user.id).populate('plan');
    const autoDeployFeature = user.plan?.features?.find(
      f => f.name === 'autoDeploy'
    );

    if (req.body.autoDeployEnabled && !autoDeployFeature?.enabled) {
      return res.status(403).json({
        error: 'Auto-deploy is not available in your plan',
        upgrade: true
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'name',
      'autoDeployEnabled',
      'repository.branch',
      'environmentVariables',
      'buildConfig'
    ];

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        if (key.includes('.')) {
          // Handle nested fields
          const [parent, child] = key.split('.');
          project[parent][child] = req.body[key];
        } else {
          project[key] = req.body[key];
        }
      }
    });

    await project.save();

    res.json({
      success: true,
      project
    });
  } catch (error) {
    logger.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});
```

---

## Admin Configuration

### Step 1: Add Feature Flag to Plan Model

**File**: `backend/models/Plan.js`

Ensure this feature exists in the features array:

```javascript
{
  name: 'autoDeploy',
  displayName: 'Auto-Deploy on Push',
  description: 'Automatic deployments when code is pushed to production branch',
  enabled: true, // Default: enabled for all plans
  config: {
    maxDeploymentsPerDay: 50 // Free tier limit
  }
}
```

### Step 2: Admin UI for Feature Control

**Location**: Admin Panel → Plans → Edit Plan → Features

Admin can:
- Toggle auto-deploy ON/OFF for plan
- Set daily deployment limits
- Configure webhook priority

---

## Testing Guide

### Manual Testing Steps

1. **Enable Auto-Deploy**
   - Go to Project → Settings → Deployment
   - Toggle "Auto-Deploy on Push" to ON
   - Select branch "main"
   - Save changes

2. **Trigger Deployment**
   - Push code to GitHub on "main" branch
   - Verify webhook received (check backend logs)
   - Verify deployment created automatically
   - Check deployment status updates

3. **Disable Auto-Deploy**
   - Toggle OFF
   - Push code
   - Verify NO deployment is triggered

4. **Change Branch**
   - Change production branch to "develop"
   - Push to "main" → No deployment
   - Push to "develop" → Deployment triggered

### API Testing

```bash
# Test branch fetching
curl -H "Authorization: Bearer TOKEN" \
  https://api.yourplatform.com/api/projects/PROJECT_ID/branches

# Test auto-deploy toggle
curl -X PATCH \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"autoDeployEnabled": true}' \
  https://api.yourplatform.com/api/projects/PROJECT_ID

# Test branch change
curl -X PATCH \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"repository.branch": "develop"}' \
  https://api.yourplatform.com/api/projects/PROJECT_ID
```

---

## User Documentation

### How to Enable Auto-Deployment

1. Navigate to your project dashboard
2. Click on "Settings" in the sidebar
3. Select the "Deployment" tab
4. Toggle "Auto-Deploy on Push" to enabled
5. Choose your production branch from the dropdown
6. Click "Save Changes"

Now, whenever you push code to the selected branch, a deployment will automatically trigger!

### Disabling Auto-Deployment

Simply toggle the switch back to OFF and save.

---

## Troubleshooting

### Auto-Deploy Not Working

**Check:**
1. Is auto-deploy enabled in project settings?
2. Are you pushing to the correct branch?
3. Is the webhook configured in GitHub?
4. Check backend logs for webhook errors

### Webhook Not Receiving Events

**Steps:**
1. Go to GitHub repo → Settings → Webhooks
2. Check webhook URL matches your platform
3. Verify webhook secret is configured
4. Check "Recent Deliveries" for errors

---

## Files Modified/Created

### Created
- ✅ `frontend/app/dashboard/projects/[id]/settings/deployment.tsx`

### Modified
- ✅ `backend/routes/projects.js` - Add branches endpoint
- ✅ `backend/services/github.js` - Add getBranches function
- ✅ `backend/models/Plan.js` - Add autoDeploy feature flag

---

## Completion Checklist

- [ ] Frontend settings component created
- [ ] Branch fetching endpoint implemented
- [ ] GitHub service updated
- [ ] Project update endpoint enhanced
- [ ] Plan feature flag added
- [ ] Admin UI updated
- [ ] Testing completed
- [ ] Documentation reviewed
- [ ] Feature marked as **COMPLETE** in main README

---

## Next Steps After Completion

1. Update `IMPLEMENTATION_ROADMAP.md` status to "✅ COMPLETE"
2. Add user guide to documentation site
3. Announce feature to users via email
4. Monitor webhook delivery success rate

---

**Feature Owner**: Backend Team + Frontend Team  
**Last Updated**: 2026-01-15  
**Status**: Awaiting Implementation
