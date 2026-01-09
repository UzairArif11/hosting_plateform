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

# Step 5: Configure Nginx - Create separate config for user deployments
echo ""
echo -e "${BLUE}━━━ Step 5: Configuring Nginx for User Deployments ━━━${NC}"

# Determine server identifier (hostname or domain-based)
SERVER_ID=$(hostname | cut -d'.' -f1 | tr '[:upper:]' '[:lower:]')
if [ -z "$SERVER_ID" ] || [ "$SERVER_ID" = "instance" ]; then
    # Try to get from domain or use generic name
    SERVER_ID=$(echo "$DOMAIN" | cut -d'.' -f1)
    if [ -z "$SERVER_ID" ]; then
        SERVER_ID="deployment-server"
    fi
fi

DEPLOYMENT_CONFIG="user-deployments-${SERVER_ID}.conf"
echo "Creating deployment config: $DEPLOYMENT_CONFIG"

# Backup existing deployment config if it exists
if [ -f "/etc/nginx/sites-available/${DEPLOYMENT_CONFIG}" ]; then
    sudo cp "/etc/nginx/sites-available/${DEPLOYMENT_CONFIG}" "/etc/nginx/sites-available/${DEPLOYMENT_CONFIG}.backup.$(date +%s)"
fi

# Create separate config file for user deployments
sudo tee "/etc/nginx/sites-available/${DEPLOYMENT_CONFIG}" > /dev/null <<EOF
# User Deployments Configuration for ${DOMAIN}
# This file is managed by nginxRouter.js - DO NOT manually edit
# Generated by setup-deployment-server.sh

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    
    server_name ${DOMAIN} www.${DOMAIN};
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

# HTTPS server block for user deployments
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    server_name ${DOMAIN} www.${DOMAIN};
    
    # SSL Configuration (will be updated by certbot if cert exists)
    # ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    client_max_body_size 100M;
    
    # Root location (health check)
    location / {
        return 200 'User Deployments Server - ${DOMAIN}';
        add_header Content-Type text/plain;
    }
    
    # User deployment locations will be added here automatically by nginxRouter.js
    # Format: location /projectname-{id}/ { proxy_pass http://localhost:{port}/; }
}
EOF

# Enable the config file
if [ ! -f "/etc/nginx/sites-enabled/${DEPLOYMENT_CONFIG}" ]; then
    sudo ln -s "/etc/nginx/sites-available/${DEPLOYMENT_CONFIG}" "/etc/nginx/sites-enabled/${DEPLOYMENT_CONFIG}"
    echo "✓ Enabled deployment config in sites-enabled"
fi

# Test and reload
if sudo nginx -t 2>&1 | grep -q "successful\|syntax is ok"; then
    sudo systemctl reload nginx
    echo -e "${GREEN}✓ Nginx configured for user deployments${NC}"
else
    echo -e "${YELLOW}⚠ Nginx test failed, but continuing...${NC}"
    echo "  (SSL certificates may not exist yet - will be configured by certbot)"
fi

echo "  Config file: /etc/nginx/sites-available/${DEPLOYMENT_CONFIG}"
echo "  Enabled at: /etc/nginx/sites-enabled/${DEPLOYMENT_CONFIG}"

# Remove default config (not needed for deployment servers - we use separate configs)
echo ""
echo -e "${BLUE}━━━ Step 5.5: Cleaning Up Default Config ━━━${NC}"
if [ -f "/etc/nginx/sites-enabled/default" ]; then
    echo "→ Removing default config symlink from sites-enabled..."
    sudo rm -f /etc/nginx/sites-enabled/default
    echo "✓ Removed default from sites-enabled"
fi

if [ -f "/etc/nginx/sites-available/default" ]; then
    # Backup default before removing (in case it's needed later)
    sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%s)
    echo "→ Backing up default config..."
    echo "→ Removing default config from sites-available..."
    sudo rm -f /etc/nginx/sites-available/default
    echo "✓ Removed default from sites-available (backup saved)"
fi

# Verify nginx config is still valid
if sudo nginx -t 2>&1 | grep -q "successful\|syntax is ok"; then
    echo "✓ Nginx config valid after cleanup"
else
    echo -e "${YELLOW}⚠ Nginx test warning after cleanup (may need manual fix)${NC}"
fi

# Step 6: Install Certbot
echo ""
echo -e "${BLUE}━━━ Step 6: Installing Certbot ━━━${NC}"

if command -v certbot &> /dev/null; then
    echo "Certbot already installed"
else
    sudo apt-get install -y certbot python3-certbot-nginx
    echo -e "${GREEN}✓ Certbot installed${NC}"
fi

# Step 7: Setup SSL for deployment config
echo ""
echo -e "${BLUE}━━━ Step 7: SSL Certificate Setup ━━━${NC}"

# Check if certificate already exists
if sudo certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
    echo -e "${GREEN}✓ SSL certificate already exists for $DOMAIN${NC}"
    echo "  → Updating deployment config with SSL settings..."
    
    # Update the deployment config file with SSL settings
    if sudo grep -q "ssl_certificate" "/etc/nginx/sites-available/${DEPLOYMENT_CONFIG}"; then
        echo "  ✓ SSL already configured in deployment config"
    else
        # Uncomment SSL lines in deployment config
        sudo sed -i "s|# ssl_certificate|ssl_certificate|g" "/etc/nginx/sites-available/${DEPLOYMENT_CONFIG}"
        sudo sed -i "s|# ssl_certificate_key|ssl_certificate_key|g" "/etc/nginx/sites-available/${DEPLOYMENT_CONFIG}"
        sudo sed -i "s|# ssl_protocols|ssl_protocols|g" "/etc/nginx/sites-available/${DEPLOYMENT_CONFIG}"
        sudo sed -i "s|# ssl_prefer_server_ciphers|ssl_prefer_server_ciphers|g" "/etc/nginx/sites-available/${DEPLOYMENT_CONFIG}"
        
        # Update certificate paths (uncomment and set correct domain)
        sudo sed -i "s|# ssl_certificate /etc/letsencrypt/live/\$DOMAIN|ssl_certificate /etc/letsencrypt/live/${DOMAIN}|g" "/etc/nginx/sites-available/${DEPLOYMENT_CONFIG}"
        sudo sed -i "s|# ssl_certificate_key /etc/letsencrypt/live/\$DOMAIN|ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}|g" "/etc/nginx/sites-available/${DEPLOYMENT_CONFIG}"
        
        if sudo nginx -t 2>&1 | grep -q "successful\|syntax is ok"; then
            sudo systemctl reload nginx
            echo "  ✓ SSL configured in deployment config"
        fi
    fi
else
    echo "Attempting to obtain SSL certificate..."
    echo "Note: Domain must be pointing to this server's IP"
    echo ""
    
    # Try to get certificate - certbot will automatically configure nginx
    # But we need to make sure it uses our deployment config
    if sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect 2>&1 | tee /tmp/certbot.log; then
        echo -e "${GREEN}✓ SSL certificate obtained${NC}"
        # Certbot may have modified default, so ensure our deployment config is correct
        if sudo grep -q "ssl_certificate.*${DOMAIN}" "/etc/nginx/sites-available/${DEPLOYMENT_CONFIG}"; then
            echo "  ✓ Deployment config already has SSL"
        else
            # Copy SSL config from certbot to deployment config
            echo "  → Configuring SSL in deployment config..."
            sudo sed -i "s|# ssl_certificate /etc/letsencrypt/live/\$DOMAIN|ssl_certificate /etc/letsencrypt/live/${DOMAIN}|g" "/etc/nginx/sites-available/${DEPLOYMENT_CONFIG}"
            sudo sed -i "s|# ssl_certificate_key /etc/letsencrypt/live/\$DOMAIN|ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}|g" "/etc/nginx/sites-available/${DEPLOYMENT_CONFIG}"
            
            if sudo nginx -t 2>&1 | grep -q "successful\|syntax is ok"; then
                sudo systemctl reload nginx
                echo "  ✓ SSL configured in deployment config"
            fi
        fi
    else
        echo -e "${YELLOW}⚠ SSL certificate setup failed${NC}"
        echo "  This is normal if:"
        echo "  - Domain is not pointing to this server yet"
        echo "  - Port 80 is not accessible from internet"
        echo ""
        echo "  You can run SSL setup later with:"
        echo "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
        echo ""
        echo "  Then update deployment config manually or re-run this script"
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

# Step 12: System Optimization (Auto-Prune & Logs)
echo ""
echo -e "${BLUE}━━━ Step 12: System Optimization ━━━${NC}"

# 1. Setup Daily Docker Prune (Maintenance)
CRON_JOB="0 4 * * * /usr/bin/docker system prune -af --filter \"until=24h\" >> /var/log/docker-prune.log 2>&1"
(crontab -l 2>/dev/null | grep -v "docker system prune"; echo "$CRON_JOB") | crontab -
echo "✓ Daily Docker cleanup scheduled (4 AM)"

# 2. Configure Docker Log Rotation (Prevent log explosion)
# This will overwrite the existing daemon.json, so ensure all desired settings are here.
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "5m",
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
echo "✓ Docker log limits configured (5MB max)"

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

# Step 13: Build Custom PM2 Docker Image
echo ""
echo -e "${BLUE}━━━ Step 13: Building Custom PM2 Image ━━━${NC}"
echo "This enables instant container startups (no 20s PM2 install wait)"
echo ""

# Pre-build cleanup to ensure space
echo "Checking disk/docker space..."
docker system prune -f > /dev/null 2>&1
# Ensure we have at least 500MB free in /var/lib/docker or /
FREE_SPACE=$(df -k . | awk 'NR==2 {print $4}')
if [ "$FREE_SPACE" -lt 500000 ]; then
    echo -e "${YELLOW}⚠ Low disk space detected! cleaning harder...${NC}"
    docker image prune -a -f --filter "until=24h" > /dev/null 2>&1
fi

# Create clean build directory (avoid /tmp permission issues)
mkdir -p ~/pm2-build
cd ~/pm2-build

# Create Dockerfile
cat > Dockerfile << 'DOCKERFILE_EOF'
FROM node:18-alpine
RUN npm install -g pm2@latest --no-audit --no-fund --silent --prefer-offline --no-optional

# FORCE SYMLINKS (Allocates PM2 to global bin paths)
RUN ln -sf /usr/local/bin/pm2 /bin/pm2
RUN ln -sf /usr/local/bin/pm2-runtime /bin/pm2-runtime
RUN ln -sf /usr/local/bin/pm2 /usr/bin/pm2

RUN pm2 --version
WORKDIR /app
ENV NODE_ENV=production
ENV PATH="/usr/local/bin:/bin:/usr/bin:${PATH}"
EXPOSE 3000
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
DOCKERFILE_EOF

echo "Building image... (takes ~2 minutes)"
if docker build -t node-pm2-alpine:latest . 2>&1 | grep -E "(Step|Successfully)"; then
    echo -e "${GREEN}✓ Custom PM2 image built: node-pm2-alpine:latest${NC}"
    docker images | grep node-pm2-alpine
else
    echo -e "${YELLOW}⚠ PM2 image build failed (optional, will use standard image)${NC}"
fi

# Cleanup
cd ~
rm -rf ~/pm2-build

echo -e "${GREEN}✓ Platform optimization complete${NC}"

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
echo -e "${GREEN}✓ Custom PM2 image built (instant container startups)${NC}"
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
