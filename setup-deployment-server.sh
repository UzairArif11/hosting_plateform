#!/bin/bash

###############################################################################
# UNIVERSAL DEPLOYMENT SERVER SETUP
# 
# Works on: Oracle Cloud, AWS, Any Ubuntu 24.04 server
# Configures: Docker, Nginx, SSL, Firewall (if available)
# 
# Usage:
#   chmod +x setup-deployment-server.sh
#   sudo ./setup-deployment-server.sh
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         DEPLOYMENT SERVER SETUP (UNIVERSAL)                ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Ask for domain configuration
echo -e "${BLUE}━━━ Domain Configuration ━━━${NC}"
echo ""
read -p "Enter domain name (default: foodpanda.site): " INPUT_DOMAIN
DOMAIN="${INPUT_DOMAIN:-foodpanda.site}"

read -p "Enter SSL email (default: admin@$DOMAIN): " INPUT_EMAIL
EMAIL="${INPUT_EMAIL:-admin@$DOMAIN}"

echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Domain: $DOMAIN"
echo "  Email: $EMAIL"
echo "  Server: $(hostname)"
echo "  IP: $(hostname -I | awk '{print $1}')"
echo ""

read -p "Continue with setup? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Step 1: Update system
echo ""
echo -e "${BLUE}━━━ Step 1: Updating System ━━━${NC}"
sudo apt-get update
sudo apt-get upgrade -y
echo -e "${GREEN}✓ System updated${NC}"

# Step 2: Install Docker (if not installed)
echo ""
echo -e "${BLUE}━━━ Step 2: Installing Docker ━━━${NC}"

if command -v docker &> /dev/null; then
    echo "Docker already installed: $(docker --version)"
else
    # Install prerequisites
    sudo apt-get install -y ca-certificates curl gnupg lsb-release

    # Add Docker's official GPG key
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    # Set up repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Add current user to docker group
    sudo usermod -aG docker $USER

    echo -e "${GREEN}✓ Docker installed${NC}"
fi

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Step 3: Install Nginx (if not installed)
echo ""
echo -e "${BLUE}━━━ Step 3: Installing Nginx ━━━${NC}"

if command -v nginx &> /dev/null; then
    echo "Nginx already installed: $(nginx -v 2>&1)"
else
    sudo apt-get install -y nginx
    echo -e "${GREEN}✓ Nginx installed${NC}"
fi

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Step 4: Configure Firewall (if available)
echo ""
echo -e "${BLUE}━━━ Step 4: Configuring Firewall ━━━${NC}"

if command -v ufw &> /dev/null; then
    # UFW is available (AWS, DigitalOcean, etc.)
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw allow 3000:5000/tcp
    echo "y" | sudo ufw enable || true
    echo -e "${GREEN}✓ UFW firewall configured${NC}"
elif command -v firewall-cmd &> /dev/null; then
    # firewalld (CentOS, RHEL)
    sudo firewall-cmd --permanent --add-service=ssh
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --permanent --add-port=3000-5000/tcp
    sudo firewall-cmd --reload
    echo -e "${GREEN}✓ firewalld configured${NC}"
else
    # Oracle Cloud or no firewall
    echo -e "${YELLOW}⚠ No firewall detected (Oracle Cloud uses Security Lists)${NC}"
    echo "  Make sure these ports are open in your cloud console:"
    echo "  - 22 (SSH)"
    echo "  - 80 (HTTP)"
    echo "  - 443 (HTTPS)"
    echo "  - 3000-5000 (Containers)"
fi

# Step 5: Configure Nginx
echo ""
echo -e "${BLUE}━━━ Step 5: Configuring Nginx ━━━${NC}"

# Backup existing config
if [ -f /etc/nginx/sites-available/default ]; then
    sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%s)
fi

# Create new config
sudo tee /etc/nginx/sites-available/default > /dev/null <<EOF
# Default server block (for IP access)
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    
    root /var/www/html;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ =404;
    }
}

# Main domain server block
server {
    listen 80;
    listen [::]:80;
    
    server_name $DOMAIN www.$DOMAIN;
    
    # Default location
    location / {
        return 404 "No deployment found at this path";
    }
    
    # Deployment locations will be added here automatically by nginxRouter
}
EOF

# Test and reload
sudo nginx -t
sudo systemctl reload nginx

echo -e "${GREEN}✓ Nginx configured${NC}"

# Step 6: Install Certbot
echo ""
echo -e "${BLUE}━━━ Step 6: Installing Certbot ━━━${NC}"

if command -v certbot &> /dev/null; then
    echo "Certbot already installed"
else
    sudo apt-get install -y certbot python3-certbot-nginx
    echo -e "${GREEN}✓ Certbot installed${NC}"
fi

# Step 7: Setup SSL
echo ""
echo -e "${BLUE}━━━ Step 7: SSL Certificate Setup ━━━${NC}"

# Check if certificate already exists
if sudo certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
    echo -e "${GREEN}✓ SSL certificate already exists for $DOMAIN${NC}"
else
    echo "Attempting to obtain SSL certificate..."
    echo "Note: Domain must be pointing to this server's IP"
    echo ""
    
    # Try to get certificate
    if sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect 2>&1 | tee /tmp/certbot.log; then
        echo -e "${GREEN}✓ SSL certificate obtained and configured${NC}"
    else
        echo -e "${YELLOW}⚠ SSL certificate setup failed${NC}"
        echo "  This is normal if:"
        echo "  - Domain is not pointing to this server yet"
        echo "  - Port 80 is not accessible from internet"
        echo ""
        echo "  You can run SSL setup later with:"
        echo "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
        echo ""
        echo "  Continuing without SSL..."
    fi
fi

# Step 8: Create deployment directories
echo ""
echo -e "${BLUE}━━━ Step 8: Creating Deployment Directories ━━━${NC}"

sudo mkdir -p /tmp/builds
sudo chmod 777 /tmp/builds

echo -e "${GREEN}✓ Directories created${NC}"

# Step 9: Install Node.js (if not installed)
echo ""
echo -e "${BLUE}━━━ Step 9: Installing Node.js ━━━${NC}"

if command -v node &> /dev/null; then
    echo "Node.js already installed: $(node --version)"
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo -e "${GREEN}✓ Node.js installed: $(node --version)${NC}"
fi

# Step 10: Configure Docker daemon
echo ""
echo -e "${BLUE}━━━ Step 10: Configuring Docker ━━━${NC}"

sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-address-pools": [
    {
      "base": "172.17.0.0/16",
      "size": 24
    }
  ]
}
EOF

sudo systemctl restart docker

echo -e "${GREEN}✓ Docker configured${NC}"

# Step 11: Create health check
echo ""
echo -e "${BLUE}━━━ Step 11: Creating Health Check ━━━${NC}"

sudo tee /var/www/html/index.html > /dev/null <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>Deployment Server Ready</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container { text-align: center; }
        h1 { font-size: 3em; margin: 0; }
        .status { color: #4ade80; font-weight: bold; font-size: 1.5em; }
        .info { margin-top: 20px; }
        .info p { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Deployment Server</h1>
        <p class="status">✓ Ready for Deployments</p>
        <div class="info">
            <p>Server: $(hostname)</p>
            <p>IP: $(hostname -I | awk '{print $1}')</p>
            <p>Docker: $(docker --version | cut -d' ' -f3 | cut -d',' -f1)</p>
            <p>Nginx: $(nginx -v 2>&1 | cut -d'/' -f2)</p>
            <p>Node.js: $(node --version)</p>
        </div>
    </div>
</body>
</html>
EOF

echo -e "${GREEN}✓ Health check created${NC}"

# Step 12: System optimization
echo ""
echo -e "${BLUE}━━━ Step 12: System Optimization ━━━${NC}"

# Increase file limits
if ! grep -q "nofile 65536" /etc/security/limits.conf; then
    sudo tee -a /etc/security/limits.conf > /dev/null <<EOF
* soft nofile 65536
* hard nofile 65536
EOF
fi

# Increase inotify limits
if ! grep -q "fs.inotify.max_user_watches" /etc/sysctl.conf; then
    sudo tee -a /etc/sysctl.conf > /dev/null <<EOF
fs.inotify.max_user_watches=524288
fs.inotify.max_user_instances=512
EOF
    sudo sysctl -p
fi

echo -e "${GREEN}✓ System optimized${NC}"

# Summary
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}SETUP COMPLETE!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✓ System updated${NC}"
echo -e "${GREEN}✓ Docker installed and configured${NC}"
echo -e "${GREEN}✓ Nginx installed and configured${NC}"
echo -e "${GREEN}✓ Firewall configured (if available)${NC}"

# Check SSL status
if sudo certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
    echo -e "${GREEN}✓ SSL certificate installed${NC}"
    SSL_STATUS="Enabled"
else
    echo -e "${YELLOW}⚠ SSL not configured (run certbot manually)${NC}"
    SSL_STATUS="Not configured"
fi

echo -e "${GREEN}✓ Deployment directories created${NC}"
echo -e "${GREEN}✓ Node.js installed${NC}"
echo -e "${GREEN}✓ System optimized${NC}"
echo ""
echo -e "${BLUE}Server Information:${NC}"
echo "  Hostname: $(hostname)"
echo "  IP: $(hostname -I | awk '{print $1}')"
echo "  Domain: $DOMAIN"
echo "  SSL: $SSL_STATUS"
echo "  Docker: $(docker --version | cut -d' ' -f3 | cut -d',' -f1)"
echo "  Nginx: $(nginx -v 2>&1 | cut -d'/' -f2)"
echo "  Node.js: $(node --version)"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Verify health check: http://$(hostname -I | awk '{print $1}')"
echo "  2. If SSL failed, run: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "  3. Deploy from user panel - routing will work automatically!"
echo ""
echo -e "${GREEN}The server is ready to receive deployments!${NC}"
echo ""
