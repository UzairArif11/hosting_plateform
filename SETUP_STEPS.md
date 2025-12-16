# 📝 Step-by-Step Setup Guide

## ✅ **Step 1: Open backend/.env file**

Location: `d:\work\vercel-clone-platform\backend\.env`

---

## ✅ **Step 2: Add These Lines to the TOP of .env**

Copy and paste these lines at the **top** of your `.env` file:

```env
# SSH Configuration
SSH_EC2_KEY=D:/work/ec2
SSH_EC3_KEY=D:/work/ec3
SSH_USERNAME=ubuntu

# Domain
BASE_DOMAIN=foodpanda.site
```

**Important:** 
- Use forward slashes `/` not backslashes `\`
- Keep all your existing variables below these

---

## ✅ **Step 3: Verify Configuration**

Run this command to check if everything is set correctly:

```bash
cd backend
node verify-env.js
```

**Expected output:**
```
✅ SSH_EC2_KEY - D:/work/ec2
   ✓ File exists
✅ SSH_EC3_KEY - D:/work/ec3
   ✓ File exists
✅ SSH_USERNAME - ubuntu
✅ BASE_DOMAIN - foodpanda.site
✅ All configuration looks good!
```

---

## ✅ **Step 4: Test SSH Connections**

```bash
node test-ssh-connections.js
```

**Expected output:**
```
✅ EC2 Connection successful!
  Docker: Docker version 24.0.x
✅ EC3 Connection successful!
  Docker: Docker version 24.0.x
```

**If it fails:**
- Check SSH key file paths
- Make sure keys don't have `.pub` extension
- Try connecting manually: `ssh -i D:/work/ec3 ubuntu@129.154.255.90`

---

## ✅ **Step 5: Restart Backend**

```bash
npm run dev
```

---

## ✅ **Step 6: Deploy a Project**

1. Go to http://localhost:3000
2. Click on a project
3. Click "Deploy Now"
4. Watch the logs!

**New logs you'll see:**
```
📡 Connecting to 129.154.255.90 via SSH...
✅ SSH connection established
📤 Copying build files to 129.154.255.90...
✅ Files copied successfully
🐳 Building Docker image on 129.154.255.90...
✅ Docker image built successfully
✅ Container started successfully!
```

---

## 🐛 **Troubleshooting**

### **Problem: "SSH key not configured"**
**Solution:** Make sure you added the SSH variables to `.env`

### **Problem: "File NOT found"**
**Solution:** Check the path. Should be `D:/work/ec2` not `D:\work\ec2`

### **Problem: "Permission denied (publickey)"**
**Solution:** 
1. Check SSH key permissions
2. Make sure you're using the private key (not .pub)
3. Try: `ssh -i D:/work/ec3 ubuntu@129.154.255.90`

### **Problem: "Connection timeout"**
**Solution:** 
1. Check EC2/EC3 are running
2. Check firewall allows SSH (port 22)
3. Verify IP addresses in `.env`

---

## 📋 **Complete .env Example**

Your `.env` should look like this:

```env
# SSH Configuration
SSH_EC2_KEY=D:/work/ec2
SSH_EC3_KEY=D:/work/ec3
SSH_USERNAME=ubuntu

# Domain
BASE_DOMAIN=foodpanda.site

# Server IPs
EC1_SERVER_IP=192.168.1.10
EC2_SERVER_IP=140.238.229.147
EC3_SERVER_IP=129.154.255.90

# MongoDB
MONGODB_URI=mongodb://localhost:27017/vercel_clone

# Redis
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=7379

# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# Session
SESSION_SECRET=your_secret_here

# Frontend
FRONTEND_URL=http://localhost:3000

# Build
BUILD_DIR=\tmp\builds
MAX_BUILD_TIME=600000
```

---

## ✅ **Ready to Test!**

Run these commands in order:

```bash
cd backend

# 1. Verify .env
node verify-env.js

# 2. Test SSH
node test-ssh-connections.js

# 3. Start backend
npm run dev
```

Then deploy a project from the UI! 🚀
