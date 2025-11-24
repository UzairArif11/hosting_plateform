# ✅ ORACLE CLOUD SETUP COMPLETE!

**Your Oracle IP:** `129.154.255.90`  
**Docker:** ✅ Installed and configured  
**Remote API:** ✅ Enabled on port 2376  

---

## 🔥 IMPORTANT: Open Port 2376 in Oracle Cloud Console

UFW is not installed on Oracle Cloud. You need to open the port in the Oracle Cloud Console:

### Step 1: Open Oracle Cloud Console

1. Go to: https://cloud.oracle.com
2. Login to your account
3. Navigate to: **Compute** → **Instances**
4. Click on your instance: `instance-20250713-1730`

### Step 2: Open Security List

1. Click on the **Subnet** link (under "Primary VNIC")
2. Click on the **Security List** (usually "Default Security List")
3. Click **Add Ingress Rules**

### Step 3: Add Ingress Rule

**Fill in:**
- **Source Type:** CIDR
- **Source CIDR:** `0.0.0.0/0` (or your local IP for security)
- **IP Protocol:** TCP
- **Source Port Range:** (leave empty)
- **Destination Port Range:** `2376`
- **Description:** Docker Remote API

**Click:** Add Ingress Rules

---

## 🚀 ALTERNATIVE: Use iptables (Faster!)

**On your Oracle VM, run:**

```bash
# Open port 2376
sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT

# Save iptables rules
sudo netfilter-persistent save

# Or if that doesn't work:
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

---

## ✅ TEST DOCKER

**On Oracle VM:**

```bash
# Test Docker locally
docker ps

# Test remote API locally
curl http://localhost:2376/version

# Should show Docker version info
```

---

## 🎯 UPDATE YOUR BACKEND

**On your Windows machine:**

### Step 1: Update backend/.env

Add this line:

```env
EC2_SERVER_IP=129.154.255.90
```

**Full example:**

```env
# MongoDB
MONGODB_URI=mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin

# Frontend
FRONTEND_URL=http://localhost:3000

# JWT
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret

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

# Optional: If you have a second Oracle VM
# EC3_SERVER_IP=your_ec3_ip
```

### Step 2: Restart Backend

```powershell
# Stop current backend (Ctrl+C)
cd backend
npm run dev
```

### Step 3: Test Connection

**Open browser:**

```
http://localhost:5000/api/test/server-capacity
```

**Or PowerShell:**

```powershell
Invoke-WebRequest http://localhost:5000/api/test/server-capacity | Select-Object -Expand Content
```

---

## 🔍 EXPECTED RESULTS

### Before Opening Port (Current):

```json
{
  "servers": {
    "EC2": {
      "connected": false,
      "error": "Cannot connect to Docker"
    }
  }
}
```

### After Opening Port:

```json
{
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
  "configuration": {
    "EC2_SERVER_IP": "129.154.255.90",
    "note": "Server configured"
  }
}
```

---

## 🧪 TEST FROM LOCAL MACHINE

**After opening port 2376:**

```powershell
# Test connection
Test-NetConnection -ComputerName 129.154.255.90 -Port 2376

# Test Docker API
Invoke-WebRequest "http://129.154.255.90:2376/version"

# Should return Docker version JSON
```

---

## 📝 QUICK CHECKLIST

- [x] Docker installed on Oracle VM
- [x] Docker Remote API enabled (port 2376)
- [x] User added to docker group
- [x] Docker restarted
- [ ] **Port 2376 opened in Oracle Cloud Console** ← DO THIS!
- [ ] IP added to backend/.env
- [ ] Backend restarted
- [ ] Test API endpoint

---

## 🎉 SUMMARY

**What's Done:**
- ✅ Oracle VM: `129.154.255.90`
- ✅ Docker installed
- ✅ Remote API enabled
- ✅ Docker running

**What's Next:**
1. Open port 2376 in Oracle Cloud Console (or use iptables)
2. Add `EC2_SERVER_IP=129.154.255.90` to backend/.env
3. Restart backend
4. Test: `http://localhost:5000/api/test/server-capacity`

**Then users will automatically get assigned to Oracle Cloud when they register!** 🚀

---

## 🔧 TROUBLESHOOTING

### Can't connect from local machine?

**Check 1: Port open in Oracle Cloud Console?**
- Go to Oracle Console → Compute → Instances
- Click instance → Subnet → Security List
- Add ingress rule for port 2376

**Check 2: iptables blocking?**
```bash
# On Oracle VM
sudo iptables -L -n | grep 2376
# Should show ACCEPT rule
```

**Check 3: Docker listening?**
```bash
# On Oracle VM
sudo netstat -tlnp | grep 2376
# Should show dockerd listening
```

---

**Your Oracle IP:** `129.154.255.90`  
**Next Step:** Open port 2376 in Oracle Cloud Console!  

🎯 **Almost there!**
