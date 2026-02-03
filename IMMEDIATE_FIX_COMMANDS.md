# Immediate Fix Commands - Run on Production Server

## Step 1: Pull Latest Fixes
```bash
cd ~/hosting_plateform
git pull origin optimization2
```

## Step 2: Fix Current Stuck Deployment (Manual DB Fix)
```bash
cd ~/hosting_plateform/backend
node scripts/fix-stuck-deployments.js
```

**This script will**:
- Find all templates stuck in "deploying" state
- Check if deployment exists and how long it's been running
- Mark as failed if > 10 minutes or deployment failed
- Reset template status
- Show you what was fixed

## Step 3: Restart Services
```bash
pm2 reload all
```

## Step 4: Verify Fixes
```bash
# Check backend is running
pm2 logs backend --lines 20

# Should see:
# - "Server running on port 5000"
# - "MongoDB connected"
# - "WebSocket server started"
```

## Step 5: Test in Browser
```
1. Open: https://foodpanda.site/admin/templates
2. You should see:
   - ❌ Failed deployment card (red)
   - Error message displayed
   - 🗑️ "Delete Demo" button
   - 🔄 "Redeploy" button
3. Click "Redeploy" to try again
4. Or click "Delete Demo" to remove it
```

---

## If You Want to Fix the Prisma Error

The template has an invalid Prisma schema. Quick fix:

### Option 1: Add DATABASE_URL to Template (Via UI)
```
1. Admin → Templates → Edit "Smart Portfolio"
2. Environment Variables tab → Add:
   - Key: DATABASE_URL
   - Default Value: file:./data/portfolio.db
   - Required: Yes
3. Save
4. Delete failed demo
5. Redeploy
```

### Option 2: Fix Template Repository (Proper Fix)
```bash
# On your local machine or server
git clone https://github.com/uzairtesta/nextjs-portfolio.git
cd nextjs-portfolio

# Edit prisma/schema.prisma
# Change line 4 from:
#   url = env("DATABASE_URL") != "" ? env("DATABASE_URL") : "file:./data/portfolio.db"
# To:
#   url = env("DATABASE_URL")

nano prisma/schema.prisma  # or vim

# Commit and push
git add prisma/schema.prisma
git commit -m "Fix Prisma schema syntax"
git push

# Then redeploy from admin panel
```

---

## Expected Output

### After Running fix-stuck-deployments.js:
```
✅ Connected to MongoDB

🔍 Found 1 templates stuck in deploying state

📋 Template: Smart Portfolio
   ID: 673abc123...
   Status: deploying
   Progress: 0%
   Deployment: 6981eb6df7ae15c9849a2c17
   Deployment Status: failed
   Created: 2026-02-03T12:34:54.000Z
   Age: 15 minutes
   ⚠️  Marking as failed...
   ✅ Marked as failed

✅ All stuck deployments fixed!

Refresh your admin panel to see the changes.
✅ Disconnected from MongoDB
```

### After Reloading PM2:
```
[PM2] Applying action reloadProcessId on app [backend](ids: [ 9 ])
[PM2] [backend](9) ✓
[PM2] Applying action reloadProcessId on app [frontend](ids: [ 5 ])
[PM2] [frontend](5) ✓
```

### In Admin Panel (After Refresh):
- ❌ Error card shown (red)
- Error message: "Prisma schema validation error..."
- 🗑️ "Delete Demo" button visible
- 🔄 "Redeploy" button visible
- ✅ No loading spinner (stopped)

---

## Run These Commands Now:

```bash
# 1. Pull fixes
cd ~/hosting_plateform && git pull origin optimization2

# 2. Fix stuck deployment
cd backend && node scripts/fix-stuck-deployments.js

# 3. Reload services
pm2 reload all

# 4. Check it's working
pm2 status
```

**Then refresh your browser and the stuck deployment will show as failed with delete/redeploy buttons!**
