# 🚀 SERVER SETUP & CLEANUP GUIDE

## 📋 **OVERVIEW:**

Two scripts have been created:
1. **`cleanup-server.sh`** - Completely cleans a server (EC3)
2. **`setup-deployment-server.sh`** - Sets up a fresh server (EC4/EC5)

---

## 🧹 **PART 1: CLEANING EC3**

### **What the cleanup script does:**
- ✅ Stops and removes ALL Docker containers
- ✅ Removes ALL Docker images
- ✅ Cleans Docker system and cache
- ✅ Resets Nginx to default configuration
- ✅ Removes all deployment scripts
- ✅ Cleans temporary files

### **How to use:**

```bash
# 1. Copy script to EC3
scp -i D:/work/ec3/uz.key cleanup-server.sh ubuntu@129.154.255.90:~/

# 2. SSH to EC3
ssh -i D:/work/ec3/uz.key ubuntu@129.154.255.90

# 3. Make executable and run
chmod +x cleanup-server.sh
sudo ./cleanup-server.sh

# 4. Type 'YES' when prompted to confirm
```

### **After cleanup:**
- Server will be completely clean
- No containers running
- Nginx reset to default
- Ready for fresh setup

---

## 🆕 **PART 2: SETTING UP EC4/EC5**

### **What the setup script does:**
- ✅ Updates system packages
- ✅ Installs Docker
- ✅ Installs Nginx
- ✅ Configures firewall (UFW)
- ✅ Sets up Nginx for automatic deployments
- ✅ Installs Certbot for SSL
- ✅ Optionally configures SSL certificate
- ✅ Creates deployment directories
- ✅ Installs Node.js
- ✅ Configures Docker daemon
- ✅ Sets system limits
- ✅ Creates health check endpoint

### **Prerequisites:**

1. **Fresh Ubuntu 24.04 server** (Oracle Cloud)
2. **Domain DNS configured** (optional, for SSL)
3. **SSH access** with sudo privileges

### **How to use:**

```bash
# 1. Copy script to new server (EC4 or EC5)
scp -i D:/work/ec4/key.pem setup-deployment-server.sh ubuntu@<EC4_IP>:~/

# 2. SSH to the server
ssh -i D:/work/ec4/key.pem ubuntu@<EC4_IP>

# 3. Make executable and run
chmod +x setup-deployment-server.sh
sudo ./setup-deployment-server.sh

# 4. Follow prompts:
#    - Confirm setup
#    - Choose whether to setup SSL now
```

### **What happens:**
1. System updates
2. Docker installation
3. Nginx installation
4. Firewall configuration
5. Nginx configuration for deployments
6. SSL setup (if you choose)
7. Directory creation
8. Node.js installation
9. Docker daemon configuration
10. System optimization

---

## ⚙️ **PART 3: BACKEND CONFIGURATION**

After setting up EC4/EC5, you need to update the backend code:

### **Step 1: Update `containerOrchestrator.js`**

Add EC4/EC5 to the ORACLE_SERVERS object:

```javascript
// backend/services/containerOrchestrator.js

const ORACLE_SERVERS = {
  EC2: {
    host: process.env.EC2_HOST,
    sshKey: process.env.SSH_EC2_KEY,
    maxContainers: 10,
    region: 'us-ashburn-1'
  },
  EC3: {
    host: process.env.EC3_HOST,
    sshKey: process.env.SSH_EC3_KEY,
    maxContainers: 10,
    region: 'us-phoenix-1'
  },
  EC4: {
    host: process.env.EC4_HOST,
    sshKey: process.env.SSH_EC4_KEY,
    maxContainers: 10,
    region: 'us-sanjose-1'
  },
  EC5: {
    host: process.env.EC5_HOST,
    sshKey: process.env.SSH_EC5_KEY,
    maxContainers: 10,
    region: 'ca-toronto-1'
  }
};
```

### **Step 2: Update `.env` file**

Add EC4/EC5 configuration:

```env
# EC4 Configuration
EC4_HOST=<EC4_IP_ADDRESS>
SSH_EC4_KEY=D:/work/ec4/key.pem

# EC5 Configuration
EC5_HOST=<EC5_IP_ADDRESS>
SSH_EC5_KEY=D:/work/ec5/key.pem
```

### **Step 3: Update `nginxRouter.js`**

Add EC4/EC5 to the SSH key selection:

```javascript
// backend/services/nginxRouter.js

const keyPath = serverKey === 'EC2' ? process.env.SSH_EC2_KEY
              : serverKey === 'EC3' ? process.env.SSH_EC3_KEY
              : serverKey === 'EC4' ? process.env.SSH_EC4_KEY
              : serverKey === 'EC5' ? process.env.SSH_EC5_KEY
              : process.env.SSH_EC3_KEY;
```

### **Step 4: Update User model**

Update the enum to include EC4/EC5:

```javascript
// backend/models/User.js

oracleAccountId: {
  type: String,
  enum: ['EC1', 'EC2', 'EC3', 'EC4', 'EC5', null],
  default: null
}
```

---

## 🧪 **PART 4: TESTING**

### **Test EC4/EC5 Setup:**

```bash
# 1. Check health endpoint
curl http://<EC4_IP>

# Should show: "Deployment Server Ready"

# 2. Check Docker
ssh -i D:/work/ec4/key.pem ubuntu@<EC4_IP>
docker ps
docker --version

# 3. Check Nginx
sudo nginx -t
curl -I http://localhost

# 4. Check firewall
sudo ufw status

# All should be configured correctly
```

### **Test Deployment from User Panel:**

1. **Create a new project**
2. **Deploy the project**
3. **Check backend logs** - should assign to EC4 or EC5
4. **Verify container created** on EC4/EC5
5. **Check Nginx routing** - location block should be added automatically
6. **Test URL** - should be accessible

---

## 📊 **EXPECTED RESULTS:**

### **After Cleanup (EC3):**
```
✓ All containers removed
✓ All Docker images removed
✓ Docker system cleaned
✓ Nginx config reset
✓ Deployment scripts removed
✓ Temporary files cleaned
```

### **After Setup (EC4/EC5):**
```
✓ Docker installed and configured
✓ Nginx installed and configured
✓ Firewall configured
✓ SSL ready (Certbot installed)
✓ Deployment directories created
✓ Node.js installed
✓ System limits configured
```

### **After Backend Update:**
```
✓ EC4/EC5 added to ORACLE_SERVERS
✓ Environment variables configured
✓ SSH keys configured
✓ nginxRouter updated
✓ User model updated
```

---

## 🎯 **DEPLOYMENT FLOW (After Setup):**

1. **User creates project** in panel
2. **User clicks deploy**
3. **Backend receives request**
4. **Backend chooses server** (EC2/EC3/EC4/EC5 based on load)
5. **Backend creates container** on chosen server via SSH
6. **Backend updates Nginx** on that server via SSH
7. **Nginx routes traffic** to container
8. **User gets URL** - deployment is live!

---

## 🔧 **TROUBLESHOOTING:**

### **If cleanup fails:**
```bash
# Manually stop all containers
docker stop $(docker ps -aq)

# Manually remove all containers
docker rm -f $(docker ps -aq)

# Manually remove all images
docker rmi -f $(docker images -q)

# Reset Nginx manually
sudo rm /etc/nginx/sites-available/default
sudo nano /etc/nginx/sites-available/default
# (paste minimal config)
```

### **If setup fails:**
```bash
# Check logs
sudo journalctl -xe

# Check Docker
sudo systemctl status docker

# Check Nginx
sudo systemctl status nginx
sudo nginx -t

# Check firewall
sudo ufw status verbose
```

---

## 📝 **SUMMARY:**

### **Cleanup Script:**
- **Purpose:** Clean EC3 completely
- **Usage:** `sudo ./cleanup-server.sh`
- **Time:** ~2 minutes
- **Result:** Clean server ready for fresh setup

### **Setup Script:**
- **Purpose:** Configure EC4/EC5 for deployments
- **Usage:** `sudo ./setup-deployment-server.sh`
- **Time:** ~10 minutes
- **Result:** Production-ready deployment server

### **Backend Updates:**
- **Files:** 4 files to update
- **Time:** ~5 minutes
- **Result:** Backend can deploy to EC4/EC5

---

## 🚀 **QUICK START:**

```bash
# 1. Clean EC3
scp -i D:/work/ec3/uz.key cleanup-server.sh ubuntu@129.154.255.90:~/
ssh -i D:/work/ec3/uz.key ubuntu@129.154.255.90
sudo ./cleanup-server.sh

# 2. Setup EC4
scp -i D:/work/ec4/key.pem setup-deployment-server.sh ubuntu@<EC4_IP>:~/
ssh -i D:/work/ec4/key.pem ubuntu@<EC4_IP>
sudo ./setup-deployment-server.sh

# 3. Update backend code (4 files)
# 4. Restart backend
# 5. Test deployment!
```

---

**Both scripts are production-ready and will work for any new Oracle Cloud server!** 🎉
