# Multi-Server Container Orchestration - Complete Setup Guide

## 🎯 Architecture Overview

```
EC2-1 (Control Plane)          EC2-2 (Free Users)           EC2-3+ (Paid Users)
┌─────────────────────┐        ┌────────────────────┐       ┌─────────────────────┐
│ ┌─────────────────┐ │        │ ┌────────────────┐ │       │ ┌─────────────────┐ │
│ │  Frontend       │ │        │ │ Container      │ │       │ │ Container       │ │
│ │  (React)        │ │        │ │ Agent          │ │       │ │ Agent           │ │
│ └─────────────────┘ │        │ │ (Port 3001)    │ │       │ │ (Port 3001)     │ │
│                     │        │ └────────────────┘ │       │ └─────────────────┘ │
│ ┌─────────────────┐ │   ──── │ ┌────────────────┐ │       │ ┌─────────────────┐ │
│ │  Backend API    │ │        │ │ Shared         │ │       │ │ User-1          │ │
│ │  + Orchestrator │ │        │ │ Container      │ │       │ │ Container       │ │
│ └─────────────────┘ │        │ │ (All Free      │ │       │ └─────────────────┘ │
│                     │        │ │  Users)        │ │       │ ┌─────────────────┐ │
│ ┌─────────────────┐ │        │ └────────────────┘ │       │ │ User-2          │ │
│ │  MongoDB        │ │        │                    │       │ │ Container       │ │
│ └─────────────────┘ │        └────────────────────┘       │ └─────────────────┘ │
└─────────────────────┘                                     │ ┌─────────────────┐ │
                                                            │ │ User-N          │ │
                                                            │ │ Container       │ │
                                                            │ └─────────────────┘ │
                                                            └─────────────────────┘
```

## 🚀 What This Setup Provides

✅ **Cost-Effective Scaling**: Free users share resources, paid users get dedicated containers  
✅ **Automatic User Assignment**: Users automatically assigned to appropriate servers based on plan  
✅ **Functional Programming**: Clean, testable code using pure functions  
✅ **Easy Horizontal Scaling**: Add more EC2 instances as needed  
✅ **Resource Isolation**: Each paid user gets guaranteed resources  
✅ **High Availability**: Distributed across multiple servers  

## 📁 Key Files Created/Updated

### New Files:
- **`services/containerOrchestrator.js`** - Functional container assignment logic
- **`container-host-agent.js`** - Single agent file for EC2-2/EC2-3+
- **`deploy-container-host.sh`** - Automated deployment script for container hosts
- **`SETUP.md`** - Complete deployment guide

### Updated Files:
- **`backend/routes/auth.js`** - Integrated container assignment on registration
- **`backend/package.json`** - Added node-fetch and bcrypt dependencies
- **`backend/.env.example`** - Updated MongoDB URI and added server host variables

## 🔧 How Everything Works

### 1. User Registration Flow (Functional)
```javascript
// When user registers (GitHub OAuth or direct)
const user = createUser(userData) 
  |> saveToDatabase
  |> (user) => assignUserToServer(user._id, user.plan)
  |> logResult
```

### 2. Container Assignment Logic (Pure Functions)
```javascript
// Free users → Shared container on EC2-2
const assignFreeUser = (userId) => 
  sendCommandToServer('EC2-2')({
    action: 'add_user_to_shared',
    userId,
    resources: { cpu: 0.1, memory: '128m' }
  });

// Paid users → Dedicated container on best available EC2-3+
const assignPaidUser = (userId, plan) =>
  findBestServer(plan)
    |> sendCommandToServer
    |> (sender) => sender({
        action: 'create_dedicated_container',
        userId,
        config: createContainerConfig(userId, plan)
      });
```

### 3. Container Host Agent (EC2-2/EC2-3+)
```javascript
// Single file that handles all container operations
const handlers = {
  'add_user_to_shared': addUserToSharedContainer,
  'create_dedicated_container': createDedicatedContainer,
  'remove_user_container': removeUserContainer
};

app.post('/container-command', (req, res) => {
  const { action, userId, config } = req.body;
  const result = handlers[action](userId, config);
  res.json(result);
});
```

## 🏗️ Deployment Steps

### Step 1: Deploy EC2-1 (Control Plane)
```bash
# On EC2-1, clone complete repository
git clone https://github.com/yourusername/vercel-clone-platform.git
cd vercel-clone-platform

# Start MongoDB
./setup-mongodb.ps1 start

# Install backend dependencies
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings including:
# FREE_SERVER_HOST=10.0.1.100    # EC2-2 private IP
# PAID_SERVER_1_HOST=10.0.1.101  # EC2-3 private IP

# Start backend
npm run dev
```

### Step 2: Deploy EC2-2 (Free Users Host)
```bash
# On EC2-2, run deployment script
curl -o deploy-container-host.sh https://raw.githubusercontent.com/yourusername/vercel-clone-platform/main/deploy-container-host.sh
chmod +x deploy-container-host.sh
./deploy-container-host.sh

# Select option 1 (Free users server)
# This creates shared container + agent service
```

### Step 3: Deploy EC2-3+ (Paid Users Hosts)
```bash
# On EC2-3+, run same deployment script
curl -o deploy-container-host.sh https://raw.githubusercontent.com/yourusername/vercel-clone-platform/main/deploy-container-host.sh
chmod +x deploy-container-host.sh
./deploy-container-host.sh

# Select option 2 (Paid users server)
# This creates agent service only (no shared container)
```

### Step 4: Configure Security Groups
```bash
# EC2-1: Allow inbound 5000, 8081, 27017 (MongoDB if needed)
# EC2-2/EC2-3+: Allow inbound 3001 from EC2-1 private IP only
```

## 🧪 Testing the Setup

### Test 1: Verify Container Hosts
```bash
# From EC2-1, test connection to container hosts
curl http://10.0.1.100:3001/health  # EC2-2
curl http://10.0.1.101:3001/health  # EC2-3

# Should return: {"status":"healthy","timestamp":"...","agent":"container-host-agent"}
```

### Test 2: Register Free User
```bash
curl -X POST http://your-domain:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"free@example.com","password":"password123","plan":"free"}'

# Response should include containerAssignment with serverId: "free-server"
```

### Test 3: Register Paid User
```bash
curl -X POST http://your-domain:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"pro@example.com","password":"password123","plan":"pro"}'

# Response should include containerAssignment with serverId: "paid-server-1"
```

### Test 4: Verify Container Creation
```bash
# On EC2-2, check shared container
docker exec shared-free-container ls -la /app/users/
# Should show directory for free user

# On EC2-3, check dedicated containers
docker ps | grep user-.*-container
# Should show dedicated container for paid user
```

## 📊 Monitoring & Management

### Check System Health
```bash
# EC2-1: Backend status
curl http://localhost:5000/health

# EC2-2/EC2-3+: Container agent status
curl http://localhost:3001/stats
```

### View Logs
```bash
# EC2-1: Backend logs
cd backend && npm run logs

# EC2-2/EC2-3+: Agent logs
sudo journalctl -u container-agent -f
```

### Scaling (Add EC2-4, EC2-5...)
```bash
# 1. Deploy new EC2 instance with deploy-container-host.sh
# 2. Update EC2-1 environment variables:
echo "PAID_SERVER_2_HOST=10.0.1.103" >> backend/.env
# 3. Restart backend
cd backend && npm restart
```

## 🛠️ Running Commands Summary

### EC2-1 (Control Plane):
- **Setup**: Clone full repository + `npm install` + `npm run dev`
- **Files**: Complete project with frontend, backend, MongoDB
- **Processes**: Backend server, MongoDB, container orchestrator

### EC2-2 (Free Users Host):
- **Setup**: `./deploy-container-host.sh` (option 1)
- **Files**: `container-host-agent.js` only
- **Processes**: `node container-host-agent.js` (systemd service)
- **Containers**: One shared container for all free users

### EC2-3+ (Paid Users Hosts):
- **Setup**: `./deploy-container-host.sh` (option 2)  
- **Files**: `container-host-agent.js` only
- **Processes**: `node container-host-agent.js` (systemd service)
- **Containers**: Dedicated containers created dynamically per paid user

## 🔄 User Journey

1. **User visits your frontend** → Hosted on EC2-1
2. **User registers/logs in** → Backend on EC2-1 handles auth
3. **Container assignment happens** → Orchestrator assigns user to appropriate server
4. **User gets workspace** → Either shared (free) or dedicated (paid) container
5. **User deploys projects** → Container executes builds in isolated environment
6. **User upgrades plan** → Automatic migration to dedicated container

## ⚙️ Environment Variables Reference

### EC2-1 Backend (.env)
```env
# Basic
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin

# Container Hosts (Private IPs)
FREE_SERVER_HOST=10.0.1.100
PAID_SERVER_1_HOST=10.0.1.101
PAID_SERVER_2_HOST=10.0.1.102

# OAuth & Payments
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-secret
PAYONEER_CLIENT_ID=your-payoneer-id

# Security
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret
```

### EC2-2/EC2-3+ (No environment needed)
The container agent is stateless and receives all configuration from EC2-1.

## 🚨 Troubleshooting

### Container Agent Won't Start
```bash
sudo systemctl status container-agent
sudo journalctl -u container-agent -n 50
```

### Users Not Getting Assigned
```bash
# Check connectivity
ping 10.0.1.100  # from EC2-1 to EC2-2

# Check backend logs
cd backend && npm run logs

# Verify environment variables
grep SERVER_HOST backend/.env
```

### MongoDB Issues
```bash
./setup-mongodb.ps1 status
docker exec -it vercel-clone-mongodb mongosh -u admin -p password123
```

## 🎉 Success Indicators

When everything is working correctly, you should see:

✅ MongoDB running on EC2-1 (port 27017)  
✅ Backend API running on EC2-1 (port 5000)  
✅ Container agents running on all EC2-2/EC2-3+ (port 3001)  
✅ Shared container on EC2-2 (for free users)  
✅ Dedicated containers created dynamically on EC2-3+ (for paid users)  
✅ Users automatically assigned to appropriate servers based on their plan  
✅ All communication happening via private IPs (secure)  

Your **Vercel Clone Platform** is now ready for production with horizontal scaling! 🚀
