# 🛡️ WHAT HAPPENS WHEN LIMITS ARE HIT

## 🎯 Quick Summary

| Resource | Type | What Happens When Exceeded | Can App Exceed Limit? |
|----------|------|---------------------------|---------------------|
| **RAM** | Hard | Process **killed instantly** (OOM) | ❌ NO - Kernel prevents it |
| **CPU** | Hard | Process **throttled/slowed** | ❌ NO - Kernel prevents it |
| **Storage** | Soft | PM2 processes **stopped** (after 60s) | ⚠️ YES - Briefly (until check runs) |

---

## 1️⃣ RAM LIMIT (1GB) - HARD LIMIT ✅

### How It Works:
- **Enforced by:** Linux Kernel (Docker `Memory` setting)
- **Limit:** `Memory: 1073741824` bytes = 1GB
- **Check Frequency:** Continuous (kernel-level)

### What Happens When Hit:
```
User App Memory Usage: 950MB → 1000MB → 1050MB
                                           ↓
                                    ❌ KERNEL KILLS PROCESS
                                    (OOM - Out Of Memory)
```

### Behavior:
1. **App tries to allocate more RAM**
2. **Kernel says "NO"**
3. **Process is killed immediately** (SIGKILL)
4. **PM2 auto-restarts** the app
5. **Container stays running**, only the app process is killed

### Example Log:
```bash
# On container logs
[PM2] App [myapp] killed by signal [SIGKILL]
[PM2] Starting myapp in fork_mode (1 instance)
[PM2] Done.
```

### Prevention:
- Memory-efficient code
- Proper cleanup of variables
- Our build uses `--max-old-space-size=900` to prevent this during builds

---

## 2️⃣ CPU LIMIT (0.5 cores) - HARD LIMIT ✅

### How It Works:
- **Enforced by:** Linux Kernel (Docker `NanoCpus` setting)
- **Limit:** `NanoCpus: 500000000` = 0.5 CPU cores
- **Check Frequency:** Continuous (kernel-level)

### What Happens When Hit:
```
User App CPU Usage: 40% → 50% → Tries to use 80%
                                      ↓
                               ⏸️ KERNEL THROTTLES
                               (Slows down execution)
```

### Behavior:
1. **App tries to use more CPU**
2. **Kernel throttles** (limits CPU time slices)
3. **App runs SLOWER** but doesn't crash
4. **Process stays alive**, just takes longer to complete tasks

### Example:
```bash
# Without limit: Build finishes in 30 seconds
# With 0.5 core limit: Build finishes in 60 seconds (slower but completes)
```

### What User Sees:
- Slower response times
- Longer build times
- But **no crashes or errors**

---

## 3️⃣ STORAGE LIMIT (2GB) - SOFT LIMIT ⚠️

### How It Works:
- **Enforced by:** Our software monitoring (not kernel)
- **Limit:** `2GB` per user container
- **Check Frequency:** Every 60 seconds

### What Happens When Hit:
```
Container Storage: 1.8GB → 2.0GB → 2.2GB
                                       ↓
                                (Still running for up to 60s)
                                       ↓
                                Monitor detects violation
                                       ↓
                                🛑 PM2 STOP ALL
```

### Behavior:
1. **App writes data beyond 2GB**
2. **Continues for up to 60 seconds** (until next check)
3. **Monitoring script detects excess**
4. **Runs:** `docker exec <container> pm2 stop all`
5. **All PM2 apps stopped** (container still running)
6. **User must delete files** and redeploy

### Code That Enforces:
```javascript
// containerOrchestrator.js:1012-1015
const storageUsedMB = await checkStorageUsage(containerInfo.container.name);
const storageLimitMB = resourceCaps.perUserCap.storage * 1024; // 2048MB
if (storageUsedMB > storageLimitMB) {
  violations.push({ type: 'storage', current: storageUsedMB, limit: storageLimitMB });
}

// containerOrchestrator.js:1032
await docker.execCommand(containerInfo.container.name, ['pm2', 'stop', 'all']);
```

### Example Log:
```bash
# Platform backend logs
[warn]: Resource violation detected
[warn]: 🛑 Stopping container EC3-user-... due to storage violation (2200MB > 2048MB)

# Container logs (pm2 list)
┌─────┬──────┬─────────┬────────┬─────────┐
│ id  │ name │ status  │ cpu    │ memory  │
├─────┼──────┼─────────┼────────┼─────────┤
│ 0   │ app  │ stopped │ 0%     │ 0mb     │
└─────┴──────┴─────────┴────────┴─────────┘
```

---

## 🔧 HOW TO RECOVER FROM VIOLATIONS

### 1. RAM Violation (OOM Killed):
```bash
# PM2 auto-restarts, but if it keeps crashing:
# Option A: Optimize your app to use less RAM
# Option B: Upgrade to paid plan with 2GB RAM
```

### 2. CPU Throttling:
```bash
# No recovery needed - app just runs slower
# But will complete eventually
# If too slow: Upgrade to paid plan with more CPU
```

### 3. Storage Violation:
```bash
# On EC3 server:
# Step 1: Check what's using space
docker exec EC3-user-<id> du -sh /app/*

# Step 2: Delete unnecessary files
docker exec EC3-user-<id> rm -rf /app/projects/<old-project-id>

# Step 3: Verify space freed
docker exec EC3-user-<id> du -sh /app

# Step 4: Redeploy project (PM2 will start again)
```

---

## 📊 MONITORING & ALERTS

### Current Monitoring:
Your platform already monitors and logs violations.

### Check Logs for Violations:
```bash
# Look for these patterns in backend logs:
grep "Resource violation detected" backend.log
grep "🛑 Stopping container" backend.log
```

### Real-Time Monitoring:
```bash
# On EC3 server
docker stats --no-stream EC3-user-<id>

# Shows:
# CPU %: Should never exceed 50% (0.5 cores)
# MEM USAGE / LIMIT: Should show "XXXMiB / 1GiB"
```

---

## 🎯 SUMMARY: WILL LIMITS ALWAYS BE RESPECTED?

| Limit Type | Enforceable? | Can Exceed? | Recovery |
|-----------|--------------|-------------|----------|
| **RAM (1GB)** | ✅ Yes (Kernel) | ❌ Never | Auto-restart |
| **CPU (0.5)** | ✅ Yes (Kernel) | ❌ Never | Just slower |
| **Storage (2GB)** | ⚠️ Software | ✅ Briefly (max 60s) | Manual cleanup needed |

### Your Platform is SAFE because:
1. **RAM & CPU:** Impossible to exceed (kernel enforced)
2. **Storage:** Monitored every 60s, violators stopped automatically
3. **Total Usage:** 15 users × 2GB = 30GB < 45GB available ✅

---

## 💡 RECOMMENDATIONS

### For Better Enforcement:
If you want **instant** storage enforcement (not every 60s):

**Option 1:** Check on every deployment
```javascript
// Before starting PM2, check storage
const storage = await checkStorageUsage(containerName);
if (storage > 2048) {
  throw new Error('Storage limit exceeded. Delete old projects first.');
}
```

**Option 2:** Increase check frequency
```javascript
// Change from 60s to 10s
startResourceMonitoring(10000); // Check every 10 seconds
```

**Option 3:** Use Docker volumes with size limits
```bash
# Create 2GB volume (requires Docker storage driver support)
docker volume create --driver local \
  --opt type=none \
  --opt device=/path/to/2gb/file \
  --opt o=bind,size=2G \
  user-storage
```

But your **current setup is sufficient** for free tier users! ✅

---

## 🔍 TEST SCENARIOS

Want to test the limits? Try this:

### Test 1: RAM Limit
```javascript
// In your app, try to allocate 2GB
const bigArray = new Array(300000000); // Will be killed at ~1GB
```

### Test 2: Storage Limit
```bash
# Inside container
docker exec EC3-user-<id> sh -c "dd if=/dev/zero of=/app/test.bin bs=1M count=2500"
# After 60s, PM2 processes will stop
```

### Test 3: CPU Limit
```bash
# Run CPU-intensive task
docker exec EC3-user-<id> sh -c "for i in {1..1000000}; do echo test > /dev/null; done"
# Will be slow but complete
```

**Everything is properly limited!** 🛡️
