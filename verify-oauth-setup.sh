#!/bin/bash

###############################################################################
# Verify OAuth Setup
# 
# Checks all OAuth configuration to ensure it's correct for production
###############################################################################

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         🔍 VERIFYING OAUTH SETUP 🔍                      ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd ~/hosting_plateform/backend

# Check .env file
echo -e "${CYAN}1. Checking Environment Variables:${NC}"
echo ""

REQUIRED_VARS=("API_URL" "FRONTEND_URL" "GITHUB_CLIENT_ID" "GITHUB_CLIENT_SECRET" "JWT_SECRET" "NODE_ENV")
ALL_GOOD=true

for var in "${REQUIRED_VARS[@]}"; do
    value=$(grep "^${var}=" .env 2>/dev/null | cut -d'=' -f2- | head -1)
    if [ -z "$value" ]; then
        echo -e "${RED}❌ ${var} is MISSING${NC}"
        ALL_GOOD=false
    else
        if [ "$var" = "GITHUB_CLIENT_SECRET" ] || [ "$var" = "JWT_SECRET" ]; then
            echo -e "${GREEN}✓${NC} ${var} is set (${#value} chars)"
        else
            echo -e "${GREEN}✓${NC} ${var} = ${value}"
        fi
    fi
done

echo ""
echo -e "${CYAN}2. Checking OAuth Callback URL:${NC}"
API_URL=$(grep "^API_URL=" .env | cut -d'=' -f2- | head -1)
EXPECTED_CALLBACK="${API_URL}/api/auth/github/callback"
echo "Expected: ${EXPECTED_CALLBACK}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: This URL MUST match exactly in GitHub OAuth App settings!${NC}"
echo "   Go to: https://github.com/settings/developers"
echo "   Check your OAuth App's 'Authorization callback URL'"
echo ""

echo -e "${CYAN}3. Checking Backend Status:${NC}"
if pm2 list | grep -q "backend.*online"; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}❌ Backend is NOT running${NC}"
    ALL_GOOD=false
fi

echo ""
echo -e "${CYAN}4. Testing Backend Health:${NC}"
if curl -s http://localhost:5000/api/health > /dev/null; then
    echo -e "${GREEN}✓ Backend is responding${NC}"
else
    echo -e "${RED}❌ Backend is NOT responding${NC}"
    ALL_GOOD=false
fi

echo ""
echo -e "${CYAN}5. Checking Recent OAuth Errors:${NC}"
RECENT_ERRORS=$(pm2 logs backend --err --lines 100 | grep -i "oauth\|github\|auth.*error" | tail -5)
if [ -z "$RECENT_ERRORS" ]; then
    echo -e "${GREEN}✓ No recent OAuth errors in logs${NC}"
else
    echo -e "${YELLOW}⚠️  Recent errors found:${NC}"
    echo "$RECENT_ERRORS"
fi

echo ""
if [ "$ALL_GOOD" = true ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo -e "${CYAN}Next steps:${NC}"
    echo "1. Verify callback URL in GitHub: ${EXPECTED_CALLBACK}"
    echo "2. Test OAuth flow: https://foodpanda.site/login"
    echo "3. Check logs if errors: pm2 logs backend"
else
    echo -e "${RED}❌ Some checks failed. Fix the issues above.${NC}"
fi

