# 🧪 TESTING GUIDE - SSH Container Logic Verification

**Date:** 2025-12-19  
**Purpose:** Test ONE container + PM2 architecture via SSH

---

## 📋 **PRE-REQUISITES:**

1. ✅ Backend server running
2. ✅ SSH access to EC2/EC3 servers
3. ✅ Docker installed on servers
4. ✅ Test user account created

---

## 🔧 **TEST 1: Verify Container Creation on Signup**

### **Step 1: Create Test User**

**Via API or Frontend:**
```bash
# Signup a new user
# This should trigger container creation
```

**Or via MongoDB:**
```bash
# Connect to MongoDB
mongo

# Check user was created
db.users.findOne({ email: "test@example.com" })

# Should have:
# - assignedServer: "EC2" or "EC3"
# - containerName: "EC2-user-testuser-1234567890"
# - containerId: "abc123..."
# - resourceAllocation: { cpu: 0.5, ram: 1, ... }
```

---

### **Step 2: SSH to Server and Verify Container**

**SSH to EC2/EC3:**
```bash
# SSH to server (replace with your server IP)
ssh -i /path/to/key.pem ubuntu@<EC2_IP>

# Or for EC3
ssh -i /path/to/key.pem ubuntu@<EC3_IP>
```

**List Docker Containers:**
```bash
# List all running containers
docker ps

# Expected output:
# CONTAINER ID   IMAGE            COMMAND                  CREATED          STATUS          PORTS                    NAMES
# abc123def456   node:18-alpine   "sh -c 'apk add --n…"   2 minutes ago    Up 2 minutes    0.0.0.0:3000->80/tcp     EC2-user-testuser-1234567890

# Verify container name matches database
```

**Check Container Details:**
```bash
# Get container name from database (e.g., EC2-user-testuser-1234567890)
CONTAINER_NAME="EC2-user-testuser-1234567890"

# Inspect container
docker inspect $CONTAINER_NAME

# Check:
# - Memory limit: Should be 1GB (1073741824 bytes)
# - CPU shares: Should be 512 (0.5 * 1024)
# - Restart policy: "unless-stopped"
# - Status: "running"
```

**Verify PM2 is Installed:**
```bash
# Execute command inside container
docker exec $CONTAINER_NAME pm2 --version

# Expected output:
# 5.x.x (or latest PM2 version)

# List PM2 processes
docker exec $CONTAINER_NAME pm2 list

# Expected output:
# ┌────┬────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┐
# │ id │ name       │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │
# ├────┼────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┤
# │ 0  │ keepalive  │ default     │ N/A     │ fork    │ 123      │ 2m     │ 0    │ online    │ 0%       │ 10.0mb   │ root     │
# └────┴────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┘

# Should show "keepalive" process running
```

**Verify Container File Structure:**
```bash
# Check if /app directory exists
docker exec $CONTAINER_NAME ls -la /app

# Expected output:
# total 8
# drwxr-xr-x    2 root     root          4096 Dec 19 10:00 .
# drwxr-xr-x    1 root     root          4096 Dec 19 10:00 ..

# Check if /app/projects directory will be created
docker exec $CONTAINER_NAME mkdir -p /app/projects
docker exec $CONTAINER_NAME ls -la /app/projects

# Should be empty (no projects yet)
```

---

### **✅ TEST 1 VERIFICATION:**

- [ ] Container created with correct name
- [ ] Container running with correct resources (1GB RAM, 0.5 CPU)
- [ ] PM2 installed and working
- [ ] PM2 keepalive process running
- [ ] /app directory exists
- [ ] Container restart policy set

---

## 🔧 **TEST 2: Verify Project Deployment as PM2 Process**

### **Step 1: Create Test Project**

**Via API or Frontend:**
```bash
# Create a new project
# This should deploy to existing container as PM2 process
```

**Check Database:**
```bash
# Connect to MongoDB
mongo

# Find project
db.projects.findOne({ name: "My Test Project" })

# Should have:
# - containerName: "EC2-user-testuser-1234567890" (same as user)
# - port: 3001 (or other unique port)
# - server: "EC2"
# - processName: "project_id_here"
# - status: "running"
```

---

### **Step 2: Verify PM2 Process in Container**

**SSH to Server:**
```bash
ssh -i /path/to/key.pem ubuntu@<EC2_IP>

# Get container name
CONTAINER_NAME="EC2-user-testuser-1234567890"

# List PM2 processes
docker exec $CONTAINER_NAME pm2 list

# Expected output:
# ┌────┬──────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┐
# │ id │ name             │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │
# ├────┼──────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┤
# │ 0  │ keepalive        │ default     │ N/A     │ fork    │ 123      │ 10m    │ 0    │ online    │ 0%       │ 10.0mb   │
# │ 1  │ 67890abcdef123   │ default     │ 1.0.0   │ fork    │ 456      │ 2m     │ 0    │ online    │ 5%       │ 50.0mb   │
# └────┴──────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┘

# Should show project process (ID from database)
```

**Check Project Files:**
```bash
# Get project ID from database
PROJECT_ID="67890abcdef123"

# List project files
docker exec $CONTAINER_NAME ls -la /app/projects/$PROJECT_ID

# Expected output:
# total 100
# drwxr-xr-x    5 root     root          4096 Dec 19 10:05 .
# drwxr-xr-x    3 root     root          4096 Dec 19 10:05 ..
# -rw-r--r--    1 root     root          1234 Dec 19 10:05 package.json
# drwxr-xr-x  100 root     root          4096 Dec 19 10:05 node_modules
# -rw-r--r--    1 root     root          5678 Dec 19 10:05 server.js
# ... (other project files)

# Files should be present
```

**Check Process is Listening on Port:**
```bash
# Get port from database (e.g., 3001)
PORT=3001

# Check if port is listening inside container
docker exec $CONTAINER_NAME netstat -tlnp | grep $PORT

# Expected output:
# tcp        0      0 0.0.0.0:3001            0.0.0.0:*               LISTEN      456/node

# Or use ss command
docker exec $CONTAINER_NAME ss -tlnp | grep $PORT
```

**Test Project Accessibility:**
```bash
# From host machine, test if project responds
curl http://localhost:$PORT

# Should return project response
```

**Check PM2 Logs:**
```bash
# View PM2 logs for project
docker exec $CONTAINER_NAME pm2 logs $PROJECT_ID --lines 50

# Should show project startup logs
```

---

### **✅ TEST 2 VERIFICATION:**

- [ ] PM2 process created with project ID as name
- [ ] Project files copied to /app/projects/{projectId}/
- [ ] node_modules installed
- [ ] Process running and listening on port
- [ ] PM2 shows process as "online"
- [ ] Project accessible via port

---

## 🔧 **TEST 3: Verify Multiple Projects in Same Container**

### **Step 1: Create Second Project**

**Via API or Frontend:**
```bash
# Create another project for same user
```

**Check Database:**
```bash
# Both projects should have:
# - Same containerName
# - Different ports (3001, 3002)
# - Different processNames
```

---

### **Step 2: Verify Both PM2 Processes**

**SSH to Server:**
```bash
ssh -i /path/to/key.pem ubuntu@<EC2_IP>

CONTAINER_NAME="EC2-user-testuser-1234567890"

# List PM2 processes
docker exec $CONTAINER_NAME pm2 list

# Expected output:
# ┌────┬──────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┐
# │ id │ name             │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │
# ├────┼──────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┤
# │ 0  │ keepalive        │ default     │ N/A     │ fork    │ 123      │ 20m    │ 0    │ online    │ 0%       │ 10.0mb   │
# │ 1  │ project1_id      │ default     │ 1.0.0   │ fork    │ 456      │ 12m    │ 0    │ online    │ 5%       │ 50.0mb   │
# │ 2  │ project2_id      │ default     │ 1.0.0   │ fork    │ 789      │ 2m     │ 0    │ online    │ 3%       │ 40.0mb   │
# └────┴──────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┘

# Should show 3 processes: keepalive + 2 projects
```

**Check Resource Usage:**
```bash
# Check container resource usage
docker stats $CONTAINER_NAME --no-stream

# Expected output:
# CONTAINER ID   NAME                              CPU %     MEM USAGE / LIMIT     MEM %     NET I/O           BLOCK I/O
# abc123def456   EC2-user-testuser-1234567890     8.5%      100MiB / 1GiB         9.77%     1.2kB / 0B        0B / 0B

# Memory should be under 1GB limit
# CPU should be under 50% (0.5 CPU)
```

**Verify Both Projects Accessible:**
```bash
# Test project 1
curl http://localhost:3001

# Test project 2
curl http://localhost:3002

# Both should respond
```

---

### **✅ TEST 3 VERIFICATION:**

- [ ] Both projects in same container
- [ ] Both PM2 processes running
- [ ] Different ports (3001, 3002)
- [ ] Total memory under 1GB
- [ ] Both projects accessible
- [ ] Resources shared dynamically

---

## 🔧 **TEST 4: Verify Project Deletion**

### **Step 1: Delete Project**

**Via API or Frontend:**
```bash
# Delete one project
```

---

### **Step 2: Verify PM2 Process Removed**

**SSH to Server:**
```bash
ssh -i /path/to/key.pem ubuntu@<EC2_IP>

CONTAINER_NAME="EC2-user-testuser-1234567890"

# List PM2 processes
docker exec $CONTAINER_NAME pm2 list

# Expected output:
# ┌────┬──────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┐
# │ id │ name             │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │
# ├────┼──────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┤
# │ 0  │ keepalive        │ default     │ N/A     │ fork    │ 123      │ 30m    │ 0    │ online    │ 0%       │ 10.0mb   │
# │ 1  │ project2_id      │ default     │ 1.0.0   │ fork    │ 789      │ 12m    │ 0    │ online    │ 3%       │ 40.0mb   │
# └────┴──────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┘

# Deleted project should be gone
```

**Verify Files Removed:**
```bash
# Check if project directory removed
DELETED_PROJECT_ID="project1_id"

docker exec $CONTAINER_NAME ls -la /app/projects/$DELETED_PROJECT_ID

# Expected output:
# ls: /app/projects/project1_id: No such file or directory

# Files should be deleted
```

---

### **✅ TEST 4 VERIFICATION:**

- [ ] PM2 process stopped and deleted
- [ ] Project files removed
- [ ] Other projects still running
- [ ] Container still running

---

## 🔧 **TEST 5: Verify IP Restrictions**

### **Step 1: Create Multiple Free Accounts from Same IP**

**Create 3 accounts:**
```bash
# Account 1: test1@example.com
# Account 2: test2@example.com
# Account 3: test3@example.com
# All from same IP
```

**Check Database:**
```bash
mongo

# Count free accounts from IP
db.users.count({ signupIP: "192.168.1.1", planType: "free" })

# Should return: 3
```

---

### **Step 2: Try to Create Project with 4th Account**

**Create 4th account:**
```bash
# Account 4: test4@example.com (same IP)
```

**Try to create project:**
```bash
# Should be BLOCKED
# Error: "You have already used free resources multiple times..."
```

**Check Logs:**
```bash
# Backend logs should show:
# "Project creation blocked - IP free account limit"
```

---

### **✅ TEST 5 VERIFICATION:**

- [ ] First 3 accounts can create projects
- [ ] 4th account blocked from creating projects
- [ ] Error message shown
- [ ] Upgrade prompt displayed

---

## 📊 **COMPLETE TEST CHECKLIST:**

### **Container Creation:**
- [ ] Container created on signup
- [ ] Correct name format
- [ ] PM2 installed
- [ ] Resource limits set
- [ ] Restart policy configured

### **Project Deployment:**
- [ ] PM2 process created
- [ ] Files copied to container
- [ ] Dependencies installed
- [ ] Process listening on port
- [ ] Database updated

### **Multiple Projects:**
- [ ] Multiple PM2 processes in same container
- [ ] Different ports
- [ ] Resources shared
- [ ] All accessible

### **Project Deletion:**
- [ ] PM2 process stopped
- [ ] PM2 process deleted
- [ ] Files removed
- [ ] Database cleaned

### **IP Restrictions:**
- [ ] Counts free accounts correctly
- [ ] Blocks after limit
- [ ] Shows upgrade message
- [ ] Paid accounts exempt

---

## 🎯 **QUICK TEST COMMANDS:**

```bash
# 1. SSH to server
ssh -i /path/to/key.pem ubuntu@<SERVER_IP>

# 2. List containers
docker ps

# 3. Get container name (from database or docker ps)
CONTAINER_NAME="EC2-user-testuser-1234567890"

# 4. Check PM2 processes
docker exec $CONTAINER_NAME pm2 list

# 5. Check container resources
docker stats $CONTAINER_NAME --no-stream

# 6. Check project files
docker exec $CONTAINER_NAME ls -la /app/projects/

# 7. Check PM2 logs
docker exec $CONTAINER_NAME pm2 logs --lines 50

# 8. Test project accessibility
curl http://localhost:3001
```

---

## ✅ **SUCCESS CRITERIA:**

**All tests pass:** ✅  
**Container logic works:** ✅  
**PM2 processes work:** ✅  
**Resource sharing works:** ✅  
**IP restrictions work:** ✅  

---

**READY TO TEST!** 🧪🚀
