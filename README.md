# 🚀 PLATFORM - Deployment & Management

**One script. Simple workflow. Zero confusion.**

---

## ⚡ DEPLOYMENT

### **First Time:**
```bash
chmod +x deploy.sh
./deploy.sh
```

### **After Code Updates:**
```bash
git pull
./deploy.sh
```

**That's it!** 🎉

---

## 📊 WHAT'S RUNNING

### **Services:**
```
PM2:
  • backend  (port 5000) - Platform API
  • frontend (port 3000) - Platform UI

Docker:
  • MongoDB (port 27017) - Database  
  • Redis (port 6379) - Job queue

Nginx:
  • Port 80/443 - SSL proxy
```

### **Architecture:**
```
https://foodpanda.site/
  ├─→ /              → Platform UI (admin/dashboard)
  ├─→ /api/          → Platform API
  ├─→ /user-project/ → User deployments (10+ active)
  └─→ ...
```

---

## 🔧 COMMANDS

### **View Status:**
```bash
pm2 list              # PM2 processes
docker ps             # Containers
```

### **View Logs:**
```bash
pm2 logs              # All logs
pm2 logs backend      # Backend only
pm2 logs frontend     # Frontend only
```

### **Restart:**
```bash
pm2 restart all       # Both services
pm2 restart backend   # Backend only
pm2 restart frontend  # Frontend only
```

### **Clean PM2:**
```bash
# Remove errored processes
pm2 list | grep errored | awk '{print $4}' | xargs pm2 delete
pm2 save
```

---

## 📝 MAINTENANCE

### **Update Code:**
```bash
git pull
./deploy.sh
```

### **Rebuild Frontend:**
```bash
cd frontend
npm run build
pm2 restart frontend
```

### **Check Health:**
```bash
curl https://foodpanda.site/api/health
```

---

## 📚 DOCUMENTATION

- `README.md` - This file (Quick ref)
- `README_DEPLOYMENT.md` - Detailed guide
- `PLATFORM_ARCHITECTURE.md` - System architecture
- `DEEP_SECURITY_REVIEW.md` - Security checklist

---

## ✅ SUMMARY

**One deployment script:**
- First time: `./deploy.sh`
- Updates: `git pull && ./deploy.sh`

**Your platform:**
- SSL enabled ✅
- 10+ user projects deployed ✅
- Backend + Frontend running ✅
- Simple workflow ✅

🚀 **Production ready!**
