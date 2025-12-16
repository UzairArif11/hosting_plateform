#!/bin/bash

###############################################################################
# NGINX ROUTING TEST & FIX SCRIPT
# 
# This script tests and fixes Nginx routing for deployed containers
# Run this on EC3 server via SSH
#
# Usage:
#   chmod +x test-nginx-routing.sh
#   ./test-nginx-routing.sh
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         NGINX ROUTING TEST & FIX                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get the latest deployment info
DEPLOYMENT_URL="uzairarif11t-693904aa-44714701"
CONTAINER_PORT="4259"

echo -e "${GREEN}Testing deployment:${NC}"
echo "  URL Path: /$DEPLOYMENT_URL/"
echo "  Container Port: $CONTAINER_PORT"
echo ""

# Step 1: Check if container is running
echo -e "${BLUE}━━━ Step 1: Checking Container ━━━${NC}"
CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep -i "trello" | head -1)

if [ -z "$CONTAINER_NAME" ]; then
    echo -e "${RED}✗ No Trello container found!${NC}"
    echo "  Listing all containers:"
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    exit 1
else
    echo -e "${GREEN}✓ Container found: $CONTAINER_NAME${NC}"
    
    # Check if it's running
    STATUS=$(docker inspect -f '{{.State.Status}}' "$CONTAINER_NAME")
    echo "  Status: $STATUS"
    
    if [ "$STATUS" != "running" ]; then
        echo -e "${RED}✗ Container is not running!${NC}"
        exit 1
    fi
    
    # Check port mapping
    PORT_MAP=$(docker port "$CONTAINER_NAME" 80 2>/dev/null || echo "none")
    echo "  Port Mapping: $PORT_MAP"
    
    # Get actual port
    ACTUAL_PORT=$(echo "$PORT_MAP" | grep -oP '\d+$' || echo "")
    if [ -n "$ACTUAL_PORT" ]; then
        echo -e "${GREEN}✓ Container listening on port: $ACTUAL_PORT${NC}"
    else
        echo -e "${YELLOW}⚠ Could not determine port${NC}"
    fi
fi

# Step 2: Test container directly
echo ""
echo -e "${BLUE}━━━ Step 2: Testing Container Directly ━━━${NC}"
if [ -n "$ACTUAL_PORT" ]; then
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$ACTUAL_PORT" || echo "000")
    echo "  HTTP Response: $RESPONSE"
    
    if [ "$RESPONSE" = "200" ]; then
        echo -e "${GREEN}✓ Container is responding!${NC}"
    else
        echo -e "${RED}✗ Container not responding (HTTP $RESPONSE)${NC}"
        echo "  Checking container logs:"
        docker logs --tail 20 "$CONTAINER_NAME"
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

echo "  Config file: $NGINX_CONF"

# Check if our deployment is in the config
if grep -q "$DEPLOYMENT_URL" "$NGINX_CONF"; then
    echo -e "${GREEN}✓ Deployment found in Nginx config${NC}"
    
    # Show the location block
    echo ""
    echo "  Configuration:"
    grep -A 10 "location /$DEPLOYMENT_URL/" "$NGINX_CONF" | head -11
else
    echo -e "${RED}✗ Deployment NOT found in Nginx config!${NC}"
    echo ""
    echo -e "${YELLOW}This is the problem! Nginx doesn't know about this deployment.${NC}"
    echo ""
    
    # Offer to add it
    read -p "Do you want to add this deployment to Nginx? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "  Adding deployment to Nginx..."
        
        # Backup config
        sudo cp "$NGINX_CONF" "${NGINX_CONF}.backup.$(date +%s)"
        
        # Add location block
        sudo tee -a "$NGINX_CONF" > /dev/null <<EOF

    # Deployment: $DEPLOYMENT_URL
    location /$DEPLOYMENT_URL/ {
        proxy_pass http://localhost:$ACTUAL_PORT/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Handle trailing slashes
        rewrite ^/$DEPLOYMENT_URL/(.*)$ /\$1 break;
    }
EOF
        
        echo -e "${GREEN}✓ Added to Nginx config${NC}"
        
        # Test config
        echo "  Testing Nginx configuration..."
        if sudo nginx -t; then
            echo -e "${GREEN}✓ Nginx config is valid${NC}"
            
            # Reload Nginx
            echo "  Reloading Nginx..."
            sudo systemctl reload nginx
            echo -e "${GREEN}✓ Nginx reloaded${NC}"
        else
            echo -e "${RED}✗ Nginx config has errors!${NC}"
            echo "  Restoring backup..."
            sudo mv "${NGINX_CONF}.backup.$(date +%s)" "$NGINX_CONF"
            exit 1
        fi
    fi
fi

# Step 4: Test Nginx routing
echo ""
echo -e "${BLUE}━━━ Step 4: Testing Nginx Routing ━━━${NC}"

# Test internal
INTERNAL_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost/$DEPLOYMENT_URL/" || echo "000")
echo "  Internal (localhost): HTTP $INTERNAL_RESPONSE"

if [ "$INTERNAL_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ Nginx routing works internally!${NC}"
else
    echo -e "${RED}✗ Nginx routing failed (HTTP $INTERNAL_RESPONSE)${NC}"
    
    # Check Nginx error log
    echo ""
    echo "  Recent Nginx errors:"
    sudo tail -20 /var/log/nginx/error.log | grep -i "$DEPLOYMENT_URL" || echo "  No errors found"
fi

# Test external (if domain is configured)
echo ""
EXTERNAL_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "https://foodpanda.site/$DEPLOYMENT_URL/" || echo "000")
echo "  External (foodpanda.site): HTTP $EXTERNAL_RESPONSE"

if [ "$EXTERNAL_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ Deployment is accessible externally!${NC}"
    echo ""
    echo -e "${GREEN}🎉 SUCCESS! Deployment is working:${NC}"
    echo -e "${GREEN}   https://foodpanda.site/$DEPLOYMENT_URL/${NC}"
else
    echo -e "${YELLOW}⚠ External access failed (HTTP $EXTERNAL_RESPONSE)${NC}"
    echo "  This might be a firewall or DNS issue"
fi

# Step 5: Summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Container: $CONTAINER_NAME"
echo "Port: $ACTUAL_PORT"
echo "URL: https://foodpanda.site/$DEPLOYMENT_URL/"
echo ""
echo "Status:"
echo "  Container Running: $([ "$STATUS" = "running" ] && echo "✓" || echo "✗")"
echo "  Container Responding: $([ "$RESPONSE" = "200" ] && echo "✓" || echo "✗")"
echo "  Nginx Config: $(grep -q "$DEPLOYMENT_URL" "$NGINX_CONF" && echo "✓" || echo "✗")"
echo "  Internal Routing: $([ "$INTERNAL_RESPONSE" = "200" ] && echo "✓" || echo "✗")"
echo "  External Access: $([ "$EXTERNAL_RESPONSE" = "200" ] && echo "✓" || echo "✗")"
echo ""

# Recommendations
echo -e "${YELLOW}RECOMMENDATIONS:${NC}"
echo ""

if [ "$INTERNAL_RESPONSE" != "200" ]; then
    echo "1. Fix Nginx routing configuration"
    echo "   - Check location block syntax"
    echo "   - Verify proxy_pass port matches container port"
    echo "   - Check for trailing slash issues"
fi

if [ "$EXTERNAL_RESPONSE" != "200" ] && [ "$INTERNAL_RESPONSE" = "200" ]; then
    echo "2. Check firewall rules"
    echo "   sudo ufw status"
    echo "   sudo ufw allow 443/tcp"
fi

if [ "$RESPONSE" != "200" ]; then
    echo "3. Check container logs for errors"
    echo "   docker logs $CONTAINER_NAME"
fi

echo ""
echo "Done!"
