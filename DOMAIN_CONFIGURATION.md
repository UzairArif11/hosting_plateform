# 🌐 Domain Configuration Guide

## 📋 **Current Status**

Right now, `BASE_DOMAIN` is **not set**, so the deployment URLs will use a **fallback domain**.

---

## 🔍 **How Domains Work**

### **Development (Local)**

When running locally without `BASE_DOMAIN` set:

```javascript
// In buildExecutor.js
const deploymentUrl = deployment.isPreview
    ? `https://preview-${project.name}-${deployment._id.toString().substring(0, 8)}.${process.env.BASE_DOMAIN || 'vcp.dev'}`
    : `https://${project.name}.${process.env.BASE_DOMAIN || 'vcp.dev'}`;
```

**Result:**
- Production: `https://trello-clone.vcp.dev`
- Preview: `https://preview-trello-clone-692e7c13.vcp.dev`

**⚠️ Problem:** These domains don't actually exist! They're just placeholders.

---

### **Production (Live on EC1)**

When you deploy EC1 to production with a real domain:

1. **Buy a domain** (e.g., `myplatform.com`)
2. **Set BASE_DOMAIN** in `.env`
3. **Configure DNS** to point to your servers
4. **Set up reverse proxy** (Nginx/Caddy)

---

## 🚀 **Production Setup**

### **Step 1: Get a Domain**

Buy a domain from:
- Namecheap
- GoDaddy
- Cloudflare
- Google Domains

**Example:** `myplatform.com`

---

### **Step 2: Configure DNS**

Add these DNS records:

```
Type    Name                    Value                   TTL
A       @                       129.154.255.89          300
A       *                       129.154.255.89          300
A       *.preview               129.154.255.89          300
CNAME   www                     myplatform.com          300
```

**What this does:**
- `@` → Points root domain to EC1
- `*` → Points all subdomains to EC1 (for user projects)
- `*.preview` → Points preview deployments to EC1
- `www` → Points www to root

---

### **Step 3: Set Environment Variable**

On EC1, add to `.env`:

```env
BASE_DOMAIN=myplatform.com
```

**Restart backend:**
```bash
pm2 restart backend
```

---

### **Step 4: Set Up Reverse Proxy**

You need a reverse proxy on EC1 to route requests to the correct containers.

#### **Option A: Nginx**

Install Nginx on EC1:
```bash
sudo apt install nginx
```

Create config `/etc/nginx/sites-available/platform`:

```nginx
# Main platform (frontend)
server {
    listen 80;
    server_name myplatform.com www.myplatform.com;
    
    location / {
        proxy_pass http://localhost:3000;  # Frontend
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# API
server {
    listen 80;
    server_name api.myplatform.com;
    
    location / {
        proxy_pass http://localhost:5000;  # Backend
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# User projects on EC2
server {
    listen 80;
    server_name ~^(?<project>.+)\.myplatform\.com$;
    
    location / {
        # Route to EC2 based on project
        # This requires a lookup to find which port
        proxy_pass http://129.154.255.90:$port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Preview deployments
server {
    listen 80;
    server_name ~^preview-(?<project>.+)-(?<id>.+)\.myplatform\.com$;
    
    location / {
        # Route to EC2/EC3 preview containers
        proxy_pass http://129.154.255.90:$port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

#### **Option B: Caddy (Easier with Auto-SSL)**

Install Caddy:
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Create `/etc/caddy/Caddyfile`:

```caddy
# Main platform
myplatform.com, www.myplatform.com {
    reverse_proxy localhost:3000
}

# API
api.myplatform.com {
    reverse_proxy localhost:5000
}

# User projects (wildcard)
*.myplatform.com {
    reverse_proxy 129.154.255.90:3001  # Dynamic routing needed
}

# Preview deployments
*.preview.myplatform.com {
    reverse_proxy 129.154.255.90:3001  # Dynamic routing needed
}
```

Restart:
```bash
sudo systemctl restart caddy
```

**Caddy automatically handles SSL certificates!** 🎉

---

## 🔄 **Dynamic Routing**

The challenge: Each project runs on a different port (3001, 3002, etc.)

### **Solution: Use a Routing Service**

Create `backend/services/router.js`:

```javascript
const express = require('express');
const httpProxy = require('http-proxy');
const Project = require('../models/Project');

const proxy = httpProxy.createProxyServer();
const router = express();

router.use(async (req, res) => {
    const hostname = req.hostname;
    
    // Extract project name from subdomain
    const parts = hostname.split('.');
    const projectName = parts[0];
    
    // Find project in database
    const project = await Project.findOne({ name: projectName });
    
    if (!project || !project.activeDeployment) {
        return res.status(404).send('Project not found');
    }
    
    // Get deployment info
    const deployment = await Deployment.findById(project.activeDeployment);
    const user = await User.findById(project.userId);
    
    // Determine target server and port
    const server = user.assignedServer === 'EC2' ? '129.154.255.90' : '129.154.255.91';
    const port = user.assignedPort || 3001;
    
    // Proxy request
    proxy.web(req, res, {
        target: `http://${server}:${port}`
    });
});

module.exports = router;
```

Add to `server.js`:
```javascript
const router = require('./services/router');
app.use(router);
```

---

## 📊 **URL Examples**

### **With BASE_DOMAIN=myplatform.com**

**Production Deployments:**
```
https://trello-clone.myplatform.com
https://my-blog.myplatform.com
https://portfolio.myplatform.com
```

**Preview Deployments:**
```
https://preview-trello-clone-692e7c13.myplatform.com
https://preview-my-blog-a1b2c3d4.myplatform.com
```

**Platform URLs:**
```
https://myplatform.com          → Frontend
https://api.myplatform.com      → Backend API
https://app.myplatform.com      → Dashboard
```

---

## 🔐 **SSL Certificates**

### **Option 1: Caddy (Automatic)**
Caddy automatically gets Let's Encrypt certificates for all domains!

### **Option 2: Certbot (Manual)**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d myplatform.com -d *.myplatform.com
```

---

## 🎯 **For Local Development**

### **Without a Real Domain:**

1. **Use localhost with ports:**
   ```
   http://localhost:3001  → User project 1
   http://localhost:3002  → User project 2
   ```

2. **Use /etc/hosts for testing:**
   ```
   127.0.0.1  trello-clone.local
   127.0.0.1  my-blog.local
   ```

3. **Set BASE_DOMAIN for testing:**
   ```env
   BASE_DOMAIN=localhost
   ```
   
   URLs become:
   ```
   http://trello-clone.localhost:3001
   http://my-blog.localhost:3002
   ```

---

## 📝 **Summary**

### **Current (Development):**
- No real domain
- URLs are placeholders: `*.vcp.dev`
- Access via `http://localhost:PORT`

### **Production (Live):**
1. Buy domain: `myplatform.com`
2. Set DNS to point to EC1
3. Set `BASE_DOMAIN=myplatform.com`
4. Set up reverse proxy (Caddy recommended)
5. URLs work: `https://project.myplatform.com`

---

## 🚀 **Quick Start for Production**

```bash
# 1. Buy domain
# 2. Point DNS to EC1 (129.154.255.89)

# 3. On EC1, set environment
echo "BASE_DOMAIN=myplatform.com" >> backend/.env

# 4. Install Caddy
sudo apt install caddy

# 5. Configure Caddy
sudo nano /etc/caddy/Caddyfile
# Add configuration from above

# 6. Restart services
pm2 restart backend
sudo systemctl restart caddy

# 7. Deploy a project
# 8. Access at https://projectname.myplatform.com
```

---

**For now, deployments work but URLs are placeholders. When you go live, set up a real domain!** 🌐
