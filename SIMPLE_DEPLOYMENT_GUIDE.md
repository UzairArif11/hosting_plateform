# 🚀 SIMPLE DEPLOYMENT GUIDE

**Last Updated:** January 7, 2026

---

## 📋 THREE SCRIPTS YOU NEED

### **1. deploy.sh** - First Time Setup
**When:** Fresh server, first deployment  
**Does:**
- Installs Node.js, PM2, Nginx, Docker
- Starts MongoDB + Redis
- Starts backend + frontend
- **Does NOT** configure Nginx (you do that manually to preserve user deployments)

```bash
chmod +x deploy.sh
./deploy.sh
```

---

### **2. update.sh** - Update After Git Pull  
**When:** After `git pull` to deploy new code  
**Does:**
- Detects what changed (backend/frontend)
- Installs new dependencies if needed
- Rebuilds frontend if needed
- Restarts only changed services
- **Does NOT** affect user deployments

```bash
git pull
./deploy.sh
```

---

### **3. setup-ssl.sh** - SSL Certificate  
**When:** Domain DNS is configured  
**Does:**
- Installs Certbot
- Gets Let's Encrypt certificate
- Configures auto-renewal

```bash
chmod +x setup-ssl-domain.sh
./setup-ssl-domain.sh foodpanda.site
```

---

## 🎯 DEPLOYMENT FLOW

### **First Time Deployment:**

```bash
# 1. Clone repository
git clone <your-repo> hosting_plateform
cd hosting_plateform

# 2. Deploy platform
./deploy.sh

# 3. Configure Nginx manually (preserve user deployments!)
sudo nano /etc/nginx/sites-available/default
# Add /api/ and / locations (see below)

# 4. Reload Nginx
sudo nginx -t
sudo systemctl reload nginx

# 5. Setup SSL (after DNS configured)
./setup-ssl-domain.sh foodpanda.site
```

---

### **Updating Code (Regular):**

```bash
# 1. Pull new code
git pull

# 2. Run update script
./update.sh

# Done! 🎉
```

---

## 📝 NGINX CONFIGURATION

### **Safe Nginx Update:**

Your Nginx already has **user deployments** like:
```nginx
location /ff-xxx/ { ... }
location /ddd-xxx/ { ... }
```

**Add platform routes WITHOUT removing user routes:**

```bash
sudo nano /etc/nginx/sites-available/default
```

**In the HTTPS server block:**

**A) Add AFTER SSL config, BEFORE user deployments:**

```nginx
    # Platform Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

**B) REPLACE the "return 404" at the end:**

```nginx
    # Platform Frontend (catch-all at the end)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
```

**Test and reload:**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🗂️ FILE STRUCTURE

```
hosting_plateform/
├── deploy.sh                 ← First-time deployment
├── update.sh                 ← Update after git pull
├── setup-ssl-domain.sh       ← SSL setup
├── ecosystem.config.js       ← PM2 configuration
├── docker-compose.yml        ← MongoDB + Redis
├── backend/                  ← Platform API
│   ├── server.js
│   ├── .env (created by deploy.sh)
│   └── ...
├── frontend/                 ← Platform UI
│   ├── next.config.js
│   ├── .env.local (created by deploy.sh)
│   └── ...
└── logs/                     ← PM2 logs
```

---

## 📊 WHAT RUNS WHERE

### **Docker Containers (Infrastructure):**
```
vercel-clone-mongodb   → Port 27017 (localhost only)
vercel-clone-redis     → Port 6379 (localhost only)
```

### **PM2 Processes (Platform):**
```
backend   → Port 5000 (Platform API)
frontend  → Port 3000 (Platform UI - Admin/Dashboard)
```

### **Nginx (Reverse Proxy):**
```
Port 80/443 (SSL)
  ├─→ /                    → Platform Frontend (3000)
  ├─→ /api/                → Platform Backend (5000)
  ├─→ /ff-xxx/             → User deployment
  ├─→ /ddd-xxx/            → User deployment
  └─→ ... 8 more user deployments
```

### **User Containers:**
```
EC3-user-xxx → User's projects (PM2 processes inside)
EC3-user-yyy → Another user's projects
```

---

## 🔄 UPDATE WORKFLOW

### **Scenario 1: Backend Code Change**

```bash
git pull
./update.sh

# Output:
# ✓ Backend code changed
# ✓ Installing dependencies...
# ✓ Restarting backend...
# ✓ Update complete!
```

**What happens:**
- Backend dependencies installed (if package.json changed)
- Backend PM2 process restarted
- Frontend unchanged
- User deployments unaffected ✅

---

### **Scenario 2: Frontend Code Change**

```bash
git pull
./update.sh

# Output:
# ✓ Frontend code changed
# ✓ Installing dependencies...
# ✓ Building frontend...
# ✓ Restarting frontend...
# ✓ Update complete!
```

**What happens:**
- Frontend dependencies installed (if package.json changed)
- Frontend rebuilt (`npm run build`)
- Frontend PM2 process restarted
- Backend unchanged
- User deployments unaffected ✅

---

### **Scenario 3: Both Changed**

```bash
git pull
./update.sh

# Output:
# ✓ Backend code changed
# ✓ Frontend code changed
# ✓ Updating backend...
# ✓ Updating frontend...
# ✓ Update complete!
```

**What happens:**
- Both services updated
- Both services restarted
- User deployments unaffected ✅

---

### **Scenario 4: No Changes**

```bash
git pull
# Already up to date

./update.sh

# Output:
# ✓ Already up to date
# ✓ No changes, nothing to update
```

---

## 🎯 COMMON TASKS

### **View Logs:**
```bash
pm2 logs              # All logs
pm2 logs backend      # Backend only
pm2 logs frontend     # Frontend only
```

### **Restart Services:**
```bash
pm2 restart backend   # Backend only
pm2 restart frontend  # Frontend only
pm2 restart all       # Both
```

### **Check Status:**
```bash
pm2 status            # PM2 processes
docker ps             # Docker containers
sudo systemctl status nginx  # Nginx status
```

### **Rebuild Frontend Manually:**
```bash
cd frontend
npm run build
pm2 restart frontend
```

### **View Nginx Access Logs:**
```bash
sudo tail -f /var/log/nginx/access.log
```

---

## ⚠️ IMPORTANT NOTES

### **DON'T DO THIS:**
- ❌ Run `deploy.sh` multiple times (only for first deployment)
- ❌ Manually edit `/etc/nginx/sites-available/default` user deployment blocks
- ❌ Delete docker volumes (you'll lose database!)
- ❌ Run `pm2 delete all` without backup

### **DO THIS:**
- ✅ Use `update.sh` for code updates
- ✅ Let nginxRouter.js manage user deployment routes
- ✅ Backup Nginx config before changes
- ✅ Test Nginx config with `sudo nginx -t`

---

## 🔧 TROUBLESHOOTING

### **Issue: Update script fails**

```bash
# Check what's wrong
pm2 logs

# Manual restart
pm2 restart all
```

### **Issue: Frontend won't build**

```bash
cd frontend
rm -rf .next node_modules
npm install
npm run build
pm2 restart frontend
```

### **Issue: Backend errors**

```bash
cd backend
npm install
pm2 restart backend
pm2 logs backend
```

### **Issue: Can't pull code**

```bash
# Stash local changes
git stash

# Pull
git pull

# Apply stashed changes (if needed)
git stash pop
```

---

## ✅ SUMMARY

**Three scripts, three purposes:**

| Script | When | What |
|--------|------|------|
| `deploy.sh` | First time | Setup everything |
| `update.sh` | After git pull | Update code |
| `setup-ssl-domain.sh` | DNS ready | Add SSL |

**Daily workflow:**
```bash
# Update code
git pull
./update.sh

# Check logs
pm2 logs

# Done! ✅
```

**That's it!** Simple, safe, preserves user deployments! 🚀

---

*Keep it simple. Keep it safe. Keep user deployments running!*

