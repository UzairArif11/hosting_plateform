#!/bin/bash

###############################################################################
# ORACLE CLOUD DEPLOYMENT SERVER SETUP (FIXED)
# Works specifically for Oracle Cloud Ubuntu instances
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         ORACLE CLOUD DEPLOYMENT SETUP                      ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

DOMAIN="foodpanda.site"
EMAIL="admin@foodpanda.site"

echo -e "${BLUE}Configuration:${NC}"
echo "  Domain: $DOMAIN"
echo ""

# Step 1: Configure Nginx for deployments
echo -e "${BLUE}━━━ Step 1: Configuring Nginx ━━━${NC}"

sudo tee /etc/nginx/sites-available/default > /dev/null <<'EOF'
# Default server block (for IP access)
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    
    root /var/www/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
}

# Main domain server block
server {
    listen 80;
    listen [::]:80;
    
    server_name foodpanda.site www.foodpanda.site;
    
    # Default location - return 404
    location / {
        return 404 "No deployment found";
    }
    
    # Deployment locations will be added here automatically
}
EOF

sudo nginx -t
sudo systemctl reload nginx

echo -e "${GREEN}✓ Nginx configured${NC}"

# Step 2: Create deployment directories
echo ""
echo -e "${BLUE}━━━ Step 2: Creating Deployment Directories ━━━${NC}"

sudo mkdir -p /tmp/builds
sudo chmod 777 /tmp/builds

echo -e "${GREEN}✓ Directories created${NC}"

# Step 3: Configure Docker daemon
echo ""
echo -e "${BLUE}━━━ Step 3: Configuring Docker ━━━${NC}"

sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

sudo systemctl restart docker

echo -e "${GREEN}✓ Docker configured${NC}"

# Step 4: Install Certbot (optional)
echo ""
echo -e "${BLUE}━━━ Step 4: Installing Certbot ━━━${NC}"

if ! command -v certbot &> /dev/null; then
    sudo apt-get install -y certbot python3-certbot-nginx
    echo -e "${GREEN}✓ Certbot installed${NC}"
else
    echo "Certbot already installed"
fi

# Step 5: Create health check
echo ""
echo -e "${BLUE}━━━ Step 5: Creating Health Check ━━━${NC}"

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
        .status { color: #4ade80; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Deployment Server</h1>
        <p class="status">✓ Ready for Deployments</p>
        <p>Server: $(hostname)</p>
    </div>
</body>
</html>
EOF

echo -e "${GREEN}✓ Health check created${NC}"

# Summary
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}SETUP COMPLETE!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✓ Nginx configured for $DOMAIN${NC}"
echo -e "${GREEN}✓ Deployment directories created${NC}"
echo -e "${GREEN}✓ Docker configured${NC}"
echo -e "${GREEN}✓ Certbot installed${NC}"
echo -e "${GREEN}✓ Health check created${NC}"
echo ""
echo -e "${YELLOW}Next: Deploy from user panel - routing will work automatically!${NC}"
echo ""
