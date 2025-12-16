#!/bin/bash

###############################################################################
# AUTO-DIAGNOSE AND FIX NGINX ROUTING
# This script automatically detects and fixes routing issues
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         AUTO-DIAGNOSE & FIX NGINX ROUTING                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get the latest deployment info from logs or parameters
DEPLOYMENT_PATH="${1:-eccom-69397f04-76074692}"
CONTAINER_PORT="${2:-3975}"

echo -e "${GREEN}Deployment Info:${NC}"
echo "  Path: /$DEPLOYMENT_PATH/"
echo "  Port: $CONTAINER_PORT"
echo ""

# Step 1: Check if container is running
echo -e "${BLUE}━━━ Step 1: Checking Container ━━━${NC}"

if docker ps --format '{{.Ports}}' | grep -q "$CONTAINER_PORT"; then
    echo -e "${GREEN}✓ Container is running on port $CONTAINER_PORT${NC}"
    
    # Test container directly
    CONTAINER_TEST=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$CONTAINER_PORT" 2>/dev/null || echo "000")
    echo "  Container response: HTTP $CONTAINER_TEST"
    
    if [ "$CONTAINER_TEST" = "200" ]; then
        echo -e "${GREEN}  ✓ Container is responding${NC}"
    else
        echo -e "${RED}  ✗ Container not responding${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ No container found on port $CONTAINER_PORT${NC}"
    echo "  Available containers:"
    docker ps --format 'table {{.Names}}\t{{.Ports}}'
    exit 1
fi

# Step 2: Check Nginx configuration
echo ""
echo -e "${BLUE}━━━ Step 2: Checking Nginx Configuration ━━━${NC}"

NGINX_CONF="/etc/nginx/sites-available/default"

if [ ! -f "$NGINX_CONF" ]; then
    echo -e "${RED}✗ Nginx config not found${NC}"
    exit 1
fi

# Check if deployment exists in config
if sudo grep -q "location /$DEPLOYMENT_PATH/" "$NGINX_CONF"; then
    echo -e "${GREEN}✓ Deployment found in Nginx config${NC}"
    
    # Check which server block it's in
    BLOCK_INFO=$(sudo awk -v path="/$DEPLOYMENT_PATH/" '
        /server {/ { in_server=1; server_name=""; }
        in_server && /server_name/ { server_name=$0; }
        in_server && $0 ~ path { print server_name; exit; }
        /^}/ { in_server=0; }
    ' "$NGINX_CONF")
    
    echo "  Found in server block: $BLOCK_INFO"
    
    if echo "$BLOCK_INFO" | grep -q "foodpanda.site"; then
        echo -e "${GREEN}  ✓ In correct server block (foodpanda.site)${NC}"
    else
        echo -e "${YELLOW}  ⚠ In wrong server block (not foodpanda.site)${NC}"
        echo -e "${YELLOW}  Will fix this...${NC}"
        NEEDS_FIX=true
    fi
else
    echo -e "${RED}✗ Deployment NOT in Nginx config${NC}"
    NEEDS_FIX=true
fi

# Step 3: Test routing
echo ""
echo -e "${BLUE}━━━ Step 3: Testing Routing ━━━${NC}"

# Test localhost
LOCALHOST_TEST=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost/$DEPLOYMENT_PATH/" 2>/dev/null || echo "000")
echo "  Localhost: HTTP $LOCALHOST_TEST"

# Test domain
DOMAIN_TEST=$(curl -s -o /dev/null -w "%{http_code}" "http://foodpanda.site/$DEPLOYMENT_PATH/" 2>/dev/null || echo "000")
echo "  Domain: HTTP $DOMAIN_TEST"

if [ "$DOMAIN_TEST" = "200" ]; then
    echo -e "${GREEN}✓ Routing works! No fix needed.${NC}"
    exit 0
fi

# Step 4: Fix the issue
if [ "$NEEDS_FIX" = "true" ]; then
    echo ""
    echo -e "${BLUE}━━━ Step 4: Fixing Nginx Configuration ━━━${NC}"
    
    # Backup current config
    sudo cp "$NGINX_CONF" "${NGINX_CONF}.backup.$(date +%s)"
    echo "  ✓ Config backed up"
    
    # Check if foodpanda.site server block exists
    if sudo grep -q "server_name foodpanda.site" "$NGINX_CONF"; then
        echo "  ✓ foodpanda.site server block exists"
        
        # Add location block to foodpanda.site server block
        sudo awk -v path="$DEPLOYMENT_PATH" -v port="$CONTAINER_PORT" '
        /server_name foodpanda.site/ { in_target=1; }
        in_target && /location \// && !added {
            print "    # Deployment: " path;
            print "    location /" path "/ {";
            print "        proxy_pass http://localhost:" port "/;";
            print "        proxy_http_version 1.1;";
            print "        proxy_set_header Upgrade $http_upgrade;";
            print "        proxy_set_header Connection '\''upgrade'\'';";
            print "        proxy_set_header Host $host;";
            print "        proxy_set_header X-Real-IP $remote_addr;";
            print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;";
            print "        proxy_set_header X-Forwarded-Proto $scheme;";
            print "        proxy_cache_bypass $http_upgrade;";
            print "    }";
            print "";
            added=1;
        }
        { print }
        ' "$NGINX_CONF" > /tmp/nginx-fixed.conf
        
        sudo mv /tmp/nginx-fixed.conf "$NGINX_CONF"
        echo "  ✓ Added location block to foodpanda.site server"
        
    else
        echo "  ✗ foodpanda.site server block not found"
        echo "  Creating new server block..."
        
        # Add new server block
        sudo tee -a "$NGINX_CONF" > /dev/null <<EOF

# Deployment server block
server {
    listen 80;
    listen [::]:80;
    
    server_name foodpanda.site www.foodpanda.site;
    
    # Deployment: $DEPLOYMENT_PATH
    location /$DEPLOYMENT_PATH/ {
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
        echo "  ✓ Created new server block"
    fi
    
    # Test Nginx config
    echo ""
    echo "  Testing Nginx configuration..."
    if sudo nginx -t 2>&1 | grep -q "successful"; then
        echo -e "${GREEN}  ✓ Nginx config is valid${NC}"
        
        # Reload Nginx
        echo "  Reloading Nginx..."
        sudo systemctl reload nginx
        echo -e "${GREEN}  ✓ Nginx reloaded${NC}"
    else
        echo -e "${RED}  ✗ Nginx config has errors!${NC}"
        sudo nginx -t
        echo "  Restoring backup..."
        sudo cp "${NGINX_CONF}.backup."* "$NGINX_CONF"
        exit 1
    fi
fi

# Step 5: Verify fix
echo ""
echo -e "${BLUE}━━━ Step 5: Verifying Fix ━━━${NC}"

sleep 2

# Test again
FINAL_TEST=$(curl -s -o /dev/null -w "%{http_code}" "http://foodpanda.site/$DEPLOYMENT_PATH/" 2>/dev/null || echo "000")
echo "  Final test: HTTP $FINAL_TEST"

if [ "$FINAL_TEST" = "200" ]; then
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ SUCCESS! Routing is now working!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${GREEN}Deployment URL:${NC}"
    echo -e "${GREEN}  http://foodpanda.site/$DEPLOYMENT_PATH/${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}⚠ Still not working (HTTP $FINAL_TEST)${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Check Nginx error log:"
    sudo tail -20 /var/log/nginx/error.log
fi
