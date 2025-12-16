#!/bin/bash

###############################################################################
# NGINX ROUTING FIX - Find and Fix Config
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         NGINX CONFIG FINDER & FIXER                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

DEPLOYMENT_URL="uzairarif11t-693904aa-44714701"
CONTAINER_PORT="4259"

echo -e "${GREEN}Finding Nginx configuration...${NC}"
echo ""

# Check common Nginx config locations
POSSIBLE_CONFIGS=(
    "/etc/nginx/sites-available/default"
    "/etc/nginx/sites-enabled/default"
    "/etc/nginx/nginx.conf"
    "/etc/nginx/conf.d/default.conf"
    "/etc/nginx/sites-available/deployments.conf"
)

FOUND_CONFIG=""

for config in "${POSSIBLE_CONFIGS[@]}"; do
    if [ -f "$config" ]; then
        echo -e "${GREEN}✓ Found: $config${NC}"
        FOUND_CONFIG="$config"
        break
    fi
done

if [ -z "$FOUND_CONFIG" ]; then
    echo -e "${RED}✗ No Nginx config found!${NC}"
    echo ""
    echo "Let's check what's in /etc/nginx:"
    ls -la /etc/nginx/
    exit 1
fi

echo ""
echo -e "${BLUE}Using config: $FOUND_CONFIG${NC}"
echo ""

# Check if our deployment is already there
if sudo grep -q "$DEPLOYMENT_URL" "$FOUND_CONFIG"; then
    echo -e "${GREEN}✓ Deployment already in config!${NC}"
    echo ""
    echo "Configuration:"
    sudo grep -A 10 "$DEPLOYMENT_URL" "$FOUND_CONFIG"
else
    echo -e "${YELLOW}Adding deployment to Nginx config...${NC}"
    
    # Backup
    sudo cp "$FOUND_CONFIG" "${FOUND_CONFIG}.backup.$(date +%s)"
    echo "  ✓ Config backed up"
    
    # Check if this is inside a server block or needs one
    if sudo grep -q "server {" "$FOUND_CONFIG"; then
        echo "  ✓ Found existing server block"
        
        # Add location block before the last closing brace
        sudo sed -i "/^[[:space:]]*}[[:space:]]*$/i\\
\\
    # Deployment: $DEPLOYMENT_URL\\
    location /$DEPLOYMENT_URL/ {\\
        proxy_pass http://localhost:$CONTAINER_PORT/;\\
        proxy_http_version 1.1;\\
        proxy_set_header Upgrade \$http_upgrade;\\
        proxy_set_header Connection 'upgrade';\\
        proxy_set_header Host \$host;\\
        proxy_set_header X-Real-IP \$remote_addr;\\
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\\
        proxy_set_header X-Forwarded-Proto \$scheme;\\
        proxy_cache_bypass \$http_upgrade;\\
    }" "$FOUND_CONFIG"
        
        echo "  ✓ Added location block"
    else
        echo -e "${YELLOW}  No server block found. Creating complete config...${NC}"
        
        # Create a complete server block
        cat << EOF | sudo tee -a "$FOUND_CONFIG" > /dev/null

server {
    listen 80;
    listen [::]:80;
    server_name foodpanda.site www.foodpanda.site;

    # Deployment: $DEPLOYMENT_URL
    location /$DEPLOYMENT_URL/ {
        proxy_pass http://localhost:$CONTAINER_PORT/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
        echo "  ✓ Added server block with location"
    fi
    
    # Test config
    echo ""
    echo "Testing Nginx configuration..."
    if sudo nginx -t 2>&1 | grep -q "successful"; then
        echo -e "${GREEN}✓ Nginx config is valid${NC}"
        
        # Reload
        echo "Reloading Nginx..."
        sudo systemctl reload nginx
        echo -e "${GREEN}✓ Nginx reloaded${NC}"
    else
        echo -e "${RED}✗ Nginx config has errors!${NC}"
        sudo nginx -t
        echo ""
        echo "Restoring backup..."
        sudo cp "${FOUND_CONFIG}.backup."* "$FOUND_CONFIG"
        exit 1
    fi
fi

# Test routing
echo ""
echo -e "${BLUE}━━━ Testing Routing ━━━${NC}"

sleep 2

# Test internal
INTERNAL=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost/$DEPLOYMENT_URL/" 2>/dev/null || echo "000")
echo "  Internal: HTTP $INTERNAL"

if [ "$INTERNAL" = "200" ] || [ "$INTERNAL" = "304" ]; then
    echo -e "${GREEN}✓ Nginx routing works!${NC}"
else
    echo -e "${YELLOW}⚠ Internal: HTTP $INTERNAL${NC}"
fi

# Test external
EXTERNAL=$(curl -s -o /dev/null -w "%{http_code}" "https://foodpanda.site/$DEPLOYMENT_URL/" 2>/dev/null || echo "000")
echo "  External: HTTP $EXTERNAL"

if [ "$EXTERNAL" = "200" ] || [ "$EXTERNAL" = "304" ]; then
    echo -e "${GREEN}✓ External access works!${NC}"
else
    echo -e "${YELLOW}⚠ External: HTTP $EXTERNAL${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}DEPLOYMENT URL:${NC}"
echo -e "${GREEN}  https://foodpanda.site/$DEPLOYMENT_URL/${NC}"
echo ""

if [ "$EXTERNAL" = "200" ] || [ "$EXTERNAL" = "304" ]; then
    echo -e "${GREEN}🎉 SUCCESS! Your deployment is live!${NC}"
else
    echo -e "${YELLOW}Configuration added. If still 404, try:${NC}"
    echo "  1. Wait 30 seconds and try again"
    echo "  2. Check: curl -I http://localhost:$CONTAINER_PORT"
    echo "  3. Check logs: sudo tail -50 /var/log/nginx/error.log"
fi

echo ""
echo "Done!"
