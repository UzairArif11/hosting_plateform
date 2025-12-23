# 🔍 LIVE MONITORING GUIDE

**Backend Status:** ✅ RUNNING  
**Command ID:** 00b79844-b386-47c1-9bfe-507a80901fac

---

## 📊 **WHAT TO WATCH FOR:**

### **When User Signs Up:**

Look for these logs in sequence:

```
🚀 [CREATE_CONTAINER] Starting user container creation
  user: test@example.com
  container: EC2-user-testuser-1234567890
  server: EC2
  resources: { cpu: 0.5, ram: 1, ... }

🐳 [CREATE_CONTAINER] Calling docker.runContainer with node:18-alpine

🔍 [CREATE_CONTAINER] Docker runContainer result:
  success: true
  containerId: abc123...
  containerName: EC2-user-testuser-1234567890

✅ [CREATE_CONTAINER] User container created successfully
```

**Expected:** Container created with PM2 installed

---

### **When User Creates Project:**

Look for these logs in sequence:

```
🚀 [DEPLOY_PROJECT] Starting PM2 deployment
  user: test@example.com
  project: My Test Project
  projectId: 67890abcdef...
  container: EC2-user-testuser-1234567890
  port: 3001
  buildPath: /tmp/build-...

🔐 [DEPLOY_PROJECT] Connecting via SSH to server

📁 [DEPLOY_PROJECT] Creating project directory:
  projectPath: /app/projects/67890abcdef...

📦 [DEPLOY_PROJECT] Copying files to container via tar

📚 [DEPLOY_PROJECT] Installing npm dependencies

🎯 [DEPLOY_PROJECT] Starting PM2 process
  PM2 command: docker exec EC2-user-testuser-1234567890 pm2 start ...

💾 [DEPLOY_PROJECT] Saving PM2 process list

✅ [DEPLOY_PROJECT] Project deployed successfully as PM2 process
  port: 3001
  processName: 67890abcdef...
```

**Expected:** Project deployed as PM2 process in existing container

---

## 🎯 **TESTING STEPS:**

### **Step 1: Login as Free User**

1. Open frontend: http://localhost:3000
2. Login with free account
3. **Watch logs for:** User authentication

---

### **Step 2: Create New Project**

1. Click "Create Project"
2. Enter project details
3. Click "Deploy"

**Watch logs for:**
- ✅ Container check (should find existing container)
- ✅ PM2 deployment start
- ✅ SSH connection
- ✅ File copy
- ✅ npm install
- ✅ PM2 start
- ✅ Success message

---

### **Step 3: Verify Deployment**

**Check logs for:**
```
✅ [DEPLOY_PROJECT] Project deployed successfully
```

**Then SSH to server:**
```bash
ssh -i /path/to/key.pem ubuntu@SERVER_IP

# List containers
docker ps

# Check PM2 processes
docker exec CONTAINER_NAME pm2 list

# Should show your project running
```

---

## ❌ **COMMON ERRORS TO WATCH FOR:**

### **Error 1: Container Creation Failed**
```
❌ [CREATE_CONTAINER] Failed to create container
```
**Fix:** Check Docker is running on server

---

### **Error 2: SSH Connection Failed**
```
❌ [DEPLOY_PROJECT] Failed to connect via SSH
```
**Fix:** Check SSH keys and server access

---

### **Error 3: PM2 Start Failed**
```
❌ [DEPLOY_PROJECT] PM2 start failed
```
**Fix:** Check project has server.js and dependencies

---

## 📝 **MONITORING COMMANDS:**

### **View Real-time Logs:**
```powershell
# In PowerShell
Get-Content d:\work\platform\backend\logs\combined.log -Wait -Tail 50
```

### **Filter for Container Logs:**
```powershell
Get-Content d:\work\platform\backend\logs\combined.log -Wait | Select-String "CREATE_CONTAINER"
```

### **Filter for Deployment Logs:**
```powershell
Get-Content d:\work\platform\backend\logs\combined.log -Wait | Select-String "DEPLOY_PROJECT"
```

---

## ✅ **SUCCESS INDICATORS:**

### **Container Creation:**
- [ ] Log shows "Starting user container creation"
- [ ] Log shows "Docker runContainer result: success: true"
- [ ] Log shows "User container created successfully"
- [ ] Database updated with containerName and containerId

### **Project Deployment:**
- [ ] Log shows "Starting PM2 deployment"
- [ ] Log shows "SSH connected successfully"
- [ ] Log shows "PM2 start result: code: 0"
- [ ] Log shows "Project deployed successfully"
- [ ] Database updated with port and processName

---

## 🎯 **NEXT STEPS:**

1. ✅ Backend is running
2. ⏳ Login as free user
3. ⏳ Create project
4. ⏳ Watch logs
5. ⏳ Verify deployment
6. ⏳ SSH to server and check PM2

---

**READY TO TEST!** 🚀

**Watch the logs and tell me what you see!**
