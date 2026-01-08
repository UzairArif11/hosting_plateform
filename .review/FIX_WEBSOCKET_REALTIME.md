# 🔴 CRITICAL: WebSocket Real-Time Updates Not Working

**Status:** UI stuck at 0%, no progress shown, requires refresh

---

## 🐛 THE PROBLEM

**Symptoms:**
1. ❌ Deployment starts but UI shows 0% forever
2. ❌ No real-time logs appear
3. ❌ Status stuck on "deploying"
4. ❌ Must refresh page to see completion
5. ❌ URL doesn't update automatically

**Root Cause:** WebSocket connection not working or frontend not listening

---

## 🔍 DIAGNOSIS

### Check 1: Is WebSocket Server Running?
```bash
pm2 logs backend | grep "WebSocket"
# Should show: ✅ WebSocket server initialized
```

### Check 2: Is Frontend Connecting?
Open browser console (F12) and check for:
```
✅ Connected to deployment logs
socket.id: xxxxx
```

If you see:
```
❌ Disconnected from deployment logs
```
Then WebSocket isn't connecting!

### Check 3: WebSocket URL
Check frontend `.env.production`:
```bash
cat frontend/.env.production | grep SOCKET
```

Should be:
```
NEXT_PUBLIC_SOCKET_URL=https://foodpanda.site
```

---

## 🚀 FIX WEBSOCKET ISSUES

### Fix 1: Verify Socket URL

```bash
# Check if frontend has correct socket URL
cd ~/hosting_plateform/frontend

# Create/update .env.production
cat > .env.production << EOF
NEXT_PUBLIC_API_URL=https://foodpanda.site
NEXT_PUBLIC_SOCKET_URL=https://foodpanda.site
NODE_ENV=production
EOF

# Rebuild frontend
npm run build
pm2 restart frontend
```

### Fix 2: Check Nginx WebSocket Config

SSH to main server and verify Nginx allows WebSocket:

```nginx
# Should be in /etc/nginx/sites-available/default
location /socket.io/ {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

### Fix 3: Test WebSocket Endpoint

```bash
# Test from server
curl -I https://foodpanda.site/socket.io/?EIO=4&transport=polling

# Should return: HTTP/2 200
```

---

## ✅ COMPLETE FIX PROCEDURE

```bash
cd ~/hosting_plateform

# 1. Update frontend environment
cat > frontend/.env.production << 'EOF'
NEXT_PUBLIC_API_URL=https://foodpanda.site
NEXT_PUBLIC_SOCKET_URL=https://foodpanda.site
NODE_ENV=production
EOF

# 2. Rebuild and restart
cd frontend
npm run build
cd ..
pm2 restart frontend

# 3. Test deployment
# Go to UI, create new deployment
# Open browser console (F12)
# Watch for WebSocket connection messages
```

---

## 🧪 VERIFICATION

After applying fix:

1. **Start new deployment**
2. **Open browser console (F12)**
3. **Look for:**
   ```
   ✅ Connected to deployment logs
   WebSocket client connected
   ```

4. **Check deployment page:**
   - ✅ Progress bar moves 0% → 100%
   - ✅ Logs appear in real-time
   - ✅ Status changes: queued → building → deploying → success
   - ✅ "Visit Deployment" button appears automatically

---

## 📋 EXPECTED CONSOLE OUTPUT

When WebSocket works correctly:

```
✅ Connected to deployment logs
deployment-log { message: "Starting deployment...", level: "info" }
deployment-progress { progress: 10 }
deployment-log { message: "Cloning repository...", level: "info" }
deployment-progress { progress: 30 }
deployment-log { message: "Building project...", level: "info" }
deployment-progress { progress: 70 }
deployment-status { status: "success", url: "https://..." }
```

---

## 🔧 ALTERNATIVE: Debug Mode

If still not working, enable debug logs:

```bash
# Backend logs
pm2 logs backend --lines 100 | grep -i socket

# Check WebSocket emissions
pm2 logs backend --lines 100 | grep emitDeployment
```

Should show:
```
emitDeploymentLog
emitDeploymentProgress  
emitDeploymentStatus
```

---

## ⚡ QUICK TEST

```bash
# 1. Check if Socket.IO is responding
curl https://foodpanda.site/socket.io/\?EIO\=4\&transport\=polling

# Should return JSON with: {"sid":"...","upgrades":["websocket"],...}

# 2. If returns 404, WebSocket server not properly configured
```

---

**After applying the fix, deployments will show real-time progress!** 🚀
