#!/bin/bash

###############################################################################
# Test GitHub Login and Watch Logs
# 
# Restarts backend and watches logs for detailed OAuth errors
###############################################################################

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         🔄 TESTING GITHUB LOGIN 🔄                       ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}1. Restarting backend with updated code...${NC}"
pm2 restart backend --update-env
sleep 3

echo ""
echo -e "${CYAN}2. Backend status:${NC}"
pm2 status backend

echo ""
echo -e "${CYAN}3. Watching logs (will show detailed errors)...${NC}"
echo -e "${YELLOW}   Now try GitHub login in your browser: https://foodpanda.site/login${NC}"
echo -e "${YELLOW}   Press Ctrl+C to stop watching${NC}"
echo ""
echo -e "${CYAN}=== LOGS (watching for OAuth errors) ===${NC}"
echo ""

# Watch logs and filter for OAuth/GitHub/error messages
pm2 logs backend --lines 0 | grep --line-buffered -i "oauth\|github\|error\|validation\|creating.*user\|callback"

