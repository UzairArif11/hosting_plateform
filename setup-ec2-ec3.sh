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
echo "   ${GREEN}EC2_SERVER_IP=$PUBLIC_IP${NC}"
echo "   (or EC3_SERVER_IP if this is your third server)"
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
