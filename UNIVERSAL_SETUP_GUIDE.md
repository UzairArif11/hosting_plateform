# 🚀 UNIVERSAL SERVER SETUP & CLEANUP GUIDE

## 📦 **WHAT YOU HAVE:**

### **1. Universal Setup Script** ⭐
**File:** `setup-deployment-server.sh`

**Features:**
- ✅ Works on ALL servers (Oracle Cloud, AWS, DigitalOcean, etc.)
- ✅ Auto-detects and configures firewall (UFW, firewalld, or none)
- ✅ Automatically attempts SSL setup
- ✅ Installs: Docker, Nginx, Node.js, Certbot
- ✅ Configures: Nginx for foodpanda.site, Docker daemon, system limits
- ✅ Creates: Health check, deployment directories
- ✅ Production-ready in ~10 minutes

### **2. Enhanced Cleanup Script** ⭐
**File:** `cleanup-server.sh`

**Features:**
- ✅ Removes all containers and images
- ✅ Resets Nginx configuration
- ✅ **Option to preserve SSL certificates**
- ✅ Cleans Docker system
- ✅ Safe error handling
- ✅ Works on all server types

### **3. Auto-Fix Script**
**File:** `auto-fix-routing.sh`

**Features:**
- ✅ Automatically diagnoses routing issues
- ✅ Detects and fixes Nginx configuration
- ✅ Verifies the fix
- ✅ Works for any deployment

---

## 🎯 **USAGE:**

### **For NEW Servers (EC4, EC5, etc.):**

```bash
# 1. Copy setup script to server
scp -i /path/to/key.pem setup-deployment-server.sh ubuntu@<SERVER_IP>:~/

# 2. SSH and run
ssh -i /path/to/key.pem ubuntu@<SERVER_IP>
chmod +x setup-deployment-server.sh
sudo ./setup-deployment-server.sh

# 3. Follow prompts:
#    - Confirm setup (y)
#    - SSL will be attempted automatically
#    - If SSL fails, you can run it later

# 4. Done! Server is ready for deployments
```

**Time:** ~10 minutes

**Result:**
- ✅ Docker, Nginx, Node.js installed
- ✅ Nginx configured for foodpanda.site
- ✅ SSL configured (if domain is ready)
- ✅ Firewall configured
- ✅ Ready for automatic deployments

---

### **For EXISTING Servers (EC2, EC3):**

#### **Option 1: Clean and Re-setup (Recommended)**

```bash
# 1. Cleanup
ssh -i /path/to/key.pem ubuntu@<SERVER_IP>
chmod +x cleanup-server.sh
sudo ./cleanup-server.sh
# Type 'YES' to confirm
# Choose 'y' to preserve SSL (if you have it)

# 2. Setup
chmod +x setup-deployment-server.sh
sudo ./setup-deployment-server.sh
```

#### **Option 2: Just Run Setup (If Not Clean)**

```bash
# Run setup script - it will update existing configuration
chmod +x setup-deployment-server.sh
sudo ./setup-deployment-server.sh
```

---

## 🔧 **SSL CONFIGURATION:**

### **Automatic (During Setup):**

The setup script automatically attempts to get SSL certificate.

**Requirements:**
- Domain must be pointing to server's IP
- Port 80 must be accessible from internet

**If successful:**
- ✅ SSL certificate obtained
- ✅ HTTPS configured
- ✅ HTTP → HTTPS redirect enabled

**If fails:**
- ⚠️ Setup continues without SSL
- ℹ️ You can run SSL setup later

### **Manual SSL Setup (After Setup):**

```bash
# On the server
sudo certbot --nginx -d foodpanda.site -d www.foodpanda.site
```

This will:
1. Get SSL certificate from Let's Encrypt
2. Configure Nginx for HTTPS
3. Setup auto-redirect from HTTP to HTTPS

---

## 📊 **WHAT GETS CONFIGURED:**

### **Nginx Structure:**

```nginx
# Default server (for IP access)
server {
    listen 80 default_server;
    server_name _;
    # ... basic config
}

# Main domain server (for deployments)
server {
    listen 80;
    server_name foodpanda.site www.foodpanda.site;
    
    location / {
        return 404 "No deployment found";
    }
    
    # Deployments added here automatically by nginxRouter
}

# HTTPS server (if SSL configured)
server {
    listen 443 ssl;
    server_name foodpanda.site www.foodpanda.site;
    
    # Same locations as HTTP
    # SSL certificates
}
```

### **Docker Configuration:**

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-address-pools": [
    {
      "base": "172.17.0.0/16",
      "size": 24
    }
  ]
}
```

### **System Limits:**

```
* soft nofile 65536
* hard nofile 65536
fs.inotify.max_user_watches=524288
fs.inotify.max_user_instances=512
```

---

## ✅ **VERIFICATION:**

### **After Setup:**

```bash
# 1. Check health endpoint
curl http://<SERVER_IP>
# Should show: "Deployment Server Ready"

# 2. Check Docker
docker --version
docker ps

# 3. Check Nginx
nginx -t
curl -I http://foodpanda.site

# 4. Check SSL (if configured)
curl -I https://foodpanda.site

# 5. Check firewall
sudo ufw status  # or check cloud console
```

---

## 🚀 **DEPLOYMENT FLOW:**

### **After Setup:**

1. **User deploys from panel**
2. **Backend chooses server** (EC2/EC3/EC4/EC5)
3. **Backend creates container** via SSH
4. **nginxRouter updates Nginx** automatically
5. **Nginx routes traffic** to container
6. **URL works immediately!**

### **Example:**

```
User deploys "my-app"
  ↓
Backend creates container on EC4:3975
  ↓
nginxRouter adds to Nginx:
  location /myapp-abc12345-67890123/ {
      proxy_pass http://localhost:3975/;
  }
  ↓
User gets URL:
  https://foodpanda.site/myapp-abc12345-67890123/
  ↓
URL works! ✅
```

---

## 🔧 **TROUBLESHOOTING:**

### **If Deployment Returns 404:**

```bash
# Run auto-fix script
chmod +x auto-fix-routing.sh
sudo ./auto-fix-routing.sh <deployment-path> <port>

# Example:
sudo ./auto-fix-routing.sh eccom-69397f04-76074692 3975
```

### **If SSL Fails:**

```bash
# Check if domain points to server
dig foodpanda.site

# Check if port 80 is open
curl -I http://foodpanda.site

# Try manual SSL setup
sudo certbot --nginx -d foodpanda.site -d www.foodpanda.site

# Check certbot logs
sudo tail -50 /var/log/letsencrypt/letsencrypt.log
```

### **If Firewall Issues:**

```bash
# UFW (Ubuntu/Debian)
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Oracle Cloud - check Security Lists in console
# AWS - check Security Groups in console
```

---

## 📝 **SUMMARY:**

### **Setup Script:**
- **Purpose:** Configure server for deployments
- **Time:** ~10 minutes
- **Works on:** All Ubuntu 24.04 servers
- **Configures:** Docker, Nginx, SSL, Firewall
- **Result:** Production-ready deployment server

### **Cleanup Script:**
- **Purpose:** Reset server to clean state
- **Time:** ~2 minutes
- **Preserves:** SSL certificates (optional), system packages
- **Removes:** Containers, images, configs
- **Result:** Clean server ready for re-setup

### **Auto-Fix Script:**
- **Purpose:** Fix routing issues automatically
- **Time:** ~30 seconds
- **Detects:** Nginx configuration issues
- **Fixes:** Adds missing location blocks
- **Result:** Working deployment URL

---

## 🎉 **YOU'RE ALL SET!**

**Run the setup script on any server and it will be ready for automatic deployments!**

**Commands to remember:**

```bash
# Setup new server
sudo ./setup-deployment-server.sh

# Clean existing server
sudo ./cleanup-server.sh

# Fix routing issue
sudo ./auto-fix-routing.sh <path> <port>

# Setup SSL manually
sudo certbot --nginx -d foodpanda.site -d www.foodpanda.site
```

---

**All scripts are production-ready and work on Oracle Cloud, AWS, and any Ubuntu server!** 🚀
