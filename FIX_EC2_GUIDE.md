# 🔧 Fix EC2 Docker - Quick Guide

**File:** `fix-ec2-docker.sh`  
**Purpose:** Configure EC2 Docker for HTTP (remove SSL)

---

## 🚀 How to Use

### Method 1: Copy from Local to EC2

**Step 1: Copy file to EC2**
```powershell
# From Windows (in project directory)
scp fix-ec2-docker.sh ubuntu@140.238.229.147:~/
```

**Step 2: SSH into EC2**
```bash
ssh ubuntu@140.238.229.147
```

**Step 3: Run the script**
```bash
chmod +x fix-ec2-docker.sh
sudo bash fix-ec2-docker.sh
```

---

### Method 2: Create Directly on EC2

**Step 1: SSH into EC2**
```bash
ssh ubuntu@140.238.229.147
```

**Step 2: Create the file**
```bash
nano fix-ec2-docker.sh
```

**Step 3: Paste the script content**
(Copy from `fix-ec2-docker.sh` and paste)

**Step 4: Save and exit**
- Press `Ctrl+X`
- Press `Y`
- Press `Enter`

**Step 5: Run it**
```bash
chmod +x fix-ec2-docker.sh
sudo bash fix-ec2-docker.sh
```

---

### Method 3: One-Liner (Fastest!)

**Just run this on EC2:**
```bash
ssh ubuntu@140.238.229.147 << 'EOF'
sudo systemctl stop docker
sudo mkdir -p /etc/systemd/system/docker.service.d
echo '[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2376' | sudo tee /etc/systemd/system/docker.service.d/override.conf
sudo systemctl daemon-reload
sudo systemctl start docker
sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT
sudo netfilter-persistent save || sudo iptables-save | sudo tee /etc/iptables/rules.v4
curl http://localhost:2376/version
EOF
```

---

## 📊 What the Script Does

### Step-by-Step:

1. ✅ **Stops Docker**
2. ✅ **Creates override config** (HTTP, no SSL)
3. ✅ **Reloads systemd**
4. ✅ **Starts Docker**
5. ✅ **Opens port 2376** in iptables
6. ✅ **Saves firewall rules**
7. ✅ **Tests Docker API**
8. ✅ **Shows public IP**
9. ✅ **Shows next steps**

---

## ✅ Expected Output

```
========================================
EC2 Docker Fix - Configure for HTTP
========================================

Step 1: Stopping Docker...
[OK] Docker stopped

Step 2: Configuring Docker for HTTP (no SSL)...
[OK] Docker configured for HTTP

Step 3: Reloading systemd...
[OK] systemd reloaded

Step 4: Starting Docker...
[OK] Docker started

Step 5: Opening firewall port 2376...
[OK] Firewall rules saved with netfilter-persistent

Step 6: Verifying configuration...
[OK] Docker is running
[OK] Port 2376 is open in iptables

Docker is listening on:
tcp  0.0.0.0:2376  LISTEN  dockerd

Step 7: Testing Docker API...
[OK] Docker API is accessible via HTTP!

Docker version:
{
  "Platform": {
    "Name": ""
  },
  "Components": [
    ...

Step 8: Getting public IP...
Public IP: 140.238.229.147

========================================
Fix Complete!
========================================
```

---

## 🧪 Testing After Running Script

### Test 1: From EC2 itself
```bash
curl http://localhost:2376/version
# Should return Docker version JSON ✅
```

### Test 2: From Windows
```powershell
Test-NetConnection -ComputerName 140.238.229.147 -Port 2376
# TcpTestSucceeded : True ✅

Invoke-WebRequest "http://140.238.229.147:2376/version"
# Should return Docker version ✅
```

### Test 3: Via Backend API
```
http://localhost:5000/api/test/server-capacity
```

**Should show:**
```json
{
  "servers": {
    "EC2": {
      "connected": true  ← This!
    }
  }
}
```

---

## 📝 Complete Workflow

### 1. Fix EC2:
```bash
ssh ubuntu@140.238.229.147
# Copy or create fix-ec2-docker.sh
chmod +x fix-ec2-docker.sh
sudo bash fix-ec2-docker.sh
exit
```

### 2. Fix EC3 (if needed):
```bash
ssh ubuntu@129.154.255.90
# Same script works for EC3 too!
chmod +x fix-ec2-docker.sh
sudo bash fix-ec2-docker.sh
exit
```

### 3. Open Oracle Cloud Firewall:
- Go to https://cloud.oracle.com
- Open port 2376 for BOTH servers

### 4. Update EC1 .env:
```env
DOCKER_USE_HTTPS=false
EC2_SERVER_IP=140.238.229.147
EC3_SERVER_IP=129.154.255.90
```

### 5. Restart EC1 backend:
```powershell
cd backend
npm run dev
```

### 6. Test:
```
http://localhost:5000/api/test/server-capacity
```

**Should show both connected!** ✅

---

## 🎯 Quick Commands

### Copy script to EC2:
```powershell
scp fix-ec2-docker.sh ubuntu@140.238.229.147:~/
```

### Run on EC2:
```bash
ssh ubuntu@140.238.229.147
chmod +x fix-ec2-docker.sh
sudo bash fix-ec2-docker.sh
```

### Test from Windows:
```powershell
Test-NetConnection -ComputerName 140.238.229.147 -Port 2376
Invoke-WebRequest "http://140.238.229.147:2376/version"
```

---

## 🎉 Summary

**File:** `fix-ec2-docker.sh`  
**Purpose:** Configure Docker for HTTP (no SSL)  
**Use on:** EC2 and EC3  
**Run with:** `sudo bash fix-ec2-docker.sh`  

**After running:**
1. ✅ Docker uses HTTP (no SSL)
2. ✅ Port 2376 open in iptables
3. ⚠️ Still need to open Oracle Cloud firewall
4. ✅ Test from Windows
5. ✅ Update EC1 .env
6. ✅ **Done!** 🚀

---

**Status:** ✅ **Script ready to use!**  
**Next:** Copy to EC2 and run it!
