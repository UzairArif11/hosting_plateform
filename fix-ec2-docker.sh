#!/bin/bash
########################################
# Fix EC2 Docker - Configure for HTTP
# Removes SSL/TLS and enables HTTP API
########################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "EC2 Docker Fix - Configure for HTTP"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}ERROR: Please run with sudo${NC}"
    echo "Usage: sudo bash fix-ec2-docker.sh"
    exit 1
fi

echo -e "${GREEN}Step 1: Stopping Docker...${NC}"
systemctl stop docker
echo -e "${GREEN}[OK] Docker stopped${NC}"

echo ""
echo -e "${GREEN}Step 2: Configuring Docker for HTTP (no SSL)...${NC}"

# Create override directory
mkdir -p /etc/systemd/system/docker.service.d

# Create override file for HTTP
cat > /etc/systemd/system/docker.service.d/override.conf <<EOF
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2376
EOF

echo -e "${GREEN}[OK] Docker configured for HTTP${NC}"

echo ""
echo -e "${GREEN}Step 3: Reloading systemd...${NC}"
systemctl daemon-reload
echo -e "${GREEN}[OK] systemd reloaded${NC}"

echo ""
echo -e "${GREEN}Step 4: Starting Docker...${NC}"
systemctl start docker
sleep 2
echo -e "${GREEN}[OK] Docker started${NC}"

echo ""
echo -e "${GREEN}Step 5: Opening firewall port 2376...${NC}"

# Open port 2376 in iptables
iptables -I INPUT -p tcp --dport 2376 -j ACCEPT

# Try to save iptables rules
if command -v netfilter-persistent &> /dev/null; then
    netfilter-persistent save
    echo -e "${GREEN}[OK] Firewall rules saved with netfilter-persistent${NC}"
else
    # Alternative method
    mkdir -p /etc/iptables
    iptables-save > /etc/iptables/rules.v4
    echo -e "${YELLOW}[WARNING] netfilter-persistent not found, rules saved manually${NC}"
fi

echo ""
echo -e "${GREEN}Step 6: Verifying configuration...${NC}"

# Check if Docker is running
if systemctl is-active --quiet docker; then
    echo -e "${GREEN}[OK] Docker is running${NC}"
else
    echo -e "${RED}[ERROR] Docker is not running${NC}"
    exit 1
fi

# Check if port 2376 is open in iptables
if iptables -L -n | grep -q 2376; then
    echo -e "${GREEN}[OK] Port 2376 is open in iptables${NC}"
else
    echo -e "${YELLOW}[WARNING] Port 2376 not found in iptables${NC}"
fi

# Check what Docker is listening on
echo ""
echo "Docker is listening on:"
netstat -tlnp | grep docker || echo "Could not determine Docker ports"

echo ""
echo -e "${GREEN}Step 7: Testing Docker API...${NC}"

# Test HTTP
if curl -s http://localhost:2376/version > /dev/null 2>&1; then
    echo -e "${GREEN}[OK] Docker API is accessible via HTTP!${NC}"
    echo ""
    echo "Docker version:"
    curl -s http://localhost:2376/version | head -5
else
    echo -e "${RED}[ERROR] Docker API is not accessible via HTTP${NC}"
    echo "This might be normal if Docker is still starting up"
fi

# Get public IP
echo ""
echo -e "${GREEN}Step 8: Getting public IP...${NC}"
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "Could not determine")
echo "Public IP: $PUBLIC_IP"

echo ""
echo "========================================"
echo -e "${GREEN}Fix Complete!${NC}"
echo "========================================"
echo ""
echo "Configuration Summary:"
echo "  Docker: Running on HTTP (no SSL)"
echo "  Port: 2376"
echo "  Protocol: HTTP"
echo "  Public IP: $PUBLIC_IP"
echo ""
echo "Next Steps:"
echo ""
echo "1. ${YELLOW}IMPORTANT:${NC} Open port 2376 in Oracle Cloud Console:"
echo "   - Go to: https://cloud.oracle.com"
echo "   - Navigate to: Compute → Instances → Your Instance"
echo "   - Click: Subnet → Security List → Add Ingress Rules"
echo "   - Add rule: TCP port 2376, Source: 0.0.0.0/0"
echo ""
echo "2. Test from your local machine:"
echo "   ${GREEN}Test-NetConnection -ComputerName $PUBLIC_IP -Port 2376${NC}"
echo "   ${GREEN}Invoke-WebRequest http://$PUBLIC_IP:2376/version${NC}"
echo ""
echo "3. Update EC1 backend/.env:"
echo "   ${GREEN}DOCKER_USE_HTTPS=false${NC}"
echo "   ${GREEN}EC2_SERVER_IP=$PUBLIC_IP${NC}"
echo ""
echo "4. Restart EC1 backend and test:"
echo "   ${GREEN}http://localhost:5000/api/test/server-capacity${NC}"
echo ""
echo "========================================"
echo ""
