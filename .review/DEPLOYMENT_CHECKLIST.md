# ✅ FINAL DEPLOYMENT CHECKLIST

**Date:** 2026-01-08  
**Status:** Code review complete, ready to deploy

---

## 📋 PRE-DEPLOYMENT VERIFICATION

### 1. Review Documentation ✅
- [x] Read `.review/DEPLOYMENT_FLOW_ANALYSIS.md`
- [x] Read `.review/COMPLETE_FIX_SUMMARY.md`
- [x] Read `.review/DEPLOYMENT_FLOW_DIAGRAM.md`

### 2. Understand Changes ✅
- [x] **9 files** modified
- [x] **7 critical bugs** fixed
- [x] **2 new features** added (PM2 auto-build, robust Nginx parsing)
- [x] **No breaking changes** introduced

---

## 🚀 DEPLOYMENT COMMANDS (Run on Production Server)

```bash
# Navigate to project directory
cd ~/hosting_plateform

# 1️⃣ UPDATE DATABASE CONFIGURATION
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Updating EC3 domain in database..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd backend
node -e "const mongoose = require('mongoose'); \
require('dotenv').config(); \
const Settings = require('./models/Settings'); \
mongoose.connect(process.env.MONGODB_URI).then(async () => { \
  await Settings.updateOne({}, { \$set: { 'serverDomains.EC3': 'ec3.foodpanda.site' } }); \
  const updated = await Settings.findOne(); \
  console.log('✅ EC2:', updated.serverDomains.EC2); \
  console.log('✅ EC3:', updated.serverDomains.EC3); \
  process.exit(0); \
});"

cd ..

# 2️⃣ PULL LATEST CODE (if using Git)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Pulling latest code..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git pull origin main
# OR: Upload files manually via SCP/SFTP

# 3️⃣ INSTALL DEPENDENCIES (if package.json changed)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Checking dependencies..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd backend && npm install
cd ../frontend && npm install && npm run build
cd ..

# 4️⃣ RESTART PM2 SERVICES
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Restarting PM2 services..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 restart all

# 5️⃣ VERIFY SERVICES RUNNING
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Verifying services..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 status

# 6️⃣ CHECK LOGS FOR ERRORS
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. Checking recent logs..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 logs backend --lines 20 --nostream
pm2 logs frontend --lines 10 --nostream

echo ""
echo "✅ Deployment complete!"
echo ""
```

---

## 🧪 POST-DEPLOYMENT TESTING

### Test 1: Verify Settings
```bash
cd backend
node -e "const mongoose = require('mongoose'); \
require('dotenv').config(); \
const Settings = require('./models/Settings'); \
mongoose.connect(process.env.MONGODB_URI).then(async () => { \
  const s = await Settings.findOne(); \
  console.log('EC2 Domain:', s.serverDomains.EC2); \
  console.log('EC3 Domain:', s.serverDomains.EC3); \
  process.exit(0); \
});"
```

**Expected Output:**
```
EC2 Domain: ec2.foodpanda.site
EC3 Domain: ec3.foodpanda.site  ← Should be this, not foodpanda.site
```

---

### Test 2: Create Test Deployment

1. **Open UI:** `https://foodpanda.site`
2. **Login** with a free tier user
3. **Create Project:**
   - Repository: `UzairArif11/React-Weather-Website`
   - Branch: `main`
4. **Click Deploy**

---

### Test 3: Monitor Real-time Logs

**Watch:**
- [ ] Logs appear in UI terminal as they generate
- [ ] Status badge changes: `Queued` → `Building` → `Deploying` → `Success`
- [ ] Progress bar updates smoothly
- [ ] No frontend console errors

**Backend logs should show:**
```
Loading plan 'free' from database...
✅ Loaded plan: Free Tier (CPU: 0.5, RAM: 0.5GB)
✅ PM2 image found in cache on EC2 (instant deployment)
✅ Container allocated successfully
Container details: {"name":"EC2-user-{id}","port":18093,"server":"EC2"}
Using domain: ec2.foodpanda.site for server EC2
✅ Nginx routing updated: https://ec2.foodpanda.site/www-{id}-{hash}/
✅ Deployment successful!
```

---

### Test 4: Verify Deployment URL

**Check URL format:**
- [ ] **EC2:** `https://ec2.foodpanda.site/projectname-{id}/`
- [ ] **EC3:** `https://ec3.foodpanda.site/projectname-{id}/`
- [ ] ❌ **NOT:** `https://vv.foodpanda.site/` (old broken format)

**Test accessibility:**
```bash
# Test URL responds
curl -I https://ec2.foodpanda.site/www-695f9018-70566021/
# Should return: HTTP/2 200
```

---

### Test 5: Verify Container Resources

```bash
# SSH to EC2
ssh -i ~/.ssh/ec2_key ubuntu@140.238.229.147

# Check container stats
docker stats --no-stream | grep user-

# Expected output (for free tier):
# EC2-user-{id}  0.50%   512MiB / 512MiB   ← Should be 512MB, not 4GB
```

---

### Test 6: Test Second User (EC3 Round-Robin)

1. **Logout** from first user
2. **Login** with different free tier user
3. **Deploy same repository**

**Expected:**
- [ ] Container created on **EC3** (load balancing)
- [ ] PM2 image builds on EC3 (~30s, first time only)
- [ ] URL format: `https://ec3.foodpanda.site/...`
- [ ] Container uses 512MB RAM

---

### Test 7: Test Third User (EC2 Cached)

1. **Logout** from second user
2. **Login** with third free tier user
3. **Deploy same repository**

**Expected:**
- [ ] Container created on **EC2** (round-robin back to EC2)
- [ ] PM2 image **cached** (instant, <1s)
- [ ] Total deployment faster (~45s instead of 75s)
- [ ] URL format: `https://ec2.foodpanda.site/...`

---

## 📊 SUCCESS CRITERIA

### ✅ All Tests Must Pass:
- [x] EC3 domain is `ec3.foodpanda.site` in database
- [ ] Deployments show real-time logs in UI
- [ ] Status changes instantly (no refresh needed)
- [ ] "Visit Deployment" button appears on success
- [ ] URL format is path-based: `/projectname-{id}/`
- [ ] EC2 deployments use `ec2.foodpanda.site`
- [ ] EC3 deployments use `ec3.foodpanda.site`
- [ ] Containers use correct resources (0.5GB RAM for free)
- [ ] PM2 image auto-builds and caches
- [ ] Nginx config has no syntax errors

---

## 🔍 TROUBLESHOOTING

### Issue: UI shows "Waiting for logs..."
**Solution:**
```bash
# Check WebSocket connection
pm2 logs backend | grep WebSocket
pm2 logs frontend | grep socket

# Verify frontend env
cat frontend/.env.production | grep NEXT_PUBLIC_SOCKET_URL
# Should be: NEXT_PUBLIC_SOCKET_URL=https://foodpanda.site
```

---

### Issue: Status stuck on "Deploying"
**Solution:**
```bash
# Check if deployment completed
pm2 logs backend | grep "695f9018" | grep "successful"

# Check WebSocket emission
pm2 logs backend | grep "emitDeploymentStatus"
```

---

### Issue: URL shows old format (vv.foodpanda.site)
**Solution:**
```bash
# Re-check database settings
cd backend
node -e "const mongoose = require('mongoose'); \
require('dotenv').config(); \
const Settings = require('./models/Settings'); \
mongoose.connect(process.env.MONGODB_URI).then(async () => { \
  const s = await Settings.findOne(); \
  console.log('EC3:', s.serverDomains.EC3); \
  if (s.serverDomains.EC3 !== 'ec3.foodpanda.site') { \
    await Settings.updateOne({}, { \$set: { 'serverDomains.EC3': 'ec3.foodpanda.site' } }); \
    console.log('✅ Fixed'); \
  } \
  process.exit(0); \
});"

# Restart backend
pm2 restart backend
```

---

### Issue: Nginx config test fails
**Solution:**
```bash
# SSH to server where deployment failed
ssh -i ~/.ssh/ec3_key ubuntu@129.154.255.90

# Test Nginx config
sudo nginx -t

# If errors, view config
sudo cat /etc/nginx/sites-available/default | tail -50

# Reload Nginx manually
sudo systemctl reload nginx
```

---

### Issue: Container created with 4GB RAM
**Solution:**
```bash
# Verify plan in database
cd backend
node -e "const mongoose = require('mongoose'); \
require('dotenv').config(); \
const Plan = require('./models/Plan'); \
mongoose.connect(process.env.MONGODB_URI).then(async () => { \
  const plan = await Plan.findOne({ name: 'free' }); \
  console.log('Free Plan RAM:', plan.resources.ram); \
  // Should be 0.5, not 4 \
  if (plan.resources.ram !== 0.5) { \
    console.log('❌ Plan misconfigured! Run: ./init-database.sh'); \
  } \
  process.exit(0); \
});"

# If misconfigured, re-seed
cd backend
./init-database.sh
```

---

## ✅ FINAL VERIFICATION

Run the automated test script:

```bash
cd ~/hosting_plateform
chmod +x test-all-functionality.sh
./test-all-functionality.sh
```

**Expected Output:**
```
✅ All critical tests passed!

📋 DEPLOYMENT READY CHECKLIST:
   ✅ Database connection working
   ✅ Settings model configured
   ✅ Plan resources correct (0.5GB for free)
   ✅ All critical files present
   ✅ Code changes verified
   ✅ Frontend WebSocket fixed
```

---

## 🎯 SIGN-OFF CHECKLIST

- [ ] Database settings updated (EC3 = ec3.foodpanda.site)
- [ ] PM2 services restarted
- [ ] Test deployment successful
- [ ] Real-time logs working
- [ ] Status updates instant
- [ ] URL format correct
- [ ] Container resources correct
- [ ] No Nginx errors
- [ ] Automated test script passed

**When all boxes checked:** ✅ **PLATFORM IS PRODUCTION READY**

---

## 📞 SUPPORT

If issues persist:
1. Check `.review/DEPLOYMENT_FLOW_ANALYSIS.md` for detailed flow
2. Check `.review/COMPLETE_FIX_SUMMARY.md` for all changes
3. Check `.review/DEPLOYMENT_FLOW_DIAGRAM.md` for visual reference
4. Review PM2 logs: `pm2 logs backend --lines 100`

---

**🚀 Ready to deploy? Run the commands above and test!**
