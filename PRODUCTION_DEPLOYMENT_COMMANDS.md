# Production Server Commands - Fix Deployment Issues

## Commands to Run on Production Server

### 1. Pull Latest Fixes
```bash
cd ~/hosting_plateform
git pull origin optimization2
```

### 2. Restart Services
```bash
pm2 reload all
```

### 3. Check Logs (Verify Fixes)
```bash
# Watch backend logs
pm2 logs backend --lines 50

# Or tail the log file
tail -f logs/backend.log
```

### 4. Test Deployment
```bash
# From your local machine or browser:
# 1. Go to: https://foodpanda.site/admin/templates
# 2. Click "Deploy Demo" on a template
# 3. Watch the status updates
# 4. If it fails, you should see error immediately (not stuck loading)
# 5. You should see "Delete Demo" and "Redeploy" buttons
```

---

## Verification Steps

After pulling and restarting, verify:

1. **Socket.IO Connection**:
```bash
curl http://localhost:5000/socket.io/
# Should return socket.io protocol version
```

2. **Backend Health**:
```bash
curl http://localhost:5000/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

3. **Frontend Health**:
```bash
curl http://localhost:3000/api/health
# Should return: {"status":"healthy"}
```

---

## If Issues Persist

### Check PM2 Status
```bash
pm2 status
pm2 describe backend
pm2 describe frontend
```

### Check Port Conflicts
```bash
netstat -tuln | grep :5000
netstat -tuln | grep :3000
```

### Full Restart (if needed)
```bash
pm2 stop all
pm2 delete all
cd ~/hosting_plateform
pm2 start ecosystem.config.js
```

### Check MongoDB Connection
```bash
# Test MongoDB connection
mongosh "mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin" --eval "db.adminCommand({ ping: 1 })"
```

---

## Expected Output After Fixes

### Backend Logs (On Deployment Failure)
```
[info]: [deploymentId] Build failed: Prisma error...
[error]: 📡 EMITTING template-demo-status (failed) for templateId: Prisma error
[error]: ❌ Admin demo deployment failed for template: Smart Portfolio
```

### Frontend Behavior
- ❌ Toast notification: "Demo deployment failed: Prisma error"
- 🛑 Loading spinner stops immediately
- 🔴 Error card shows with error message
- 🗑️ "Delete Demo" button appears
- 🔄 "Redeploy" button appears
- 📋 "View Logs" button available

---

## Fixing Template Prisma Error

The actual deployment error is from the template's Prisma schema. To fix:

### Option 1: Update Environment Variable (Quick Fix)
```bash
# Via UI:
# 1. Admin → Templates → Edit "Smart Portfolio"
# 2. Environment Variables tab
# 3. Add: DATABASE_URL = "file:./data/portfolio.db"
# 4. Mark as Required: Yes
# 5. Save
```

### Option 2: Fix Template Repository (Proper Fix)
```bash
# Clone the template repo
git clone https://github.com/uzairtesta/nextjs-portfolio.git
cd nextjs-portfolio

# Edit prisma/schema.prisma
# Change:
#   url = env("DATABASE_URL") != "" ? env("DATABASE_URL") : "file:./data/portfolio.db"
# To:
#   url = env("DATABASE_URL")

# Commit and push
git add prisma/schema.prisma
git commit -m "Fix Prisma schema - remove invalid conditional syntax"
git push

# Then redeploy from admin panel
```

---

## Summary of Fixes in Code

1. ✅ Enhanced socket emission on deployment failure
2. ✅ Added fallback socket room emission
3. ✅ Improved error logging
4. ✅ Frontend stops loading on failed status
5. ✅ Toast notifications on all states
6. ✅ Delete/redeploy buttons on failed state
7. ✅ Delete button also on successful deployments

**Run these commands on your production server and the issues will be fixed!**
