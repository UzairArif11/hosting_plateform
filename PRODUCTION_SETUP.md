# 🚀 Production Setup Guide - foodpanda.site

## ✅ **Step 1: Add Environment Variables**

Add these to `backend/.env`:

```env
# SSH Keys for Remote Servers
SSH_EC2_KEY=F:/sshA/ec2
SSH_EC3_KEY=F:/sshA/ec3
SSH_USERNAME=ubuntu

# Production Domain
BASE_DOMAIN=foodpanda.site

# Keep all existing variables
```

---

## ✅ **Step 2: Test SSH Connections**

```bash
cd backend
node test-ssh-connections.js
```

**Expected output:**
```
✅ EC2 Connection successful!
✅ EC3 Connection successful!
```

If it fails, check:
- SSH key paths are correct
- Keys have proper permissions
- EC2/EC3 are accessible

---

## ✅ **Step 3: Install Dependencies**

```bash
cd backend
npm install node-ssh
```

---

## ✅ **Step 4: Restart Backend**

```bash
cd backend
npm run dev
```

---

## ✅ **Step 5: Deploy a Project**

1. Go to frontend: `http://localhost:3000`
2. Click on a project
3. Click "Deploy Now"

**New Flow:**
```
✅ Clone repository
✅ Install dependencies
✅ Build project
✅ Copy files to EC3 via SSH
✅ Build Docker image on EC3
✅ Create container on EC3
✅ App is LIVE on EC3!
```

---

## ✅ **Step 6: Set Up Domain (foodpanda.site)**

### **6.1: Point DNS to EC1**

In your domain registrar (GoDaddy, Namecheap, etc.):

```
Type    Name                Value                   TTL
A       @                   YOUR_EC1_IP             300
A       *                   YOUR_EC1_IP             300
CNAME   www                 foodpanda.site          300
```

Replace `YOUR_EC1_IP` with your EC1 public IP.

---

### **6.2: Install Caddy on EC1 (Reverse Proxy)**

**On EC1 (your production server):**

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

---

### **6.3: Configure Caddy**

Create `/etc/caddy/Caddyfile`:

```caddy
# Main platform
foodpanda.site, www.foodpanda.site {
    reverse_proxy localhost:3000  # Frontend
}

# API
api.foodpanda.site {
    reverse_proxy localhost:5000  # Backend
}

# User projects - Dynamic routing
*.foodpanda.site {
    reverse_proxy localhost:8080  # Routing service
}
```

Restart Caddy:
```bash
sudo systemctl restart caddy
```

---

### **6.4: Create Routing Service**

This routes `projectname.foodpanda.site` to the correct EC2/EC3 container.

Create `backend/services/router.js`:

```javascript
const express = require('express');
const httpProxy = require('http-proxy');
const Project = require('../models/Project');
const Deployment = require('../models/Deployment');
const User = require('../models/User');

const proxy = httpProxy.createProxyServer();
const router = express();

router.use(async (req, res) => {
    try {
        const hostname = req.hostname;
        
        // Extract project name from subdomain
        const projectName = hostname.split('.')[0];
        
        // Skip api and www
        if (projectName === 'api' || projectName === 'www' || hostname === 'foodpanda.site') {
            return res.status(404).send('Not found');
        }
        
        // Find project
        const project = await Project.findOne({ name: projectName });
        
        if (!project || !project.activeDeployment) {
            return res.status(404).send('Project not found');
        }
        
        // Get deployment and user info
        const deployment = await Deployment.findById(project.activeDeployment);
        const user = await User.findById(project.userId);
        
        if (!deployment || !user) {
            return res.status(404).send('Deployment not found');
        }
        
        // Get server and port
        const server = user.assignedServer === 'EC2' ? '140.238.229.147' : '129.154.255.90';
        const port = user.assignedPort || 3001;
        
        // Proxy to container
        proxy.web(req, res, {
            target: `http://${server}:${port}`,
            changeOrigin: true
        });
        
    } catch (error) {
        console.error('Routing error:', error);
        res.status(500).send('Internal server error');
    }
});

module.exports = router;
```

Add to `backend/server.js`:
```javascript
const router = require('./services/router');
app.use(router);  // Add this line
```

Start routing service on port 8080:
```bash
PORT=8080 node server.js
```

---

## ✅ **Step 7: Test Production Deployment**

1. Deploy a project
2. Wait for completion
3. Access at: `http://projectname.foodpanda.site`

**Example:**
- Project name: `trello-clone`
- URL: `https://trello-clone.foodpanda.site`

---

## 🎯 **Complete Architecture**

```
User Browser
    ↓
foodpanda.site (DNS)
    ↓
EC1 (Caddy Reverse Proxy)
    ↓
├─ foodpanda.site → Frontend (port 3000)
├─ api.foodpanda.site → Backend (port 5000)
└─ *.foodpanda.site → Router (port 8080)
    ↓
Router looks up project in database
    ↓
Proxies to EC2/EC3 container
    ↓
User sees their deployed app!
```

---

## 📊 **Deployment Flow (Production)**

```
1. User clicks "Deploy" on foodpanda.site
2. Backend clones repo on EC1
3. Backend installs deps on EC1
4. Backend builds project on EC1
5. Backend copies build to EC3 via SSH
6. Backend builds Docker image on EC3
7. Backend creates container on EC3
8. App is live at projectname.foodpanda.site
```

---

## 🔐 **Security Checklist**

- [x] SSH keys configured
- [x] Docker on EC2/EC3 secured
- [ ] SSL certificates (Caddy handles automatically)
- [ ] Firewall rules configured
- [ ] MongoDB authentication enabled
- [ ] Redis password set
- [ ] Environment variables secured

---

## 🐛 **Troubleshooting**

### **SSH Connection Fails**
```bash
# Test manually
ssh -i F:/sshA/ec3 ubuntu@129.154.255.90

# Check key permissions (on Linux)
chmod 600 F:/sshA/ec3
```

### **Docker Build Fails on EC3**
```bash
# SSH to EC3
ssh -i F:/sshA/ec3 ubuntu@129.154.255.90

# Check Docker
docker --version
docker images

# Check disk space
df -h
```

### **Domain Not Working**
```bash
# Check DNS propagation
nslookup foodpanda.site

# Check Caddy
sudo systemctl status caddy
sudo journalctl -u caddy -f
```

---

## 🎉 **You're Production Ready!**

After completing these steps:
- ✅ Deployments build on EC3 (not EC1)
- ✅ Apps are accessible on EC2/EC3
- ✅ Domain works: `projectname.foodpanda.site`
- ✅ SSL certificates automatic (Caddy)
- ✅ Full production deployment pipeline!

---

**Next: Deploy a project and access it at `https://projectname.foodpanda.site`!** 🚀
