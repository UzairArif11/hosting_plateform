# 🔧 Fix: 500 Internal Server Error

**Error:** `POST http://localhost:5000/api/projects 500 (Internal Server Error)`

**This means:** The request format is correct, but something is failing on the backend.

---

## 🔍 **Check Backend Logs**

**Look at your backend terminal (where you ran `npm run dev`).**

You should see an error message like:
```
❌ Create project error: [error message here]
```

---

## 🎯 **Common Causes:**

### 1. **No GitHub Access Token**

**Error:** `Cannot read property 'githubAccessToken' of undefined`

**Fix:**
- User must login with **GitHub** (not Google)
- Logout and login again with GitHub

---

### 2. **GitHub API Rate Limit**

**Error:** `API rate limit exceeded`

**Fix:**
- Wait 1 hour
- Or use authenticated GitHub token

---

### 3. **Repository Not Found**

**Error:** `Repository not found` or `404`

**Fix:**
- Make sure repository exists
- Make sure it's public (or you have access)
- Check spelling: `UzairArif11/Trello-Clone`

---

### 4. **User Not Assigned to Server**

**Error:** `User has no Oracle account assigned`

**Fix:**
```powershell
cd backend
node cleanup-users.js
```

---

### 5. **MongoDB Connection Error**

**Error:** `MongoError` or `Connection refused`

**Fix:**
```powershell
# Check if MongoDB is running
docker ps | findstr mongo

# If not running, start it
docker start mongodb
```

---

## 🧪 **Debug Steps:**

### Step 1: Check Backend Logs

**Look at backend terminal for the actual error!**

### Step 2: Check User Status

```powershell
cd backend
node check-user.js your-email@gmail.com
```

**Should show:**
```
✅ GitHub Token: Has token
✅ Oracle Account: EC3
✅ Container Type: shared
```

### Step 3: Test API Directly

```powershell
cd backend
node test-create-project.js
```

**First, get your token:**
1. Open http://localhost:3000
2. Login
3. Open browser console (F12)
4. Run: `localStorage.getItem('token')`
5. Copy the token
6. Edit `test-create-project.js` and paste the token
7. Run: `node test-create-project.js`

---

## 📝 **Most Likely Issues:**

### Issue 1: No GitHub Token

**User logged in with Google instead of GitHub**

**Solution:**
1. Logout
2. Login with **GitHub**
3. Try again

---

### Issue 2: Repository Access

**Backend can't access the repository**

**Solution:**
- Use a **public** repository
- Or make sure your GitHub token has `repo` scope

---

### Issue 3: User Not Set Up

**User missing container assignment**

**Solution:**
```powershell
cd backend
node cleanup-users.js
```

---

## ✅ **Quick Fix Workflow:**

### 1. Check Backend Logs
**Look for the actual error message!**

### 2. Check User
```powershell
cd backend
node check-user.js your-email@gmail.com
```

### 3. Fix User if Needed
```powershell
node cleanup-users.js
# or
node delete-all-users.js
```

### 4. Try Again
**Create project with a public repository**

---

## 🎯 **What to Send Me:**

**If still not working, send me:**

1. **Backend error logs** (from terminal)
2. **User check output:**
   ```powershell
   node check-user.js your-email@gmail.com
   ```
3. **Repository you're trying to use**

---

**Status:** ⚠️ **Need backend logs to diagnose!**  
**Next:** Check backend terminal for error message!
