# 🚀 PLATFORM DEPLOYMENT - SIMPLE GUIDE

**Last Updated:** January 7, 2026

---

## ⚡ QUICK START

### **First Time Deployment:**
```bash
chmod +x deploy.sh
./deploy.sh
```

### **After Code Updates:**
```bash
git pull
./deploy.sh
```

**That's it!** ONE script for everything! 🎉

---

## 📋 WHAT deploy.sh DOES

The script is **SMART** - it detects what needs to be done:

### **First Time:**
1. ✅ Installs: Node.js, PM2, Nginx, Docker Compose
2. ✅ Starts: MongoDB + Redis (Docker)
3. ✅ Installs: Backend + Frontend dependencies
4. ✅ Builds: Frontend
5. ✅ Starts: Backend + Frontend (PM2)
6. ✅ Shows: Nginx configuration steps

### **After Git Pull:**
1. ✅ Detects what changed (backend/frontend)
2. ✅ Installs new dependencies (if needed)
3. ✅ Rebuilds frontend (if code changed)
4. ✅ Restarts only changed services
5. ✅ Preserves user deployments ✅

---

## 🔧 ONE-TIME MANUAL STEP: NGINX

After first `./deploy.sh`, add platform routes to Nginx:

```bash
sudo nano /etc/nginx/sites-available/default
```

### **In the HTTPS server block:**

**Add BEFORE user deployments:**
```nginx
    # Platform Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
```

**REPLACE the 404 at the end:**
```nginx
    # Platform Frontend (last - catch all)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
```

**Save, test, reload:**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

**Done! Never touch Nginx again!** ✅

---

## 🔄 WORKFLOW

### **Daily Development:**

```bash
# 1. Make code changes
# 2. Commit and push
git add .
git commit -m "Updated feature X"
git push

# 3. On server: Update
git pull
./deploy.sh

# 4. Verify
curl https://foodpanda.site/api/health
```

### **The script automatically:**
- Detects changes
- Rebuilds if needed
- Restarts services
- Preserves user deployments
- Shows status

---

## 📊 ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│  Nginx (Port 80/443) - SSL                                 │
│    ├─→ /                → Platform Frontend (PM2:3000)     │
│    ├─→ /api/            → Platform Backend (PM2:5000)      │
│    ├─→ /ff-xxx/         → User Project 1                   │
│    └─→ /ddd-xxx/        → User Project 2 (+ 8 more)       │
├─────────────────────────────────────────────────────────────┤
│  PM2 (Process Manager)                                      │
│    ├─→ backend          → Express API                      │
│    └─→ frontend         → Next.js                          │
├─────────────────────────────────────────────────────────────┤
│  Docker (Databases)                                         │
│    ├─→ MongoDB          → Platform data                    │
│    └─→ Redis            → Job queue                        │
└─────────────────────────────────────────────────────────────┘
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
sudo systemctl status nginx  # Nginx
```

### **Manual Rebuild:**
```bash
cd frontend
npm run build
pm2 restart frontend
```

---

## 🔒 SECURITY

### **Before Production:**

1. **Change MongoDB password:**
```bash
# Edit docker-compose.yml
MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD:-your-strong-password}
```

2. **Set JWT secret:**
```bash
# Edit backend/.env
JWT_SECRET=your-very-long-random-secret-key-here
```

3. **Enable session store:**
```bash
# Edit backend/server.js
# Uncomment MongoStore configuration
```

4. **Review security:**
```bash
cat DEEP_SECURITY_REVIEW.md
```

---

## 📞 TROUBLESHOOTING

### **Issue: deploy.sh fails**
```bash
# Check logs
pm2 logs

# Manual restart
pm2 restart all
```

### **Issue: Frontend not building**
```bash
cd frontend
rm -rf .next node_modules
npm install
npm run build
pm2 restart frontend
```

### **Issue: Database connection error**
```bash
# Check MongoDB
docker ps | grep mongodb
docker logs vercel-clone-mongodb

# Restart if needed
docker restart vercel-clone-mongodb
```

---

## ✅ SUMMARY

**One script:** `deploy.sh`

**First time:**
```bash
./deploy.sh
# + manual Nginx config (once)
```

**Every update:**
```bash
git pull && ./deploy.sh
```

**That's it!** Simple, clean, safe! 🚀

---

## 📁 FILES TO KEEP

```
✅ deploy.sh                    ← Main deployment script
✅ setup-ssl-domain.sh          ← SSL setup (when needed)
✅ ecosystem.config.js          ← PM2 configuration
✅ docker-compose.yml           ← Database configuration
✅ README_DEPLOYMENT.md         ← This file
✅ PLATFORM_DEPLOYMENT_ANALYSIS.md  ← Current state analysis
✅ DEEP_SECURITY_REVIEW.md      ← Security checklist
```

All other deployment scripts have been removed to avoid confusion.

---

**Questions?** Read `PLATFORM_DEPLOYMENT_ANALYSIS.md` for complete system analysis!

