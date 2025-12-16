# ✅ SETUP SCRIPTS - READY TO RUN!

**Your scripts are ready!** No changes needed.

---

## 📦 What You Have

### EC1 (Windows):
**File:** `D:\work\vercel-clone-platform\setup-ec1.bat`  
**Status:** ✅ Ready to run as-is  
**No changes needed!**

### EC2/EC3 (Ubuntu):
**File:** `D:\work\vercel-clone-platform\setup-ec2-ec3.sh`  
**Status:** ✅ Ready to run as-is  
**No changes needed!**

---

## 🚀 HOW TO RUN

### EC1 - Main Server (Windows)

**Step 1: Run the script**

```powershell
# Right-click setup-ec1.bat and select "Run as Administrator"
# OR from PowerShell:
cd D:\work\vercel-clone-platform
.\setup-ec1.bat
```

**What it does automatically:**
- ✅ Checks Node.js and Docker
- ✅ Installs backend dependencies (`npm install`)
- ✅ Installs frontend dependencies (`npm install`)
- ✅ Creates `backend/.env` (if doesn't exist)
- ✅ Creates `frontend/.env.local` (if doesn't exist)
- ✅ Starts MongoDB (`docker-compose up -d`)
- ✅ Shows next steps

**Step 2: Edit backend/.env**

The script creates `backend/.env` with placeholders. You need to add:

```env
# GitHub OAuth (get from https://github.com/settings/developers)
GITHUB_CLIENT_ID=your_actual_github_client_id
GITHUB_CLIENT_SECRET=your_actual_github_client_secret

# Google OAuth (get from https://console.cloud.google.com)
GOOGLE_CLIENT_ID=your_actual_google_client_id
GOOGLE_CLIENT_SECRET=your_actual_google_client_secret

# Oracle Cloud Servers (add after EC2 setup)
EC2_SERVER_IP=129.154.255.90
# EC3_SERVER_IP=your_ec3_ip  # if you have EC3
```

**Step 3: Start backend**

```powershell
cd backend
npm run dev
```

**Step 4: Start frontend (new terminal)**

```powershell
cd frontend
npm run dev
```

**Done!** Access: http://localhost:3000

---

### EC2 - Container Server (Oracle Cloud)

**Step 1: SSH into Oracle VM**

```bash
ssh ubuntu@129.154.255.90
```

**Step 2: Clone project**

```bash
git clone <your-repo-url>
cd vercel-clone-platform
```

**Step 3: Run the script**

```bash
sudo bash setup-ec2-ec3.sh
```

**What it does automatically:**
- ✅ Updates system (`apt update && upgrade`)
- ✅ Installs Docker
- ✅ Enables Docker Remote API (port 2376)
- ✅ Configures firewall (iptables)
- ✅ Adds user to docker group
- ✅ Shows your public IP
- ✅ Shows next steps

**Step 4: Note the public IP**

The script will show:
```
Your IP: 129.154.255.90
```

**Step 5: Open port 2376 in Oracle Cloud Console**

See instructions at the end of the script output.

---

## 📝 WHAT NEEDS TO BE UPDATED

### ✅ Nothing in the scripts!

The scripts are **perfect as-is**. You only need to update:

### 1. `backend/.env` (after running setup-ec1.bat)

**Add these:**
```env
# OAuth credentials (required for login)
GITHUB_CLIENT_ID=your_real_id
GITHUB_CLIENT_SECRET=your_real_secret
GOOGLE_CLIENT_ID=your_real_id
GOOGLE_CLIENT_SECRET=your_real_secret

# Oracle IP (after EC2 setup)
EC2_SERVER_IP=129.154.255.90
```

**That's it!** Everything else is auto-created.

---

## 🎯 COMPLETE WORKFLOW

### 1. Run EC1 Setup

```powershell
# On Windows
cd D:\work\vercel-clone-platform
setup-ec1.bat
```

**Wait for it to finish, then:**

```powershell
# Edit .env
notepad backend\.env
# Add OAuth credentials

# Start backend
cd backend
npm run dev

# Start frontend (new terminal)
cd frontend
npm run dev
```

---

### 2. Run EC2 Setup

```bash
# On Oracle VM
git clone <repo>
cd vercel-clone-platform
sudo bash setup-ec2-ec3.sh

# Note the IP shown at the end
```

---

### 3. Connect EC1 to EC2

```powershell
# On Windows, edit backend/.env
notepad backend\.env

# Add this line:
EC2_SERVER_IP=129.154.255.90

# Restart backend (Ctrl+C then npm run dev)
```

---

### 4. Test Connection

```
http://localhost:5000/api/test/server-capacity
```

**Should show:** `"connected": true` ✅

---

## ✅ VERIFICATION

### After EC1 Setup:

- [ ] Script ran without errors
- [ ] `backend/.env` created
- [ ] `frontend/.env.local` created
- [ ] MongoDB started (`docker ps` shows mongo)
- [ ] Dependencies installed

### After EC2 Setup:

- [ ] Script ran without errors
- [ ] Docker installed (`docker ps` works)
- [ ] Public IP shown
- [ ] Port 2376 instructions shown

### After Connecting:

- [ ] `EC2_SERVER_IP` added to `backend/.env`
- [ ] Backend restarted
- [ ] Test API shows `"connected": true`

---

## 🚨 IMPORTANT NOTES

### EC1 Script:

**Requires:**
- ✅ Windows (already have)
- ✅ Node.js installed
- ✅ Docker Desktop installed
- ✅ Run as Administrator

**Creates:**
- ✅ `backend/.env` (with placeholders)
- ✅ `frontend/.env.local`
- ✅ Starts MongoDB

**You must add:**
- ✅ OAuth credentials to `backend/.env`
- ✅ Oracle IP to `backend/.env` (after EC2 setup)

---

### EC2 Script:

**Requires:**
- ✅ Ubuntu (Oracle Cloud)
- ✅ Run with sudo
- ✅ Internet connection

**Does:**
- ✅ Installs everything automatically
- ✅ No manual configuration needed!

**You must do:**
- ✅ Open port 2376 in Oracle Cloud Console
- ✅ Add IP to EC1's `backend/.env`

---

## 📞 QUICK REFERENCE

### Run EC1:
```powershell
setup-ec1.bat
```

### Run EC2:
```bash
sudo bash setup-ec2-ec3.sh
```

### Edit .env:
```powershell
notepad backend\.env
```

### Start Backend:
```powershell
cd backend && npm run dev
```

### Start Frontend:
```powershell
cd frontend && npm run dev
```

### Test:
```
http://localhost:5000/api/test/server-capacity
```

---

## 🎉 SUMMARY

**Your scripts are perfect!** ✅

**No changes needed to:**
- ✅ `setup-ec1.bat`
- ✅ `setup-ec2-ec3.sh`

**Only update:**
- ✅ `backend/.env` (after EC1 setup)
  - Add OAuth credentials
  - Add EC2 IP

**Then:**
- ✅ Run scripts
- ✅ Edit .env
- ✅ Start servers
- ✅ Test connection
- ✅ **Done!** 🚀

---

**Status:** ✅ **Scripts ready to run as-is!**  
**No modifications needed!**  
**Just run and follow the prompts!**
