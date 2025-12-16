#!/bin/bash

###############################################################################
# NGINX ROUTING FIX - SIMPLIFIED VERSION
# For deployment: uzairarif11t-693904aa-44714701
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         NGINX ROUTING FIX                                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Deployment info
DEPLOYMENT_URL="uzairarif11t-693904aa-44714701"
CONTAINER_NAME="EC3-shared-user-uzairtesta-1765344696646"
CONTAINER_PORT="4259"

echo -e "${GREEN}Deployment Info:${NC}"
echo "  URL Path: /$DEPLOYMENT_URL/"
echo "  Container: $CONTAINER_NAME"
echo "  Port: $CONTAINER_PORT"
echo ""

# Step 1: Verify container is running
echo -e "${BLUE}━━━ Step 1: Checking Container ━━━${NC}"
if docker ps --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
    echo -e "${GREEN}✓ Container is running: $CONTAINER_NAME${NC}"
    
    # Get status
    STATUS=$(docker inspect -f '{{.State.Status}}' "$CONTAINER_NAME")
    echo "  Status: $STATUS"
    
    # Get port
    PORT_MAP=$(docker port "$CONTAINER_NAME" 80)
    echo "  Port Mapping: $PORT_MAP"
else
    echo -e "${RED}✗ Container not found!${NC}"
    exit 1
fi

# Step 2: Test container directly
echo ""
echo -e "${BLUE}━━━ Step 2: Testing Container ━━━${NC}"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$CONTAINER_PORT" 2>/dev/null || echo "000")
echo "  HTTP Response: $RESPONSE"

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "304" ] || [ "$RESPONSE" = "301" ]; then
    echo -e "${GREEN}✓ Container is responding!${NC}"
else
    echo -e "${YELLOW}⚠ Container response: HTTP $RESPONSE${NC}"
    if [ "$RESPONSE" = "000" ]; then
        echo "  Container might not be ready yet"
    fi
fi

# Step 3: Check Nginx configuration
echo ""
echo -e "${BLUE}━━━ Step 3: Checking Nginx Configuration ━━━${NC}"

NGINX_CONF="/etc/nginx/sites-available/deployments.conf"

if [ ! -f "$NGINX_CONF" ]; then
    echo -e "${RED}✗ Nginx config not found: $NGINX_CONF${NC}"
    exit 1
fi

# Check if deployment exists in config
if sudo grep -q "$DEPLOYMENT_URL" "$NGINX_CONF"; then
    echo -e "${GREEN}✓ Deployment found in Nginx config${NC}"
    echo ""
    echo "  Configuration:"
    sudo grep -A 10 "location /$DEPLOYMENT_URL/" "$NGINX_CONF" | head -11
else
    echo -e "${RED}✗ Deployment NOT found in Nginx config${NC}"
    echo ""
    echo -e "${YELLOW}Adding deployment to Nginx configuration...${NC}"
    
    # Backup config
    sudo cp "$NGINX_CONF" "${NGINX_CONF}.backup.$(date +%s)"
    echo "  ✓ Config backed up"
    
    # Find the closing brace of the server block
    # Add our location block before it
    sudo sed -i "/^}/i\\
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
    }" "$NGINX_CONF"
    
    echo "  ✓ Added location block to Nginx config"
    
    # Test config
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
        exit 1
    fi
fi

# Step 4: Test routing
echo ""
echo -e "${BLUE}━━━ Step 4: Testing Nginx Routing ━━━${NC}"

# Wait a moment for Nginx to reload
sleep 2

# Test internal
INTERNAL_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost/$DEPLOYMENT_URL/" 2>/dev/null || echo "000")
echo "  Internal (localhost): HTTP $INTERNAL_RESPONSE"

if [ "$INTERNAL_RESPONSE" = "200" ] || [ "$INTERNAL_RESPONSE" = "304" ]; then
    echo -e "${GREEN}✓ Nginx routing works!${NC}"
else
    echo -e "${RED}✗ Nginx routing failed (HTTP $INTERNAL_RESPONSE)${NC}"
    echo ""
    echo "  Checking Nginx error log:"
    sudo tail -20 /var/log/nginx/error.log | grep -i "$DEPLOYMENT_URL" || echo "  No specific errors found"
fi

# Test external
echo ""
EXTERNAL_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "https://foodpanda.site/$DEPLOYMENT_URL/" 2>/dev/null || echo "000")
echo "  External (foodpanda.site): HTTP $EXTERNAL_RESPONSE"

if [ "$EXTERNAL_RESPONSE" = "200" ] || [ "$EXTERNAL_RESPONSE" = "304" ]; then
    echo -e "${GREEN}✓ Deployment is accessible externally!${NC}"
else
    echo -e "${YELLOW}⚠ External: HTTP $EXTERNAL_RESPONSE${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Deployment URL:"
echo -e "${GREEN}  https://foodpanda.site/$DEPLOYMENT_URL/${NC}"
echo ""
echo "Status:"
echo "  Container Running: ✓"
echo "  Container Responding: $([ "$RESPONSE" = "200" ] && echo "✓" || echo "⚠")"
echo "  Nginx Config: $(sudo grep -q "$DEPLOYMENT_URL" "$NGINX_CONF" && echo "✓" || echo "✗")"
echo "  Internal Routing: $([ "$INTERNAL_RESPONSE" = "200" ] && echo "✓" || echo "⚠")"
echo "  External Access: $([ "$EXTERNAL_RESPONSE" = "200" ] && echo "✓" || echo "⚠")"
echo ""

if [ "$EXTERNAL_RESPONSE" = "200" ] || [ "$EXTERNAL_RESPONSE" = "304" ]; then
    echo -e "${GREEN}🎉 SUCCESS! Your deployment is live!${NC}"
    echo -e "${GREEN}   Visit: https://foodpanda.site/$DEPLOYMENT_URL/${NC}"
else
    echo -e "${YELLOW}⚠ Deployment configured but may need a few moments to be fully accessible${NC}"
    echo ""
    echo "Try visiting the URL in your browser:"
    echo "  https://foodpanda.site/$DEPLOYMENT_URL/"
    echo ""
    echo "If still 404, check:"
    echo "  1. Container logs: docker logs $CONTAINER_NAME"
    echo "  2. Nginx errors: sudo tail -50 /var/log/nginx/error.log"
fi

echo ""
echo "Done!"
