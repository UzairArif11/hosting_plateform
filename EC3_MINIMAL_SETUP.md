# ✅ EC3 Setup - Just Run One Script!

**Question:** Does EC3 need the full codebase?

**Answer:** ❌ **NO! Just one script!**

---

## 🎯 What EC3 Needs

### ❌ Does NOT Need:
- ❌ Full project code
- ❌ Backend code
- ❌ Frontend code
- ❌ MongoDB
- ❌ Node.js
- ❌ npm packages
- ❌ .env files
- ❌ Git repository

### ✅ ONLY Needs:
- ✅ **One file:** `setup-ec2-ec3.sh`
- ✅ **Ubuntu OS** (Oracle Cloud VM)
- ✅ **Internet connection**

**That's it!** 🚀

---

## 🚀 Complete EC3 Setup (3 Steps!)

### Step 1: Create the Script on EC3

**SSH into EC3:**
```bash
ssh ubuntu@your-ec3-ip
```

**Create the script:**
```bash
# Create the file
nano setup-ec2-ec3.sh
```

**Paste this content:**
```bash
#!/bin/bash
########################################
# EC2/EC3 - Docker Setup Script
# Container servers for user deployments
########################################

set -e  # Exit on error

echo "========================================"
echo "EC2/EC3 - Docker Container Server Setup"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}ERROR: Please run as root (use sudo)${NC}"
    exit 1
fi

echo -e "${GREEN}Step 1: Updating system...${NC}"
apt update && apt upgrade -y

echo ""
echo -e "${GREEN}Step 2: Installing Docker...${NC}"

# Install Docker
apt install docker.io -y

# Start and enable Docker
systemctl start docker
systemctl enable docker

echo -e "${GREEN}[OK] Docker installed${NC}"

echo ""
echo -e "${GREEN}Step 3: Configuring Docker Remote API...${NC}"

# Create override directory
mkdir -p /etc/systemd/system/docker.service.d

# Create override file
cat > /etc/systemd/system/docker.service.d/override.conf <<EOF
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2376
EOF

echo -e "${GREEN}[OK] Docker Remote API configured${NC}"

echo ""
echo -e "${GREEN}Step 4: Restarting Docker...${NC}"

# Reload systemd and restart Docker
systemctl daemon-reload
systemctl restart docker

echo -e "${GREEN}[OK] Docker restarted${NC}"

echo ""
echo -e "${GREEN}Step 5: Configuring firewall...${NC}"

# Open port 2376 using iptables
iptables -I INPUT -p tcp --dport 2376 -j ACCEPT

# Try to save iptables rules
if command -v netfilter-persistent &> /dev/null; then
    netfilter-persistent save
    echo -e "${GREEN}[OK] Firewall rules saved${NC}"
else
    # Alternative method
    mkdir -p /etc/iptables
    iptables-save > /etc/iptables/rules.v4
    echo -e "${YELLOW}[WARNING] netfilter-persistent not found, rules saved manually${NC}"
fi

echo ""
echo -e "${GREEN}Step 6: Adding current user to docker group...${NC}"

# Add user to docker group
if [ -n "$SUDO_USER" ]; then
    usermod -aG docker $SUDO_USER
    echo -e "${GREEN}[OK] User $SUDO_USER added to docker group${NC}"
else
    echo -e "${YELLOW}[WARNING] Could not detect user, run manually: sudo usermod -aG docker \$USER${NC}"
fi

echo ""
echo -e "${GREEN}Step 7: Testing Docker...${NC}"

# Test Docker
if docker ps &> /dev/null; then
    echo -e "${GREEN}[OK] Docker is working!${NC}"
else
    echo -e "${RED}[ERROR] Docker test failed${NC}"
    exit 1
fi

# Get public IP
echo ""
echo -e "${GREEN}Step 8: Getting public IP...${NC}"
PUBLIC_IP=$(curl -s ifconfig.me)

echo ""
echo "========================================"
echo -e "${GREEN}Setup Complete!${NC}"
echo "========================================"
echo ""
echo "Server Information:"
echo "  Public IP: $PUBLIC_IP"
echo "  Docker Port: 2376"
echo ""
echo "Next Steps:"
echo ""
echo "1. ${YELLOW}IMPORTANT:${NC} Open port 2376 in Oracle Cloud Console:"
echo "   - Go to: https://cloud.oracle.com"
echo "   - Navigate to: Compute → Instances → Your Instance"
echo "   - Click: Subnet → Security List → Add Ingress Rules"
echo "   - Add rule: TCP port 2376, Source: 0.0.0.0/0"
echo ""
echo "2. Add this IP to your EC1 server backend/.env:"
echo "   ${GREEN}EC3_SERVER_IP=$PUBLIC_IP${NC}"
echo ""
echo "3. Test connection from EC1:"
echo "   curl http://$PUBLIC_IP:2376/version"
echo ""
echo "4. Restart backend on EC1 and check:"
echo "   http://localhost:5000/api/test/server-capacity"
echo ""
echo "========================================"
echo ""
echo -e "${YELLOW}Note: You may need to logout and login again for docker group to take effect${NC}"
echo ""
```

**Save and exit:**
- Press `Ctrl+X`
- Press `Y`
- Press `Enter`

---

### Step 2: Make it Executable

```bash
chmod +x setup-ec2-ec3.sh
```

---

### Step 3: Run It!

```bash
sudo bash setup-ec2-ec3.sh
```

**That's it!** ✅

---

## 🎯 What the Script Does

### Automatically:
1. ✅ Updates Ubuntu
2. ✅ Installs Docker
3. ✅ Enables Docker Remote API (port 2376)
4. ✅ Opens firewall port
5. ✅ Tests Docker
6. ✅ Shows your public IP
7. ✅ Shows next steps

### You get:
- ✅ **Docker running** on EC3
- ✅ **Port 2376 listening** for remote connections
- ✅ **Public IP** to add to EC1
- ✅ **Ready for containers!**

---

## 🔗 How EC1 Will Use EC3

### After EC3 Setup:

**On EC1, edit `backend/.env`:**
```env
EC2_SERVER_IP=129.154.255.90
EC3_SERVER_IP=your_ec3_public_ip
```

**Restart EC1 backend:**
```powershell
cd backend
npm run dev
```

**Test:**
```
http://localhost:5000/api/test/server-capacity
```

**Should show:**
```json
{
  "servers": {
    "EC2": {
      "connected": true
    },
    "EC3": {
      "connected": true  ← This!
    }
  }
}
```

---

## 🎯 What Happens Automatically

### When User Registers on EC1:

```
1. User registers
        ↓
2. EC1 backend checks EC2 vs EC3 capacity
        ↓
3. Chooses server with more space
        ↓
4. Sends Docker command to EC2 or EC3
        ↓
5. EC2/EC3 creates container
        ↓
6. User assigned!
```

**EC1 controls everything!**  
**EC2/EC3 just run Docker!**

---

## 📊 Server Roles

### EC1 (Main Server):
```
┌─────────────────────────┐
│ EC1 - Control Center    │
├─────────────────────────┤
│ ✅ Backend API          │
│ ✅ Frontend             │
│ ✅ MongoDB              │
│ ✅ User Management      │
│ ✅ Container Orchestrator│
│ ✅ Decides which server │
└─────────────────────────┘
```

### EC2/EC3 (Container Servers):
```
┌─────────────────────────┐
│ EC2/EC3 - Workers       │
├─────────────────────────┤
│ ✅ Docker Engine        │
│ ✅ Run containers       │
│ ✅ That's it!           │
└─────────────────────────┘
```

**EC2/EC3 are just Docker hosts!**  
**No code, no logic, just Docker!**

---

## ✅ Verification

### After Running Script on EC3:

**Check 1: Docker is running**
```bash
docker ps
# Should show: CONTAINER ID   IMAGE   ...
```

**Check 2: Port 2376 is listening**
```bash
sudo netstat -tlnp | grep 2376
# Should show: tcp  0.0.0.0:2376  LISTEN
```

**Check 3: Can access locally**
```bash
curl http://localhost:2376/version
# Should show Docker version JSON
```

**Check 4: Public IP**
```bash
curl ifconfig.me
# Shows your EC3 public IP
```

---

### From EC1 (After adding IP to .env):

**Test connection:**
```powershell
# Test port
Test-NetConnection -ComputerName your_ec3_ip -Port 2376

# Test Docker API
Invoke-WebRequest "http://your_ec3_ip:2376/version"

# Test via backend
curl http://localhost:5000/api/test/server-capacity
```

---

## 🚨 Important: Open Port 2376!

**After running the script, you MUST open port 2376 in Oracle Cloud Console:**

1. Go to: https://cloud.oracle.com
2. Navigate to: **Compute** → **Instances**
3. Click your EC3 instance
4. Click **Subnet** → **Security List**
5. Click **Add Ingress Rules**
6. Add:
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: `TCP`
   - Destination Port: `2376`
   - Description: `Docker Remote API`
7. Click **Add Ingress Rules**

**Without this, EC1 cannot connect!**

---

## 🎉 SUMMARY

### EC3 Setup:

**What EC3 needs:**
- ✅ Just one file: `setup-ec2-ec3.sh`
- ✅ Ubuntu OS
- ✅ Internet connection

**What EC3 does NOT need:**
- ❌ Full project code
- ❌ Backend/Frontend
- ❌ MongoDB
- ❌ Node.js
- ❌ npm packages

**Setup steps:**
1. Create `setup-ec2-ec3.sh` on EC3
2. Run `sudo bash setup-ec2-ec3.sh`
3. Open port 2376 in Oracle Console
4. Add EC3 IP to EC1's `backend/.env`
5. **Done!** ✅

**EC1 can now:**
- ✅ Send Docker commands to EC3
- ✅ Create containers on EC3
- ✅ Manage user deployments
- ✅ Load balance between EC2 and EC3

**All automatic!** 🚀

---

## 📞 Quick Reference

### Create Script on EC3:
```bash
nano setup-ec2-ec3.sh
# Paste content
# Ctrl+X, Y, Enter
```

### Run Script:
```bash
chmod +x setup-ec2-ec3.sh
sudo bash setup-ec2-ec3.sh
```

### Add to EC1:
```env
# backend/.env
EC3_SERVER_IP=your_ec3_ip
```

### Test:
```
http://localhost:5000/api/test/server-capacity
```

---

**Status:** ✅ **EC3 needs ONLY the setup script!**  
**No code, no packages, just Docker!**  
**EC1 controls everything remotely!** 🎯
