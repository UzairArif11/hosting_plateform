#!/bin/bash

###############################################################################
# NEW SERVER SETUP SCRIPT (EC4, EC5, etc.)
# 
# This script sets up a new Oracle Cloud server for the deployment platform
# 
# Usage:
#   chmod +x setup-new-server.sh
#   ./setup-new-server.sh EC4 <server-ip> <domain>
#
# Example:
#   ./setup-new-server.sh EC4 129.159.249.124 foodpanda.site
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Arguments
SERVER_KEY=${1:-EC4}
SERVER_IP=${2}
DOMAIN=${3}

if [ -z "$SERVER_IP" ] || [ -z "$DOMAIN" ]; then
    echo -e "${RED}Usage: $0 <SERVER_KEY> <SERVER_IP> <DOMAIN>${NC}"
    echo -e "${YELLOW}Example: $0 EC4 129.159.249.124 foodpanda.site${NC}"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         NEW SERVER SETUP FOR ${SERVER_KEY}                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Server Key:${NC} $SERVER_KEY"
echo -e "${GREEN}Server IP:${NC} $SERVER_IP"
echo -e "${GREEN}Domain:${NC} $DOMAIN"
echo ""

# SSH Configuration
SSH_KEY="${SSH_${SERVER_KEY}_KEY:-D:/work/${SERVER_KEY,,}/uz.key}"
SSH_USER="${SSH_USERNAME:-ubuntu}"

# Function to run command on server
run_on_server() {
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$SERVER_IP" "$1"
}

# Function to print step
step() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}▶ $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

step "Step 1: Testing SSH Connection"
if run_on_server "echo 'SSH connection successful'"; then
    echo -e "${GREEN}✓ SSH connection working${NC}"
else
    echo -e "${RED}✗ Failed to connect via SSH${NC}"
    exit 1
fi

step "Step 2: Updating System"
run_on_server "sudo apt update && sudo apt upgrade -y"
echo -e "${GREEN}✓ System updated${NC}"

step "Step 3: Installing Docker"
run_on_server "curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh"
run_on_server "sudo usermod -aG docker $SSH_USER"
echo -e "${GREEN}✓ Docker installed${NC}"

step "Step 4: Installing Nginx"
run_on_server "sudo apt install -y nginx"
echo -e "${GREEN}✓ Nginx installed${NC}"

step "Step 5: Installing Node.js"
run_on_server "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
run_on_server "sudo apt install -y nodejs"
echo -e "${GREEN}✓ Node.js installed${NC}"

step "Step 6: Installing PM2"
run_on_server "sudo npm install -g pm2"
echo -e "${GREEN}✓ PM2 installed${NC}"

step "Step 7: Configuring Firewall"
run_on_server "sudo ufw allow 22/tcp"    # SSH
run_on_server "sudo ufw allow 80/tcp"    # HTTP
run_on_server "sudo ufw allow 443/tcp"   # HTTPS
run_on_server "sudo ufw allow 3000:9999/tcp"  # Container ports
run_on_server "sudo ufw --force enable"
echo -e "${GREEN}✓ Firewall configured${NC}"

step "Step 8: Creating Nginx Configuration"

NGINX_CONFIG="server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Deployed apps (dynamic routing)
    location ~ ^/([a-zA-Z0-9-]+)/ {
        resolver 127.0.0.1;
        set \$backend http://localhost:3000;
        proxy_pass \$backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}"

run_on_server "echo '$NGINX_CONFIG' | sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null"
run_on_server "sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN"
run_on_server "sudo rm -f /etc/nginx/sites-enabled/default"
run_on_server "sudo nginx -t && sudo systemctl restart nginx"
echo -e "${GREEN}✓ Nginx configured${NC}"

step "Step 9: Setting up Docker Network"
run_on_server "docker network create deployment-network || true"
echo -e "${GREEN}✓ Docker network created${NC}"

step "Step 10: Creating Directories"
run_on_server "mkdir -p ~/deployments ~/logs"
echo -e "${GREEN}✓ Directories created${NC}"

echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              SERVER SETUP COMPLETE!                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ Docker installed and configured${NC}"
echo -e "${GREEN}✓ Nginx installed and configured${NC}"
echo -e "${GREEN}✓ Node.js and PM2 installed${NC}"
echo -e "${GREEN}✓ Firewall configured${NC}"
echo -e "${GREEN}✓ Ready for deployments${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Update backend .env with new server:"
echo "     ${SERVER_KEY}_HOST=$SERVER_IP"
echo "  2. Add server to containerOrchestrator.js:"
echo "     ORACLE_SERVERS.$SERVER_KEY = { host: '$SERVER_IP', ... }"
echo "  3. Setup SSL: ./setup-ssl.sh"
echo ""
echo -e "${GREEN}Done! 🎉${NC}"
