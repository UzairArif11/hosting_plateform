# 🔧 FINAL FIX: Both Servers Connection Issues

**Current Status:**
- ❌ EC2: SSL error (Docker using HTTPS)
- ❌ EC3: Timeout (Oracle Cloud firewall blocking)

---

## 🎯 SOLUTION

### Fix 1: EC3 - Open Oracle Cloud Firewall

**The iptables rule worked, but Oracle Cloud firewall is still blocking!**

**You MUST open port 2376 in Oracle Cloud Console:**

1. Go to: https://cloud.oracle.com
2. Click **☰** → **Compute** → **Instances**
3. Find instance with IP `129.154.255.90`
4. Click instance name
5. Under **Primary VNIC**, click **Subnet** link
6. Click **Security Lists** → Click the security list name
7. Click **Add Ingress Rules**
8. Fill in:
   - **Stateless:** No
   - **Source Type:** CIDR
   - **Source CIDR:** `0.0.0.0/0`
   - **IP Protocol:** TCP
   - **Source Port Range:** (leave empty)
   - **Destination Port Range:** `2376`
   - **Description:** `Docker Remote API`
9. Click **Add Ingress Rules**

**Wait 1-2 minutes, then test!**

---

### Fix 2: EC2 - Check Docker Configuration

**SSH into EC2:**
```bash
ssh ubuntu@140.238.229.147
```

**Check what Docker is listening on:**
```bash
sudo netstat -tlnp | grep docker
```

**Should show:**
```
tcp  0.0.0.0:2376  LISTEN  dockerd
```

**If it shows port 2376 with TLS, update Docker config:**

```bash
# Stop Docker
sudo systemctl stop docker

# Update config
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo tee /etc/systemd/system/docker.service.d/override.conf > /dev/null <<EOF
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2376
EOF

# Reload and start
sudo systemctl daemon-reload
sudo systemctl start docker

# Verify
sudo netstat -tlnp | grep 2376
curl http://localhost:2376/version
```

**Should return Docker version JSON!**

---

### Fix 3: Alternative - Use HTTP for Both Servers

**Update backend to force HTTP:**

**Edit `backend/.env`:**
```env
# Force HTTP (disable HTTPS)
DOCKER_USE_HTTPS=false

# Server IPs
EC2_SERVER_IP=140.238.229.147
EC3_SERVER_IP=129.154.255.90
```

**Restart backend:**
```powershell
cd backend
npm run dev
```

---

## 🧪 Testing

### Test EC2 Locally (via SSH):

```bash
ssh ubuntu@140.238.229.147

# Test HTTP
curl http://localhost:2376/version
# Should return JSON ✅

# Test HTTPS
curl https://localhost:2376/version
# Should fail or return error ✅
```

---

### Test EC3 from Windows:

```powershell
# Test port (after opening Oracle firewall)
Test-NetConnection -ComputerName 129.154.255.90 -Port 2376

# Should show:
# TcpTestSucceeded : True ✅
```

---

### Test Both from Backend:

```
http://localhost:5000/api/test/server-capacity
```

**Should show:**
```json
{
  "servers": {
    "EC2": { "connected": true },
    "EC3": { "connected": true }
  }
}
```

---

## 📝 Complete Fix Commands

### On EC2 (140.238.229.147):

```bash
# SSH into EC2
ssh ubuntu@140.238.229.147

# Update Docker to use HTTP
sudo systemctl stop docker
sudo mkdir -p /etc/systemd/system/docker.service.d
echo '[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2376' | sudo tee /etc/systemd/system/docker.service.d/override.conf

sudo systemctl daemon-reload
sudo systemctl start docker

# Open port in iptables
sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT
sudo netfilter-persistent save

# Test
curl http://localhost:2376/version

# Exit
exit
```

---

### On EC3 (129.154.255.90):

**Already done!** ✅

**Just need to open Oracle Cloud Console firewall!**

---

### On EC1 (Windows):

**Option 1: Force HTTP in .env**
```env
DOCKER_USE_HTTPS=false
EC2_SERVER_IP=140.238.229.147
EC3_SERVER_IP=129.154.255.90
```

**Option 2: Keep HTTPS (if EC2 has valid certs)**
```env
# Don't add DOCKER_USE_HTTPS
EC2_SERVER_IP=140.238.229.147
EC3_SERVER_IP=129.154.255.90
```

**Restart backend:**
```powershell
cd backend
npm run dev
```

---

## 🎯 Quick Fix Script for EC2

**Create this file on EC2:**

```bash
#!/bin/bash
echo "Fixing Docker on EC2..."

# Stop Docker
sudo systemctl stop docker

# Configure for HTTP
sudo mkdir -p /etc/systemd/system/docker.service.d
cat > /tmp/docker-override.conf <<EOF
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2376
EOF
sudo mv /tmp/docker-override.conf /etc/systemd/system/docker.service.d/override.conf

# Restart Docker
sudo systemctl daemon-reload
sudo systemctl start docker

# Open firewall
sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT
sudo netfilter-persistent save || sudo iptables-save | sudo tee /etc/iptables/rules.v4

# Test
echo ""
echo "Testing Docker API..."
if curl -s http://localhost:2376/version > /dev/null; then
    echo "✅ Docker API is accessible via HTTP!"
else
    echo "❌ Docker API test failed"
fi

echo ""
echo "Checking what Docker is listening on:"
sudo netstat -tlnp | grep docker
```

**Save as `fix-ec2-docker.sh` and run:**
```bash
chmod +x fix-ec2-docker.sh
sudo bash fix-ec2-docker.sh
```

---

## ⚠️ Critical: Oracle Cloud Firewall

**Even if iptables is open, Oracle Cloud has its own firewall!**

**You MUST open port 2376 in Oracle Cloud Console for EC3!**

**Steps:**
1. Login to https://cloud.oracle.com
2. Find EC3 instance (129.154.255.90)
3. Go to Subnet → Security List
4. Add Ingress Rule for port 2376
5. Wait 1-2 minutes

**Without this, EC3 will always timeout!**

---

## 🎉 Expected Results

### After All Fixes:

**Test from Windows:**
```powershell
# EC2
Test-NetConnection -ComputerName 140.238.229.147 -Port 2376
# TcpTestSucceeded : True ✅

# EC3
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

## 📞 Summary

**EC2 Issue:** Docker using HTTPS, backend expects HTTP  
**Fix:** Configure Docker for HTTP or force backend to use HTTP

**EC3 Issue:** Oracle Cloud firewall blocking port 2376  
**Fix:** Open port 2376 in Oracle Cloud Console

**Both need:**
1. ✅ iptables open (done via script)
2. ⚠️ Oracle Cloud firewall open (need to do in console)
3. ✅ Docker listening on HTTP (need to configure)

---

**Next Steps:**
1. Fix EC2 Docker config (run fix-ec2-docker.sh)
2. Open EC3 port in Oracle Console
3. Test both connections
4. **Done!** 🚀
