#!/bin/bash

###############################################################################
# COMPLETE NGINX DIAGNOSTIC & FIX
# Fixes both HTTP and HTTPS routing
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         COMPLETE NGINX DIAGNOSTIC & FIX                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

DEPLOYMENT_URL="uzairarif11t-693904aa-44714701"
CONTAINER_PORT="4259"

# Step 1: Find all Nginx configs
echo -e "${BLUE}━━━ Step 1: Finding All Nginx Configs ━━━${NC}"

echo "Checking /etc/nginx/sites-available/:"
ls -la /etc/nginx/sites-available/ 2>/dev/null || echo "  Directory not found"

echo ""
echo "Checking /etc/nginx/sites-enabled/:"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "  Directory not found"

echo ""
echo "Checking for SSL configs:"
sudo grep -r "listen.*443" /etc/nginx/ 2>/dev/null | head -5 || echo "  No SSL configs found"

# Step 2: Check both HTTP and HTTPS server blocks
echo ""
echo -e "${BLUE}━━━ Step 2: Checking Server Blocks ━━━${NC}"

HTTP_FOUND=0
HTTPS_FOUND=0

# Check if deployment exists in HTTP (port 80)
if sudo grep -r "listen.*80" /etc/nginx/sites-available/ 2>/dev/null | grep -q "default"; then
    echo -e "${GREEN}✓ Found HTTP server block (port 80)${NC}"
    HTTP_CONFIG=$(sudo grep -l "listen.*80" /etc/nginx/sites-available/* | head -1)
    echo "  Config: $HTTP_CONFIG"
    
    if sudo grep -q "$DEPLOYMENT_URL" "$HTTP_CONFIG"; then
        echo -e "${GREEN}  ✓ Deployment found in HTTP config${NC}"
        HTTP_FOUND=1
    else
        echo -e "${RED}  ✗ Deployment NOT in HTTP config${NC}"
    fi
fi

# Check if deployment exists in HTTPS (port 443)
if sudo grep -r "listen.*443" /etc/nginx/sites-available/ 2>/dev/null | grep -q "default"; then
    echo -e "${GREEN}✓ Found HTTPS server block (port 443)${NC}"
    HTTPS_CONFIG=$(sudo grep -l "listen.*443" /etc/nginx/sites-available/* | head -1)
    echo "  Config: $HTTPS_CONFIG"
    
    if sudo grep -q "$DEPLOYMENT_URL" "$HTTPS_CONFIG"; then
        echo -e "${GREEN}  ✓ Deployment found in HTTPS config${NC}"
        HTTPS_FOUND=1
    else
        echo -e "${RED}  ✗ Deployment NOT in HTTPS config${NC}"
    fi
else
    echo -e "${YELLOW}⚠ No HTTPS server block found${NC}"
fi

# Step 3: Fix the issue
echo ""
echo -e "${BLUE}━━━ Step 3: Fixing Configuration ━━━${NC}"

LOCATION_BLOCK="    # Deployment: $DEPLOYMENT_URL
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
    }"

# Find the default config
DEFAULT_CONFIG="/etc/nginx/sites-available/default"

if [ ! -f "$DEFAULT_CONFIG" ]; then
    echo -e "${RED}✗ Default config not found!${NC}"
    exit 1
fi

# Backup
sudo cp "$DEFAULT_CONFIG" "${DEFAULT_CONFIG}.backup.$(date +%s)"
echo "✓ Config backed up"

# Show current structure
echo ""
echo "Current server blocks in config:"
sudo grep -n "server {" "$DEFAULT_CONFIG" || echo "No server blocks found"

# Check if we need to add to HTTPS block
if [ $HTTPS_FOUND -eq 0 ]; then
    echo ""
    echo -e "${YELLOW}Adding deployment to HTTPS server block...${NC}"
    
    # Find the HTTPS server block and add location before its closing brace
    # This is tricky - we need to find the right closing brace
    
    # Create a temporary file with the fix
    sudo awk -v location="$LOCATION_BLOCK" '
    /listen.*443/ { in_https=1 }
    in_https && /^}/ && !added {
        print location
        print ""
        added=1
    }
    { print }
    ' "$DEFAULT_CONFIG" > /tmp/nginx_fixed.conf
    
    # Replace the config
    sudo mv /tmp/nginx_fixed.conf "$DEFAULT_CONFIG"
    echo "  ✓ Added to HTTPS block"
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
    sudo cp "${DEFAULT_CONFIG}.backup."* "$DEFAULT_CONFIG"
    exit 1
fi

# Step 4: Test everything
echo ""
echo -e "${BLUE}━━━ Step 4: Testing All Endpoints ━━━${NC}"

sleep 2

# Test container
echo "1. Container direct:"
CONTAINER_TEST=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$CONTAINER_PORT" 2>/dev/null)
echo "   http://localhost:$CONTAINER_PORT → HTTP $CONTAINER_TEST"

# Test HTTP
echo "2. HTTP (port 80):"
HTTP_TEST=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost/$DEPLOYMENT_URL/" 2>/dev/null)
echo "   http://localhost/$DEPLOYMENT_URL/ → HTTP $HTTP_TEST"

# Test HTTPS internal
echo "3. HTTPS internal:"
HTTPS_INT=$(curl -s -o /dev/null -w "%{http_code}" "https://localhost/$DEPLOYMENT_URL/" 2>/dev/null || echo "000")
echo "   https://localhost/$DEPLOYMENT_URL/ → HTTP $HTTPS_INT"

# Test HTTPS external
echo "4. HTTPS external:"
HTTPS_EXT=$(curl -s -o /dev/null -w "%{http_code}" "https://foodpanda.site/$DEPLOYMENT_URL/" 2>/dev/null)
echo "   https://foodpanda.site/$DEPLOYMENT_URL/ → HTTP $HTTPS_EXT"

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}RESULTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$HTTPS_EXT" = "200" ] || [ "$HTTPS_EXT" = "304" ]; then
    echo -e "${GREEN}🎉 SUCCESS! Deployment is accessible!${NC}"
    echo -e "${GREEN}   https://foodpanda.site/$DEPLOYMENT_URL/${NC}"
else
    echo -e "${YELLOW}⚠ Still getting 404 on external HTTPS${NC}"
    echo ""
    echo "Possible issues:"
    echo "1. SSL certificate doesn't cover this path"
    echo "2. There might be multiple server blocks"
    echo "3. The HTTPS block might be in a different file"
    echo ""
    echo "Let's check the full Nginx config:"
    echo ""
    sudo nginx -T 2>/dev/null | grep -A 20 "listen.*443" | head -30
    echo ""
    echo "Check Nginx error log:"
    sudo tail -20 /var/log/nginx/error.log
fi

echo ""
echo "Done!"
