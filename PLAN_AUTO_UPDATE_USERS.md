# 🎯 PLAN UPDATES - AUTO-PROPAGATE TO ALL USERS

## ✅ **HOW IT WORKS:**

When admin updates a plan, **ALL existing users** on that plan are automatically updated!

---

## 📊 **PLAN UPDATE SCENARIOS**

### **Scenario 1: Update Plan Resources**

```javascript
// Admin updates Pro plan
PUT /admin/plans/pro
Body: {
  displayResources: {
    cpu: 3.0,        // Increase from 2.0 to 3.0
    ram: 6144        // Increase from 4GB to 6GB
  },
  actualResources: {
    cpu: 3.0,        // Also increase backend
    ram: 6144
  },
  applyToExisting: true  // ← Auto-update all existing users
}

Result:
✅ Plan updated in database
✅ All 100 existing Pro users updated:
   - Display: 2.0 → 3.0 CPU, 4GB → 6GB
   - Backend: 2.0 → 3.0 CPU, 4GB → 6GB
   - Containers: Resource limits updated
✅ New Pro users: Get 3.0 CPU, 6GB
```

---

### **Scenario 2: Update Display Only**

```javascript
// Marketing upgrade - display only
PUT /admin/plans/pro
Body: {
  displayResources: {
    cpu: 3.0,        // Increase display
    ram: 6144
  },
  actualResources: {
    cpu: 2.0,        // Keep backend same
    ram: 4096
  },
  applyToExisting: true,
  updateType: 'display'  // Only update display
}

Result:
✅ All 100 Pro users see upgrade:
   - Display: 2.0 → 3.0 CPU, 4GB → 6GB ✅
   - Backend: 2.0 CPU, 4GB (unchanged) ✅
✅ No actual resource cost!
✅ Marketing win!
```

---

### **Scenario 3: Update Backend Only**

```javascript
// Reduce backend allocation
PUT /admin/plans/pro
Body: {
  displayResources: {
    cpu: 2.0,        // Keep display same
    ram: 4096
  },
  actualResources: {
    cpu: 1.5,        // Reduce backend
    ram: 3072
  },
  applyToExisting: true,
  updateType: 'backend'  // Only update backend
}

Result:
✅ All 100 Pro users:
   - Display: 2.0 CPU, 4GB (unchanged) ✅
   - Backend: 2.0 → 1.5 CPU, 4GB → 3GB ✅
✅ Freed: 50 CPU, 100GB RAM
✅ Users don't notice!
```

---

### **Scenario 4: Update Both**

```javascript
// Full plan upgrade
PUT /admin/plans/pro
Body: {
  displayResources: {
    cpu: 4.0,
    ram: 8192
  },
  actualResources: {
    cpu: 4.0,
    ram: 8192
  },
  applyToExisting: true,
  updateType: 'both'
}

Result:
✅ All 100 Pro users upgraded:
   - Display: 2.0 → 4.0 CPU, 4GB → 8GB
   - Backend: 2.0 → 4.0 CPU, 4GB → 8GB
✅ Containers updated with new limits
✅ Users see upgrade immediately
```

---

## 🔧 **BACKEND IMPLEMENTATION**

### **Plan Update Logic:**

```javascript
// services/planManager.js

async function updatePlan(planId, updates, applyToExisting = true) {
  // 1. Update plan in database
  const plan = await Plan.findByIdAndUpdate(planId, updates);
  
  if (!applyToExisting) {
    return { success: true, message: 'Plan updated (new users only)' };
  }
  
  // 2. Get all users on this plan
  const users = await User.find({ plan: planId });
  
  console.log(`Updating ${users.length} existing users...`);
  
  // 3. Update each user
  for (const user of users) {
    await updateUserResources(user, plan, updates.updateType);
  }
  
  return {
    success: true,
    message: `Plan updated. ${users.length} users updated.`,
    affectedUsers: users.length
  };
}

async function updateUserResources(user, plan, updateType) {
  const updates = {};
  
  // Update display resources
  if (updateType === 'display' || updateType === 'both') {
    updates.displayedResources = plan.displayResources;
  }
  
  // Update backend resources
  if (updateType === 'backend' || updateType === 'both') {
    updates.allocatedResources = plan.actualResources;
    
    // Apply to running containers
    for (const container of user.containers) {
      await enforceResourceLimits(container, plan.actualResources);
    }
  }
  
  // Update user in database
  await User.findByIdAndUpdate(user._id, { $set: updates });
  
  // Log the update
  await AuditLog.create({
    action: 'plan_update_propagated',
    userId: user._id,
    planId: plan._id,
    changes: updates,
    timestamp: new Date()
  });
}

async function enforceResourceLimits(container, resources) {
  // Update Docker container limits
  await docker.updateContainer(container.id, {
    memory: resources.ram * 1024 * 1024,
    cpuQuota: resources.cpu * 100000,
    cpuPeriod: 100000
  });
  
  // Update cgroup limits
  await docker.execCommand(container.id, 
    `echo ${resources.cpu * 100000} > /sys/fs/cgroup/cpu/cpu.cfs_quota_us`
  );
  await docker.execCommand(container.id,
    `echo ${resources.ram * 1024 * 1024} > /sys/fs/cgroup/memory/memory.limit_in_bytes`
  );
}
```

---

## 📊 **UPDATE FLOW**

```
Admin Updates Plan
       ↓
Plan Updated in DB
       ↓
Find All Users on Plan
       ↓
For Each User:
  ├─ Update Display Resources (if needed)
  ├─ Update Allocated Resources (if needed)
  ├─ Update Running Containers (if backend changed)
  └─ Log Audit Trail
       ↓
Send Notifications
       ↓
Complete ✅
```

---

## 🎨 **ADMIN UI - PLAN MANAGEMENT**

```
┌─────────────────────────────────────────────────────────┐
│ Edit Plan: Pro                                          │
│ Current Users: 100                                      │
├─────────────────────────────────────────────────────────┤
│ DISPLAY RESOURCES (What users see):                    │
│   CPU: [2.0] → [3.0] cores                             │
│   RAM: [4096] → [6144] MB                              │
│   Storage: [50] GB                                      │
│   Bandwidth: [1000] GB/month                           │
│                                                         │
│ ACTUAL RESOURCES (What backend enforces):              │
│   CPU: [2.0] → [3.0] cores                             │
│   RAM: [4096] → [6144] MB                              │
│   Storage: [50] GB                                      │
│   Bandwidth: [1000] GB/month                           │
│                                                         │
│ UPDATE OPTIONS:                                         │
│   [✓] Apply to existing users (100 users)              │
│   [ ] New users only                                    │
│                                                         │
│   Update Type:                                          │
│   ( ) Display only                                      │
│   ( ) Backend only                                      │
│   (•) Both                                              │
│                                                         │
│ IMPACT PREVIEW:                                         │
│   Affected Users: 100                                   │
│   Additional CPU needed: 100 cores                      │
│   Additional RAM needed: 200 GB                         │
│   Available on servers: ✅ Yes                          │
│                                                         │
│   [Preview Changes] [Save & Apply to All Users]        │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 **UPDATE OPTIONS**

### **Option 1: Apply to Existing Users**
```javascript
applyToExisting: true
```
- ✅ All current users updated
- ✅ New users get new plan
- ✅ Immediate effect

### **Option 2: New Users Only**
```javascript
applyToExisting: false
```
- ❌ Current users keep old resources
- ✅ New users get new plan
- ✅ Gradual migration

### **Option 3: Gradual Rollout**
```javascript
rolloutStrategy: 'gradual',
rolloutPercent: 10  // 10% per hour
```
- ✅ Update 10 users/hour
- ✅ Monitor for issues
- ✅ Safe deployment

---

## 🔔 **NOTIFICATIONS**

When plan updated, users get notified:

```
Email to all Pro users:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Your Plan Has Been Upgraded!

Your Pro plan now includes:
• 3.0 CPU cores (was 2.0)
• 6 GB RAM (was 4 GB)
• Same great price!

No action needed - upgrade is automatic.

View your new resources: [Dashboard]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 📊 **AUDIT TRAIL**

Every plan update is logged:

```javascript
{
  action: 'plan_updated',
  planId: 'pro',
  adminId: 'admin123',
  changes: {
    displayResources: {
      before: { cpu: 2.0, ram: 4096 },
      after: { cpu: 3.0, ram: 6144 }
    },
    actualResources: {
      before: { cpu: 2.0, ram: 4096 },
      after: { cpu: 3.0, ram: 6144 }
    }
  },
  affectedUsers: 100,
  applyToExisting: true,
  timestamp: '2025-12-04T13:00:00Z'
}
```

---

## ✅ **COMPLETE PLAN UPDATE SYSTEM**

### **Admin Can:**

1. ✅ **Update plan display resources**
   - All existing users see new values
   
2. ✅ **Update plan backend resources**
   - All existing containers updated
   
3. ✅ **Update both**
   - Complete upgrade/downgrade
   
4. ✅ **Choose update type:**
   - Display only
   - Backend only
   - Both
   
5. ✅ **Choose rollout:**
   - Immediate (all users)
   - New users only
   - Gradual (X% per hour)

### **System Automatically:**

1. ✅ Updates all users in database
2. ✅ Updates all running containers
3. ✅ Applies new resource limits
4. ✅ Sends notifications
5. ✅ Logs audit trail
6. ✅ Checks server capacity
7. ✅ Handles errors gracefully

---

## 🎯 **EXAMPLE USE CASES**

### **Case 1: Plan Upgrade**
```
Admin: Upgrade Pro plan 2→3 CPU
System: Updates all 100 Pro users
Users: See upgrade in dashboard
Result: Happy customers! ✅
```

### **Case 2: Plan Downgrade**
```
Admin: Reduce Pro backend 2→1.5 CPU
System: Updates all 100 Pro users (backend only)
Users: Still see 2 CPU (display unchanged)
Result: Freed 50 CPU! ✅
```

### **Case 3: Marketing Upgrade**
```
Admin: Increase Pro display 2→3 CPU (display only)
System: Updates all 100 Pro users (display only)
Users: See upgrade, feel valued
Result: No cost, happy customers! ✅
```

---

**When admin updates a plan, ALL existing users are automatically updated!** 🎯
