# 🚀 SIMPLE ORACLE CLOUD SETUP - Just Add IPs!

**Question:** When a user registers, how do they get assigned to Oracle Cloud containers?  
**Answer:** Automatically! Just add Oracle IPs to `.env` and it works!

---

## ✅ HOW IT WORKS (AUTOMATIC!)

### When User Registers:

```
1. User clicks "Login with GitHub/Google"
        ↓
2. OAuth completes, account created
        ↓
3. Backend calls: assignUserToServer(userId, 'free-trial')
        ↓
4. Container Orchestrator:
   - Checks if EC2 or EC3 has more capacity
   - Chooses best server (load balanced)
   - Creates SHARED container on Oracle Cloud
   - Assigns resource limits (0.2 CPU, 1.2GB RAM)
   - Updates user record with server assignment
        ↓
5. User is ready! Container running on Oracle!
```

**This happens AUTOMATICALLY during registration!**

---

## 🔧 SIMPLE SETUP (3 STEPS!)

### Step 1: Get Oracle Cloud VMs

1. **Sign up for Oracle Cloud Free Tier:**
   - https://www.oracle.com/cloud/free/
   - Get 2 free ARM VMs (Always Free!)

2. **Create 2 VMs:**
   - **VM 1 (EC2):** 2 OCPU, 12GB RAM
   - **VM 2 (EC3):** 4 OCPU, 24GB RAM

3. **Note the Public IPs:**
   - EC2 IP: e.g., `150.136.XX.XX`
   - EC3 IP: e.g., `150.136.YY.YY`

---

### Step 2: Install Docker on Oracle VMs

**SSH into each VM and run:**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install docker.io -y

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Enable Docker Remote API
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo nano /etc/systemd/system/docker.service.d/override.conf
```

**Add this content:**
```
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2376
```

**Then:**
```bash
# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart docker

# Test
docker ps
```

**Repeat for both EC2 and EC3!**

---

### Step 3: Update Backend .env

**That's it! Just add the IPs:**

```env
# Oracle Cloud Servers
EC2_SERVER_IP=150.136.XX.XX
EC3_SERVER_IP=150.136.YY.YY

# Optional: Customize resources
EC2_TOTAL_CPU=2
EC2_TOTAL_RAM=12
EC2_MAX_CONTAINERS=200

EC3_TOTAL_CPU=4
EC3_TOTAL_RAM=24
EC3_MAX_CONTAINERS=300
```

**Restart backend:**
```powershell
cd backend
npm run dev
```

**DONE! That's all you need!**

---

## 🎯 HOW TO VERIFY IT'S WORKING

### Test 1: Check Connection

**In backend console or create a test script:**

```javascript
// backend/test-oracle.js
const docker = require('./services/docker');

async function testOracle() {
  console.log('Testing EC2 connection...');
  const ec2 = await docker.listContainers(process.env.EC2_SERVER_IP);
  console.log('EC2:', ec2.success ? '✅ Connected!' : '❌ Failed');
  
  console.log('Testing EC3 connection...');
  const ec3 = await docker.listContainers(process.env.EC3_SERVER_IP);
  console.log('EC3:', ec3.success ? '✅ Connected!' : '❌ Failed');
}

testOracle();
```

**Run:**
```powershell
cd backend
node test-oracle.js
```

**Expected:**
```
Testing EC2 connection...
EC2: ✅ Connected!
Testing EC3 connection...
EC3: ✅ Connected!
```

---

### Test 2: Register a New User

**Steps:**
1. Go to http://localhost:3000/login
2. Click "Login with GitHub"
3. Complete OAuth
4. **Check backend logs:**

**You should see:**
```
✅ MongoDB connected successfully
🔗 Database: vercel_clone
🚀 Server running on port 5000
New user registered via GitHub
User assigned to EC2 (shared server)
Shared container allocated
Container: EC2-shared-user-testuser-1234567890
```

---

### Test 3: Check Container on Oracle

**SSH into Oracle VM:**
```bash
ssh ubuntu@150.136.XX.XX

# List containers
docker ps

# Should see:
# EC2-shared-user-testuser-1234567890
```

**Check user in database:**
```javascript
// In backend console or MongoDB
db.users.findOne({ username: 'testuser' })

// Should show:
{
  username: 'testuser',
  oracleAccountId: 'EC2',  // ← Assigned!
  containerType: 'shared',  // ← Shared container!
  resourceAllocation: {
    cpu: 0.2,               // ← 10% cap
    ram: 1.2,               // ← 1.2GB cap
    // ...
  }
}
```

---

## 📊 WHAT HAPPENS AUTOMATICALLY

### For Free Users:

```
Registration
    ↓
assignUserToServer('free-trial')
    ↓
chooseBestServerForUser('shared')
    ↓
Checks EC2 vs EC3 capacity
    ↓
Chooses server with more space
    ↓
allocateSharedContainer()
    ↓
Creates container on Oracle Cloud:
  - Name: EC2-shared-user-USERNAME-TIMESTAMP
  - CPU: 0.2 OCPU (10% cap)
  - RAM: 1.2GB (10% cap)
  - Storage: 10GB
  - Bandwidth: 100GB/month
    ↓
Updates user record:
  - oracleAccountId: 'EC2' or 'EC3'
  - containerType: 'shared'
  - resourceAllocation: { cpu: 0.2, ram: 1.2, ... }
    ↓
User ready to deploy projects!
```

---

## 🎮 USER EXPERIENCE

### What Users See:

1. **Register/Login** - Normal OAuth flow
2. **Dashboard loads** - Sees "Trial Plan" status
3. **Can create projects** - Up to 10 projects
4. **Can deploy** - Deployments go to their Oracle container
5. **Resource limits enforced** - Can't exceed 10% of server

### What Happens Behind the Scenes:

1. **Container created** on Oracle Cloud (EC2 or EC3)
2. **Resource limits set** via cgroups
3. **Load balanced** between EC2 and EC3
4. **Monitored** in real-time
5. **Auto-scaled** if they upgrade to paid plan

---

## 🔍 MONITORING CONTAINERS

### Check All Containers:

```bash
# On EC2
ssh ubuntu@EC2_IP "docker ps"

# On EC3
ssh ubuntu@EC3_IP "docker ps"
```

### Check Specific User:

```bash
# Find user's container
ssh ubuntu@EC2_IP "docker ps | grep testuser"

# Get container stats
ssh ubuntu@EC2_IP "docker stats EC2-shared-user-testuser-123"
```

### Via Admin Panel:

1. Login as admin
2. Go to `/admin/servers`
3. See real-time stats:
   - Total containers
   - CPU/RAM usage
   - Server health

---

## ⚙️ CONFIGURATION OPTIONS

### Minimal (Just IPs):
```env
EC2_SERVER_IP=150.136.XX.XX
EC3_SERVER_IP=150.136.YY.YY
```

### Full Configuration:
```env
# EC2 Server
EC2_SERVER_IP=150.136.XX.XX
EC2_TOTAL_CPU=2
EC2_TOTAL_RAM=12
EC2_MAX_CONTAINERS=200

# EC3 Server
EC3_SERVER_IP=150.136.YY.YY
EC3_TOTAL_CPU=4
EC3_TOTAL_RAM=24
EC3_MAX_CONTAINERS=300

# Docker
DOCKER_PORT=2376

# Optional: EC1 (Main API server)
EC1_SERVER_IP=your-main-server-ip
```

---

## 🚨 TROUBLESHOOTING

### Issue: "Cannot connect to Oracle Docker"

**Check 1: Docker Remote API enabled?**
```bash
ssh ubuntu@EC2_IP "sudo systemctl status docker"
```

**Check 2: Port 2376 open?**
```bash
# On Oracle VM
sudo ufw allow 2376/tcp
sudo ufw reload
```

**Check 3: Can ping from local?**
```powershell
Test-NetConnection -ComputerName EC2_IP -Port 2376
```

---

### Issue: "User not assigned to server"

**Check backend logs:**
```
Look for: "User assigned to EC2" or "User assigned to EC3"
```

**If missing:**
1. Check .env has EC2_SERVER_IP and EC3_SERVER_IP
2. Restart backend
3. Try registering again

---

### Issue: "Container not created"

**Check Oracle VM:**
```bash
ssh ubuntu@EC2_IP
docker ps -a  # Show all containers including stopped
docker logs CONTAINER_NAME  # Check logs
```

**Common causes:**
- Docker not running
- Port conflicts
- Resource limits

---

## ✅ VERIFICATION CHECKLIST

- [ ] Oracle Cloud VMs created (EC2, EC3)
- [ ] Docker installed on both VMs
- [ ] Docker Remote API enabled
- [ ] Port 2376 open in firewall
- [ ] IPs added to backend/.env
- [ ] Backend restarted
- [ ] Test connection successful
- [ ] New user registers
- [ ] Container created on Oracle
- [ ] User assigned to EC2 or EC3
- [ ] Can see container with `docker ps`

---

## 🎉 SUMMARY

### What You Need:
1. ✅ 2 Oracle Cloud VMs (Free!)
2. ✅ Docker installed on VMs
3. ✅ Public IPs added to .env
4. ✅ Restart backend

### What Happens Automatically:
1. ✅ User registers
2. ✅ Container created on Oracle
3. ✅ Resources allocated
4. ✅ Load balanced between EC2/EC3
5. ✅ User ready to deploy!

### No Additional Configuration Needed!
- ❌ No complex networking
- ❌ No VPN setup
- ❌ No manual container creation
- ❌ No database changes

**Just add IPs and it works!** 🚀

---

**Status:** ✅ **Ready to deploy to Oracle Cloud!**  
**Setup Time:** 30 minutes  
**Complexity:** Simple (just IPs!)  

**The system handles everything else automatically!** 🎯
