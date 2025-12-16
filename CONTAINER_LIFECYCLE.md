# 📦 Container Lifecycle Explained

## ❓ Why No Containers After Registration?

**You registered a user and they were assigned to EC3, but `docker ps` shows no containers.**

**This is CORRECT behavior!** ✅

---

## 🔄 Container Lifecycle

### 1. **User Registration** (No Container Created)
```
User registers → Assigned to server (EC2 or EC3) → No container yet
```

**What happens:**
- User account created in MongoDB
- User assigned to EC2 or EC3 based on capacity
- `user.oracleAccountId = "EC3"`
- `user.containerType = "shared"`
- **NO Docker container created yet!**

**Why?**
- Containers are expensive (CPU, RAM, storage)
- User might never deploy anything
- Creates containers on-demand (lazy allocation)

---

### 2. **First Deployment** (Container Created)
```
User deploys project → Container created → App runs in container
```

**What happens:**
- User clicks "Deploy Now"
- Build queue processes deployment
- `buildExecutor.deployToContainer()` called
- **Docker container created on assigned server**
- App deployed to container
- Container keeps running

**Container name format:**
```
EC3-shared-user-username-1732604400000
```

---

### 3. **Subsequent Deployments** (Reuse Container)
```
User deploys again → Same container → New app version
```

**What happens:**
- Existing container stopped
- New image built
- Container restarted with new image
- **Same container, new code**

---

## 🎯 Check Container Status

### API Endpoint 1: Server Capacity
```
GET http://localhost:5000/api/test/server-capacity
```

**Shows:**
- Connected servers
- Current utilization
- Available capacity
- **Does NOT show individual containers**

---

### API Endpoint 2: List Containers ✨ NEW!
```
GET http://localhost:5000/api/test/list-containers
```

**Shows:**
- All containers on EC2
- All containers on EC3
- Container details (name, type, status)
- Users with server assignments
- Summary statistics

**Example response:**
```json
{
  "success": true,
  "summary": {
    "totalContainers": 0,
    "ec2Containers": 0,
    "ec3Containers": 0,
    "usersWithAssignments": 1,
    "sharedContainers": 0,
    "dedicatedContainers": 0
  },
  "servers": {
    "EC2": {
      "connected": true,
      "containers": []
    },
    "EC3": {
      "connected": true,
      "containers": []
    }
  },
  "users": [
    {
      "email": "user@example.com",
      "username": "user123",
      "server": "EC3",
      "containerType": "shared",
      "resources": {
        "cpu": 0.2,
        "ram": 1.2,
        "projects": 10,
        "deployments": 100
      }
    }
  ],
  "note": "Containers are created during first deployment, not during registration"
}
```

---

## 📊 Current State

### After User Registration:
```
MongoDB:
  ✅ User exists
  ✅ user.oracleAccountId = "EC3"
  ✅ user.containerType = "shared"
  ✅ user.resourceAllocation = { ... }

Oracle Cloud EC3:
  ❌ No containers yet
  ⏳ Waiting for first deployment
```

### After First Deployment:
```
MongoDB:
  ✅ User exists
  ✅ Deployment record created
  ✅ Project record created

Oracle Cloud EC3:
  ✅ Container running
  ✅ App deployed
  ✅ Accessible via URL
```

---

## 🧪 Testing

### 1. Check User Assignment:
```powershell
cd backend
node check-user.js your-email@gmail.com
```

**Should show:**
```
✅ Oracle Account: EC3
✅ Container Type: shared
✅ Projects: 0 / 10
```

### 2. Check Containers (Before Deployment):
```
GET http://localhost:5000/api/test/list-containers
```

**Should show:**
```json
{
  "summary": {
    "totalContainers": 0,
    "usersWithAssignments": 1
  },
  "note": "Containers are created during first deployment"
}
```

### 3. Deploy a Project:
1. Create project
2. Click "Deploy Now"
3. Wait for deployment to complete

### 4. Check Containers (After Deployment):
```
GET http://localhost:5000/api/test/list-containers
```

**Should show:**
```json
{
  "summary": {
    "totalContainers": 1,
    "ec3Containers": 1,
    "sharedContainers": 1
  },
  "servers": {
    "EC3": {
      "containers": [
        {
          "name": "EC3-shared-user-username-1732604400000",
          "type": "shared",
          "status": "running",
          "state": "running"
        }
      ]
    }
  }
}
```

---

## 🔍 SSH Verification

### On EC3 (After Deployment):
```bash
ssh ubuntu@129.154.255.90

# List containers
docker ps

# Should show:
# CONTAINER ID   IMAGE              COMMAND       STATUS
# abc123def456   my-project-xyz     npm start     Up 2 minutes

# Check container details
docker inspect EC3-shared-user-username-1732604400000
```

---

## 📝 Summary

### Before First Deployment:
- ✅ User registered
- ✅ Server assigned (EC3)
- ✅ Container type assigned (shared)
- ❌ **No Docker container yet**
- ⏳ **Waiting for deployment**

### After First Deployment:
- ✅ User registered
- ✅ Server assigned (EC3)
- ✅ Container type assigned (shared)
- ✅ **Docker container created**
- ✅ **App running in container**

---

## 🎯 New API Endpoints

### 1. Server Capacity:
```
GET /api/test/server-capacity
```
Shows server stats and capacity

### 2. List Containers: ✨ NEW!
```
GET /api/test/list-containers
```
Shows all containers and users

### 3. Simulate Assignment:
```
POST /api/test/simulate-assignment
Body: { "username": "test", "planType": "free" }
```
Simulates user assignment

---

## 🚀 Next Steps

1. **Register user** (if not done)
2. **Check assignment:** `GET /api/test/list-containers`
3. **Create project**
4. **Deploy project** (this creates the container!)
5. **Check again:** `GET /api/test/list-containers`
6. **Verify on EC3:** `ssh ubuntu@129.154.255.90 && docker ps`

---

**Status:** ✅ **This is expected behavior!**  
**Containers are created on-demand during deployment!** 🎉
