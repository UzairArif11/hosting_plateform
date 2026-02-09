#!/bin/bash
########################################
# EC2/EC3 - SECURE Docker Setup Script
# Container servers for user deployments
# 
# SECURITY: Docker API is NOT exposed to internet
# Use SSH tunnels or Docker Context for remote access
########################################

set -e  # Exit on error

echo "========================================"
echo "EC2/EC3 - SECURE Docker Server Setup"
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
echo -e "${GREEN}Step 3: Configuring Docker for LOCAL-ONLY access...${NC}"

# Create override directory
mkdir -p /etc/systemd/system/docker.service.d

# Create override file - Docker listens ONLY on localhost
cat > /etc/systemd/system/docker.service.d/override.conf <<EOF
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// -H unix:///var/run/docker.sock
EOF

echo -e "${GREEN}[OK] Docker configured for local access only${NC}"
echo -e "${YELLOW}Note: Docker API is NOT exposed to the internet (secure!)${NC}"

echo ""
echo -e "${GREEN}Step 4: Installing security tools...${NC}"

# Install UFW firewall
apt install -y ufw

# Configure firewall
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS

# Explicitly deny Docker API port
ufw deny 2376

# Enable firewall
ufw --force enable

echo -e "${GREEN}[OK] Firewall configured${NC}"

# Install Fail2ban
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

echo -e "${GREEN}[OK] Fail2ban installed${NC}"

echo ""
echo -e "${GREEN}Step 5: Restarting Docker...${NC}"

# Reload systemd and restart Docker
systemctl daemon-reload
systemctl restart docker

echo -e "${GREEN}[OK] Docker restarted${NC}"

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

# Verify Docker is NOT exposed
echo ""
echo -e "${GREEN}Step 9: Security verification...${NC}"

if ss -tulpn | grep -q ":2376"; then
    echo -e "${RED}[ERROR] Docker API is exposed on port 2376!${NC}"
    exit 1
else
    echo -e "${GREEN}[OK] Docker API is NOT exposed to internet${NC}"
fi

if ufw status | grep -q "Status: active"; then
    echo -e "${GREEN}[OK] Firewall is active${NC}"
else
    echo -e "${RED}[ERROR] Firewall is not active${NC}"
    exit 1
fi

echo ""
echo "========================================"
echo -e "${GREEN}Secure Setup Complete!${NC}"
echo "========================================"
echo ""
echo "Server Information:"
echo "  Public IP: $PUBLIC_IP"
echo "  Docker Access: Local only (secure)"
echo "  Firewall: Enabled"
echo "  SSH: Port 22 (use key-based auth)"
echo ""
echo "Next Steps:"
echo ""
echo "1. ${GREEN}Set up SSH key-based authentication:${NC}"
echo "   ssh-copy-id ubuntu@$PUBLIC_IP"
echo ""
echo "2. ${GREEN}Create Docker context on your local machine:${NC}"
echo "   docker context create ec2-remote --docker \"host=ssh://ubuntu@$PUBLIC_IP\""
echo "   docker context use ec2-remote"
echo ""
echo "3. ${GREEN}Deploy remotely via SSH:${NC}"
echo "   docker-compose up -d"
echo ""
echo "4. ${GREEN}Add this IP to your EC1 server backend/.env:${NC}"
echo "   EC2_SERVER_IP=$PUBLIC_IP"
echo "   (or EC3_SERVER_IP if this is your third server)"
echo ""
echo "5. ${GREEN}Platform backend will connect via SSH tunnel${NC}"
echo ""
echo "========================================"
echo ""
echo -e "${YELLOW}Security Notes:${NC}"
echo "  - Docker API is NOT exposed to the internet"
echo "  - Remote access via SSH tunnel only"
echo "  - Firewall blocks all unnecessary ports"
echo "  - Fail2ban protects against brute force attacks"
echo ""
echo -e "${GREEN}No port 2376 exposure = No crypto mining attacks!${NC}"
echo ""
