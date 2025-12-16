# 🎯 UPDATE BACKEND .ENV - Add Oracle IP

**Your Oracle Cloud IP:** `129.154.255.90`

---

## ✅ STEP 1: Update backend/.env

**Open:** `d:/work/vercel-clone-platform/backend/.env`

**Add this line:**

```env
EC2_SERVER_IP=129.154.255.90
```

---

## 📝 COMPLETE .ENV EXAMPLE

Your `backend/.env` should look like this:

```env
# Server
PORT=5000
NODE_ENV=development

# Frontend
FRONTEND_URL=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin

# JWT & Session
JWT_SECRET=your-secret-key-here
SESSION_SECRET=your-session-secret-here

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Oracle Cloud Servers
EC2_SERVER_IP=129.154.255.90

# Optional: EC3 Server (if you have a second Oracle VM)
# EC3_SERVER_IP=your_ec3_ip_here

# Optional: Resource Configuration
EC2_TOTAL_CPU=2
EC2_TOTAL_RAM=12
EC2_MAX_CONTAINERS=200
```

---

## 🚀 STEP 2: Restart Backend

**Stop current backend:**
- Go to the terminal running `npm run dev`
- Press `Ctrl+C`

**Start backend again:**

```powershell
cd backend
npm run dev
```

**Wait for:**
```
✅ MongoDB connected successfully
🚀 Server running on port 5000
```

---

## 🧪 STEP 3: Test the Connection

**Option 1: Browser**

Open: http://localhost:5000/api/test/server-capacity

**Option 2: PowerShell**

```powershell
Invoke-WebRequest http://localhost:5000/api/test/server-capacity | Select-Object -Expand Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

---

## 📊 WHAT YOU SHOULD SEE

### If Port 2376 is NOT Open Yet:

```json
{
  "success": true,
  "servers": {
    "EC2": {
      "connected": false,
      "error": "Cannot connect to Docker",
      "note": "Server not configured or not reachable"
    }
  },
  "configuration": {
    "EC2_SERVER_IP": "129.154.255.90",
    "note": "Server configured but not reachable - check firewall"
  }
}
```

**This means:** Backend knows about Oracle, but can't connect (port 2376 blocked)

---

### After Opening Port 2376:

```json
{
  "success": true,
  "servers": {
    "EC2": {
      "connected": true,
      "utilization": {
        "sharedUsers": 0,
        "dedicatedUsers": 0,
        "totalUsers": 0,
        "sharedCapacity": 150,
        "dedicatedCapacity": 50
      },
      "capacity": {
        "shared": "150/150 users",
        "dedicated": "50/50 containers"
      },
      "resources": {
        "cpu": "0.00/2 OCPU",
        "ram": "0.00/12 GB"
      }
    }
  },
  "recommendations": {
    "forNewFreeUser": {
      "server": "EC2",
      "reason": "EC2 has more shared container capacity",
      "containerType": "shared"
    }
  },
  "configuration": {
    "EC2_SERVER_IP": "129.154.255.90",
    "note": "Server configured and connected!"
  }
}
```

**This means:** ✅ Backend connected to Oracle Cloud Docker!

---

## 🔥 OPEN PORT 2376 IN ORACLE CLOUD

**You need to do this in Oracle Cloud Console:**

### Method 1: Oracle Cloud Console (Recommended)

1. Go to: https://cloud.oracle.com
2. Navigate to: **Compute** → **Instances**
3. Click your instance: `instance-20250713-1730`
4. Click the **Subnet** link
5. Click the **Security List**
6. Click **Add Ingress Rules**
7. Fill in:
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: `TCP`
   - Destination Port Range: `2376`
   - Description: `Docker Remote API`
8. Click **Add Ingress Rules**

### Method 2: iptables (Quick Fix)

**On Oracle VM:**

```bash
# Open port 2376
sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT

# Save rules (try one of these)
sudo netfilter-persistent save
# OR
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

---

## ✅ VERIFICATION STEPS

### 1. Check Backend Logs

After restarting backend, you should see:

```
Testing EC2 connection...
EC2: ✅ Connected! (or ❌ Failed if port not open)
```

### 2. Test from Windows

```powershell
# Test port
Test-NetConnection -ComputerName 129.154.255.90 -Port 2376

# Test Docker API
Invoke-WebRequest "http://129.154.255.90:2376/version"
```

### 3. Test API Endpoint

```
http://localhost:5000/api/test/server-capacity
```

---

## 🎉 WHEN IT WORKS

**You'll see:**
- ✅ EC2: Connected = true
- ✅ Capacity: 150/150 users available
- ✅ Resources: 0.00/2 OCPU, 0.00/12 GB

**Then:**
- ✅ New users automatically get assigned to Oracle Cloud
- ✅ Containers created on Oracle VM
- ✅ Load balancing works
- ✅ Deployment system operational!

---

## 📝 QUICK CHECKLIST

- [ ] Open `backend/.env`
- [ ] Add `EC2_SERVER_IP=129.154.255.90`
- [ ] Save file
- [ ] Restart backend (`Ctrl+C` then `npm run dev`)
- [ ] Open port 2376 in Oracle Cloud Console
- [ ] Test: `http://localhost:5000/api/test/server-capacity`
- [ ] See `"connected": true` ✅

---

**Your Oracle IP:** `129.154.255.90`  
**Port to Open:** `2376`  
**Test URL:** `http://localhost:5000/api/test/server-capacity`  

**Almost done!** 🚀
