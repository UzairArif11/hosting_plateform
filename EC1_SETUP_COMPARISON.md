# ✅ EC1 Setup Scripts - Windows vs Ubuntu

**Great news!** Port 2376 is open on EC3! ✅

Now you have **TWO versions** of EC1 setup:

---

## 📦 Available Scripts

### 1. **setup-ec1.bat** (Windows)
**For:** Running EC1 on your local Windows PC  
**File:** `D:\work\vercel-clone-platform\setup-ec1.bat`

**Run:**
```powershell
# Right-click and "Run as Administrator"
# OR
cd D:\work\vercel-clone-platform
.\setup-ec1.bat
```

---

### 2. **setup-ec1.sh** (Ubuntu/Linux) ✨ NEW!
**For:** Running EC1 on Oracle Cloud or any Ubuntu server  
**File:** `D:\work\vercel-clone-platform\setup-ec1.sh`

**Run:**
```bash
# On Oracle Cloud VM
cd vercel-clone-platform
chmod +x setup-ec1.sh
bash setup-ec1.sh
```

---

## 🎯 Which One to Use?

### Option A: EC1 on Windows (Local)

**Use:** `setup-ec1.bat`

**Architecture:**
```
┌─────────────────────────┐
│ EC1 (Windows - Local)   │
│ - Backend               │
│ - Frontend              │
│ - MongoDB               │
└─────────────────────────┘
         │
         ▼ (Internet)
┌─────────────────────────┐
│ EC2 (Oracle Cloud)      │
│ - Docker only           │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ EC3 (Oracle Cloud)      │
│ - Docker only           │
└─────────────────────────┘
```

**Pros:**
- ✅ Easy to develop locally
- ✅ Fast iteration
- ✅ No cloud costs for EC1

**Cons:**
- ❌ Your PC must be running
- ❌ Not accessible from internet

---

### Option B: EC1 on Oracle Cloud (Production)

**Use:** `setup-ec1.sh`

**Architecture:**
```
┌─────────────────────────┐
│ EC1 (Oracle Cloud)      │
│ - Backend               │
│ - Frontend              │
│ - MongoDB               │
└─────────────────────────┘
         │
         ▼ (Private network)
┌─────────────────────────┐
│ EC2 (Oracle Cloud)      │
│ - Docker only           │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ EC3 (Oracle Cloud)      │
│ - Docker only           │
└─────────────────────────┘
```

**Pros:**
- ✅ Always online
- ✅ Accessible from internet
- ✅ Production-ready
- ✅ Faster communication (same datacenter)

**Cons:**
- ❌ Need another Oracle VM
- ❌ Slower development

---

## 🚀 Recommended Setup

### For Development:
```
EC1: Windows (local) - setup-ec1.bat
EC2: Oracle Cloud    - setup-ec2-ec3.sh ✅ (done!)
EC3: Oracle Cloud    - setup-ec2-ec3.sh
```

### For Production:
```
EC1: Oracle Cloud - setup-ec1.sh
EC2: Oracle Cloud - setup-ec2-ec3.sh ✅ (done!)
EC3: Oracle Cloud - setup-ec2-ec3.sh
```

---

## 📝 Current Status

### ✅ What's Done:

**EC3 (129.154.255.90):**
- ✅ Docker installed
- ✅ Port 2376 open
- ✅ Docker API accessible
- ✅ Ready to use!

### ⚠️ What's Next:

**EC1 (Choose one):**

**Option 1: Windows (Local)**
```powershell
cd D:\work\vercel-clone-platform
setup-ec1.bat
```

**Option 2: Oracle Cloud**
```bash
# Create new Oracle VM for EC1
# SSH into it
# Clone project
# Run setup-ec1.sh
```

**EC2 (140.238.229.147):**
```bash
ssh ubuntu@140.238.229.147
# Run the open-port-2376.sh script
sudo bash open-port-2376.sh
```

---

## 🎯 Quick Start (Windows Local)

### 1. Run EC1 Setup (Windows):
```powershell
cd D:\work\vercel-clone-platform
setup-ec1.bat
```

### 2. Edit .env:
```powershell
notepad backend\.env
```

**Add:**
```env
# OAuth credentials
GITHUB_CLIENT_ID=your_real_id
GITHUB_CLIENT_SECRET=your_real_secret
GOOGLE_CLIENT_ID=your_real_id
GOOGLE_CLIENT_SECRET=your_real_secret

# Oracle servers
EC2_SERVER_IP=140.238.229.147
EC3_SERVER_IP=129.154.255.90
```

### 3. Start Backend:
```powershell
cd backend
npm run dev
```

### 4. Start Frontend (new terminal):
```powershell
cd frontend
npm run dev
```

### 5. Test Connection:
```
http://localhost:5000/api/test/server-capacity
```

**Should show:**
```json
{
  "servers": {
    "EC2": { "connected": true },
    "EC3": { "connected": true }  ← This should work now!
  }
}
```

---

## 🎉 Summary

**Created:**
- ✅ `setup-ec1.bat` (Windows) - Already existed
- ✅ `setup-ec1.sh` (Ubuntu) - **NEW!**

**EC3 Status:**
- ✅ Port 2376 open
- ✅ Docker API accessible
- ✅ Ready to use!

**Next:**
1. ✅ Open port 2376 on EC2 (same as EC3)
2. ✅ Run EC1 setup (Windows or Ubuntu)
3. ✅ Test connection
4. ✅ **Done!** 🚀

---

**Recommended:** Use `setup-ec1.bat` on Windows for development! 🎯
