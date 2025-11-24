# 🔧 CORS Error Fix

## Problem
CORS error: `Access-Control-Allow-Origin` header has value `http://localhost:5000` instead of `http://localhost:3000`

## Quick Fix

### Option 1: Restart Backend (Recommended)

1. **Stop the backend** (Ctrl+C in the terminal running backend)

2. **Start it again:**
   ```bash
   cd backend
   npm run dev
   ```

3. **Refresh the browser** (Ctrl + Shift + R)

### Option 2: Check Environment Variable

Make sure `backend/.env` has:
```
FRONTEND_URL=http://localhost:3000
```

### Option 3: Temporary Browser Fix

If the backend won't start, you can temporarily disable CORS in your browser for testing:

**Chrome/Edge:**
1. Close all browser windows
2. Start browser with: `chrome.exe --disable-web-security --user-data-dir="C:/temp/chrome"`

**Firefox:**
1. Type `about:config` in address bar
2. Search for `security.fileuri.strict_origin_policy`
3. Set to `false`

## What Should Happen

After fixing CORS, the admin dashboard should:
- ✅ Load user data
- ✅ Show statistics
- ✅ Display system health
- ✅ No console errors

## Current Status

**Backend:** Having issues starting (port conflict or MongoDB connection)
**Frontend:** Working, but can't connect to backend due to CORS

## Next Steps

1. Make sure MongoDB is running: `docker ps`
2. Make sure port 5000 is free: `netstat -ano | findstr :5000`
3. Restart backend: `npm run dev` in backend folder
4. Refresh browser

---

**The admin panel pages are all created and ready to work once the backend restarts!**
