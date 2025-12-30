#!/bin/bash

###############################################################################
# COMPLETE SERVER CLEANUP SCRIPT (UNIVERSAL)
# 
# This script removes ALL deployment-related configurations and containers
# Works on: Oracle Cloud, AWS, any Ubuntu server
# 
# Features:
#   - Removes all containers and images
#   - Resets Nginx configuration
#   - Preserves SSL certificates (optional)
#   - Cleans Docker system
#
# WARNING: This will delete all containers and deployment configs!
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║         COMPLETE SERVER CLEANUP                            ║${NC}"
echo -e "${RED}║         WARNING: THIS WILL DELETE EVERYTHING!              ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}This will remove:${NC}"
echo "  - All Docker containers"
echo "  - All Docker images"
echo "  - Nginx deployment configurations"
echo "  - Temporary build files"
echo "  - Docker build cache"
echo ""
echo -e "${GREEN}This will preserve:${NC}"
echo "  - SSL certificates (if you choose)"
echo "  - System packages (Docker, Nginx, Node.js)"
echo ""

# Confirmation
read -p "Are you sure you want to clean this server? (type 'YES' to confirm): " -r
echo
if [[ ! $REPLY == "YES" ]]; then
    echo "Cleanup cancelled."
    exit 1
fi

# Ask about SSL
read -p "Do you want to preserve SSL certificates? (y/n): " -n 1 -r
echo
PRESERVE_SSL=$REPLY

echo ""
echo -e "${BLUE}Starting cleanup...${NC}"
echo ""

# Step 1: Stop and remove all containers
echo -e "${BLUE}━━━ Step 1: Removing All Containers ━━━${NC}"

CONTAINERS=$(docker ps -aq 2>/dev/null || echo "")
if [ -n "$CONTAINERS" ]; then
    echo "Stopping all containers..."
    docker stop $(docker ps -aq) 2>/dev/null || true
    
    echo "Removing all containers..."
    docker rm -f $(docker ps -aq) 2>/dev/null || true
    
    echo -e "${GREEN}✓ All containers removed${NC}"
else
    echo "No containers to remove"
fi

# Step 2: Remove all Docker images
echo ""
echo -e "${BLUE}━━━ Step 2: Removing All Docker Images ━━━${NC}"

# Ask about Custom Image
read -p "Do you want to preserve the Custom PM2 Image? (y/n): " -n 1 -r
echo
PRESERVE_IMG=$REPLY

IMAGES=$(docker images -q 2>/dev/null || echo "")
if [ -n "$IMAGES" ]; then
    echo "Removing Docker images..."
    
    if [[ $PRESERVE_IMG =~ ^[Yy]$ ]]; then
        # Remove everything EXCEPT node-pm2-alpine
        echo "Preserving node-pm2-alpine:latest..."
        docker images | grep -v "node-pm2-alpine" | awk '{print $3}' | grep -v "IMAGE" | xargs -r docker rmi -f 2>/dev/null || true
        echo -e "${GREEN}✓ Images removed (Costum PM2 image preserved)${NC}"
    else
        docker rmi -f $(docker images -q) 2>/dev/null || true
        echo -e "${GREEN}✓ All images removed${NC}"
    fi
else
    echo "No images to remove"
fi

# Step 3: Clean Docker system
echo ""
echo -e "${BLUE}━━━ Step 3: Cleaning Docker System ━━━${NC}"

docker system prune -af --volumes 2>/dev/null || true
echo -e "${GREEN}✓ Docker system cleaned${NC}"

# Step 4: Reset Nginx configuration
echo ""
echo -e "${BLUE}━━━ Step 4: Resetting Nginx Configuration ━━━${NC}"

# Backup current config
if [ -f /etc/nginx/sites-available/default ]; then
    sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%s)
    echo "✓ Current config backed up"
fi

# Check if SSL certificates exist
HAS_SSL=false
if [[ $PRESERVE_SSL =~ ^[Yy]$ ]] && sudo certbot certificates 2>/dev/null | grep -q "foodpanda.site"; then
    HAS_SSL=true
    echo "✓ SSL certificates detected - will preserve"
fi

# Create new config
if [ "$HAS_SSL" = true ]; then
    # Preserve SSL configuration
    echo "Creating config with SSL preservation..."
    sudo tee /etc/nginx/sites-available/default > /dev/null <<'EOF'
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

# Main domain server block (SSL will be re-added by certbot)
server {
    listen 80;
    listen [::]:80;
    
    server_name foodpanda.site www.foodpanda.site;
    
    location / {
        return 404 "No deployment found";
    }
}
EOF
    
    # Re-run certbot to restore SSL
    echo "Restoring SSL configuration..."
    sudo certbot --nginx -d foodpanda.site -d www.foodpanda.site --non-interactive --agree-tos --email admin@foodpanda.site --redirect 2>/dev/null || true
    
else
    # No SSL or not preserving
    sudo tee /etc/nginx/sites-available/default > /dev/null <<'EOF'
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
EOF
fi

echo -e "${GREEN}✓ Nginx config reset${NC}"

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx

# Step 5: Remove deployment scripts
echo ""
echo -e "${BLUE}━━━ Step 5: Removing Deployment Scripts ━━━${NC}"

cd ~
rm -f test-nginx-routing.sh
rm -f diagnose-nginx.sh
rm -f fix-nginx-now.sh
rm -f find-and-fix-nginx.sh
rm -f complete-nginx-fix.sh
rm -f setup-ec2-ec3.sh
rm -f fix-ec2-docker.sh
rm -f auto-fix-routing.sh
rm -f setup-oracle-cloud.sh

echo -e "${GREEN}✓ All scripts removed${NC}"

# Step 6: Clean temporary files
echo ""
echo -e "${BLUE}━━━ Step 6: Cleaning Temporary Files ━━━${NC}"

sudo rm -rf /tmp/builds/* 2>/dev/null || true
sudo rm -rf /tmp/nginx-* 2>/dev/null || true

echo -e "${GREEN}✓ Temporary files cleaned${NC}"

# Step 7: Clean Docker build cache
echo ""
echo -e "${BLUE}━━━ Step 7: Cleaning Docker Build Cache ━━━${NC}"

docker builder prune -af 2>/dev/null || true

echo -e "${GREEN}✓ Docker build cache cleaned${NC}"

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}CLEANUP COMPLETE!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Summary:"
echo "  ✓ All containers removed"
echo "  ✓ All Docker images removed"
echo "  ✓ Docker system cleaned"
echo "  ✓ Nginx config reset"
echo "  ✓ Deployment scripts removed"
echo "  ✓ Temporary files cleaned"
echo ""
echo "The server is now clean and ready for fresh setup!"
echo ""
echo "Next steps:"
echo "  1. Run the setup script: ./setup-deployment-server.sh"
echo "  2. Configure SSL if needed"
echo "  3. Test deployment from user panel"
echo ""
