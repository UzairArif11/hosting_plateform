# 🔄 CONTAINER UPDATES DURING RESOURCE OVERRIDE

## ❓ **QUESTION:**
When admin applies resource override, does the container get recreated or just updated?

## ✅ **ANSWER:**
**Container is UPDATED (not recreated)** - We change resource limits on the running container without stopping it!

---

## 🔧 **HOW IT WORKS**

### **Option 1: Update Running Container (RECOMMENDED)** ✅

**No Downtime!**

```javascript
// When admin applies override
async function applyResourceOverride(userId, override) {
  const user = await User.findById(userId);
  
  // 1. Save override to database
  user.adminOverride = {
    enabled: true,
    customCPU: override.cpu,
    customRAM: override.ram,
    reason: override.reason,
    expiresAt: new Date(Date.now() + override.duration * 1000),
    setBy: adminId,
    setAt: new Date()
  };
  await user.save();
  
  // 2. Update ALL running containers for this user
  for (const container of user.containers) {
    await updateContainerResources(container.id, {
      cpu: override.cpu,
      ram: override.ram
    });
  }
  
  return { success: true, message: 'Resources updated without downtime' };
}

async function updateContainerResources(containerId, resources) {
  // Update Docker container limits (NO RESTART!)
  await docker.updateContainer(containerId, {
    // Memory limit
    Memory: resources.ram * 1024 * 1024,
    
    // CPU quota (100000 = 1 CPU)
    CpuQuota: resources.cpu * 100000,
    CpuPeriod: 100000
  });
  
  // Update cgroup limits directly (for shared containers)
  await docker.execCommand(containerId, 
    `echo ${resources.cpu * 100000} > /sys/fs/cgroup/cpu/cpu.cfs_quota_us`
  );
  
  await docker.execCommand(containerId,
    `echo ${resources.ram * 1024 * 1024} > /sys/fs/cgroup/memory/memory.limit_in_bytes`
  );
  
  logger.info(`Container ${containerId} resources updated to ${resources.cpu} CPU, ${resources.ram} MB RAM`);
}
```

**Result:**
```
✅ Container keeps running
✅ No downtime
✅ New limits applied immediately
✅ User's app stays online
```

---

### **Option 2: Recreate Container (NOT RECOMMENDED)** ❌

**Causes Downtime!**

```javascript
// DON'T DO THIS!
async function applyResourceOverride(userId, override) {
  // 1. Stop old container
  await docker.stopContainer(container.id);  // ❌ DOWNTIME!
  
  // 2. Remove old container
  await docker.removeContainer(container.id);
  
  // 3. Create new container with new limits
  const newContainer = await docker.runContainer(image, name, {
    memory: override.ram,
    cpu: override.cpu
  });
  
  // ❌ User's app was offline during this!
}
```

**Result:**
```
❌ Container stopped
❌ Downtime (30-60 seconds)
❌ User's app offline
❌ Bad user experience
```

---

## 📊 **COMPARISON**

| Action | Update Container | Recreate Container |
|--------|-----------------|-------------------|
| **Downtime** | ✅ None | ❌ 30-60 seconds |
| **User Impact** | ✅ None | ❌ App offline |
| **Speed** | ✅ Instant | ❌ Slow |
| **Complexity** | ✅ Simple | ❌ Complex |
| **Data Loss** | ✅ None | ⚠️ Possible |

---

## 🎯 **IMPLEMENTATION**

### **Complete Flow:**

```javascript
// backend/services/resourceManager.js

async function applyAdminOverride(userId, override, adminId) {
  try {
    const user = await User.findById(userId);
    
    // 1. Save override to database
    user.adminOverride = {
      enabled: true,
      customCPU: override.cpu,
      customRAM: override.ram,
      reason: override.reason,
      expiresAt: new Date(Date.now() + override.duration * 1000),
      setBy: adminId,
      setAt: new Date()
    };
    await user.save();
    
    // 2. Get effective resources (override takes priority)
    const effectiveResources = getEffectiveResources(user);
    
    // 3. Update all user's containers WITHOUT stopping them
    const updateResults = [];
    for (const container of user.containers) {
      const result = await updateContainerResourcesLive(
        container.id, 
        effectiveResources
      );
      updateResults.push(result);
    }
    
    // 4. Log the change
    await AuditLog.create({
      action: 'admin_override_applied',
      adminId: adminId,
      userId: userId,
      changes: {
        cpu: { from: user.allocatedResources.cpu, to: override.cpu },
        ram: { from: user.allocatedResources.ram, to: override.ram }
      },
      duration: override.duration,
      reason: override.reason,
      timestamp: new Date()
    });
    
    // 5. Notify user
    await notifyUser(userId, {
      type: 'resource_update',
      message: `Your resources have been temporarily updated to ${override.cpu} CPU, ${override.ram} MB RAM`,
      expiresAt: user.adminOverride.expiresAt
    });
    
    return {
      success: true,
      message: 'Override applied without downtime',
      containersUpdated: updateResults.length
    };
    
  } catch (error) {
    logger.error('Failed to apply override:', error);
    return { success: false, error: error.message };
  }
}

async function updateContainerResourcesLive(containerId, resources) {
  try {
    // Get container info
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    
    // Update container configuration
    await container.update({
      Memory: resources.ram * 1024 * 1024,
      MemoryReservation: resources.ram * 1024 * 1024 * 0.8,
      CpuQuota: resources.cpu * 100000,
      CpuPeriod: 100000
    });
    
    // For shared containers, also update cgroups directly
    if (info.Config.Labels?.type === 'shared') {
      await updateCgroupLimits(containerId, resources);
    }
    
    logger.info(`✅ Container ${containerId} updated to ${resources.cpu} CPU, ${resources.ram} MB RAM`);
    
    return { success: true, containerId };
    
  } catch (error) {
    logger.error(`Failed to update container ${containerId}:`, error);
    return { success: false, containerId, error: error.message };
  }
}

async function updateCgroupLimits(containerId, resources) {
  // Update CPU quota
  await docker.execCommand(containerId,
    `echo ${resources.cpu * 100000} > /sys/fs/cgroup/cpu/cpu.cfs_quota_us`
  );
  
  // Update memory limit
  await docker.execCommand(containerId,
    `echo ${resources.ram * 1024 * 1024} > /sys/fs/cgroup/memory/memory.limit_in_bytes`
  );
  
  // Update memory soft limit
  await docker.execCommand(containerId,
    `echo ${resources.ram * 1024 * 1024 * 0.8} > /sys/fs/cgroup/memory/memory.soft_limit_in_bytes`
  );
}

function getEffectiveResources(user) {
  // Priority: Override > Allocated > Plan
  if (user.adminOverride?.enabled && 
      user.adminOverride.expiresAt > new Date()) {
    return {
      cpu: user.adminOverride.customCPU,
      ram: user.adminOverride.customRAM,
      source: 'admin_override'
    };
  }
  
  if (user.allocatedResources) {
    return {
      cpu: user.allocatedResources.cpu,
      ram: user.allocatedResources.ram,
      source: 'user_allocated'
    };
  }
  
  return {
    cpu: user.plan.actualResources.cpu,
    ram: user.plan.actualResources.ram,
    source: 'plan_default'
  };
}
```

---

## 🔄 **AUTO-EXPIRATION FLOW**

```javascript
// Cron job runs every hour
async function checkAndExpireOverrides() {
  const users = await User.find({
    'adminOverride.enabled': true,
    'adminOverride.expiresAt': { $lt: new Date() }
  });
  
  for (const user of users) {
    logger.info(`Override expired for user ${user.email}`);
    
    // 1. Disable override
    user.adminOverride.enabled = false;
    await user.save();
    
    // 2. Get new effective resources (will use allocated or plan)
    const effectiveResources = getEffectiveResources(user);
    
    // 3. Update containers back to normal (NO RESTART!)
    for (const container of user.containers) {
      await updateContainerResourcesLive(container.id, effectiveResources);
    }
    
    // 4. Notify admin
    await notifyAdmin({
      type: 'override_expired',
      userId: user._id,
      message: `Override expired for ${user.email}, reverted to ${effectiveResources.cpu} CPU, ${effectiveResources.ram} MB RAM`
    });
    
    // 5. Notify user
    await notifyUser(user._id, {
      type: 'resource_update',
      message: `Your temporary resource boost has expired. Back to normal allocation.`
    });
  }
}

// Run every hour
setInterval(checkAndExpireOverrides, 60 * 60 * 1000);
```

---

## 📊 **EXAMPLE TIMELINE**

### **Day 1: Admin Applies Override**
```
10:00 AM - Admin applies override (2 CPU → 4 CPU for 24 hours)
10:00 AM - Container updated (NO RESTART) ✅
10:00 AM - User gets 4 CPU immediately
10:01 AM - User's app still running, no downtime ✅
```

### **Day 2: Override Expires**
```
10:00 AM - Cron job detects expired override
10:00 AM - Container updated back to 2 CPU (NO RESTART) ✅
10:01 AM - User back to normal resources
10:01 AM - User's app still running, no downtime ✅
```

---

## ✅ **BENEFITS OF UPDATE (NOT RECREATE)**

1. ✅ **Zero Downtime** - App stays online
2. ✅ **Instant** - Changes apply immediately
3. ✅ **No Data Loss** - Container state preserved
4. ✅ **User Friendly** - No interruption
5. ✅ **Efficient** - No image pull, no startup time
6. ✅ **Safe** - Can revert anytime

---

## 🎯 **SUMMARY**

### **When Override Applied:**
```
1. Save override to database
2. Update container resources (docker.updateContainer)
3. Update cgroups (for shared containers)
4. Log the change
5. Notify user

✅ Container keeps running
✅ No downtime
✅ Instant effect
```

### **When Override Expires:**
```
1. Disable override in database
2. Update container back to normal resources
3. Update cgroups
4. Log the expiration
5. Notify admin and user

✅ Container keeps running
✅ No downtime
✅ Automatic revert
```

---

**Container is UPDATED, not recreated - Zero downtime!** ✅
