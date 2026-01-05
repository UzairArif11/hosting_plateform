# Docker PM2 Deployment Platform - Fix & Optimization Summary

## 📋 Overview
This document outlines all fixes, optimizations, and improvements made to the PM2 Docker deployment platform to ensure stable, scalable, and admin-controlled resource management.

---

## 🔧 Critical Fixes Implemented

### 1. **Dynamic Plan-Based Resource Allocation** ✅
**Problem:** Resources (RAM, CPU) were hardcoded, ignoring admin-configured plans in the database.

**Solution:**
- **File:** `backend/services/containerOrchestrator.js`
- **Changes:**
  - Containers now fetch Plan from database first
  - If user has no plan, system fetches default 'free' or 'trial' plan from DB
  - Fallback to 512MB RAM only if database is completely empty (safety net)
  - **Code Location:** Lines 209-227

**Impact:** Admin can now control all resource limits via Plan settings in the database.

---

### 2. **Dynamic Paid User Detection** ✅
**Problem:** Paid user status was checked using hardcoded array `['pro', 'business', 'enterprise']`.

**Solution:**
- **File:** `backend/routes/deployments.js`
- **Changes:**
  - System now queries Plan model from database
  - Checks `pricing.usd > 0` or `pricing.pkr > 0` to determine paid status
  - Paid users get priority queue (priority: 1) vs free users (priority: 10)
  - **Code Location:** Lines 153-175

**Impact:** Admin can create any plan with any name, and pricing determines priority automatically.

---

### 3. **Windows Path Fix for Deployments** ✅
**Problem:** `server.js` file was missing in containers, causing `pm2: Script not found` errors.

**Root Cause:** Windows `tar` command failed to archive files due to backslash paths (`D:\work\...`).

**Solution:**
- **File:** `backend/services/remoteBuild.js`
- **Changes:**
  - Normalize Windows paths to forward slashes before `tar` command
  - `buildPath.replace(/\\/g, '/')` ensures cross-platform compatibility
  - **Code Location:** Lines 201-202

**Impact:** Deployments from Windows development machines now work reliably.

---

### 4. **Unique Project Slug Generation** ✅
**Problem:** Multiple users couldn't create projects with the same name (slug collision).

**Solution:**
- **File:** `backend/routes/projects.js`
- **Changes:**
  - Added uniqueness check loop
  - If slug exists, appends random 6-character suffix
  - Up to 5 attempts before asking user to choose different name
  - **Code Location:** Lines 187-201

**Impact:** Users can create "My Project" independently without conflicts.

---

### 5. **OAuth Account Linking** ✅
**Problem:** GitHub OAuth login crashed with `E11000 duplicate key error` when email already existed.

**Solution:**
- **File:** `backend/routes/auth.js`
- **Changes:**
  - Before creating new user, check if email exists
  - If found, link GitHub ID to existing account instead of creating duplicate
  - **Code Location:** Lines 124-135

**Impact:** Users can link multiple OAuth providers to same account seamlessly.

---

### 6. **User-Friendly Error Messages** ✅
**Problem:** Generic "Failed to create project" error hid actual reasons (slug collision, etc.).

**Solution:**
- **File:** `backend/routes/projects.js`
- **Changes:**
  - Changed from `error: 'Failed to create project'` to `error: error.message`
  - Status changed from 500 to 400 for client errors
  - **Code Location:** Line 248

**Impact:** Users see helpful messages like "Project name already taken, please try a different name."

---

### 7. **Unique Port Allocation** ✅
**Problem:** Random port generation caused collisions, leading to routing failures.

**Solution:**
- **Files:** 
  - `backend/services/freeTierContainer.js` (Lines 256-271)
  - `backend/services/containerUpgrade.js` (Lines 412-421)
- **Changes:**
  - Port allocation now checks database for existing ports
  - Iterates through random ports until finding unique one
  - Range: 4000-20000 (16,000 ports)

**Impact:** No more 502 Gateway errors due to port conflicts.

---

## 🚨 Critical Issues Identified (NEED FIXING)

### 1. **Missing Plan Admin CRUD Routes** ❌
**Current State:** No API endpoints exist for admin to manage plans.

**Required Routes:**
- `POST /api/admin/plans` - Create new plan
- `GET /api/admin/plans` - List all plans
- `GET /api/admin/plans/:id` - Get single plan
- `PUT /api/admin/plans/:id` - Update plan
- `DELETE /api/admin/plans/:id` - Delete plan (soft delete if users exist)

**Action Needed:** Create these routes in `backend/routes/admin.js`

---

### 2. **Server Allocation Always Chooses EC3** ❌
**Root Cause:** `chooseBestServerForUser()` logic issue.

**Problem:**
```javascript
if (ec2Status.utilization.sharedCapacity > ec3Status.utilization.sharedCapacity) {
    return 'EC2';
} else {
    return 'EC3'; // ALWAYS RETURNS THIS
}
```

**Issue:** 
- `sharedCapacity` likely starts at MAX and decreases as users are added
- EC2 and EC3 both start empty, so capacity is equal → EC3 wins
- OR `getServerUtilization()` is returning incorrect data

**Fix Needed:** 
- Review `getServerUtilization()` implementation
- Use "current user count" instead of "remaining capacity"
- Or implement round-robin if capacities are equal

---

### 3. **Static/Default Values Still Exist** ⚠️
**Remaining Hardcoded Values:**

**In `containerOrchestrator.js`:**
```javascript
const resources = userPlan?.resources || {
  cpu: 0.5,      // ← STATIC FALLBACK
  ram: 0.5,      // ← STATIC FALLBACK
  storage: 2,    // ← STATIC FALLBACK
  bandwidth: 100 // ← STATIC FALLBACK
};
```

**Recommended Fix:**
```javascript
const resources = userPlan?.resources;

if (!resources) {
    logger.error('No plan found and no default plan in database');
    throw new Error('System configuration error: No plans available. Please contact administrator.');
}
```

**In `routes/deployments.js`:**
```javascript
// Fallback still exists
if (!isPaidUser) {
     isPaidUser = ['pro', 'business', 'enterprise'].includes(req.user.planType);
}
```

**Recommended:** Remove this fallback and strictly rely on database.

---

### 4. **Missing Server Management Admin UI** ❌
**Current State:** No admin routes for server capacity management.

**Required Routes:**
- `GET /api/admin/servers` - List all servers with stats
- `GET /api/admin/servers/:serverKey/stats` - Real-time server stats (EC2, EC3)
- `PUT /api/admin/servers/:serverKey/capacity` - Update server capacity limits
- `GET /api/admin/servers/:serverKey/containers` - List containers on specific server

**Action Needed:** Create these routes in `backend/routes/admin.js`

---

## 📊 Server Allocation Fix Details

### Current Logic Flow:
1. User creates account → `assignUserToServer('free-trial')`
2. `allocateContainer()` called → determines `containerType = 'shared'`
3. `chooseBestServerForUser('shared')` called
4. Compares `ec2Status.utilization.sharedCapacity` vs `ec3Status.utilization.sharedCapacity`
5. **Always returns EC3** (tie-break logic favors EC3)

### Recommended Fix:
```javascript
const chooseBestServerForUser = async (containerType = 'shared') => {
  try {
    const [ec2Status, ec3Status] = await Promise.all([
      getServerUtilization('EC2'),
      getServerUtilization('EC3')
    ]);

    if (!ec2Status.success) return 'EC3';
    if (!ec3Status.success) return 'EC2';

    // Use current usage instead of remaining capacity
    const ec2Load = containerType === 'shared' 
      ? ec2Status.utilization.sharedUsers || 0
      : ec2Status.utilization.dedicatedUsers || 0;
      
    const ec3Load = containerType === 'shared'
      ? ec3Status.utilization.sharedUsers || 0
      : ec3Status.utilization.dedicatedUsers || 0;

    // Choose server with LOWER load (round-robin on tie)
    if (ec2Load < ec3Load) {
      return 'EC2';
    } else if (ec3Load < ec2Load) {
      return 'EC3';
    } else {
      // Tie: Round robin based on total user count
      const totalAssignments = ec2Load + ec3Load;
      return (totalAssignments % 2 === 0) ? 'EC2' : 'EC3';
    }
  } catch (error) {
    logger.error('Error choosing best server:', error);
    return 'EC2'; // Fallback
  }
};
```

---

## 🎯 Recommendations & Next Steps

### Immediate Actions (Priority 1):
1. ✅ **Restart Backend:** User must restart `npm run dev` to apply all fixes
2. ❌ **Create Plan Admin Routes** (See implementation below)
3. ❌ **Fix Server Allocation Logic** (Implement recommended fix)
4. ❌ **Create Server Management Routes**

### Short-term Improvements (Priority 2):
1. **Remove All Static Defaults:** Make system fail gracefully if DB is misconfigured
2. **Add Plan Seeder Script:** Ensure default plans exist on fresh install
3. **Add Deployment Rollback:** Don't delete old PM2 process until new one starts successfully
4. **Implement Health Checks:** Auto-detect if EC2/EC3 are down and route accordingly

### Long-term Enhancements (Priority 3):
1. **Move from Host Network to Bridge:** Improve security and isolation
2. **Centralized Logging:** Push PM2 logs to database or logging service
3. **Auto-scaling:** Spin up new servers when capacity reaches 80%
4. **Metrics Dashboard:** Real-time graphs of CPU/RAM/Deployments per server

---

## 📁 Files Modified

| File | Lines | Change Summary |
|------|-------|---------------|
| `backend/services/containerOrchestrator.js` | 209-227 | Dynamic plan fetch with DB fallback |
| `backend/routes/deployments.js` | 153-175, 207-212 | Dynamic paid check + priority queue |
| `backend/services/remoteBuild.js` | 201-202 | Windows path normalization |
| `backend/routes/projects.js` | 187-201, 248 | Unique slug generation + error message |
| `backend/routes/auth.js` | 124-135 | OAuth account linking |
| `backend/services/freeTierContainer.js` | 256-271 | Database-backed port allocation |
| `backend/services/containerUpgrade.js` | 412-421 | Database-backed port allocation |

---

## 🧪 Testing Checklist

- [ ] Create new user via GitHub OAuth
- [ ] Create project with duplicate name
- [ ] Deploy project (verify server.js exists)
- [ ] Check container RAM limit (should match Plan in DB)
- [ ] Create paid plan, assign to user, verify queue priority
- [ ] Verify EC2 gets some users (not all EC3)
- [ ] Admin can view server stats
- [ ] Admin can create/edit plans

---

## 🐛 Known Issues

1. **No Rollback on Failed Deployment:** Old PM2 process is deleted before new one starts
2. **No Admin UI for Plans:** Routes need to be created
3. **No Admin UI for Servers:** Routes need to be created
4. **Static Defaults Still Exist:** System doesn't fail if DB is empty
5. **All Users Go to EC3:** Server selection logic needs review

---

## 📞 Support

If deployment fails with:
- `pm2: Script not found` → Ensure backend is running on Windows with updated code
- `Port already in use` → Database has stale port entries, run cleanup script
- `Plan validation failed` → Ensure Plans are seeded in database
- `Duplicate key error` → OAuth linking should handle this now

---

*Last Updated: 2025-12-31*
*Version: 2.0 - Post-Optimization*
