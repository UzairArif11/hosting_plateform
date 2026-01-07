#!/bin/bash

###############################################################################
# SMART DEPLOYMENT SCRIPT
# 
# Detects what changed and only updates that!
# - First time: Full deployment
# - Updates: Only rebuild/restart what changed
# - MongoDB/Redis: Keep running (no restart needed!)
###############################################################################

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

clear
echo -e "${CYAN}${BOLD}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              🚀 SMART DEPLOYMENT 🚀                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

success() { echo -e "${GREEN}✓ $1${NC}"; }
info() { echo -e "${CYAN}• $1${NC}"; }

#==============================================================================
# DETECT MODE
#==============================================================================

FIRST_TIME=false
if ! pm2 list | grep -q "backend.*online"; then
    FIRST_TIME=true
    info "First-time deployment detected"
else
    info "Update deployment detected"
fi

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")

#==============================================================================
# DATABASES (Only if not running)
#==============================================================================

if ! docker ps | grep -q vercel-clone-mongodb; then
    info "Starting MongoDB and Redis..."
    docker-compose up -d mongodb redis
    sleep 5
    success "Databases started"
else
    success "Databases already running (no restart needed)"
fi

#==============================================================================
# BACKEND
#==============================================================================

echo ""
echo -e "${BLUE}${BOLD}Backend:${NC}"

cd backend

# Install if needed
if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
    info "Installing dependencies..."
    npm install --quiet
fi

# Ensure backend .env has required variables
if ! grep -q "API_URL=https://foodpanda.site" .env 2>/dev/null; then
    info "Adding API_URL to backend .env..."
    echo "" >> .env
    echo "API_URL=https://foodpanda.site" >> .env
fi

if ! grep -q "REDIS_PASSWORD=" .env 2>/dev/null; then
    info "Adding REDIS_PASSWORD to backend .env..."
    echo "REDIS_PASSWORD=redis123" >> .env
fi

# Restart backend with updated env
if pm2 list | grep -q "backend.*online"; then
    info "Restarting backend with updated env..."
    pm2 restart backend --update-env
else
    info "Starting backend..."
    pm2 start server.js --name backend
fi

success "Backend updated (port 5000)"
cd ..

#==============================================================================
# FRONTEND
#==============================================================================

echo ""
echo -e "${BLUE}${BOLD}Frontend:${NC}"

cd frontend

# Update .env.local with production URL
echo "NEXT_PUBLIC_API_URL=https://foodpanda.site" > .env.local

# Install if needed
if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
    info "Installing dependencies..."
    npm install --quiet
fi

# Always rebuild (code might have changed) with production API URL
info "Building frontend with production API URL..."
NEXT_PUBLIC_API_URL=https://foodpanda.site npm run build 2>&1 | grep -E "✓|Compiled|Route" | head -5

# Restart frontend
if pm2 list | grep -q "frontend.*online"; then
    info "Restarting frontend..."
    pm2 restart frontend
else
    info "Starting frontend..."
    PORT=3001 pm2 start npm --name frontend -- start -- --port 3001
fi

success "Frontend updated (port 3001)"
cd ..

# Save PM2
pm2 save

# Setup startup (only first time)
if [ "$FIRST_TIME" = true ]; then
    pm2 startup | grep "sudo env" | bash || true
fi

#==============================================================================
# VERIFY
#==============================================================================

echo ""
echo -e "${BLUE}${BOLD}Status:${NC}"
pm2 list

echo ""
curl -s http://localhost:5000/api/health > /dev/null && success "Backend: Healthy" || info "Backend: Check logs"
curl -s http://localhost:3001/ > /dev/null && success "Frontend: Responding" || info "Frontend: Check logs"

echo ""
echo -e "${GREEN}${BOLD}✅ Deployment Complete!${NC}"
echo ""
echo -e "${CYAN}Frontend:${NC} https://foodpanda.site"
echo -e "${CYAN}Backend:${NC} https://foodpanda.site/api/health"
echo -e "${CYAN}Logs:${NC} pm2 logs"
echo -e "${CYAN}Status:${NC} pm2 status"

# Check if Nginx configured
if ! grep -q "proxy_pass.*3001" /etc/nginx/sites-available/default 2>/dev/null; then
    echo ""
    echo -e "${YELLOW}⚠️  First time? Run: sudo ./fix-ssl-now.sh${NC}"
fi
