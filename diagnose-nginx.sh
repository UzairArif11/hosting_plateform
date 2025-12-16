#!/bin/bash

###############################################################################
# NGINX FULL DIAGNOSTIC - Show Complete Config Structure
###############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         NGINX FULL DIAGNOSTIC                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

DEPLOYMENT_URL="uzairarif11t-693904aa-44714701"
CONTAINER_PORT="4259"

# Show all server blocks
echo -e "${BLUE}━━━ Server Blocks in Nginx Config ━━━${NC}"
echo ""

echo "1. Checking /etc/nginx/sites-available/default:"
echo ""
sudo grep -n "server {" /etc/nginx/sites-available/default
echo ""

echo "2. Showing all server_name directives:"
echo ""
sudo grep -n "server_name" /etc/nginx/sites-available/default
echo ""

echo "3. Showing all listen directives:"
echo ""
sudo grep -n "listen" /etc/nginx/sites-available/default
echo ""

echo -e "${BLUE}━━━ Full Config Structure ━━━${NC}"
echo ""
sudo cat -n /etc/nginx/sites-available/default
echo ""

echo -e "${BLUE}━━━ Where is our deployment? ━━━${NC}"
echo ""
if sudo grep -n "$DEPLOYMENT_URL" /etc/nginx/sites-available/default; then
    echo ""
    echo -e "${GREEN}✓ Found deployment in config${NC}"
    echo ""
    echo "Context (10 lines before and after):"
    sudo grep -B 10 -A 10 "$DEPLOYMENT_URL" /etc/nginx/sites-available/default
else
    echo -e "${RED}✗ Deployment NOT found in config!${NC}"
fi

echo ""
echo -e "${BLUE}━━━ Testing ━━━${NC}"
echo ""

# Test all variations
echo "1. Container direct:"
curl -I http://localhost:$CONTAINER_PORT 2>/dev/null | head -1

echo "2. Localhost with path:"
curl -I http://localhost/$DEPLOYMENT_URL/ 2>/dev/null | head -1

echo "3. Domain HTTP:"
curl -I http://foodpanda.site/$DEPLOYMENT_URL/ 2>/dev/null | head -1

echo "4. Domain HTTPS:"
curl -I https://foodpanda.site/$DEPLOYMENT_URL/ 2>/dev/null | head -1

echo ""
echo -e "${BLUE}━━━ Nginx Error Log (last 20 lines) ━━━${NC}"
echo ""
sudo tail -20 /var/log/nginx/error.log

echo ""
echo -e "${BLUE}━━━ Nginx Access Log (last 10 lines) ━━━${NC}"
echo ""
sudo tail -10 /var/log/nginx/access.log

echo ""
echo "Done! Review the output above to see the issue."
