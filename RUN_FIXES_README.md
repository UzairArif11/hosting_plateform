# QUICK START - Run All Fixes

## Option 1: Use the Batch Script (Windows)
```bash
# Just double-click this file:
RUN_FIXES.bat

# Or run from command prompt:
cd d:\work\platform
RUN_FIXES.bat
```

## Option 2: Run Manually
```bash
cd d:\work\platform
node fix-critical-bugs.js
```

## What Gets Fixed
1. ✅ Converts all plan features from strings to objects
2. ✅ Adds 90-day TTL index to analytics events  
3. ✅ Removes duplicate collaborators
4. ✅ Fixes users with missing plan references

## After Running
1. Restart backend server
2. Visit `/admin/plans` to verify
3. Test any feature (templates, analytics, etc.)

## Connection
Script uses: `mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin`

All fixes are **non-destructive** and can be run multiple times safely.
