#!/bin/bash

###############################################################################
# QUICK FIX: Frontend Build & Start
# 
# Fixes the 404 issue by rebuilding and restarting frontend properly
###############################################################################

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║         🔧 FIXING FRONTEND (404 ISSUE) 🔧                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

cd ~/hosting_plateform/frontend

# Stop frontend
echo -e "${CYAN}Stopping frontend...${NC}"
pm2 stop frontend 2>/dev/null || true
pm2 delete frontend 2>/dev/null || true

# Clean old build
echo -e "${CYAN}Cleaning old build...${NC}"
rm -rf .next

# Set environment (CRITICAL: Must be in .env.local AND exported)
echo "NEXT_PUBLIC_API_URL=https://foodpanda.site" > .env.local
export NEXT_PUBLIC_API_URL=https://foodpanda.site

# Verify
if [ -z "$NEXT_PUBLIC_API_URL" ]; then
    echo -e "${YELLOW}❌ NEXT_PUBLIC_API_URL not set!${NC}"
    exit 1
fi

echo -e "${CYAN}Building with API_URL: $NEXT_PUBLIC_API_URL${NC}"

# Build
echo -e "${CYAN}Building frontend...${NC}"
npm run build

# Verify build
if [ ! -d ".next" ] || [ ! -f ".next/BUILD_ID" ]; then
    echo -e "${YELLOW}❌ Build failed! Check errors above.${NC}"
    exit 1
fi

# Start with ecosystem config
echo -e "${CYAN}Starting frontend...${NC}"
cd ..
pm2 start ecosystem.config.js --only frontend

# Wait a moment
sleep 3

# Check status
echo ""
echo -e "${CYAN}Checking status...${NC}"
pm2 status

# Test
echo ""
if curl -s http://localhost:3001 > /dev/null; then
    echo -e "${GREEN}✅ Frontend is running!${NC}"
    echo -e "${CYAN}Test:${NC} curl http://localhost:3001"
    echo -e "${CYAN}Live:${NC} https://foodpanda.site"
else
    echo -e "${YELLOW}⚠️  Frontend may still be starting. Check logs:${NC}"
    echo -e "${CYAN}pm2 logs frontend${NC}"
fi

