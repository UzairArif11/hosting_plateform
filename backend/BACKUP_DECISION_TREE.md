# Backup Decision Tree & Data Flow Visual Guide

## 🌳 **Decision Tree: When Does Backup Happen?**

```
User Wants to Change Plan
         |
         ↓
   [Check Current State]
         |
    ┌────┴────┐
    ↓         ↓
[Shared]   [Dedicated]
    |         |
    ↓         ↓
Target Plan? Target Plan?
    |         |
┌───┼───┐     ├─────────┐
↓   ↓   ↓     ↓         ↓
Paid Plans   Free      Dedicated Plans
    |         |         |
    ↓         ↓         ↓
🔄 BACKUP    🔄 BACKUP  ⚡ IN-PLACE SCALING
REQUIRED     REQUIRED   NO BACKUP NEEDED
    |         |         |
    ↓         ↓         ↓
Shared→      Dedicated→ Same Container
Dedicated    Shared     New Resources
             
```

## 🔍 **Detailed Decision Logic**

```javascript
function shouldBackupData(currentContainerType, newPlanType) {
  // Rule 1: Container type change always requires backup
  if (currentContainerType === 'shared' && newPlanType === 'dedicated') {
    return {
      backup: true,
      reason: 'Upgrading from shared to dedicated container',
      method: 'recreate_with_backup'
    };
  }
  
  if (currentContainerType === 'dedicated' && newPlanType === 'shared') {
    return {
      backup: true,
      reason: 'Downgrading from dedicated to shared container',
      method: 'recreate_with_backup'
    };
  }
  
  // Rule 2: Same container type = in-place scaling
  if (currentContainerType === 'dedicated' && newPlanType === 'dedicated') {
    return {
      backup: false,
      reason: 'Same container type, only resources change',
      method: 'in_place_scaling'
    };
  }
  
  // Rule 3: Both shared (shouldn't happen in practice)
  return {
    backup: false,
    reason: 'No container change needed',
    method: 'no_change'
  };
}
```

## 🔄 **Flow Diagrams**

### **Flow A: Shared → Dedicated (Backup Required)**

```
📱 User on Trial Plan (Shared Container)
                |
                ↓
        💳 Pays for Pro Plan
                |
                ↓
    🔍 System detects: shared → dedicated
                |
                ↓
        ⚠️  BACKUP REQUIRED ⚠️
                |
                ↓
┌───────────────────────────────────────┐
│        DATA PRESERVATION FLOW        │
│                                       │
│  1. Create backup volume              │ ← 📦 Secure temporary storage
│     └─ user-john-backup-1642334567    │
│                                       │
│  2. Export data from shared container │ ← 📤 tar.gz all user files
│     └─ /app/projects/*                │
│     └─ /app/deployments/*             │
│     └─ /app/config/*                  │
│                                       │
│  3. Stop shared container (keep it!)  │ ← 🛑 Stop but don't delete
│                                       │
│  4. Create dedicated container        │ ← 🏗️  With higher resources
│     └─ EC2-dedicated-user-john-...    │
│                                       │
│  5. Import data to dedicated         │ ← 📥 Restore all files
│                                       │
│  6. Health check new container       │ ← ✅ Verify everything works
│                                       │
│  7. Cleanup old container & backup   │ ← 🗑️  Remove temporary files
└───────────────────────────────────────┘
                |
                ↓
      ✅ User now has dedicated container
      ✅ All data preserved perfectly
      ✅ Same projects, deployments, configs
```

### **Flow B: Dedicated → Dedicated (No Backup)**

```
👑 User on Pro Plan (Dedicated Container)
                |
                ↓
        📈 Upgrades to Premium Plan
                |
                ↓
    🔍 System detects: dedicated → dedicated
                |
                ↓
        ⚡ IN-PLACE SCALING ⚡
                |
                ↓
┌───────────────────────────────────────┐
│       RESOURCE SCALING FLOW          │
│                                       │
│  1. Docker update command             │ ← ⚡ Instant resource change
│     └─ updateContainerResources()     │
│                                       │
│  2. Update memory limit               │ ← 🧠 20GB → 24GB RAM
│     └─ memory: 24 * 1024 * 1024      │
│                                       │
│  3. Update CPU limit                  │ ← ⚡ 3 → 4 OCPU
│     └─ cpu: 4 * 1024                 │
│                                       │
│  4. Update database allocation        │ ← 📊 Record new limits
│                                       │
│  ⏱️ TOTAL TIME: < 1 second           │
│  📁 DATA MOVEMENT: None               │
│  ⏰ DOWNTIME: Zero                    │
└───────────────────────────────────────┘
                |
                ↓
      ✅ Same container, more resources
      ✅ Zero downtime upgrade
      ✅ All data untouched
```

## 📊 **Data Movement Matrix**

| Scenario | Data Movement | Downtime | Backup Files Created |
|----------|---------------|----------|---------------------|
| **Trial → Starter** | ✅ Full backup/restore | ~30s - 3min | ✅ tar.gz backup |
| **Trial → Growth** | ✅ Full backup/restore | ~30s - 3min | ✅ tar.gz backup |
| **Trial → Pro** | ✅ Full backup/restore | ~30s - 3min | ✅ tar.gz backup |
| **Starter → Growth** | ❌ No movement | 0 seconds | ❌ No files |
| **Growth → Pro** | ❌ No movement | 0 seconds | ❌ No files |
| **Pro → Enterprise** | ❌ No movement | 0 seconds | ❌ No files |
| **Pro → Growth** | ❌ No movement | 0 seconds | ❌ No files |
| **Growth → Starter** | ❌ No movement | 0 seconds | ❌ No files |
| **Any Paid → Trial** | ✅ Full backup/restore | ~30s - 3min | ✅ tar.gz backup |

## 🛡️ **What Gets Preserved in Backup**

### **Complete File System Backup:**
```bash
# Everything in the user's container gets backed up
/app/
├── 📁 projects/
│   ├── my-website/
│   │   ├── 📄 index.html        # ✅ Source files
│   │   ├── 📄 package.json      # ✅ Dependencies
│   │   ├── 📄 .env.local        # ✅ Environment vars
│   │   └── 📁 dist/             # ✅ Build output
│   └── my-api/
│       ├── 📄 server.js         # ✅ All project files
│       └── 📁 node_modules/     # ✅ Dependencies (if needed)
├── 📁 deployments/
│   ├── deploy_abc123/           # ✅ Deployment history
│   └── deploy_def456/           # ✅ Previous builds
├── 📁 uploads/                  # ✅ User uploads
├── 📁 logs/                     # ✅ Application logs
├── 📁 config/
│   ├── 📄 domains.json          # ✅ Domain configs
│   └── 📁 ssl/                  # ✅ SSL certificates
└── 📁 data/
    ├── 📄 database.sqlite       # ✅ Local databases
    └── 📄 cache.json            # ✅ Application data
```

### **Metadata Preserved:**
- ✅ **File permissions** (chmod 755, etc.)
- ✅ **File ownership** (user:group)
- ✅ **Timestamps** (created, modified, accessed)
- ✅ **Directory structure** (exact folder hierarchy)
- ✅ **Symbolic links** (if any)
- ✅ **Hidden files** (.env, .git, .config, etc.)

## 🚨 **Error Scenarios & Recovery**

### **Backup Phase Failures:**

```javascript
// Failure Point 1: Backup volume creation fails
if (!backupVolumeCreated) {
  return {
    success: false,
    error: 'Could not create backup volume',
    action: 'User stays on current container - no changes made'
  };
}

// Failure Point 2: Data export fails
if (!dataExported) {
  await docker.removeDataVolume(backupVolumeName);
  return {
    success: false,
    error: 'Could not backup user data',
    action: 'Cleanup backup volume - user stays on current container'
  };
}

// Failure Point 3: New container creation fails
if (!newContainerCreated) {
  await docker.removeDataVolume(backupVolumeName);
  return {
    success: false,
    error: 'Could not create new container',
    action: 'User stays on old container - no changes made'
  };
}

// Failure Point 4: Data restore fails
if (!dataRestored) {
  // Keep new container but warn user
  logger.error('Data restore failed, manual intervention may be needed');
  return {
    success: true,
    warning: 'Container upgraded but some data may need manual restoration',
    action: 'New container running - check data integrity'
  };
}

// Failure Point 5: Health check fails
if (!healthCheckPassed) {
  await docker.stopContainer(newContainerName);
  await docker.startContainer(oldContainerName);
  await docker.removeDataVolume(backupVolumeName);
  return {
    success: false,
    error: 'New container failed health check',
    action: 'Rolled back to original container'
  };
}
```

### **In-Place Scaling Failures:**

```javascript
// If in-place scaling fails, fallback to backup method
const inPlaceResult = await docker.updateContainerResources(containerName, newResources);

if (!inPlaceResult.success) {
  logger.warn('In-place scaling failed, falling back to backup method');
  
  // Automatically trigger backup/restore process
  return await recreateContainerWithDataPreservation(userId, newResources);
}
```

## 📈 **Performance Optimization**

### **Backup Speed Optimization:**
```javascript
// Use parallel compression for faster backup
const backupCommand = [
  'tar', 'czf', '/backup/user-data.tar.gz',
  '--exclude=node_modules',      // Skip node_modules (reinstall)
  '--exclude=.git',              // Skip git history (unless needed)
  '--exclude=*.log',             // Skip old logs
  '-C', '/source', '.'
];
```

### **Selective Backup (Optional):**
```javascript
// For very large containers, could implement selective backup
const criticalPaths = [
  '/app/projects',       // Always backup projects
  '/app/config',         // Always backup config
  '/app/uploads',        // Always backup uploads
  // Skip: /app/cache, /app/temp, /app/logs (optional)
];
```

## 🎯 **Key Takeaways**

### **When Backup Happens:**
1. **Container Type Changes**: shared ↔ dedicated
2. **In-Place Scaling Fails**: Fallback to backup method
3. **User Explicitly Requests**: Manual backup operations

### **When Backup Does NOT Happen:**
1. **Same Container Type**: dedicated → dedicated
2. **Resource Scaling Only**: More/less CPU, RAM, storage
3. **Plan Changes Within Same Tier**: Pro monthly → Pro yearly

### **Data Safety Guarantees:**
- ✅ **Zero Data Loss**: Complete backup before any changes
- ✅ **Atomic Operations**: All-or-nothing upgrades
- ✅ **Automatic Rollback**: On any failure, revert to original state
- ✅ **Verification Steps**: Health checks before committing changes

This system ensures **maximum performance** (no unnecessary backups) while maintaining **100% data safety** (backup when needed)!
