# Node.js Version Issue Fix Guide

## Problem
Template deployment failing with error:
```
You are using Node.js 18.20.8. For Next.js, Node.js version ">=20.9.0" is required.
```

## Root Cause
- **Server Node.js Version:** 18.20.8
- **Next.js 15.6 Requirement:** >=20.9.0
- **Mismatch:** Server Node is too old

## Quick Solutions

### Option 1: Upgrade Server Node.js to v20 (Recommended)
```bash
# SSH to server
ssh ubuntu@instance-20250713-1730

# Install Node.js 20 LTS using NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install and use Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node --version  # Should show v20.x.x

# Restart services
cd ~/hosting_plateform
pm2 restart all

# Test deployment again
```

### Option 2: Use Next.js Compatible Template
Update the seed templates to use Next.js 14 instead of 15:

```javascript
// backend/scripts/seedTemplates.js
{
    name: 'Next.js Commerce',
    githubRepo: 'vercel/commerce',
    githubBranch: 'v2',  // Use stable v2 branch (Next.js 14)
    // ...
}
```

### Option 3: Specify Node Version in Build Config
Update template build config to use compatible Node:

```javascript
buildConfig: {
    buildCommand: 'npm run build',
    outputDirectory: '.next',
    nodeVersion: '20'  // Specify required version
}
```

## Real-Time Status Updates Fixed

### Backend Changes:
✅ **Fixed template variable scope** in async promise chain  
✅ **Refetch template** before updating to ensure latest state  
✅ **Proper error emission** via Socket.IO on failures  
✅ **Store template ID** separately to avoid context loss  

### Frontend Changes:
✅ **Added polling fallback** - Checks every 10 seconds for stuck deployments  
✅ **Socket.IO error handling** - Logs connection issues  
✅ **Proper state reset** - Updates UI when deployment fails  
✅ **Button re-enabled** - No longer stuck disabled on error  

## Testing After Fix

### 1. Deploy Changes:
```bash
cd ~/hosting_plateform
git pull origin optimization2
./deploy.sh
```

### 2. Test Real-Time Updates:
1. Go to `/admin/templates`
2. Click "Deploy Demo" on Next.js Commerce
3. Watch for:
   - ✅ Button disables immediately
   - ✅ "Deploying..." spinner appears
   - ✅ Progress bar shows (if supported)
   - ✅ After ~1 minute: Error toast appears
   - ✅ Red "Deployment Failed" badge shows
   - ✅ Error message displayed
   - ✅ Button re-enabled (can retry)

### 3. Check Backend Logs:
```bash
pm2 logs backend --lines 50 | grep -A 5 "template-demo-status"

# Should see:
# io.emit('template-demo-status', {
#   templateId: '...',
#   status: 'failed',
#   error: 'Build failed...'
# })
```

### 4. Check Frontend Console:
Open browser DevTools → Console:
```
Connected to Socket.IO for template demo updates
Template demo status update: {
  templateId: "xxx",
  status: "failed",
  error: "Build failed: ..."
}
```

## Recommended: Upgrade to Node.js 20

### Why Node 20?
- ✅ **LTS (Long Term Support)** - Supported until 2026
- ✅ **Better Performance** - 10-20% faster than Node 18
- ✅ **Next.js Compatibility** - Works with Next.js 15
- ✅ **Modern Features** - Better async/await, fetch API

### Installation Steps:
```bash
# Using NVM (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

nvm install 20
nvm use 20
nvm alias default 20

# Verify installation
node --version   # v20.x.x
npm --version    # 10.x.x

# Rebuild node modules
cd ~/hosting_plateform/backend
rm -rf node_modules package-lock.json
npm install

cd ~/hosting_plateform/frontend
rm -rf node_modules package-lock.json .next
npm install

# Restart services
pm2 restart all
```

## Alternative: Use Different Template

If you can't upgrade Node, use a template that works with Node 18:

### Next.js 14 Templates:
```javascript
{
    name: 'Next.js Blog',
    githubRepo: 'vercel/next-learn',
    githubBranch: 'main',
    buildConfig: {
        buildCommand: 'npm run build',
        outputDirectory: '.next',
        nodeVersion: '18'  // Compatible with Node 18
    }
}
```

### React/Vite Templates:
```javascript
{
    name: 'React Vite Starter',
    githubRepo: 'vitejs/vite',
    githubBranch: 'main',
    framework: 'vite',
    buildConfig: {
        buildCommand: 'npm run build',
        outputDirectory: 'dist',
        nodeVersion: '18'  // Works with Node 18
    }
}
```

## Files Changed

### Backend:
- ✅ `backend/routes/templates.js` - Fixed async context, added template refetch

### Frontend:
- ✅ `frontend/app/admin/templates/page.tsx` - Added polling fallback, better error handling

## Commit & Deploy

```bash
git add .
git commit -m "Fix real-time deployment status updates and add polling fallback

- Refetch template in async handlers to maintain context
- Add polling fallback for stuck deployments (every 10s)
- Add Socket.IO connection error logging
- Properly emit failure events via Socket.IO
- Re-enable button on deployment failure
- Add Node.js version upgrade guide"

git push origin optimization2
```

## Summary

### Issues Fixed:
1. ✅ **UI stuck on "deploying"** - Added polling + Socket.IO fixes
2. ✅ **Button stays disabled** - Properly resets state on error
3. ✅ **No failure events** - Fixed Socket.IO emission in backend
4. ✅ **Template context lost** - Refetch template in async handlers

### Still Need To Fix:
❌ **Node.js version** - Upgrade server to Node 20 or use compatible templates

**Recommended Action:** Upgrade to Node.js 20 LTS for best compatibility and performance.
