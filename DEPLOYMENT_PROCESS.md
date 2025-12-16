# 🚀 Deployment Process - Complete Guide

## 📋 **Overview**

This document explains the complete deployment process, where builds happen, where containers are created, and how everything works together.

---

## 🏗️ **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────┐
│                         EC1 (Backend)                        │
│  - Node.js Backend (Port 5000)                              │
│  - MongoDB Database                                          │
│  - Redis Queue                                               │
│  - Build Executor                                            │
│  - Container Orchestrator                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Manages & Deploys to
                            ▼
        ┌───────────────────────────────────────┐
        │                                       │
        ▼                                       ▼
┌──────────────────┐                  ┌──────────────────┐
│   EC2 Server     │                  │   EC3 Server     │
│  (Oracle Cloud)  │                  │  (Oracle Cloud)  │
│                  │                  │                  │
│  - Docker Host   │                  │  - Docker Host   │
│  - User          │                  │  - User          │
│    Containers    │                  │    Containers    │
└──────────────────┘                  └──────────────────┘
```

---

## 🔄 **Complete Deployment Flow**

### **Step 1: User Triggers Deployment**

**Location:** Frontend (Browser)

```javascript
User clicks "Deploy Now"
  ↓
Frontend sends POST /api/deployments
  ↓
Backend receives request
```

---

### **Step 2: Deployment Created**

**Location:** EC1 (Backend Server)

```
1. Create Deployment record in MongoDB
2. Add job to Redis Queue (BullMQ)
3. Return deployment ID to frontend
```

**Files Involved:**
- `backend/routes/deployments.js` - API endpoint
- `backend/services/buildQueue.js` - Queue management

---

### **Step 3: Build Process Starts**

**Location:** EC1 (Backend Server)

#### **3.1 Clone Repository**

```
📦 Clone repository from GitHub
  ↓
Location: EC1 at /tmp/builds/{deploymentId}
  ↓
Uses GitHub access token from user
```

**Example Path:**
```
/tmp/builds/692e7b24d052d95556adaf2d/
```

**Files Involved:**
- `backend/services/buildExecutor.js` - `cloneRepository()`

---

#### **3.2 Detect Framework**

```
🔍 Analyze package.json
  ↓
Detect: React, Next.js, Vue, etc.
  ↓
Set build commands and output directory
```

**Detection Logic:**
- Checks `dependencies` in package.json
- Looks for framework-specific files
- Sets appropriate build command

**Files Involved:**
- `backend/services/buildExecutor.js` - `detectFramework()`

---

#### **3.3 Install Dependencies**

```
📥 Install npm packages
  ↓
Location: EC1 at /tmp/builds/{deploymentId}
  ↓
Command: npm ci (or yarn/pnpm)
  ↓
Time: 60-120 seconds
```

**Files Involved:**
- `backend/services/buildExecutor.js` - `installDependencies()`

---

#### **3.4 Build Project**

```
🔨 Build production bundle
  ↓
Location: EC1 at /tmp/builds/{deploymentId}
  ↓
Command: npm run build
  ↓
Output: /tmp/builds/{deploymentId}/build/
  ↓
Time: 180-300 seconds (3-5 minutes)
```

**Environment Variables:**
- `NODE_ENV=production`
- `CI=false` (to allow warnings)

**Files Involved:**
- `backend/services/buildExecutor.js` - `buildProject()`

---

### **Step 4: Container Allocation**

**Location:** EC1 (Backend Server)

```
🐳 Determine where to deploy
  ↓
Check if user has existing container
  ↓
If NO: Allocate new container on EC2 or EC3
  ↓
If YES: Use existing container
```

**Allocation Logic:**

```javascript
// Check user's assigned server
if (user.assignedServer === 'EC2') {
    // Deploy to EC2
    server = EC2 (129.154.255.90:2376)
} else if (user.assignedServer === 'EC3') {
    // Deploy to EC3
    server = EC3 (129.154.255.91:2376)
}

// Container naming
containerName = `user-${userId}`
port = assigned port (e.g., 3001, 3002, etc.)
```

**Files Involved:**
- `backend/services/containerOrchestrator.js` - `allocateContainer()`
- `backend/models/User.js` - User container assignment

---

### **Step 5: Docker Image Creation**

**Location:** EC1 (Backend Server)

```
🐳 Create Docker image
  ↓
Location: EC1 Docker
  ↓
1. Generate Dockerfile based on framework
2. Copy build output to image
3. Build Docker image
  ↓
Image Name: {projectName}-{deploymentId}
```

**Example Dockerfile (React):**
```dockerfile
FROM nginx:alpine
COPY build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Files Involved:**
- `backend/services/buildExecutor.js` - `generateDockerfile()`
- `backend/services/docker.js` - Docker operations

---

### **Step 6: Deploy to Container**

**Location:** EC2 or EC3 (Remote Docker Host)

```
🚢 Deploy to user's container
  ↓
1. Connect to EC2/EC3 via Docker API (port 2376)
2. Stop existing container (if running)
3. Remove old container
4. Create new container from image
5. Start container
  ↓
Container runs on EC2/EC3
```

**Container Configuration:**
```javascript
{
  Image: 'project-name-deploymentid',
  name: 'user-{userId}',
  HostConfig: {
    PortBindings: {
      '80/tcp': [{ HostPort: '3001' }]  // Assigned port
    },
    Memory: 512 * 1024 * 1024,  // 512 MB
    CpuShares: 1024,
    RestartPolicy: { Name: 'unless-stopped' }
  }
}
```

**Files Involved:**
- `backend/services/docker.js` - `runContainer()`
- `backend/services/buildExecutor.js` - `deployToContainer()`

---

### **Step 7: Deployment Complete**

```
✅ Deployment successful!
  ↓
Update deployment status in MongoDB
  ↓
Generate deployment URL
  ↓
Return URL to user
```

**Deployment URL Format:**
```
https://{projectName}.{BASE_DOMAIN}
or
https://preview-{projectName}-{deploymentId}.{BASE_DOMAIN}
```

---

## 📍 **Where Things Happen**

### **EC1 (Backend Server) - 129.154.255.89**

**Responsibilities:**
- ✅ Receives deployment requests
- ✅ Clones repositories
- ✅ Installs dependencies
- ✅ Builds projects
- ✅ Creates Docker images
- ✅ Manages deployment queue
- ✅ Orchestrates container allocation

**Storage:**
- `/tmp/builds/{deploymentId}/` - Build directories
- MongoDB - Deployment records
- Redis - Build queue

**Does NOT:**
- ❌ Run user containers
- ❌ Serve user applications

---

### **EC2 (Container Host) - 129.154.255.90**

**Responsibilities:**
- ✅ Runs user Docker containers
- ✅ Serves deployed applications
- ✅ Hosts user websites

**Configuration:**
- Docker API: Port 2376 (HTTP)
- Container Ports: 3001-3100
- Max Users: ~50 (configurable)

**Does NOT:**
- ❌ Build projects
- ❌ Clone repositories
- ❌ Run backend services

---

### **EC3 (Container Host) - 129.154.255.91**

**Responsibilities:**
- ✅ Runs user Docker containers
- ✅ Serves deployed applications
- ✅ Hosts user websites

**Configuration:**
- Docker API: Port 2376 (HTTP)
- Container Ports: 3001-3100
- Max Users: ~50 (configurable)

**Does NOT:**
- ❌ Build projects
- ❌ Clone repositories
- ❌ Run backend services

---

## 🔐 **Security & Isolation**

### **Build Isolation**
- Each build happens in separate directory on EC1
- Cleaned up after deployment
- No cross-contamination between builds

### **Container Isolation**
- Each user gets their own Docker container
- Resource limits enforced (CPU, RAM)
- Network isolation between containers

### **GitHub Access**
- User's GitHub token used for cloning
- Token stored securely in MongoDB
- Never exposed to other users

---

## 📊 **Resource Allocation**

### **Free Plan**
```javascript
{
  ram: 0.5,      // 512 MB
  cpu: 1,        // 1 CPU share
  storage: 1,    // 1 GB
  bandwidth: 10  // 10 GB/month
}
```

### **Pro Plan**
```javascript
{
  ram: 2,        // 2 GB
  cpu: 2,        // 2 CPU shares
  storage: 10,   // 10 GB
  bandwidth: 100 // 100 GB/month
}
```

---

## ⏱️ **Typical Timeline**

```
User clicks "Deploy"
  ↓ (instant)
Deployment created in MongoDB
  ↓ (instant)
Job added to Redis queue
  ↓ (0-5 seconds)
Build worker picks up job
  ↓ (5-10 seconds)
Repository cloned on EC1
  ↓ (60-120 seconds)
Dependencies installed on EC1
  ↓ (180-300 seconds)
Project built on EC1
  ↓ (10-30 seconds)
Docker image created on EC1
  ↓ (5-10 seconds)
Container deployed to EC2/EC3
  ↓ (instant)
Deployment complete! ✅

Total: 4-7 minutes
```

---

## 🔍 **Monitoring & Logs**

### **Backend Logs (EC1)**
```bash
# View deployment logs
tail -f backend/logs/deployment.log

# View build executor logs
grep "executeBuild" backend/logs/app.log
```

### **Container Logs (EC2/EC3)**
```bash
# SSH to EC2/EC3
ssh ubuntu@129.154.255.90

# View container logs
docker logs user-{userId}

# View all containers
docker ps
```

---

## 🐛 **Troubleshooting**

### **Build Fails on EC1**
- Check `/tmp/builds/{deploymentId}/` for build output
- Review deployment logs in MongoDB
- Check Redis queue status

### **Container Won't Start on EC2/EC3**
- SSH to EC2/EC3
- Check Docker daemon: `systemctl status docker`
- Check port availability: `netstat -tulpn | grep 3001`
- View container logs: `docker logs user-{userId}`

### **Can't Connect to EC2/EC3**
- Check firewall rules (port 2376)
- Verify Docker API is accessible
- Test connection: `curl http://129.154.255.90:2376/version`

---

## 📝 **Key Files**

### **Backend (EC1)**
```
backend/
├── services/
│   ├── buildExecutor.js      # Main build & deploy logic
│   ├── buildQueue.js          # Redis queue management
│   ├── containerOrchestrator.js  # Container allocation
│   └── docker.js              # Docker API wrapper
├── routes/
│   └── deployments.js         # Deployment API
└── models/
    ├── Deployment.js          # Deployment schema
    └── User.js                # User & container assignment
```

---

## 🎯 **Summary**

**Where Projects Are Built:**
- ✅ **EC1** - All building happens here

**Where Containers Run:**
- ✅ **EC2** - User containers
- ✅ **EC3** - User containers

**Where Users Access:**
- ✅ **EC2/EC3** - Via deployment URLs

**Build Process:**
1. Clone on EC1
2. Install on EC1
3. Build on EC1
4. Create image on EC1
5. Deploy to EC2/EC3
6. Container runs on EC2/EC3

---

**Everything is automated! Users just click "Deploy" and the system handles the rest!** 🚀
