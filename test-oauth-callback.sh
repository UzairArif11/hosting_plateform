#!/bin/bash

###############################################################################
# Test OAuth Callback and Check Logs
# 
# Helps diagnose the 500 error by checking logs and testing the endpoint
###############################################################################

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         🔍 DIAGNOSING OAUTH 500 ERROR 🔍                  ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}1. Checking Backend Environment:${NC}"
cd ~/hosting_plateform/backend

echo "API_URL: $(grep '^API_URL=' .env | cut -d'=' -f2-)"
echo "FRONTEND_URL: $(grep '^FRONTEND_URL=' .env | cut -d'=' -f2-)"
echo "NODE_ENV: $(grep '^NODE_ENV=' .env | cut -d'=' -f2-)"
echo "GITHUB_CLIENT_ID: $(grep '^GITHUB_CLIENT_ID=' .env | cut -d'=' -f2-)"
echo "JWT_SECRET: $(grep '^JWT_SECRET=' .env | cut -d'=' -f2- | cut -c1-10)..."
echo ""

echo -e "${CYAN}2. Checking Recent Backend Errors (last 50 lines):${NC}"
echo -e "${YELLOW}--- ERROR LOGS ---${NC}"
pm2 logs backend --err --lines 50 --nostream | tail -30

echo ""
echo -e "${CYAN}3. Checking Recent Backend Output (OAuth related):${NC}"
echo -e "${YELLOW}--- OUTPUT LOGS (OAuth/GitHub) ---${NC}"
pm2 logs backend --out --lines 100 --nostream | grep -i "oauth\|github\|auth.*callback\|error" | tail -20

echo ""
echo -e "${CYAN}4. Testing Backend Health:${NC}"
HEALTH=$(curl -s http://localhost:5000/api/health 2>&1)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backend is responding${NC}"
    echo "$HEALTH" | head -3
else
    echo -e "${RED}❌ Backend is NOT responding${NC}"
    echo "$HEALTH"
fi

echo ""
echo -e "${CYAN}5. Checking MongoDB Connection:${NC}"
MONGODB_URI=$(grep '^MONGODB_URI=' .env | cut -d'=' -f2-)
if [ -n "$MONGODB_URI" ]; then
    echo "MongoDB URI: ${MONGODB_URI:0:50}..."
    # Try to connect
    if docker ps | grep -q vercel-clone-mongodb; then
        echo -e "${GREEN}✓ MongoDB container is running${NC}"
    else
        echo -e "${RED}❌ MongoDB container is NOT running${NC}"
    fi
else
    echo -e "${RED}❌ MONGODB_URI not found in .env${NC}"
fi

echo ""
echo -e "${CYAN}6. Checking if Passport Strategy is Loaded:${NC}"
if pm2 logs backend --out --lines 200 --nostream | grep -q "GitHub.*Strategy\|passport.*github"; then
    echo -e "${GREEN}✓ GitHub strategy appears to be loaded${NC}"
else
    echo -e "${YELLOW}⚠️  Could not confirm GitHub strategy is loaded${NC}"
fi

echo ""
echo -e "${CYAN}7. Most Recent Error Details:${NC}"
LATEST_ERROR=$(pm2 logs backend --err --lines 100 --nostream | grep -A 5 -i "error\|exception\|failed" | tail -10)
if [ -n "$LATEST_ERROR" ]; then
    echo "$LATEST_ERROR"
else
    echo "No recent errors found in logs"
fi

echo ""
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}Next Steps:${NC}"
echo "1. Try GitHub login again and watch logs in real-time:"
echo "   ${YELLOW}pm2 logs backend --lines 0${NC}"
echo ""
echo "2. Check if the error happens in passport strategy or callback handler"
echo ""
echo "3. Verify all environment variables are set correctly"
echo ""

