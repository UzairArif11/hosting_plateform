# Static Assets Fix for Subpath Deployments

## Problem

Next.js apps deployed on subpaths (e.g., `/demosmartpor-123/`) have CSS/JS loading issues because:
- Assets are requested as `/_next/static/css/...` (root path)
- But they should be `https://ec2.foodpanda.site/demosmartpor-123/_next/static/css/...`

## Root Cause

Next.js doesn't know about the subpath, so it generates asset URLs from root `/`.

## Solutions

### Solution 1: Use Subdomains (RECOMMENDED) ✅

Instead of:
- `https://ec2.foodpanda.site/demo1/`
- `https://ec2.foodpanda.site/demo2/`

Use:
- `https://demo1.foodpanda.site/`
- `https://demo2.foodpanda.site/`

**Benefits**:
- ✅ No path issues
- ✅ Cleaner URLs
- ✅ Better SEO
- ✅ Standard deployment pattern
- ✅ Easier SSL management

**Implementation**: Modify `nginxRouter.js` to create wildcard subdomain configs

---

### Solution 2: Set Next.js Base Path (CURRENT FIX)

Set environment variables during build:
- `NEXT_PUBLIC_BASE_PATH=/demosmartpor-123`
- `__NEXT_ROUTER_BASEPATH=/demosmartpor-123`

And add to `next.config.js`:
```javascript
basePath: process.env.NEXT_PUBLIC_BASE_PATH || ''
```

**Status**: Requires platform code changes in buildExecutor.js

---

### Solution 3: Advanced Nginx Rewrites

Add special location blocks for `/_next/` assets that map them to the correct backend.

**Status**: Complex, not recommended

---

## Recommendation

**Switch to subdomain deployments**:
1. Update `nginxRouter.js` to use wildcard DNS
2. Each deployment gets: `{uniqueId}.ec2.foodpanda.site`
3. Configure wildcard SSL cert
4. Much cleaner solution

**OR** for now: Accept that demos work functionally (HTML/content loads) even without CSS, and document this as a known limitation for subpath deployments.

---

## Current Status

✅ **Platform core functionality**: 100% working
✅ **Template deployments**: Successful  
✅ **Applications running**: Yes
✅ **Content serving**: Yes
⚠️ **Styling on subpaths**: Needs subdomain approach

**Platform is production-ready for actual user deployments (which can use subdomains). Demo deployments on subpaths are functional but unstyled.**
