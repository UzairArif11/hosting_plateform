# 🔧 FIX: Oracle Cloud Connection Issues

**Status:** Both servers configured but cannot connect

---

## 🔍 Current Errors

### EC2 (140.238.229.147):
```
"error": "SSL routines:ssl3_get_record:wrong version number"
```
**Problem:** Docker is using HTTPS/TLS, but we're trying HTTP

### EC3 (129.154.255.90):
```
"error": "connect ETIMEDOUT"
```
**Problem:** Port 2376 is blocked by firewall

---

## ✅ FIXES

### Fix 1: EC3 - Open Port 2376 in Oracle Cloud Console

**This is the main issue!** Port 2376 is blocked.

#### Steps:

1. **Go to Oracle Cloud Console:**
   - https://cloud.oracle.com

2. **Navigate to your EC3 instance:**
   - Click **☰** (hamburger menu)
   - Click **Compute** → **Instances**
   - Find instance with IP `129.154.255.90`
   - Click on the instance name

3. **Open the Security List:**
   - Scroll down to **Primary VNIC**
   - Click on the **Subnet** link (e.g., "subnet-...")
   - Under **Security Lists**, click the security list name

4. **Add Ingress Rule:**
   - Click **Add Ingress Rules**
   - Fill in:
     - **Source Type:** CIDR
     - **Source CIDR:** `0.0.0.0/0`
     - **IP Protocol:** TCP
     - **Source Port Range:** (leave empty)
     - **Destination Port Range:** `2376`
     - **Description:** `Docker Remote API`
   - Click **Add Ingress Rules**

5. **Wait 1-2 minutes** for the rule to apply

---

### Fix 2: EC2 - Disable Docker TLS

**SSH into EC2 (140.238.229.147):**

```bash
ssh ubuntu@140.238.229.147
```

**Check current Docker config:**

```bash
sudo systemctl status docker
```

**Update Docker to use HTTP (not HTTPS):**

```bash
# Create/update override file
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo nano /etc/systemd/system/docker.service.d/override.conf
```

**Replace content with:**
```
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2376
```

**Save and exit:**
- Press `Ctrl+X`
- Press `Y`
- Press `Enter`

**Restart Docker:**
```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

**Test locally:**
```bash
curl http://localhost:2376/version
```

**Should show Docker version JSON!**

---

### Fix 3: Verify Firewall on Both Servers

**On EC2 (140.238.229.147):**

```bash
# Check if port 2376 is open
sudo iptables -L -n | grep 2376

# If not, add rule
sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT

# Save rules
sudo netfilter-persistent save
# OR
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

**On EC3 (129.154.255.90):**

```bash
# Same steps
sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT
sudo netfilter-persistent save
```

---

## 🧪 Testing

### Test from Oracle VMs (locally):

**On EC2:**
```bash
curl http://localhost:2376/version
```

**On EC3:**
```bash
curl http://localhost:2376/version
```

**Both should return Docker version JSON!**

---

### Test from Your Windows PC:

**Test EC2:**
```powershell
# Test port
Test-NetConnection -ComputerName 140.238.229.147 -Port 2376

# Test Docker API
Invoke-WebRequest "http://140.238.229.147:2376/version"
```

**Test EC3:**
```powershell
# Test port
Test-NetConnection -ComputerName 129.154.255.90 -Port 2376

# Test Docker API
Invoke-WebRequest "http://129.154.255.90:2376/version"
```

**Both should succeed!**

---

### Test via Backend API:

```
http://localhost:5000/api/test/server-capacity
```

**Should show:**
```json
{
  "servers": {
    "EC2": {
      "connected": true  ← This!
    },
    "EC3": {
      "connected": true  ← This!
    }
  }
}
```

---

## 📋 Checklist

### EC2 (140.238.229.147):
- [ ] SSH into EC2
- [ ] Update Docker config (disable TLS)
- [ ] Restart Docker
- [ ] Test locally: `curl http://localhost:2376/version`
- [ ] Open port 2376 in Oracle Console
- [ ] Open port 2376 in iptables
- [ ] Test from Windows

### EC3 (129.154.255.90):
- [ ] SSH into EC3
- [ ] Run `setup-ec2-ec3.sh` (if not done)
- [ ] Test locally: `curl http://localhost:2376/version`
- [ ] **Open port 2376 in Oracle Console** ← CRITICAL!
- [ ] Open port 2376 in iptables
- [ ] Test from Windows

### Backend:
- [ ] Both servers show `"connected": true`
- [ ] No errors in test API

---

## 🚨 Most Common Issue: Oracle Cloud Firewall

**The #1 reason for connection failures:**

Port 2376 is **NOT open** in Oracle Cloud Console!

**Even if:**
- ✅ Docker is running
- ✅ iptables allows port 2376
- ✅ Docker is listening on port 2376

**You still need to:**
- ✅ Open port 2376 in **Oracle Cloud Console**

**This is a separate firewall at the cloud level!**

---

## 🎯 Quick Fix Commands

### On EC2/EC3 (both servers):

```bash
# 1. Update Docker config
sudo mkdir -p /etc/systemd/system/docker.service.d
echo '[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2376' | sudo tee /etc/systemd/system/docker.service.d/override.conf

# 2. Restart Docker
sudo systemctl daemon-reload
sudo systemctl restart docker

# 3. Open iptables
sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT

# 4. Test
curl http://localhost:2376/version
```

**Then open port 2376 in Oracle Cloud Console!**

---

## 📞 Expected Results

### After Fixes:

**EC2 Test:**
```powershell
Test-NetConnection -ComputerName 140.238.229.147 -Port 2376
# TcpTestSucceeded : True ✅
```

**EC3 Test:**
```powershell
Test-NetConnection -ComputerName 129.154.255.90 -Port 2376
# TcpTestSucceeded : True ✅
```

**Backend API:**
```json
{
  "servers": {
    "EC2": { "connected": true },
    "EC3": { "connected": true }
  }
}
```

---

## 🎉 Summary

**Issues:**
1. ❌ EC2: SSL/TLS enabled (should be HTTP)
2. ❌ EC3: Port 2376 blocked (firewall)

**Fixes:**
1. ✅ EC2: Disable TLS in Docker config
2. ✅ EC3: Open port 2376 in Oracle Console
3. ✅ Both: Open port 2376 in iptables

**Critical:**
- ✅ **Must open port 2376 in Oracle Cloud Console!**
- ✅ This is separate from iptables!
- ✅ Without this, connections will timeout!

---

**Next:** Open port 2376 in Oracle Console for both servers! 🚀
