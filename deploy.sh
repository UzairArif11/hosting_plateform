#!/bin/bash

###############################################################################
# COMPLETE DEPLOYMENT SCRIPT - Smart & Clean
# Usage: ./deploy.sh (first time or after git pull)
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

clear
echo -e "${CYAN}${BOLD}"
cat << "EOF"
╔════════════════════════════════════════════════════════════╗
║              🚀 PLATFORM DEPLOYMENT 🚀                     ║
╚════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

step() {
    echo -e "\n${BLUE}${BOLD}▶ $1${NC}"
}

success() { echo -e "${GREEN}✓ $1${NC}"; }
info() { echo -e "${CYAN}• $1${NC}"; }

step "Starting Databases"
docker-compose up -d mongodb redis 2>/dev/null || sudo docker-compose up -d mongodb redis
success "Databases started"

step "Backend"
cd backend
[ ! -f .env ] && [ -f .env.example ] && cp .env.example .env
npm install --quiet 2>&1 | grep -v "npm WARN" || true
success "Backend ready"
cd ..

step "Frontend"  
cd frontend
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
echo "NEXT_PUBLIC_API_URL=http://${SERVER_IP}:5000" > .env.local
npm install --quiet 2>&1 | grep -v "npm WARN" || true
info "Building..."
npm run build 2>&1 | grep -E "✓|Route" || true
success "Frontend built"
cd ..

step "Services"
mkdir -p logs

# Clean PM2 - delete all errored processes
pm2 list | grep "errored" | awk '{print $4}' | xargs -r pm2 delete 2>/dev/null || true

# Stop and delete all, fresh start
pm2 stop all 2>/dev/null || true  
pm2 delete all 2>/dev/null || true

# Start backend
cd backend
pm2 start server.js --name backend
cd ..

# Start frontend
cd frontend
pm2 start npm --name frontend -- start
cd ..

pm2 save
success "Services started"

sleep 5

step "Status"
pm2 list

echo -e "\n${GREEN}${BOLD}✅ Deployment Complete!${NC}"
echo -e "\n${BLUE}Access:${NC}"
echo -e "  ${GREEN}https://foodpanda.site/${NC}"
echo -e "\n${CYAN}Commands:${NC}"
echo -e "  pm2 logs"
echo -e "  pm2 restart all"
echo -e "  git pull && ./deploy.sh"
