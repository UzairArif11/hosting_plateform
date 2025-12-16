# 🔧 Fix: Unable to Create Project (400 Error)

**Error:** `POST http://localhost:5000/api/projects 400 (Bad Request)`

**Cause:** Validation errors or missing required fields

---

## 🔍 Common Causes

### 1. **Missing Required Fields**

The API requires:
```javascript
{
  "name": "My Project",              // Required
  "repository": {
    "url": "https://github.com/...", // Required, must be valid URL
    "fullName": "owner/repo",        // Required, format: owner/repo
    "branch": "main"                 // Optional, defaults to "main"
  },
  "framework": "nextjs"              // Required, must be valid framework
}
```

### 2. **Invalid Framework**

Valid frameworks:
- `nextjs`, `react`, `vue`, `nuxt`, `svelte`, `angular`
- `express`, `fastify`, `nestjs`, `koa`
- `static`, `gatsby`, `hugo`, `jekyll`
- `laravel`, `symfony`, `django`, `flask`
- `custom`

### 3. **User Not Logged In**

User must be authenticated with GitHub/Google OAuth

### 4. **No GitHub Access Token**

User must have connected GitHub account

---

## ✅ Quick Fixes

### Fix 1: Check Backend Logs

**Look at backend terminal for detailed error:**

```powershell
cd backend
npm run dev
```

**Look for lines like:**
```
Validation failed: [...]
```

---

### Fix 2: Check User Has GitHub Token

**Run this script:**

```javascript
// backend/check-user.js
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

async function checkUser(email) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }
    
    console.log('✅ User found:', user.email);
    console.log('GitHub Token:', user.githubAccessToken ? '✅ Has token' : '❌ No token');
    console.log('Google Token:', user.googleAccessToken ? '✅ Has token' : '❌ No token');
    console.log('Oracle Account:', user.oracleAccountId || '❌ Not assigned');
    console.log('Container Type:', user.containerType || '❌ Not assigned');
    console.log('Projects:', user.currentUsage?.projects || 0, '/', user.resourceAllocation?.projects || 0);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Usage: node check-user.js your-email@gmail.com
checkUser(process.argv[2]);
```

**Run:**
```powershell
cd backend
node check-user.js your-email@gmail.com
```

---

### Fix 3: Enable Detailed Validation Errors

**Edit `backend/routes/projects.js`:**

Find line 36-46 and update:

```javascript
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Log detailed errors
    console.log('❌ Validation errors:', JSON.stringify(errors.array(), null, 2));
    
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};
```

**Restart backend and try again. Check console for detailed errors.**

---

### Fix 4: Test API Directly

**Use this curl command:**

```powershell
# Get your auth token first
# Login at http://localhost:3000
# Open browser console and run:
# localStorage.getItem('token')

# Then test:
curl -X POST http://localhost:5000/api/projects `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_TOKEN_HERE" `
  -d '{
    "name": "Test Project",
    "repository": {
      "url": "https://github.com/yourusername/yourrepo",
      "fullName": "yourusername/yourrepo",
      "branch": "main"
    },
    "framework": "nextjs"
  }'
```

---

### Fix 5: Check User Has Container Assigned

**The user needs a container assigned!**

```powershell
cd backend
node cleanup-users.js
```

**Or delete and re-register:**

```powershell
cd backend
node delete-all-users.js
```

**Then re-register at http://localhost:3000**

---

## 🧪 Debug Steps

### 1. Check Backend Logs

**Look for:**
```
❌ Validation failed: [...]
❌ User does not have access to repository
❌ Insufficient projects capacity
```

### 2. Check Browser Console

**Open DevTools (F12) → Console**

Look for the actual request payload:
```javascript
// Should see something like:
{
  name: "My Project",
  repository: {
    url: "...",
    fullName: "...",
    branch: "..."
  },
  framework: "..."
}
```

### 3. Check Network Tab

**DevTools → Network → Click the failed request**

Look at:
- **Request Payload** (what was sent)
- **Response** (error details)

---

## 📝 Most Common Issues

### Issue 1: User Not Logged In

**Solution:** Login with GitHub/Google at http://localhost:3000

### Issue 2: No GitHub Token

**Solution:** 
1. Logout
2. Login with GitHub (not Google)
3. Authorize GitHub access

### Issue 3: Invalid Repository Format

**Wrong:**
```json
{
  "repository": {
    "fullName": "myrepo"  // ❌ Wrong format
  }
}
```

**Correct:**
```json
{
  "repository": {
    "fullName": "username/myrepo"  // ✅ Correct
  }
}
```

### Issue 4: No Container Assigned

**Solution:**
```powershell
cd backend
node cleanup-users.js
```

---

## ✅ Complete Fix Workflow

### 1. Check User Status:

```powershell
cd backend
node check-user.js your-email@gmail.com
```

**Should show:**
```
✅ User found: your-email@gmail.com
✅ Has GitHub token
✅ Oracle Account: EC3
✅ Container Type: shared
✅ Projects: 0 / 10
```

### 2. If No Container:

```powershell
node cleanup-users.js
```

### 3. If No GitHub Token:

1. Logout from frontend
2. Login with GitHub (not Google)
3. Authorize GitHub access

### 4. Try Creating Project Again

**Use a valid GitHub repo you have access to!**

---

## 🎯 Quick Test

**Create this test file:**

```javascript
// backend/test-create-project.js
const axios = require('axios');

async function testCreateProject() {
  try {
    // You need to get a real token from localStorage after login
    const token = 'YOUR_TOKEN_HERE';
    
    const response = await axios.post('http://localhost:5000/api/projects', {
      name: 'Test Project',
      repository: {
        url: 'https://github.com/yourusername/yourrepo',
        fullName: 'yourusername/yourrepo',
        branch: 'main'
      },
      framework: 'nextjs'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Success:', response.data);
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
  }
}

testCreateProject();
```

---

## 🎉 Summary

**Most likely causes:**
1. ❌ User not logged in
2. ❌ No GitHub token
3. ❌ No container assigned
4. ❌ Invalid repository format
5. ❌ Invalid framework

**Quick fix:**
1. ✅ Delete users: `node delete-all-users.js`
2. ✅ Re-register with GitHub
3. ✅ Check user: `node check-user.js email`
4. ✅ Try creating project again

**Check backend logs for detailed error!**

---

**Status:** ⚠️ **Need to see backend logs for exact error!**  
**Next:** Check backend terminal for validation errors!
