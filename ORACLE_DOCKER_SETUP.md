# 🚀 Oracle Cloud Docker Setup - Complete Commands

**You're on Oracle Cloud!** Let's finish the Docker setup.

---

## ✅ STEP-BY-STEP COMMANDS

### Step 1: Fix Docker Permission

```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Apply the group change
newgrp docker

# Test docker (should work now)
docker ps
```

---

### Step 2: Enable Docker Remote API

```bash
# Create override directory
sudo mkdir -p /etc/systemd/system/docker.service.d

# Create override file
sudo tee /etc/systemd/system/docker.service.d/override.conf > /dev/null <<EOF
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2376
EOF

# Reload systemd
sudo systemctl daemon-reload

# Restart Docker
sudo systemctl restart docker

# Verify Docker is running
sudo systemctl status docker
```

---

### Step 3: Open Firewall Port

```bash
# Allow port 2376 for Docker remote API
sudo ufw allow 2376/tcp

# Reload firewall
sudo ufw reload

# Check firewall status
sudo ufw status
```

---

### Step 4: Test Docker

```bash
# Test locally
docker ps

# Test remote API
curl http://localhost:2376/version

# Get your public IP
curl ifconfig.me
```

---

### Step 5: Test from Local Machine

**On your Windows machine (PowerShell):**

```powershell
# Replace with your Oracle VM public IP
$ORACLE_IP = "YOUR_ORACLE_PUBLIC_IP"

# Test connection
Test-NetConnection -ComputerName $ORACLE_IP -Port 2376

# Test Docker API
Invoke-WebRequest "http://${ORACLE_IP}:2376/version"
```

---

## 🎯 COMPLETE SETUP SCRIPT

**Run this on Oracle VM:**

```bash
#!/bin/bash

echo "=== Oracle Cloud Docker Setup ==="

# Step 1: Add user to docker group
echo "Step 1: Adding user to docker group..."
sudo usermod -aG docker $USER

# Step 2: Enable Docker Remote API
echo "Step 2: Enabling Docker Remote API..."
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo tee /etc/systemd/system/docker.service.d/override.conf > /dev/null <<EOF
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2376
EOF

# Step 3: Reload and restart Docker
echo "Step 3: Restarting Docker..."
sudo systemctl daemon-reload
sudo systemctl restart docker

# Step 4: Open firewall
echo "Step 4: Opening firewall port 2376..."
sudo ufw allow 2376/tcp 2>/dev/null || echo "UFW not enabled, skipping..."

# Step 5: Test Docker
echo "Step 5: Testing Docker..."
sleep 2
docker ps

# Step 6: Get public IP
echo ""
echo "=== Setup Complete! ==="
echo "Your public IP is:"
curl -s ifconfig.me
echo ""
echo ""
echo "Add this IP to your backend/.env:"
echo "EC2_SERVER_IP=$(curl -s ifconfig.me)"
echo ""
echo "Test from local machine:"
echo "curl http://$(curl -s ifconfig.me):2376/version"
```

---

## 🚀 QUICK SETUP (Copy-Paste)

**Just run these commands:**

```bash
# Fix permission
sudo usermod -aG docker $USER
newgrp docker

# Enable remote API
sudo mkdir -p /etc/systemd/system/docker.service.d
echo '[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2376' | sudo tee /etc/systemd/system/docker.service.d/override.conf

# Restart Docker
sudo systemctl daemon-reload
sudo systemctl restart docker

# Open firewall
sudo ufw allow 2376/tcp

# Test
docker ps
echo "Your IP: $(curl -s ifconfig.me)"
```

---

## ✅ VERIFICATION

### On Oracle VM:

```bash
# Check Docker is running
docker ps

# Check remote API
curl http://localhost:2376/version

# Get your public IP
curl ifconfig.me
```

### On Local Machine:

```powershell
# Test connection (replace IP)
Test-NetConnection -ComputerName YOUR_ORACLE_IP -Port 2376

# Test Docker API
Invoke-WebRequest "http://YOUR_ORACLE_IP:2376/version"
```

---

## 📝 WHAT TO DO NEXT

1. **Get your Oracle public IP:**
   ```bash
   curl ifconfig.me
   ```

2. **Add to backend/.env:**
   ```env
   EC2_SERVER_IP=your_oracle_ip_here
   ```

3. **Restart backend:**
   ```powershell
   cd backend
   npm run dev
   ```

4. **Test the API:**
   ```
   http://localhost:5000/api/test/server-capacity
   ```

---

## 🎉 YOU'RE DONE!

After running these commands:
- ✅ Docker installed
- ✅ Remote API enabled
- ✅ Firewall configured
- ✅ Ready to accept connections

**Next:** Add the IP to your backend/.env and test!
