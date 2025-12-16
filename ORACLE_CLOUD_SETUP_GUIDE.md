# 🌩️ ORACLE CLOUD FREE TIER SETUP GUIDE

## 📋 **COMPLETE GUIDE TO SETTING UP ORACLE CLOUD SERVERS**

This guide explains how to create and configure Oracle Cloud Free Tier instances for the deployment platform.

---

## 🎯 **WHAT YOU'LL CREATE:**

- **EC1**: Main control server (Backend + Frontend)
- **EC2**: Deployment server #1
- **EC3**: Deployment server #2
- **EC4**: Deployment server #3 (optional)
- **EC5**: Deployment server #4 (optional)

---

## 🆓 **ORACLE CLOUD FREE TIER LIMITS:**

### **Always Free Resources:**
- ✅ 2 AMD-based Compute VMs (1/8 OCPU, 1 GB RAM each)
- ✅ 4 ARM-based Ampere A1 Compute VMs (3 OCPU, 18 GB RAM total)
- ✅ 2 Block Volumes (200 GB total)
- ✅ 10 GB Object Storage
- ✅ 10 TB Outbound Data Transfer per month

### **Recommended Setup:**
```
EC1 (Control): ARM Ampere A1 (1 OCPU, 6 GB RAM)
EC2 (Deploy):  ARM Ampere A1 (1 OCPU, 6 GB RAM)
EC3 (Deploy):  ARM Ampere A1 (1 OCPU, 6 GB RAM)
```

---

## 🚀 **STEP-BY-STEP SETUP:**

### **Step 1: Create Oracle Cloud Account**

1. Go to https://www.oracle.com/cloud/free/
2. Click "Start for free"
3. Fill in your details:
   - Email address
   - Country/Region
   - Cloud Account Name (e.g., "mydeployments")
4. Verify email
5. Add payment method (won't be charged for free tier)
6. Complete verification

---

### **Step 2: Create Compute Instance**

#### **2.1: Navigate to Compute**
1. Login to Oracle Cloud Console
2. Click ☰ menu → **Compute** → **Instances**
3. Click **Create Instance**

#### **2.2: Configure Instance**

**Name:** `EC2-deployment-server`

**Placement:**
- Availability Domain: AD-1 (or any available)

**Image and Shape:**
1. Click **Change Image**
2. Select **Canonical Ubuntu** (22.04 or 20.04)
3. Click **Select Image**

4. Click **Change Shape**
5. Select **Ampere** (ARM-based)
6. Choose:
   - OCPU count: 1
   - Memory: 6 GB
7. Click **Select Shape**

**Networking:**
- VCN: Create new or use existing
- Subnet: Public subnet
- **Assign a public IPv4 address**: ✅ YES

**Add SSH Keys:**
1. Select **Generate a key pair for me**
2. Click **Save Private Key** → Save as `ec2-key.pem`
3. Click **Save Public Key** (optional)

**Boot Volume:**
- Size: 50 GB (or more if needed)

#### **2.3: Create Instance**
Click **Create** and wait 1-2 minutes

---

### **Step 3: Configure Security Rules (CRITICAL!)**

#### **3.1: Navigate to Security List**
1. Click on your instance name
2. Under **Instance Details**, click on the **Subnet** link
3. Click on **Security Lists**
4. Click on the **Default Security List**

#### **3.2: Add Ingress Rules**

Click **Add Ingress Rules** for each:

**Rule 1: SSH**
```
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 22
Description: SSH access
```

**Rule 2: HTTP**
```
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 80
Description: HTTP
```

**Rule 3: HTTPS**
```
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 443
Description: HTTPS
```

**Rule 4: Container Ports**
```
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 3000-9999
Description: Container ports
```

**Rule 5: Backend API**
```
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 5000
Description: Backend API
```

**Rule 6: Allow from EC1** (Replace with EC1's IP)
```
Source CIDR: <EC1_IP>/32
IP Protocol: All Protocols
Description: Allow all from EC1
```

---

### **Step 4: Connect to Instance**

#### **4.1: Get Public IP**
1. Go to **Compute** → **Instances**
2. Click on your instance
3. Copy **Public IP Address** (e.g., 129.159.249.123)

#### **4.2: Set Permissions on SSH Key**
```bash
# Windows (Git Bash)
chmod 400 ec2-key.pem

# Linux/Mac
chmod 400 ec2-key.pem
```

#### **4.3: Connect via SSH**
```bash
ssh -i ec2-key.pem ubuntu@<PUBLIC_IP>
```

**First time:** Type `yes` to accept fingerprint

---

### **Step 5: Configure Ubuntu Firewall**

Once connected to the server:

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow container ports
sudo ufw allow 3000:9999/tcp

# Allow backend
sudo ufw allow 5000/tcp

# Enable firewall
sudo ufw --force enable

# Check status
sudo ufw status
```

---

### **Step 6: Run Automated Setup**

From your local machine:

```bash
# Make script executable
chmod +x setup-new-server.sh

# Run setup
./setup-new-server.sh EC2 <PUBLIC_IP> foodpanda.site
```

**This will:**
- ✅ Install Docker
- ✅ Install Nginx
- ✅ Install Node.js & PM2
- ✅ Configure firewall
- ✅ Setup Nginx routing
- ✅ Create directories

---

### **Step 7: Update Backend Configuration**

Edit `backend/.env`:

```env
# Add new server
EC2_HOST=129.159.249.123
SSH_EC2_KEY=D:/work/ec2/uz.key

# Or for EC4
EC4_HOST=129.159.249.124
SSH_EC4_KEY=D:/work/ec4/uz.key
```

Edit `backend/services/containerOrchestrator.js`:

```javascript
const ORACLE_SERVERS = {
  EC2: {
    host: process.env.EC2_HOST || '129.159.249.123',
    maxUsers: 200,
    resources: {
      physical: { cpu: 1, ram: 6144 },
      perUserCap: { cpu: 0.3, ram: 1843 }
    }
  },
  EC3: {
    host: process.env.EC3_HOST || '129.154.255.90',
    maxUsers: 200,
    resources: {
      physical: { cpu: 3, ram: 18432 },
      perUserCap: { cpu: 0.3, ram: 1843 }
    }
  },
  // Add new server
  EC4: {
    host: process.env.EC4_HOST || '129.159.249.124',
    maxUsers: 200,
    resources: {
      physical: { cpu: 1, ram: 6144 },
      perUserCap: { cpu: 0.3, ram: 1843 }
    }
  }
};
```

---

### **Step 8: Setup SSL (Optional but Recommended)**

```bash
./setup-ssl.sh
```

---

## 🔒 **SECURITY BEST PRACTICES:**

### **1. SSH Key Security:**
```bash
# Keep keys secure
chmod 400 *.pem

# Never commit keys to git
echo "*.pem" >> .gitignore
echo "*.key" >> .gitignore
```

### **2. Firewall Rules:**
- ✅ Only open necessary ports
- ✅ Use security groups
- ✅ Restrict SSH to your IP if possible

### **3. Regular Updates:**
```bash
# Run on each server
sudo apt update && sudo apt upgrade -y
```

---

## 📊 **RESOURCE ALLOCATION:**

### **Per Server Capacity:**

**EC2/EC3 (1 OCPU, 6 GB RAM):**
```
Max Users: 200
Per User: 0.3 OCPU, 1843 MB RAM
Total Capacity: 60 OCPU, 368 GB RAM (shared)
```

**EC3 (3 OCPU, 18 GB RAM):**
```
Max Users: 200
Per User: 0.3 OCPU, 1843 MB RAM
Total Capacity: 60 OCPU, 368 GB RAM (shared)
```

---

## 🌐 **DOMAIN SETUP:**

### **Option 1: Use Subdomain per Server**
```
ec2.foodpanda.site → EC2 (129.159.249.123)
ec3.foodpanda.site → EC3 (129.154.255.90)
ec4.foodpanda.site → EC4 (129.159.249.124)
```

### **Option 2: Use Main Domain with Load Balancing**
```
foodpanda.site → EC1 (Load balancer)
  ↓
  ├→ EC2 (Deployments)
  ├→ EC3 (Deployments)
  └→ EC4 (Deployments)
```

### **DNS Configuration:**

**Cloudflare/Your DNS Provider:**
```
Type: A
Name: @
Value: <EC1_IP>
TTL: Auto

Type: A
Name: ec2
Value: <EC2_IP>
TTL: Auto

Type: A
Name: ec3
Value: <EC3_IP>
TTL: Auto
```

---

## ✅ **VERIFICATION CHECKLIST:**

After setup, verify:

- [ ] Can SSH to server
- [ ] Docker is installed: `docker --version`
- [ ] Nginx is running: `sudo systemctl status nginx`
- [ ] Node.js installed: `node --version`
- [ ] PM2 installed: `pm2 --version`
- [ ] Firewall configured: `sudo ufw status`
- [ ] Ports are open: `curl http://<SERVER_IP>`
- [ ] Can access from EC1

---

## 🚨 **COMMON ISSUES:**

### **Issue 1: Can't SSH**
**Solution:**
1. Check security list has port 22 open
2. Check Ubuntu firewall: `sudo ufw status`
3. Verify SSH key permissions: `chmod 400 key.pem`

### **Issue 2: Can't Access HTTP**
**Solution:**
1. Check security list has port 80 open
2. Check Nginx: `sudo systemctl status nginx`
3. Check Ubuntu firewall: `sudo ufw allow 80/tcp`

### **Issue 3: Containers Not Accessible**
**Solution:**
1. Check security list has ports 3000-9999 open
2. Check Docker network: `docker network ls`
3. Check container is running: `docker ps`

---

## 📝 **QUICK REFERENCE:**

### **Create New Server:**
```bash
./setup-new-server.sh EC4 <IP> foodpanda.site
```

### **Add to Backend:**
```javascript
// .env
EC4_HOST=<IP>
SSH_EC4_KEY=D:/work/ec4/uz.key

// containerOrchestrator.js
EC4: { host: '<IP>', maxUsers: 200, ... }
```

### **Setup SSL:**
```bash
./setup-ssl.sh
```

### **Test Connection:**
```bash
ssh -i ec4-key.pem ubuntu@<IP>
```

---

## 🎉 **DONE!**

Your new Oracle Cloud server is ready for deployments!

**Next:** Deploy your first project and watch it work! 🚀
