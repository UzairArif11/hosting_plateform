# ✅ FINAL FIX - Step by Step

**Current Status:**
- ✅ EC3 script ran successfully!
- ❌ EC2 still needs the script
- ❌ EC3 Oracle Cloud firewall still blocking
- ❌ EC1 .env needs update

---

## 🎯 THREE FIXES NEEDED

### Fix 1: Run Script on EC2 (140.238.229.147)

**You ran the script on EC3, but EC2 still needs it!**

```bash
# SSH into EC2 (not EC3!)
ssh ubuntu@140.238.229.147

# Create the script
nano fix-ec2-docker.sh
# Paste the content
# Ctrl+X, Y, Enter

# Run it
chmod +x fix-ec2-docker.sh
sudo bash fix-ec2-docker.sh

# Exit
exit
```

---

### Fix 2: Open Oracle Cloud Firewall for EC3

**The script opened iptables, but Oracle Cloud firewall is still blocking!**

**Go to Oracle Cloud Console:**

1. **Login:** https://cloud.oracle.com
2. **Navigate:** ☰ → Compute → Instances
3. **Find EC3:** Look for instance with IP `129.154.255.90`
4. **Click** on the instance name
5. **Under "Primary VNIC"**, click the **Subnet** link
6. **Click** on the **Security List** name
7. **Click** "Add Ingress Rules"
8. **Fill in:**
   - Stateless: No
   - Source Type: CIDR
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: TCP
   - Source Port Range: (leave empty)
   - Destination Port Range: `2376`
   - Description: `Docker Remote API`
9. **Click** "Add Ingress Rules"

**Do the same for EC2 (140.238.229.147)!**

---

### Fix 3: Update EC1 backend/.env

**Add this line to force HTTP:**

```powershell
# On Windows
cd D:\work\vercel-clone-platform
notepad backend\.env
```

**Add this line at the top:**
```env
# Force HTTP (no HTTPS)
DOCKER_USE_HTTPS=false
```

**Your .env should look like:**
```env
# Force HTTP (no HTTPS)
DOCKER_USE_HTTPS=false

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin

# JWT & Session
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
EC2_SERVER_IP=140.238.229.147
EC3_SERVER_IP=129.154.255.90
```

**Save and restart backend:**
```powershell
cd backend
npm run dev
```

---

## 📋 Complete Checklist

### EC2 (140.238.229.147):
- [ ] SSH into EC2
- [ ] Create fix-ec2-docker.sh
- [ ] Run: `sudo bash fix-ec2-docker.sh`
- [ ] Verify: `curl http://localhost:2376/version`
- [ ] Open port 2376 in Oracle Cloud Console
- [ ] Exit EC2

### EC3 (129.154.255.90):
- [x] Script already run ✅
- [ ] Open port 2376 in Oracle Cloud Console ← **CRITICAL!**

### EC1 (Windows):
- [ ] Edit backend/.env
- [ ] Add: `DOCKER_USE_HTTPS=false`
- [ ] Save file
- [ ] Restart backend: `cd backend && npm run dev`

### Testing:
- [ ] Test EC2: `Test-NetConnection -ComputerName 140.238.229.147 -Port 2376`
- [ ] Test EC3: `Test-NetConnection -ComputerName 129.154.255.90 -Port 2376`
- [ ] Test API: `http://localhost:5000/api/test/server-capacity`
- [ ] See both `"connected": true` ✅

---

## 🚀 Quick Commands

### 1. Fix EC2:
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
sudo netfilter-persistent save
curl http://localhost:2376/version
EOF
```

### 2. Update EC1 .env:
```powershell
# Add to backend/.env
echo "DOCKER_USE_HTTPS=false" | Out-File -FilePath backend\.env -Encoding utf8 -Append
```

### 3. Restart backend:
```powershell
cd backend
npm run dev
```

---

## 🧪 Testing

### Test from Windows:

```powershell
# Test EC2
Test-NetConnection -ComputerName 140.238.229.147 -Port 2376

# Test EC3
Test-NetConnection -ComputerName 129.154.255.90 -Port 2376

# Both should show: TcpTestSucceeded : True
```

### Test API:
```
http://localhost:5000/api/test/server-capacity
```

**Expected:**
```json
{
  "servers": {
    "EC2": { "connected": true },
    "EC3": { "connected": true }
  }
}
```

---

## ⚠️ CRITICAL: Oracle Cloud Firewall

**Even though iptables is open, Oracle Cloud has its own firewall!**

**You MUST open port 2376 in Oracle Cloud Console for BOTH servers!**

**Without this:**
- ❌ EC3 will timeout
- ❌ EC2 might timeout too

**With this:**
- ✅ Both servers accessible
- ✅ Backend can connect
- ✅ Everything works!

---

## 🎯 Priority Order

**Do these in order:**

1. **Fix EC2** (run script on 140.238.229.147)
2. **Open Oracle firewall** for EC3 (129.154.255.90)
3. **Open Oracle firewall** for EC2 (140.238.229.147)
4. **Update EC1 .env** (add DOCKER_USE_HTTPS=false)
5. **Restart backend**
6. **Test!**

---

## 🎉 Summary

**What you did:**
- ✅ Ran script on EC3

**What you need to do:**
1. ⚠️ Run script on EC2 (140.238.229.147)
2. ⚠️ Open Oracle firewall for EC3
3. ⚠️ Open Oracle firewall for EC2
4. ⚠️ Add `DOCKER_USE_HTTPS=false` to EC1 .env
5. ⚠️ Restart EC1 backend

**Then it will work!** 🚀

---

**Most Important:** Open port 2376 in Oracle Cloud Console for BOTH servers!
