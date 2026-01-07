# 🚀 DEPLOYMENT STEPS - Simple 3-Step Process

**Last Updated:** January 7, 2026

---

## ⚡ QUICK START (3 Commands)

```bash
# Step 1: Clean
./cleanup-server.sh

# Step 2: Deploy
./setup-deployment-server.sh

# Step 3: Fix Nginx
./fix-ssl-now.sh
```

**Done!** Platform is live! ✅

---

## 📋 DETAILED STEPS

### **STEP 1: Cleanup Old Configuration**

```bash
chmod +x cleanup-server.sh
./cleanup-server.sh
```

**What it does:**
- Stops all PM2 processes
- Kills zombie Next.js processes
- Stops platform Docker containers (preserves user containers!)
- Cleans logs and temporary files

**Output:**
```
╔══════════════════════════════════════════════════════════
║  CLEANUP SERVER
╚══════════════════════════════════════════════════════════
✓ PM2 stopped
✓ Zombie processes killed
✓ Platform containers stopped
✓ Logs cleaned
✅ Cleanup complete!
```

---

### **STEP 2: Deploy Platform**

```bash
chmod +x setup-deployment-server.sh
./setup-deployment-server.sh
```

**What it does:**
- Installs Node.js, PM2, Nginx
- Starts MongoDB + Redis (Docker)
- Installs backend dependencies
- Installs frontend dependencies
- Builds frontend
- Starts backend on port 5000 (PM2)
- Starts frontend on port 3001 (PM2)
- Configures PM2 auto-start

**Output:**
```
╔══════════════════════════════════════════════════════════
║  SETUP DEPLOYMENT SERVER
╚══════════════════════════════════════════════════════════
→ STEP 1: Installing dependencies...
  ✓ Node.js, PM2, Nginx installed
→ STEP 2: Starting databases...
  ✓ MongoDB, Redis started
→ STEP 3: Backend setup...
  ✓ Backend running
→ STEP 4: Frontend setup...
  ✓ Frontend running
✅ Deployment complete!

Services:
  • Backend:  Port 5000 ✅
  • Frontend: Port 3001 ✅
```

---

### **STEP 3: Fix Nginx Configuration**

```bash
chmod +x fix-ssl-now.sh
sudo ./fix-ssl-now.sh
```

**What it does:**
- Backs up current Nginx config
- Creates proper config with:
  - Platform routes (/api, /)
  - User deployment routes (preserved!)
  - SSL configuration (if exists)
  - Security headers
- Tests configuration
- Reloads Nginx

**Output:**
```
╔══════════════════════════════════════════════════════════
║  FIX NGINX CONFIGURATION
╚══════════════════════════════════════════════════════════
✓ Backup created
✓ SSL certificates found
✓ Nginx configuration created
✓ User deployments preserved
✓ Configuration valid
✓ Nginx reloaded
✅ NGINX CONFIGURATION COMPLETE!

Platform accessible:
  https://foodpanda.site/
  https://foodpanda.site/api
```

---

## 🔄 AFTER DEPLOYMENT (Future Updates)

When you update code:

```bash
# Pull changes
git pull

# Redeploy
./cleanup-server.sh
./setup-deployment-server.sh
./fix-ssl-now.sh
```

---

## 📊 WHAT YOU'LL HAVE

```
✅ Backend  → Port 5000 (PM2)
✅ Frontend → Port 3001 (PM2)
✅ MongoDB  → Port 27017 (Docker)
✅ Redis    → Port 6379 (Docker)
✅ Nginx    → Port 80/443 (SSL)

https://foodpanda.site/
  ├─→ /                  → Platform (admin/dashboard)
  ├─→ /api/              → Backend API
  ├─→ /ff-xxx/           → User project 1
  ├─→ /ddd-xxx/          → User project 2
  └─→ ... (8 more user deployments)
```

---

## 🎯 QUICK REFERENCE

### **Fresh Deployment:**
```bash
./cleanup-server.sh && ./setup-deployment-server.sh && ./fix-ssl-now.sh
```

### **Check Status:**
```bash
pm2 list
docker ps
sudo systemctl status nginx
```

### **View Logs:**
```bash
pm2 logs
pm2 logs backend
pm2 logs frontend
```

### **Restart Services:**
```bash
pm2 restart all
```

---

## ✅ SUMMARY

**Three scripts, three steps:**

1. `cleanup-server.sh` - Clean old config
2. `setup-deployment-server.sh` - Deploy platform
3. `fix-ssl-now.sh` - Configure Nginx

**Simple, proven, works!** 🚀

---

*This follows your proven workflow pattern that has worked before.*

