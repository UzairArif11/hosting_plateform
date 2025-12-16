#!/bin/bash

###############################################################################
# VERIFY SERVER IS READY FOR DEPLOYMENTS
###############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         SERVER READINESS CHECK                             ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

PASS=0
FAIL=0

# Check 1: Docker
echo -e "${BLUE}━━━ Check 1: Docker ━━━${NC}"
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker installed: $(docker --version | cut -d' ' -f3 | cut -d',' -f1)${NC}"
    ((PASS++))
else
    echo -e "${RED}✗ Docker not installed${NC}"
    ((FAIL++))
fi

# Check 2: Nginx
echo ""
echo -e "${BLUE}━━━ Check 2: Nginx ━━━${NC}"
if command -v nginx &> /dev/null; then
    echo -e "${GREEN}✓ Nginx installed: $(nginx -v 2>&1 | cut -d'/' -f2)${NC}"
    ((PASS++))
    
    # Test Nginx config
    if sudo nginx -t 2>&1 | grep -q "successful"; then
        echo -e "${GREEN}✓ Nginx config valid${NC}"
        ((PASS++))
    else
        echo -e "${RED}✗ Nginx config has errors${NC}"
        ((FAIL++))
    fi
else
    echo -e "${RED}✗ Nginx not installed${NC}"
    ((FAIL++))
fi

# Check 3: SSL
echo ""
echo -e "${BLUE}━━━ Check 3: SSL Certificate ━━━${NC}"
if sudo certbot certificates 2>/dev/null | grep -q "foodpanda.site"; then
    echo -e "${GREEN}✓ SSL certificate exists${NC}"
    ((PASS++))
    
    # Check expiry
    EXPIRY=$(sudo certbot certificates 2>/dev/null | grep "Expiry Date" | head -1 | cut -d':' -f2-)
    echo "  Expires: $EXPIRY"
else
    echo -e "${YELLOW}⚠ No SSL certificate${NC}"
fi

# Check 4: HTTP/HTTPS
echo ""
echo -e "${BLUE}━━━ Check 4: HTTP/HTTPS ━━━${NC}"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://foodpanda.site/" 2>/dev/null || echo "000")
echo "  HTTP: $HTTP_CODE"
if [ "$HTTP_CODE" = "301" ]; then
    echo -e "${GREEN}✓ HTTP redirects to HTTPS${NC}"
    ((PASS++))
elif [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ HTTP responding${NC}"
    ((PASS++))
else
    echo -e "${RED}✗ HTTP not working${NC}"
    ((FAIL++))
fi

HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://foodpanda.site/" 2>/dev/null || echo "000")
echo "  HTTPS: $HTTPS_CODE"
if [ "$HTTPS_CODE" = "404" ] || [ "$HTTPS_CODE" = "200" ]; then
    echo -e "${GREEN}✓ HTTPS working (404 is normal - no deployments yet)${NC}"
    ((PASS++))
else
    echo -e "${RED}✗ HTTPS not working${NC}"
    ((FAIL++))
fi

# Check 5: Nginx Server Block
echo ""
echo -e "${BLUE}━━━ Check 5: Nginx Configuration ━━━${NC}"
if sudo grep -q "server_name foodpanda.site" /etc/nginx/sites-available/default; then
    echo -e "${GREEN}✓ foodpanda.site server block exists${NC}"
    ((PASS++))
else
    echo -e "${RED}✗ No foodpanda.site server block${NC}"
    ((FAIL++))
fi

# Check 6: Deployment Directory
echo ""
echo -e "${BLUE}━━━ Check 6: Deployment Directory ━━━${NC}"
if [ -d "/tmp/builds" ]; then
    echo -e "${GREEN}✓ /tmp/builds exists${NC}"
    ((PASS++))
else
    echo -e "${YELLOW}⚠ /tmp/builds missing (will be created on first deployment)${NC}"
fi

# Check 7: Node.js
echo ""
echo -e "${BLUE}━━━ Check 7: Node.js ━━━${NC}"
if command -v node &> /dev/null; then
    echo -e "${GREEN}✓ Node.js installed: $(node --version)${NC}"
    ((PASS++))
else
    echo -e "${YELLOW}⚠ Node.js not installed (optional)${NC}"
fi

# Summary
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}SUMMARY${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Passed: ${GREEN}$PASS${NC}"
echo -e "  Failed: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ SERVER IS READY FOR DEPLOYMENTS!                      ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}Next steps:${NC}"
    echo "  1. Deploy a project from user panel"
    echo "  2. nginxRouter will automatically add location block"
    echo "  3. Deployment URL will work on HTTPS"
    echo ""
    echo -e "${GREEN}Example deployment URL:${NC}"
    echo "  https://foodpanda.site/projectname-abc12345-67890123/"
    echo ""
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ⚠ SERVER HAS ISSUES - FIX REQUIRED                       ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Please fix the failed checks above"
fi

echo ""
