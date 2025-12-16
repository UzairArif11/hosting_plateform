# ⚙️ Server Capacity Configuration

**Question:** Where do these values come from?

```json
{
  "capacity": {
    "shared": "200/200 users",
    "dedicated": "100/100 containers"
  },
  "resources": {
    "cpu": "0.00/2 OCPU",
    "ram": "0.00/12 GB"
  }
}
```

**Answer:** From `backend/services/containerOrchestrator.js` with `.env` overrides!

---

## 📊 Current Configuration

### EC2 (Default Values):
```javascript
EC2: {
  totalCPU: 4,           // 4 OCPU
  totalRAM: 24,          // 24 GB
  sharedPool: {
    maxUsers: 150,       // 150 shared users max
    cpuLimit: 2,         // 2 OCPU for shared
    ramLimit: 12         // 12 GB for shared
  },
  dedicatedPool: {
    maxUsers: 50,        // 50 dedicated containers max
    cpuLimit: 2,         // 2 OCPU for dedicated
    ramLimit: 12         // 12 GB for dedicated
  }
}
```

### EC3 (Default Values):
```javascript
EC3: {
  totalCPU: 8,           // 8 OCPU
  totalRAM: 48,          // 48 GB
  sharedPool: {
    maxUsers: 200,       // 200 shared users max
    cpuLimit: 3,         // 3 OCPU for shared
    ramLimit: 18         // 18 GB for shared
  },
  dedicatedPool: {
    maxUsers: 100,       // 100 dedicated containers max
    cpuLimit: 5,         // 5 OCPU for dedicated
    ramLimit: 30         // 30 GB for dedicated
  }
}
```

---

## 🔧 How to Customize

### Method 1: Via Environment Variables (Recommended)

**Edit `backend/.env`:**

```env
# EC2 Configuration
EC2_SERVER_IP=140.238.229.147
EC2_TOTAL_CPU=4           # Total CPU cores
EC2_TOTAL_RAM=24          # Total RAM in GB
EC2_MAX_CONTAINERS=200    # Max total containers
EC2_MAX_SHARED=150        # Max shared users
EC2_MAX_DEDICATED=50      # Max dedicated containers

# EC3 Configuration
EC3_SERVER_IP=129.154.255.90
EC3_TOTAL_CPU=8           # Total CPU cores
EC3_TOTAL_RAM=48          # Total RAM in GB
EC3_MAX_CONTAINERS=300    # Max total containers
EC3_MAX_SHARED=200        # Max shared users
EC3_MAX_DEDICATED=100     # Max dedicated containers
```

**Restart backend:**
```powershell
cd backend
npm run dev
```

---

### Method 2: Edit Code Directly

**Edit `backend/services/containerOrchestrator.js`:**

**Lines 53-90:**

```javascript
EC2: {
  name: 'EC2-Mixed-Server',
  host: process.env.EC2_SERVER_IP,
  totalCPU: parseFloat(process.env.EC2_TOTAL_CPU) || 4,  // ← Change default
  totalRAM: parseInt(process.env.EC2_TOTAL_RAM) || 24,   // ← Change default
  maxContainers: parseInt(process.env.EC2_MAX_CONTAINERS) || 200,
  type: 'mixed_users',
  description: 'Handles both FREE users (shared) and PAID users (dedicated)',
  sharedPool: {
    maxUsers: 150,        // ← Change this
    cpuLimit: 2,          // ← Change this
    ramLimit: 12          // ← Change this
  },
  dedicatedPool: {
    maxUsers: 50,         // ← Change this
    cpuLimit: 2,          // ← Change this
    ramLimit: 12          // ← Change this
  }
},
EC3: {
  name: 'EC3-Mixed-Server',
  host: process.env.EC3_SERVER_IP,
  totalCPU: parseFloat(process.env.EC3_TOTAL_CPU) || 8,   // ← Change default
  totalRAM: parseInt(process.env.EC3_TOTAL_RAM) || 48,    // ← Change default
  maxContainers: parseInt(process.env.EC3_MAX_CONTAINERS) || 300,
  type: 'mixed_users',
  description: 'Handles both FREE users (shared) and PAID users (dedicated)',
  sharedPool: {
    maxUsers: 200,        // ← Change this
    cpuLimit: 3,          // ← Change this
    ramLimit: 18          // ← Change this
  },
  dedicatedPool: {
    maxUsers: 100,        // ← Change this
    cpuLimit: 5,          // ← Change this
    ramLimit: 30          // ← Change this
  }
}
```

---

## 📝 Example: Match Your Actual Oracle VMs

### If your Oracle VMs are:

**EC2:**
- 2 OCPU
- 12 GB RAM

**EC3:**
- 1 OCPU
- 6 GB RAM

### Update `.env`:

```env
# EC2 Configuration (2 OCPU, 12 GB)
EC2_SERVER_IP=140.238.229.147
EC2_TOTAL_CPU=2           # Actual CPU
EC2_TOTAL_RAM=12          # Actual RAM
EC2_MAX_SHARED=100        # Reduce shared users
EC2_MAX_DEDICATED=30      # Reduce dedicated

# EC3 Configuration (1 OCPU, 6 GB)
EC3_SERVER_IP=129.154.255.90
EC3_TOTAL_CPU=1           # Actual CPU
EC3_TOTAL_RAM=6           # Actual RAM
EC3_MAX_SHARED=50         # Reduce shared users
EC3_MAX_DEDICATED=15      # Reduce dedicated
```

**Restart backend and test:**
```
http://localhost:5000/api/test/server-capacity
```

**Should show updated values!**

---

## 🎯 Recommended Values Based on VM Size

### Free Tier (1 OCPU, 6 GB RAM):
```env
TOTAL_CPU=1
TOTAL_RAM=6
MAX_SHARED=50
MAX_DEDICATED=15
```

### Small (2 OCPU, 12 GB RAM):
```env
TOTAL_CPU=2
TOTAL_RAM=12
MAX_SHARED=100
MAX_DEDICATED=30
```

### Medium (4 OCPU, 24 GB RAM):
```env
TOTAL_CPU=4
TOTAL_RAM=24
MAX_SHARED=150
MAX_DEDICATED=50
```

### Large (8 OCPU, 48 GB RAM):
```env
TOTAL_CPU=8
TOTAL_RAM=48
MAX_SHARED=200
MAX_DEDICATED=100
```

---

## 🧮 How to Calculate

### Shared Users:
```
Max Shared Users = (Total RAM in GB / 0.1) * 0.8
```

**Example (12 GB RAM):**
```
(12 / 0.1) * 0.8 = 96 ≈ 100 users
```

### Dedicated Containers:
```
Max Dedicated = (Total RAM in GB / 0.5) * 0.8
```

**Example (12 GB RAM):**
```
(12 / 0.5) * 0.8 = 19.2 ≈ 20 containers
```

---

## 📊 Current vs Actual

### What the API Shows:

```json
{
  "EC2": {
    "resources": {
      "cpu": "0.00/4 OCPU",    // From EC2_TOTAL_CPU || 4
      "ram": "0.00/24 GB"      // From EC2_TOTAL_RAM || 24
    },
    "capacity": {
      "shared": "150/150",     // From sharedPool.maxUsers
      "dedicated": "50/50"     // From dedicatedPool.maxUsers
    }
  },
  "EC3": {
    "resources": {
      "cpu": "0.00/2 OCPU",    // From EC3_TOTAL_CPU || 8
      "ram": "0.00/12 GB"      // From EC3_TOTAL_RAM || 48
    },
    "capacity": {
      "shared": "200/200",     // From sharedPool.maxUsers
      "dedicated": "100/100"   // From dedicatedPool.maxUsers
    }
  }
}
```

### Your Actual Oracle VMs:

**Check actual resources:**
```bash
# SSH into EC2
ssh ubuntu@140.238.229.147

# Check CPU
nproc

# Check RAM
free -h

# Exit
exit
```

**Then update `.env` to match!**

---

## ✅ Quick Setup

### 1. Check Your Oracle VM Resources:

```bash
# EC2
ssh ubuntu@140.238.229.147
echo "CPU: $(nproc)"
echo "RAM: $(free -h | grep Mem | awk '{print $2}')"
exit

# EC3
ssh ubuntu@129.154.255.90
echo "CPU: $(nproc)"
echo "RAM: $(free -h | grep Mem | awk '{print $2}')"
exit
```

### 2. Update `.env`:

```env
# Match your actual resources
EC2_TOTAL_CPU=2
EC2_TOTAL_RAM=12
EC2_MAX_SHARED=100
EC2_MAX_DEDICATED=30

EC3_TOTAL_CPU=1
EC3_TOTAL_RAM=6
EC3_MAX_SHARED=50
EC3_MAX_DEDICATED=15
```

### 3. Restart Backend:

```powershell
cd backend
npm run dev
```

### 4. Verify:

```
http://localhost:5000/api/test/server-capacity
```

**Should show your actual values!** ✅

---

## 🎉 Summary

**Values come from:**
1. ✅ **Hardcoded defaults** in `containerOrchestrator.js`
2. ✅ **Environment variables** in `.env` (override defaults)

**To customize:**
1. ✅ Check actual VM resources
2. ✅ Add to `backend/.env`
3. ✅ Restart backend
4. ✅ Test API

**Recommended:**
- ✅ Use `.env` for easy changes
- ✅ Match actual Oracle VM specs
- ✅ Leave some headroom (80% of total)

---

**Status:** ✅ **Fully customizable via .env!**  
**No admin panel needed!**  
**Just edit .env and restart!** 🚀
