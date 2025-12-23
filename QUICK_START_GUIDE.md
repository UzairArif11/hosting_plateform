# 🚀 QUICK START GUIDE - PRODUCTION DEPLOYMENT

## ✅ **EVERYTHING IS READY!**

All issues fixed, all features working, production ready!

---

## 📋 **PRE-FLIGHT CHECKLIST:**

### **Backend:**
- [x] planType field added to User model
- [x] Resource monitoring fixed
- [x] Cross-platform storage monitoring
- [x] All routes registered
- [x] Cron jobs configured
- [x] Error handling complete

### **Frontend:**
- [x] Error handling added
- [x] Loading states added
- [x] Memory leaks fixed
- [x] Toast notifications working
- [x] All admin pages functional

---

## 🚀 **START THE PLATFORM:**

### **Step 1: Start Backend**
```bash
cd backend
npm install  # If not already done
npm start
```

**Expected Output:**
```
✅ MongoDB connected
✅ Account lifecycle cron jobs started
✅ Resource monitoring started (every 5 minutes)
🚀 Server running on port 5000
```

### **Step 2: Start Frontend**
```bash
cd frontend
npm install  # If not already done
npm run dev
```

**Expected Output:**
```
✓ Ready in 2.5s
○ Local:   http://localhost:3000
```

---

## 🧪 **QUICK TESTS:**

### **Test 1: Health Check**
```bash
curl http://localhost:5000/health
```
**Expected:** `{"status":"healthy",...}`

### **Test 2: Resource Monitoring**
```bash
curl http://localhost:5000/api/resources/usage \
  -H "Authorization: Bearer YOUR_TOKEN"
```
**Expected:** CPU, RAM, Storage usage data

### **Test 3: Capacity Check**
```bash
curl http://localhost:5000/api/resources/capacity \
  -H "Authorization: Bearer YOUR_TOKEN"
```
**Expected:** Available slots per plan

### **Test 4: Frontend**
Open browser: `http://localhost:3000/admin`
- Should see admin dashboard
- Should see resource stats
- Should see cleanup options

---

## 📊 **ADMIN PANEL FEATURES:**

### **Available Pages:**
```
http://localhost:3000/admin              → Dashboard
http://localhost:3000/admin/users        → User Management
http://localhost:3000/admin/cleanup      → Resource Cleanup
http://localhost:3000/admin/servers      → Server Management
http://localhost:3000/admin/domains      → Domain Management
http://localhost:3000/admin/capacity     → Resource Capacity
```

### **What You Can Do:**
✅ View all users  
✅ Suspend/unsuspend users  
✅ Delete/recover users  
✅ Change user plans  
✅ Bulk delete users  
✅ Monitor resources  
✅ Check capacity  
✅ Verify DNS  
✅ Migrate domains  

---

## 🔧 **COMMON TASKS:**

### **Create Admin User:**
```bash
cd backend
node make-admin.js YOUR_EMAIL
```

### **Check Resource Usage:**
```bash
# Via API
curl http://localhost:5000/api/resources/usage \
  -H "Authorization: Bearer YOUR_TOKEN"

# Via Admin Panel
# Go to http://localhost:3000/admin/capacity
```

### **Clean Up Resources:**
```bash
# Via Admin Panel
# Go to http://localhost:3000/admin/cleanup
# Click "Delete All Suspended" or "Delete All Soft-Deleted"
```

### **Change User Plan:**
```bash
# Via API
curl -X PUT http://localhost:5000/api/admin/users/USER_ID/plan \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan":"pro","upgradeContainers":true}'

# Via Admin Panel
# Go to http://localhost:3000/admin/users
# Find user → Change Plan → Select plan → Save
```

---

## 🎯 **MONITORING:**

### **Resource Monitoring (Automatic):**
- Runs every 5 minutes
- Checks CPU, RAM, Storage
- Alerts at 70% usage
- Logs to console

### **Cron Jobs (Automatic):**
```
2:00 AM → Check expired trials
3:00 AM → Check expired subscriptions
4:00 AM → Delete resources (suspended > 7 days)
5:00 AM → Permanent deletion (past recovery deadline)
```

### **Manual Monitoring:**
```bash
# Check logs
tail -f backend/logs/combined.log

# Check resource usage
curl http://localhost:5000/api/resources/usage

# Check capacity
curl http://localhost:5000/api/resources/capacity
```

---

## 🐛 **TROUBLESHOOTING:**

### **Issue: Backend won't start**
```bash
# Check MongoDB
mongosh

# Check environment variables
cat backend/.env

# Check logs
cat backend/error.log
```

### **Issue: Frontend won't start**
```bash
# Clear cache
rm -rf frontend/.next

# Reinstall dependencies
cd frontend
rm -rf node_modules
npm install
```

### **Issue: Resource monitoring not working**
```bash
# Check if cron jobs started
# Look for: "✅ Resource monitoring started"

# Check logs
tail -f backend/logs/combined.log | grep "Resource monitoring"
```

### **Issue: Capacity calculation wrong**
```bash
# Check if planType is set
mongosh
use vercel-clone
db.users.find({}, {email: 1, planType: 1})

# Should see planType: 'free', 'pro', or 'enterprise'
```

---

## 📝 **ENVIRONMENT VARIABLES:**

### **Required:**
```bash
# Backend (.env)
MONGODB_URI=mongodb://localhost:27017/vercel-clone
JWT_SECRET=your-secret-key
PORT=5000
FRONTEND_URL=http://localhost:3000

# Server SSH (for production)
EC2_HOST=your-ec2-ip
SSH_EC2_KEY=/path/to/key
EC3_HOST=your-ec3-ip
SSH_EC3_KEY=/path/to/key
```

### **Optional:**
```bash
NODE_ENV=production
SESSION_SECRET=your-session-secret
```

---

## ✅ **PRODUCTION DEPLOYMENT:**

### **Step 1: Prepare**
```bash
# Update environment variables
vi backend/.env

# Set production URLs
FRONTEND_URL=https://your-domain.com
NODE_ENV=production
```

### **Step 2: Build Frontend**
```bash
cd frontend
npm run build
```

### **Step 3: Start Services**
```bash
# Backend (with PM2)
cd backend
pm2 start server.js --name "platform-backend"

# Frontend (with PM2)
cd frontend
pm2 start npm --name "platform-frontend" -- start
```

### **Step 4: Verify**
```bash
# Check services
pm2 list

# Check logs
pm2 logs

# Test endpoints
curl https://your-domain.com/health
```

---

## 🎉 **YOU'RE READY!**

**Everything is:**
- ✅ Fixed
- ✅ Tested
- ✅ Documented
- ✅ Production ready

**Next Steps:**
1. Start backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npm run dev`
3. Open admin panel: `http://localhost:3000/admin`
4. Test features
5. Deploy to production

**Need Help?**
- Check `ALL_FIXES_COMPLETED.md` for details
- Check `DEEP_CODE_REVIEW_FINAL.md` for review
- Check `QUICK_FIX_REFERENCE.md` for quick fixes

🚀 **HAPPY DEPLOYING!**
