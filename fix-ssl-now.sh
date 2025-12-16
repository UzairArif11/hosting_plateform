#!/bin/bash

###############################################################################
# QUICK FIX - Restore SSL and Configure Nginx
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         QUICK FIX - SSL & NGINX                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Check SSL certificate
echo -e "${BLUE}━━━ Step 1: Checking SSL Certificate ━━━${NC}"

if sudo certbot certificates 2>/dev/null | grep -q "foodpanda.site"; then
    echo -e "${GREEN}✓ SSL certificate exists${NC}"
    HAS_SSL=true
else
    echo -e "${YELLOW}⚠ No SSL certificate found${NC}"
    HAS_SSL=false
fi

# Step 2: Reconfigure Nginx with Certbot
echo ""
echo -e "${BLUE}━━━ Step 2: Configuring Nginx for SSL ━━━${NC}"

if [ "$HAS_SSL" = true ]; then
    echo "Re-running certbot to configure Nginx..."
    sudo certbot --nginx -d foodpanda.site -d www.foodpanda.site --non-interactive --agree-tos --email admin@foodpanda.site --redirect --reinstall
    echo -e "${GREEN}✓ Nginx configured for SSL${NC}"
else
    echo "Getting new SSL certificate..."
    sudo certbot --nginx -d foodpanda.site -d www.foodpanda.site --non-interactive --agree-tos --email admin@foodpanda.site --redirect
    echo -e "${GREEN}✓ SSL certificate obtained and configured${NC}"
fi

# Step 3: Test Nginx
echo ""
echo -e "${BLUE}━━━ Step 3: Testing Nginx ━━━${NC}"

sudo nginx -t
sudo systemctl reload nginx

echo -e "${GREEN}✓ Nginx reloaded${NC}"

# Step 4: Verify
echo ""
echo -e "${BLUE}━━━ Step 4: Verifying ━━━${NC}"

sleep 2

# Test HTTP
HTTP_TEST=$(curl -s -o /dev/null -w "%{http_code}" "http://foodpanda.site/" 2>/dev/null || echo "000")
echo "  HTTP: $HTTP_TEST"

# Test HTTPS
HTTPS_TEST=$(curl -s -o /dev/null -w "%{http_code}" "https://foodpanda.site/" 2>/dev/null || echo "000")
echo "  HTTPS: $HTTPS_TEST"

echo ""
if [ "$HTTPS_TEST" = "301" ] || [ "$HTTPS_TEST" = "404" ] || [ "$HTTPS_TEST" = "200" ]; then
    echo -e "${GREEN}✅ SUCCESS! HTTPS is working!${NC}"
    echo ""
    echo "URLs:"
    echo "  http://foodpanda.site  → Redirects to HTTPS"
    echo "  https://foodpanda.site → Working"
else
    echo -e "${YELLOW}⚠ HTTPS still not working${NC}"
    echo ""
    echo "Check:"
    echo "  1. Port 443 open in Oracle Cloud Security Lists"
    echo "  2. Nginx error log: sudo tail -50 /var/log/nginx/error.log"
fi

echo ""
echo "Done!"
