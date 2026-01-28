# 🧪 QA Verification Checklist - Vercel Clone Platform

**Last Updated:** January 28, 2026  
**Platform URL:** https://foodpanda.site  
**Tester Role:** QA Engineer & Product Manager

---

## 📋 Pre-Test Setup

### Environment Check
```bash
# 1. Verify all services are running
pm2 list
# Expected: backend (online), frontend (online)

docker ps
# Expected: MongoDB, Redis containers running

# 2. Check platform health
curl https://foodpanda.site/api/health
# Expected: {"status":"healthy","mongodb":"connected","redis":"connected"}

# 3. View logs (keep open in separate terminal)
pm2 logs
```

### Test Accounts Required
- [ ] **Free User** (new registration)
- [ ] **Pro User** (upgrade via admin or billing)
- [ ] **Admin User** (use `node backend/make-admin.js <email>`)

---

## 1️⃣ Authentication & Onboarding

### 1.1 Sign Up Flow
**URL:** https://foodpanda.site/signup

- [ ] Click "Sign Up"
- [ ] Fill form:
  - Email: `test-free-user@example.com`
  - Password: `Test123!@#`
  - Name: `Free User`
- [ ] Submit and verify:
  - ✅ Redirects to `/dashboard`
  - ✅ Shows welcome message
  - ✅ Dashboard displays "Free Trial" plan badge
  - ✅ No credit card required

**Backend Verification:**
```bash
# Check user was created with correct plan
mongo
use vercel_clone_platform
db.users.findOne({email: "test-free-user@example.com"})
# Expected: { plan: "free", ... }
```

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 1.2 Login/Logout Flow
**URL:** https://foodpanda.site/login

- [ ] Logout from current session
- [ ] Login with credentials from 1.1
- [ ] Verify:
  - ✅ Successful login → redirects to `/dashboard`
  - ✅ Dashboard shows user's name and plan
- [ ] Click user menu → Logout
- [ ] Verify:
  - ✅ Redirects to `/login`
  - ✅ Cannot access `/dashboard` (redirects to login)

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 1.3 Session Persistence
**Test:** Close browser → Reopen → Navigate to `/dashboard`

- [ ] Verify:
  - ✅ Still logged in (no login prompt)
  - ✅ Cookie `connect.sid` exists with `HttpOnly`, `Secure`, `SameSite=Lax`

**Browser DevTools Check:**
```
Application → Cookies → https://foodpanda.site
Check: connect.sid cookie attributes
```

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

## 2️⃣ Project Creation

### 2.1 Create Blank Project
**URL:** https://foodpanda.site/dashboard

- [ ] Click "New Project"
- [ ] Fill form:
  - Name: `my-test-app`
  - Framework: `Next.js`
  - Git Repo: (leave blank for now)
- [ ] Click "Create"
- [ ] Verify:
  - ✅ Project appears in dashboard
  - ✅ Has unique slug (e.g., `my-test-app-a1b2c3`)
  - ✅ Status: `Not Deployed` or `Ready`

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 2.2 Import from GitHub
**URL:** https://foodpanda.site/dashboard

**Prerequisites:** GitHub OAuth configured (check `backend/.env` → `GITHUB_CLIENT_ID`)

- [ ] Click "New Project" → "Import from GitHub"
- [ ] Authorize GitHub (if first time)
- [ ] Select a test repository (or use: `https://github.com/vercel/next.js/tree/canary/examples/blog`)
- [ ] Click "Import"
- [ ] Verify:
  - ✅ Project created with repo linked
  - ✅ Auto-deploy starts (if configured)
  - ✅ GitHub webhook added (check repo settings)

**GitHub Webhook Check:**
```
GitHub → Repo Settings → Webhooks
Expected: https://foodpanda.site/api/webhooks/github
```

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

## 3️⃣ Template System (Critical)

### 3.1 Browse Template Marketplace
**URL:** https://foodpanda.site/templates

- [ ] Verify page loads with template grid
- [ ] Check template cards display:
  - ✅ Template name & description
  - ✅ Preview image (static screenshot)
  - ✅ Plan badge (FREE, PRO, ENTERPRISE)
  - ✅ Framework icon/label

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 3.2 Preview Behavior (Crucial Fix)
**As Free User:**

- [ ] Click on a **Pro-tier template card**
- [ ] Verify:
  - ✅ Shows static preview image (NOT redirecting to external URL)
  - ✅ "Live Preview" button is MISSING or DISABLED
  - ✅ Lock icon overlay with "Upgrade to Pro" badge
  - ✅ Cannot deploy (upgrade prompt shown)

**As Pro User:**

- [ ] Login as Pro user
- [ ] Click on a **Pro-tier template**
- [ ] Verify:
  - ✅ Shows preview image
  - ✅ "Use Template" button is active
  - ✅ No upgrade prompt

**Expected Behavior:**
- ❌ NO redirects to `vercel.com/templates/*`
- ✅ Preview images are hosted locally or from CDN
- ✅ "Live Preview" only shows if admin has deployed internal demos

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 3.3 Deploy Template (Free Tier)
**URL:** https://foodpanda.site/templates

**As Free User:**

- [ ] Select a **Free-tier template** (e.g., "Next.js Starter")
- [ ] Click "Use Template"
- [ ] Fill deployment form:
  - Project Name: `nextjs-demo`
- [ ] Click "Deploy"
- [ ] Verify:
  - ✅ Deployment starts immediately
  - ✅ Build logs stream in real-time
  - ✅ Status: `Queued` → `Building` → `Success`

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 3.4 Dependency Check (pnpm Fallback)
**Test:** Deploy a template that uses `pnpm` (e.g., Next.js Commerce)

- [ ] Select template with `pnpm-lock.yaml`
- [ ] Start deployment
- [ ] Monitor build logs:
  - ✅ System detects `pnpm-lock.yaml`
  - ✅ Falls back to `npm install` (or uses `pnpm` if available)
  - ✅ Build succeeds without errors

**Backend Log Check:**
```bash
pm2 logs backend | grep -i "pnpm"
# Expected: "Detected pnpm, using npm as fallback"
```

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

## 4️⃣ Deployment Engine

### 4.1 Manual Deployment
**URL:** https://foodpanda.site/dashboard/projects/[projectId]

- [ ] Open existing project
- [ ] Click "Deploy" button
- [ ] Verify:
  - ✅ Deployment queued (shows in deployment history)
  - ✅ Build logs appear
  - ✅ Real-time log streaming works

**Expected Log Flow:**
```
[Queued] Deployment queued...
[Building] Pulling source code...
[Building] Installing dependencies...
[Building] Running build command...
[Building] Creating Docker image...
[Success] Deployment live at https://my-app.foodpanda.site
```

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 4.2 Preview URL Generation & Access
**Critical Test:** Verify deployed app actually loads

- [ ] Copy preview URL from deployment logs (e.g., `https://my-app-a1b2c3.foodpanda.site`)
- [ ] Open in new browser tab
- [ ] Verify:
  - ✅ Page loads successfully (NOT 502/404)
  - ✅ SSL certificate valid (https)
  - ✅ App runs as expected (interactive, not just static HTML)

**Nginx Configuration Check:**
```bash
# On server
sudo cat /etc/nginx/sites-enabled/foodpanda.site
# Expected: proxy_pass to correct Docker container port
```

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 4.3 Build Failure Handling
**Test:** Force a build failure

- [ ] Create project with invalid `package.json` or broken build script
- [ ] Trigger deployment
- [ ] Verify:
  - ✅ Status changes to `Failed`
  - ✅ Error logs clearly shown
  - ✅ Previous deployment (if any) remains active
  - ✅ Rollback option available

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

## 5️⃣ Environment Variables

### 5.1 Add Environment Variable
**URL:** https://foodpanda.site/dashboard/projects/[projectId]/settings

- [ ] Navigate to Project Settings → Environment Variables
- [ ] Click "Add Variable"
- [ ] Add:
  - Key: `API_KEY`
  - Value: `test_secret_key_123`
  - Environment: `Production`
- [ ] Save

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 5.2 Verify Runtime Access
**Test:** Redeploy and check if app can access env var

- [ ] Trigger new deployment
- [ ] Check build logs for env var injection
- [ ] Visit deployed app
- [ ] Check app console/logs:

**Test Method (in deployed app):**
```javascript
// Add this to your app's code temporarily
console.log('API_KEY:', process.env.API_KEY);
```

- [ ] Verify:
  - ✅ `API_KEY` is accessible
  - ✅ Value matches what was set
  - ✅ Env var NOT exposed in browser (if server-side only)

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

## 6️⃣ Custom Domains

### 6.1 Assign Custom Domain
**URL:** https://foodpanda.site/dashboard/projects/[projectId]/domains

**Prerequisites:** Have a domain/subdomain pointing to server IP

- [ ] Click "Add Domain"
- [ ] Enter: `test.yourdomain.com`
- [ ] Click "Add"
- [ ] Verify:
  - ✅ Domain appears in list
  - ✅ Shows DNS verification status
  - ✅ SSL certificate provisioning starts

**DNS Setup (do this first):**
```
Type: A Record
Host: test
Value: [Your Server IP]
```

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 6.2 SSL Certificate Verification
**Test:** Check SSL termination

- [ ] Wait for SSL cert to provision (can take 1-5 minutes)
- [ ] Visit `https://test.yourdomain.com`
- [ ] Verify:
  - ✅ Page loads with valid SSL (no browser warnings)
  - ✅ Certificate issued by Let's Encrypt (or configured CA)
  - ✅ Auto-redirects from `http://` to `https://`

**Browser Security Check:**
```
1. Click padlock icon in browser
2. View Certificate
Expected: Issued to test.yourdomain.com, Valid dates
```

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

## 7️⃣ Resource Limits & Plan Enforcement

### 7.1 Free Plan Limits
**As Free User:**

- [ ] Go to Dashboard → Usage
- [ ] Verify displays:
  - ✅ CPU usage (%)
  - ✅ RAM usage (MB)
  - ✅ Storage usage (MB)
  - ✅ Bandwidth usage (GB)
  - ✅ "X of Y limit" for each resource

**Free Plan Limits (from backend/models/Plan.js):**
```
CPU: 0.5 cores
RAM: 512 MB
Storage: 1 GB
Bandwidth: 10 GB/month
Projects: 3
Deployments: 10/day
```

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 7.2 Limit Enforcement Test
**Test:** Exceed free plan limits

- [ ] Create 4 projects as Free user (exceeds 3-project limit)
- [ ] Verify:
  - ✅ 4th project creation blocked
  - ✅ Error message: "Upgrade to Pro for more projects"
  - ✅ Upgrade button/link shown

**Alternative Test:**
- [ ] Try to deploy when daily deployment limit reached
- [ ] Verify similar blocking behavior

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

## 8️⃣ Git Integration & Webhooks

### 8.1 Auto-Deploy on Git Push
**Prerequisites:** Project connected to GitHub repo

**Test:**
```bash
# 1. Clone the connected repo locally
git clone https://github.com/yourusername/test-repo.git
cd test-repo

# 2. Make a simple change
echo "# Updated" >> README.md
git add .
git commit -m "Test auto-deploy"
git push origin main

# 3. Check platform dashboard
```

- [ ] Verify within 30 seconds:
  - ✅ New deployment appears in project history
  - ✅ Status: `Queued` → `Building` → `Success`
  - ✅ Deployment triggered by webhook (check logs)

**Webhook Verification:**
```bash
pm2 logs backend | grep -i "webhook"
# Expected: "GitHub webhook received for repo:..."
```

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 8.2 Webhook Failure Handling
**Test:** Disable webhook temporarily

- [ ] GitHub: Repo → Settings → Webhooks → Edit → Change URL to invalid
- [ ] Push a commit
- [ ] Verify:
  - ✅ Platform does NOT auto-deploy (expected)
  - ✅ Manual deploy still works
  - ✅ Dashboard shows webhook connection issue

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

## 9️⃣ Billing & Plans

### 9.1 View Plans
**URL:** https://foodpanda.site/dashboard/billing

- [ ] Click "Upgrade Plan" or "Billing"
- [ ] Verify page shows:
  - ✅ Current plan highlighted (e.g., "Free Trial")
  - ✅ Available plans: Pro, Enterprise
  - ✅ Feature comparison table
  - ✅ Pricing displayed

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 9.2 Plan Upgrade (Manual/Admin)
**Since Stripe may not be live, test admin upgrade:**

```bash
# On server
cd /var/www/platform/backend
node make-admin.js test-free-user@example.com upgrade pro
```

- [ ] Verify:
  - ✅ User's plan changes to "Pro"
  - ✅ Dashboard reflects new plan
  - ✅ Pro features unlocked (e.g., more projects, advanced templates)

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 9.3 Feature Lock for Free Users
**Test:** Access Pro-only features as Free user

- [ ] Try to:
  - Deploy Pro template → Should show upgrade modal
  - Add 4th project → Should block with upgrade prompt
  - Access Team Collaboration → Should redirect to billing

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

## 🔟 Logs & Monitoring

### 10.1 View Build Logs
**URL:** https://foodpanda.site/dashboard/projects/[projectId]/deployments/[deploymentId]

- [ ] Click on a deployment
- [ ] Verify:
  - ✅ Full build log visible
  - ✅ Log updates in real-time (if building)
  - ✅ Logs persist after completion
  - ✅ Can download logs (if feature exists)

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 10.2 View Runtime Logs
**URL:** https://foodpanda.site/dashboard/projects/[projectId]/logs

- [ ] Navigate to Logs tab
- [ ] Verify:
  - ✅ Shows application stdout/stderr
  - ✅ Real-time streaming (if active)
  - ✅ Filterable by level (info/warn/error)

**If Not Implemented:**
- [ ] Check Docker logs manually:
```bash
docker ps | grep my-app
docker logs [container-id]
```

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 10.3 View Deployment History
**URL:** https://foodpanda.site/dashboard/projects/[projectId]

- [ ] Check Deployments tab
- [ ] Verify shows:
  - ✅ List of all deployments
  - ✅ Status for each (success/failed/building)
  - ✅ Deploy time & duration
  - ✅ Commit hash (if GitHub connected)
  - ✅ Deployed URL

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

## 1️⃣1️⃣ Production Reliability

### 11.1 Graceful Backend Restart
**Test:** Restart during active deployment

```bash
# Terminal 1: Start a deployment (deploy a large app)
# Terminal 2: While building, run:
pm2 restart backend
```

- [ ] Verify:
  - ✅ Deployment continues or fails gracefully (NOT stuck in "Building" forever)
  - ✅ Job queue (Redis) retains state
  - ✅ New deployments can be created immediately after restart
  - ✅ No 502 errors on frontend

**Backend Job Queue Check:**
```bash
docker exec -it redis redis-cli
KEYS deployment:*
# Expected: Jobs persist across restart
```

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 11.2 Database Connection Failure
**Test:** Simulate MongoDB outage

```bash
# Stop MongoDB
docker stop mongodb
```

- [ ] Try to:
  - Login → Should show error (not crash)
  - Create project → Should show error
  - View dashboard → Should show error

```bash
# Restart MongoDB
docker start mongodb
```

- [ ] Verify:
  - ✅ Platform recovers automatically
  - ✅ No manual intervention needed
  - ✅ Reconnects to database

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 11.3 Container Cleanup
**Test:** Verify old deployments are cleaned up

- [ ] Deploy multiple times to same project (5-10 deployments)
- [ ] Check Docker containers:
```bash
docker ps -a | grep my-app
```

- [ ] Verify:
  - ✅ Only recent deployments have running containers
  - ✅ Old containers are stopped/removed (if cleanup enabled)
  - ✅ Disk space not endlessly consumed

**Expected Behavior:**
- Keep last 3-5 deployments active
- Older ones stopped/removed by cron job or service

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

## 1️⃣2️⃣ Admin: Internal Template Demos (Advanced)

### 12.1 Admin Login
**URL:** https://foodpanda.site/admin

**Prerequisites:** Create admin user first
```bash
cd /var/www/platform/backend
node make-admin.js your-email@example.com
```

- [ ] Login with admin credentials
- [ ] Verify:
  - ✅ Admin panel loads
  - ✅ Shows admin-only sections: Users, Templates, Servers, Settings

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 12.2 Deploy Template Internally
**Goal:** Create live preview demos

- [ ] Navigate to: Admin → Templates
- [ ] Select a template (e.g., "Next.js Commerce")
- [ ] Click "Deploy Demo" or similar button
- [ ] Fill form:
  - Deploy to: EC2/EC3 (select server)
  - Subdomain: `commerce-demo`
- [ ] Click "Deploy"
- [ ] Verify:
  - ✅ Deployment starts
  - ✅ Returns live URL: `https://commerce-demo.foodpanda.site`
  - ✅ URL accessible publicly

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 12.3 Verify Live URL
**Test:** Click generated demo URL

- [ ] Visit `https://commerce-demo.foodpanda.site`
- [ ] Verify:
  - ✅ Loads fully functional demo app
  - ✅ NOT just a screenshot
  - ✅ Interactive (can navigate, click buttons)
  - ✅ SSL valid

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 12.4 Template Live Preview Button
**Goal:** Verify "Live Preview" appears for deployed templates

**As Regular User:**
- [ ] Navigate to: https://foodpanda.site/templates
- [ ] Find the template you just deployed (e.g., "Next.js Commerce")
- [ ] Verify:
  - ✅ "Live Preview" button is now visible
  - ✅ Clicking it opens `https://commerce-demo.foodpanda.site` in new tab
  - ✅ Does NOT redirect to vercel.com

**For Non-Deployed Templates:**
- [ ] Find a template NOT yet deployed by admin
- [ ] Verify:
  - ✅ "Live Preview" button is hidden/disabled
  - ✅ Shows static preview image only
  - ✅ Hover text: "Demo not available" (or similar)

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

### 12.5 Deploy Missing Templates
**Workflow:** Admin deploys all missing template demos

- [ ] Admin panel: View templates without live demos (filter/flag)
- [ ] Bulk deploy or deploy one-by-one
- [ ] Verify:
  - ✅ All templates now have live URLs
  - ✅ Template marketplace shows "Live Preview" for all
  - ✅ User experience is seamless

**Automation (Optional):**
```bash
# Script to deploy all templates
cd /var/www/platform/backend
node scripts/deploy-all-templates.js
```

**Result:** ✅ PASS / ❌ FAIL  
**Notes:**

---

## 📊 Test Summary Report

### Overall Results
- **Total Tests:** 50+
- **Passed:** ___
- **Failed:** ___
- **Skipped:** ___

### Critical Issues Found
1. 
2. 
3. 

### Recommendations
1. 
2. 
3. 

### Next Steps
- [ ] Fix critical bugs
- [ ] Retest failed scenarios
- [ ] Document workarounds
- [ ] Update user guide

---

## 📞 Support & Documentation

**Documentation:**
- [Admin Guide](./ADMIN_GUIDE.md)
- [User Guide](./USER_GUIDE.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Features Testing Guide](./FEATURES_TESTING_GUIDE.md)

**Logs Location:**
```bash
# Backend logs
pm2 logs backend

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Docker logs
docker logs mongodb
docker logs redis
```

**Common Issues:**
1. **502 Bad Gateway:** Backend not running (`pm2 restart backend`)
2. **Template not loading:** Check GitHub repo access
3. **Deployment stuck:** Restart Redis (`docker restart redis`)
4. **SSL errors:** Re-run `./setup-ssl.sh`

---

**End of QA Checklist**
