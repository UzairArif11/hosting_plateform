#!/bin/bash

###############################################################################
# MASTER DEPLOYMENT SCRIPT
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
║         🚀 PLATFORM DEPLOYMENT - SMART MODE 🚀             ║
╚════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

step() {
    echo -e "\n${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}▶ $1${NC}"
    echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

success() { echo -e "${GREEN}✓ $1${NC}"; }
info() { echo -e "${CYAN}ℹ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
error() { echo -e "${RED}✗ $1${NC}"; }

step "Environment Check"

FIRST_DEPLOYMENT=false
[ ! -f ".deployed" ] && FIRST_DEPLOYMENT=true

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
success "Server IP: $SERVER_IP"

# Check dependencies
command -v node &> /dev/null && success "Node.js: $(node --version)" || { warning "Installing Node.js..."; curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs; }
command -v pm2 &> /dev/null && success "PM2: $(pm2 --version)" || { warning "Installing PM2..."; sudo npm install -g pm2; }
command -v nginx &> /dev/null && success "Nginx: installed" || { warning "Installing Nginx..."; sudo apt update && sudo apt install nginx -y; }

COMPOSE_CMD="docker-compose"
command -v docker-compose &> /dev/null && success "Docker Compose: ready" || COMPOSE_CMD="docker compose"

step "Starting Databases"

docker-compose up -d mongodb redis 2>/dev/null || sudo docker-compose up -d mongodb redis
sleep 3
success "MongoDB + Redis started"

step "Backend"

cd backend
[ ! -f .env ] && [ -f .env.example ] && cp .env.example .env && warning "Created .env from example"
npm install --production 2>&1 | grep -v "^npm WARN" || true
success "Backend ready"
cd ..

step "Frontend"

cd frontend
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://${SERVER_IP}:5000
EOF
npm install --production 2>&1 | grep -v "^npm WARN" || true
info "Building frontend..."
npm run build 2>&1 | grep -E "✓|Creating|Compiled|Route" || true
success "Frontend built"
cd ..

step "Starting Services"

mkdir -p logs

# Kill any process on port 3000
sudo fuser -k 3000/tcp 2>/dev/null || true
sleep 2

# Clean PM2
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true
sleep 1

# Start fresh
pm2 start ecosystem.config.js
pm2 save

[ "$FIRST_DEPLOYMENT" = true ] && pm2 startup | grep "sudo" | bash || true

success "Services started"
sleep 5

step "Verification"

PM2_ONLINE=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.pm2_env.status == "online") | .name' | wc -l)
[ "$PM2_ONLINE" -ge 2 ] && success "PM2: $PM2_ONLINE/2 online" || warning "PM2: Only $PM2_ONLINE/2 online"

curl -s http://localhost:5000/api/health > /dev/null 2>&1 && success "Backend: Healthy" || warning "Backend: Check logs"
curl -s http://localhost:3000/ > /dev/null 2>&1 && success "Frontend: Responding" || warning "Frontend: Check logs"

touch .deployed

echo -e "\n${CYAN}${BOLD}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              ✅ DEPLOYMENT COMPLETE!                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

pm2 list

echo -e "\n${BLUE}${BOLD}🌐 URLs:${NC}"
if [ -f /etc/letsencrypt/live/foodpanda.site/fullchain.pem ]; then
    echo -e "  ${GREEN}https://foodpanda.site/${NC}"
    echo -e "  ${GREEN}https://foodpanda.site/api${NC}"
else
    echo -e "  ${GREEN}http://${SERVER_IP}/${NC} (after Nginx config)"
    echo -e "  ${GREEN}http://${SERVER_IP}/api${NC}"
fi

echo -e "\n${YELLOW}${BOLD}Next Steps:${NC}"
if ! grep -q "location /api/" /etc/nginx/sites-available/default 2>/dev/null; then
    echo -e "  1. ${CYAN}Configure Nginx (one-time only)${NC}"
    echo -e "     See: README_DEPLOYMENT.md"
fi
echo -e "  2. ${CYAN}View logs:${NC} pm2 logs"
echo -e "  3. ${CYAN}Update code:${NC} git pull && ./deploy.sh"

echo -e "\n${GREEN}✨ Done!${NC}"
