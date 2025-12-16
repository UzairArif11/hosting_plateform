# 🧪 TESTING GUIDE - Vercel Clone Platform

Complete guide for testing all backend functionality and using the Postman collection.

---

## 📋 TABLE OF CONTENTS

1. [Prerequisites](#prerequisites)
2. [Backend Testing](#backend-testing)
3. [Postman Collection Usage](#postman-collection-usage)
4. [Manual Testing Steps](#manual-testing-steps)
5. [Automated Tests](#automated-tests)
6. [Common Issues](#common-issues)

---

## 🔧 PREREQUISITES

### **Required Services**

```bash
# 1. MongoDB
docker run -d -p 27017:27017 --name mongodb mongo

# 2. Redis
docker run -d -p 6379:6379 --name redis redis

# 3. Docker (for builds)
# Make sure Docker is running
docker ps
```

### **Environment Setup**

```bash
# Backend .env
cd backend
cp .env.example .env
# Edit .env with your credentials
```

**Required credentials**:
- ✅ `GITHUB_API_TOKEN` - Your GitHub personal access token
- ✅ `GITHUB_CLIENT_ID` - GitHub OAuth app client ID
- ✅ `GITHUB_CLIENT_SECRET` - GitHub OAuth app secret
- ⚠️ `GOOGLE_CLIENT_ID` - (Optional) Google OAuth
- ⚠️ `GOOGLE_CLIENT_SECRET` - (Optional) Google OAuth

---

## 🧪 BACKEND TESTING

### **1. Verify Backend Setup**

```bash
cd backend

# Install dependencies
npm install

# Run verification script
node verify-backend.js
```

**Expected output**:
```
✅ All files exist
✅ All imports valid
✅ All dependencies installed
✅ No syntax errors
✅ Backend is ready!
```

### **2. Start Backend**

```bash
# Development mode
npm run dev

# Production mode
npm start
```

**Expected output**:
```
✅ MongoDB connected
✅ Redis connected
✅ Server running on port 5000
✅ Socket.IO initialized
```

### **3. Test Health Endpoint**

```bash
curl http://localhost:5000/health
```

**Expected response**:
```json
{
  "status": "ok",
  "timestamp": "2025-11-21T10:00:00.000Z",
  "services": {
    "mongodb": "connected",
    "redis": "connected"
  }
}
```

---

## 📮 POSTMAN COLLECTION USAGE

### **1. Import Collection**

1. Open Postman
2. Click "Import"
3. Select `Vercel_Clone_Platform.postman_collection.json`
4. Collection imported! ✅

### **2. Setup Environment**

Create a new environment with these variables:

```
base_url = http://localhost:5000
jwt_token = (will be set automatically after login)
project_id = (will be set automatically after creating project)
deployment_id = (will be set automatically after deployment)
```

### **3. Authentication Flow**

**Step 1: Login via Browser**

Since OAuth requires browser interaction, you need to:

1. Open browser
2. Go to: `http://localhost:5000/api/auth/github`
3. Authorize with GitHub
4. You'll be redirected to frontend with cookies set

**Step 2: Get JWT Token**

After OAuth login, open browser console and run:

```javascript
// Get cookies
document.cookie
```

Or use the "Get Current User" endpoint in Postman (cookies will be sent automatically).

### **4. Testing Workflow**

**Complete Test Flow**:

```
1. Authentication
   └─ GET /api/auth/me (verify login)

2. Create Project
   └─ POST /api/projects
   └─ (project_id auto-saved)

3. Get Project
   └─ GET /api/projects/:id

4. Create Deployment
   └─ POST /api/deployments
   └─ (deployment_id auto-saved)

5. Watch Deployment
   └─ GET /api/deployments/:id
   └─ GET /api/deployments/:id/logs

6. Check Billing
   └─ GET /api/billing/plans

7. Admin (if admin user)
   └─ GET /api/admin/stats
   └─ GET /api/admin/servers
```

---

## 🔍 MANUAL TESTING STEPS

### **Test 1: Authentication**

```bash
# 1. GitHub OAuth (Browser)
Open: http://localhost:5000/api/auth/github

# 2. Get current user
curl http://localhost:5000/api/auth/me \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"

# Expected: User object with GitHub info
```

### **Test 2: Create Project**

```bash
curl -X POST http://localhost:5000/api/projects \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{
    "name": "test-project",
    "repository": {
      "url": "https://github.com/username/repo",
      "owner": "username",
      "name": "repo",
      "branch": "main"
    },
    "framework": "nextjs"
  }'

# Expected: 201 Created with project object
```

### **Test 3: Create Deployment**

```bash
curl -X POST http://localhost:5000/api/deployments \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{
    "projectId": "PROJECT_ID_HERE",
    "branch": "main"
  }'

# Expected: 201 Created with deployment object
# Build will start in background
```

### **Test 4: Watch Deployment Logs**

```bash
# Get deployment status
curl http://localhost:5000/api/deployments/DEPLOYMENT_ID \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"

# Get deployment logs
curl http://localhost:5000/api/deployments/DEPLOYMENT_ID/logs \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"

# Expected: Array of log lines
```

### **Test 5: Billing**

```bash
# List plans
curl http://localhost:5000/api/billing/plans \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"

# Expected: Array of plans (Free, Starter, Pro, Enterprise)
```

### **Test 6: Admin (Admin users only)**

```bash
# Get platform stats
curl http://localhost:5000/api/admin/stats \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"

# Get server status
curl http://localhost:5000/api/admin/servers \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"

# Expected: Server info for EC1, EC2, EC3
```

---

## 🤖 AUTOMATED TESTS

### **Run All Tests**

```bash
cd backend
npm test
```

### **Test Coverage**

```bash
npm run test:coverage
```

### **Test Specific Module**

```bash
# Test auth
npm test -- auth

# Test projects
npm test -- projects

# Test deployments
npm test -- deployments
```

---

## 🔥 REAL DEPLOYMENT TEST

### **Test Complete Deployment Flow**

**Prerequisites**:
- Have a real GitHub repository
- Repository should have a `package.json`
- Framework should be supported (Next.js, React, etc.)

**Steps**:

1. **Create Project** (via Postman or curl)
   ```json
   {
     "name": "my-nextjs-app",
     "repository": {
       "url": "https://github.com/yourusername/your-nextjs-repo",
       "owner": "yourusername",
       "name": "your-nextjs-repo",
       "branch": "main"
     }
   }
   ```

2. **Trigger Deployment**
   ```json
   {
     "projectId": "PROJECT_ID_FROM_STEP_1",
     "branch": "main"
   }
   ```

3. **Watch Build Progress**
   - Check deployment status every 5 seconds
   - Watch logs in real-time
   - Wait for status: "success" or "failed"

4. **Verify Deployment**
   - If successful, deployment URL will be provided
   - Visit URL to see your deployed app
   - Check Docker containers: `docker ps`

---

## 📊 TESTING CHECKLIST

### **Authentication** ✅
- [ ] GitHub OAuth login works
- [ ] Google OAuth login works (if configured)
- [ ] JWT tokens are issued
- [ ] Session cookies are set
- [ ] Logout works
- [ ] Token refresh works

### **Projects** ✅
- [ ] Can create project
- [ ] Can list projects
- [ ] Can get project details
- [ ] Can update project
- [ ] Can delete project
- [ ] Framework detection works

### **Deployments** ✅
- [ ] Can create deployment
- [ ] Build queue processes jobs
- [ ] Repository cloning works
- [ ] Dependency installation works
- [ ] Build execution works
- [ ] Docker image creation works
- [ ] Container deployment works
- [ ] Logs are captured
- [ ] Status updates work
- [ ] Can cancel deployment

### **Billing** ✅
- [ ] Can list plans
- [ ] Can subscribe to plan
- [ ] Payment processing works
- [ ] Resource allocation updates
- [ ] Trial period works

### **Admin** ✅
- [ ] Can view platform stats
- [ ] Can view all users
- [ ] Can view server status
- [ ] Can allocate resources
- [ ] Can track payments

### **Real-time** ✅
- [ ] Socket.IO connects
- [ ] Deployment logs stream
- [ ] Status updates broadcast
- [ ] Notifications work

---

## 🐛 COMMON ISSUES

### **Issue 1: MongoDB Connection Failed**

**Error**: `MongoNetworkError: connect ECONNREFUSED`

**Solution**:
```bash
# Start MongoDB
docker run -d -p 27017:27017 --name mongodb mongo

# Or if using local MongoDB
sudo systemctl start mongod
```

### **Issue 2: Redis Connection Failed**

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution**:
```bash
# Start Redis
docker run -d -p 6379:6379 --name redis redis

# Or if using local Redis
sudo systemctl start redis
```

### **Issue 3: GitHub API Token Invalid**

**Error**: `401 Unauthorized`

**Solution**:
```bash
# Test your token
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.github.com/user

# If fails, regenerate token at:
# https://github.com/settings/tokens
```

### **Issue 4: Docker Permission Denied**

**Error**: `Error: connect EACCES /var/run/docker.sock`

**Solution**:
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Restart session
newgrp docker
```

### **Issue 5: Build Fails**

**Error**: `Build failed: npm install failed`

**Solution**:
- Check repository has `package.json`
- Check GitHub token has repo access
- Check Docker is running
- Check build logs for specific error

---

## 📈 PERFORMANCE TESTING

### **Load Testing**

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test API endpoint
ab -n 1000 -c 10 http://localhost:5000/api/auth/me

# Expected: < 100ms average response time
```

### **Stress Testing**

```bash
# Create multiple deployments simultaneously
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/deployments \
    -H "Content-Type: application/json" \
    -d '{"projectId":"PROJECT_ID","branch":"main"}' &
done

# Monitor queue
redis-cli LLEN bull:build-queue:wait
```

---

## ✅ SUCCESS CRITERIA

### **Backend is working if**:
- ✅ All services connect (MongoDB, Redis, Docker)
- ✅ Authentication works (GitHub/Google OAuth)
- ✅ Projects can be created
- ✅ Deployments execute successfully
- ✅ Real-time logs stream via Socket.IO
- ✅ Docker containers are created
- ✅ Admin endpoints return data
- ✅ No errors in console

### **Production ready if**:
- ✅ All tests pass
- ✅ No memory leaks
- ✅ Response times < 200ms
- ✅ Error rate < 1%
- ✅ Uptime > 99%
- ✅ Security headers present
- ✅ Rate limiting works

---

## 🎯 NEXT STEPS

After successful testing:

1. **Deploy to Staging**
   - Setup Oracle Cloud servers
   - Deploy backend to EC1
   - Deploy frontend to Vercel/Netlify

2. **Monitor**
   - Setup logging (Winston)
   - Setup monitoring (PM2)
   - Setup alerts

3. **Optimize**
   - Add caching
   - Optimize queries
   - Add CDN

4. **Scale**
   - Add more servers
   - Setup load balancer
   - Add database replication

---

## 📞 SUPPORT

If you encounter issues:

1. Check logs: `pm2 logs` or `docker logs`
2. Check this guide's Common Issues section
3. Check GitHub Issues
4. Contact support

---

**Happy Testing! 🚀**

**All 67 endpoints are ready to test!**
