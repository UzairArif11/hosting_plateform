#!/bin/bash

###############################################################################
# POST-PUSH DEPLOYMENT
# 
# Run this after git push to deploy changes
# Usage: ./post-push-deploy.sh
###############################################################################

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║         🚀 POST-PUSH DEPLOYMENT 🚀                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Pull latest changes
echo -e "${CYAN}Pulling latest changes...${NC}"
git pull origin main || git pull origin master

# Run deployment
echo ""
echo -e "${CYAN}Running deployment...${NC}"
./deploy.sh

echo ""
echo -e "${GREEN}${BOLD}✅ All done!${NC}"
echo ""
echo "Your changes are now live at: https://foodpanda.site"

