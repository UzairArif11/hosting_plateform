# 🚀 QUICK START GUIDE - Get Everything Running

**Goal:** Fix CORS and get the platform fully operational

---

## ⚡ IMMEDIATE FIX - CORS Issue

### Problem
Backend is sending wrong CORS header: `http://localhost:5000` instead of `http://localhost:3000`

### Solution (5 minutes)

#### Step 1: Stop All Servers
```powershell
# Kill all node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Verify port 5000 is free
Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
# Should return nothing
```

#### Step 2: Verify Environment Variable
```powershell
cd backend
Get-Content .env | Select-String "FRONTEND_URL"
# Should show: FRONTEND_URL=http://localhost:3000
```

If not, add it:
```bash
echo FRONTEND_URL=http://localhost:3000 >> .env
```

#### Step 3: Start Backend Fresh
```powershell
cd backend
npm run dev
```

Wait for: `✅ MongoDB connected successfully` and `🚀 Server running on port 5000`

#### Step 4: Start Frontend Fresh
```powershell
# In a new terminal
cd frontend
Remove-Item -Path .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```

Wait for: `✓ Ready in Xms`

#### Step 5: Test
Open browser: http://localhost:3000

Check browser console (F12) - **NO CORS errors should appear!**

---

## 🎯 COMPLETE SETUP FROM SCRATCH

If you need to start everything fresh:

### 1. Start MongoDB
```powershell
cd d:/work/vercel-clone-platform
docker-compose up -d
```

Verify:
```powershell
docker ps | Select-String "mongo"
# Should show 2 containers running
```

### 2. Start Backend
```powershell
cd backend

# Clean start
Remove-Item -Path node_modules -Recurse -Force -ErrorAction SilentlyContinue
npm install
npm run dev
```

### 3. Start Frontend
```powershell
cd frontend

# Clean start
Remove-Item -Path .next -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path node_modules -Recurse -Force -ErrorAction SilentlyContinue
npm install
npm run dev
```

### 4. Make Yourself Admin
```powershell
cd backend
node make-admin.js your-email@gmail.com
```

### 5. Test Everything

**Landing Page:**
http://localhost:3000

**Login:**
http://localhost:3000/login

**Dashboard (after login):**
http://localhost:3000/dashboard

**Admin Panel (after making yourself admin):**
http://localhost:3000/admin

---

## 🔍 VERIFICATION CHECKLIST

### Backend Health
```powershell
# Test health endpoint
Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing

# Expected: StatusCode 200
```

### Frontend Health
```powershell
# Test frontend
Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing

# Expected: StatusCode 200
```

### CORS Check
Open http://localhost:3000 in browser

Press F12 (Developer Tools) → Console tab

**Should NOT see:** "Access to XMLHttpRequest... has been blocked by CORS policy"

**Should see:** No CORS errors

### Database Check
```powershell
# Check MongoDB
docker exec vercel-clone-mongodb mongosh -u admin -p password123 --authenticationDatabase admin --eval "db.adminCommand('ping')"

# Expected: { ok: 1 }
```

---

## 🎨 TESTING THE PLATFORM

### 1. Test Landing Page
- Visit: http://localhost:3000
- Should see: Beautiful landing page
- Click: "Get Started" or "Login"

### 2. Test Login
- Click: "Login with GitHub" or "Login with Google"
- Complete OAuth flow
- Should redirect to: /dashboard

### 3. Test User Dashboard
- View: Dashboard statistics
- Click: "Projects" in sidebar
- Try: Creating a new project
- Try: Deleting a project

### 4. Test Admin Panel

**First, make yourself admin:**
```powershell
cd backend
node make-admin.js your-email@gmail.com
```

**Then:**
- Logout and login again
- Visit: http://localhost:3000/admin
- Test all 5 admin pages:
  - Dashboard
  - Users
  - Projects
  - Servers
  - Settings

---

## 🐛 TROUBLESHOOTING

### Issue: CORS Error Still Appears

**Solution 1: Hard Refresh**
```
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

**Solution 2: Clear Browser Cache**
1. F12 → Network tab
2. Right-click → "Clear browser cache"
3. Refresh page

**Solution 3: Restart Everything**
```powershell
# Kill all
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Start backend
cd backend
npm run dev

# Start frontend (new terminal)
cd frontend
npm run dev
```

### Issue: Backend Won't Start

**Check MongoDB:**
```powershell
docker ps | Select-String "mongo"
```

If not running:
```powershell
docker-compose up -d
```

**Check Port 5000:**
```powershell
Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
```

If occupied:
```powershell
$pid = (Get-NetTCPConnection -LocalPort 5000).OwningProcess
Stop-Process -Id $pid -Force
```

### Issue: Frontend Won't Start

**Clear Next.js cache:**
```powershell
cd frontend
Remove-Item -Path .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```

**Check Port 3000:**
```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
```

### Issue: Can't Login

**Check OAuth credentials in backend/.env:**
```
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

**Callback URLs must be:**
- GitHub: `http://localhost:5000/api/auth/github/callback`
- Google: `http://localhost:5000/api/auth/google/callback`

### Issue: Admin Panel Shows 404

**Make sure you're admin:**
```powershell
cd backend
node make-admin.js your-email@gmail.com
```

**Logout and login again** to refresh session

---

## 📊 EXPECTED RESULTS

### After Successful Setup

**Backend Terminal:**
```
[nodemon] starting `node server.js`
✅ MongoDB connected successfully
🔗 Database: vercel_clone
🚀 Server running on port 5000
```

**Frontend Terminal:**
```
✓ Ready in 3.2s
○ Local: http://localhost:3000
```

**Browser (http://localhost:3000):**
- ✅ Landing page loads
- ✅ No CORS errors in console
- ✅ Can login with OAuth
- ✅ Dashboard shows statistics
- ✅ Can create/view/delete projects
- ✅ Admin panel accessible (if admin)

---

## 🎉 SUCCESS CRITERIA

You know everything is working when:

1. ✅ No CORS errors in browser console
2. ✅ Can login with GitHub/Google
3. ✅ Dashboard shows your user info
4. ✅ Can create a project
5. ✅ Can view projects list
6. ✅ Admin panel loads (if admin)
7. ✅ All admin pages work

---

## 🚀 NEXT STEPS AFTER SETUP

1. **Explore the platform**
   - Try all user features
   - Test admin panel
   - Check different pages

2. **Customize**
   - Update branding
   - Modify colors
   - Add your own features

3. **Deploy** (optional)
   - Follow `PRODUCTION_DEPLOYMENT.md`
   - Deploy to Oracle Cloud
   - Configure domain

---

## 📝 QUICK COMMANDS REFERENCE

```powershell
# Start everything
docker-compose up -d                    # MongoDB
cd backend && npm run dev               # Backend
cd frontend && npm run dev              # Frontend

# Stop everything
Get-Process node | Stop-Process -Force  # Stop Node
docker-compose down                     # Stop MongoDB

# Make admin
cd backend && node make-admin.js email@example.com

# Check status
docker ps                               # MongoDB status
Get-NetTCPConnection -LocalPort 5000    # Backend status
Get-NetTCPConnection -LocalPort 3000    # Frontend status

# Clean restart
Remove-Item frontend/.next -Recurse -Force
Get-Process node | Stop-Process -Force
# Then start again
```

---

**Time to Complete:** 5-10 minutes  
**Difficulty:** Easy  
**Result:** Fully working platform!  

🎯 **Let's get it running!**
