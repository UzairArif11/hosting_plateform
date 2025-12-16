#!/bin/bash

###############################################################################
# FIX NGINX CONFIGURATION - Remove nested location blocks
###############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         FIX NGINX NESTED LOCATION BLOCKS                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Backup current config
echo -e "${BLUE}━━━ Step 1: Backing up current config ━━━${NC}"
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%s)
echo -e "${GREEN}✓ Backup created${NC}"

# Show current error
echo ""
echo -e "${BLUE}━━━ Step 2: Testing current config ━━━${NC}"
sudo nginx -t 2>&1 | head -20

# Fix the config
echo ""
echo -e "${BLUE}━━━ Step 3: Fixing nested location blocks ━━━${NC}"

# Create a clean config
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

# Main domain server block - HTTP
server {
    listen 80;
    listen [::]:80;
    
    server_name foodpanda.site www.foodpanda.site;
    
    # Default location
    location / {
        return 404 "No deployment found at this path";
    }
    
    # Deployments will be added here
}

# Main domain server block - HTTPS
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    
    server_name foodpanda.site www.foodpanda.site;
    
    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/foodpanda.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/foodpanda.site/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # Default location
    location / {
        return 404 "No deployment found at this path";
    }
    
    # Deployments will be added here
}
EOF

echo -e "${GREEN}✓ Config rewritten${NC}"

# Test new config
echo ""
echo -e "${BLUE}━━━ Step 4: Testing new config ━━━${NC}"
if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓ Nginx config is valid${NC}"
    
    # Reload Nginx
    echo ""
    echo -e "${BLUE}━━━ Step 5: Reloading Nginx ━━━${NC}"
    sudo systemctl reload nginx
    echo -e "${GREEN}✓ Nginx reloaded${NC}"
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ NGINX CONFIGURATION FIXED!                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Restart backend: pm2 restart backend (or npm start)"
    echo "  2. Deploy again from user panel"
    echo "  3. New deployment will work correctly"
else
    echo -e "${RED}✗ Nginx config still has errors${NC}"
    sudo nginx -t
    echo ""
    echo "Restoring backup..."
    sudo cp /etc/nginx/sites-available/default.backup.* /etc/nginx/sites-available/default
fi

echo ""
