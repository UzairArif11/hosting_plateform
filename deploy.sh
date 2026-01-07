#!/bin/bash

###############################################################################
# MASTER DEPLOYMENT SCRIPT - ONE SCRIPT TO RULE THEM ALL
# 
# Usage:
#   First time:     ./deploy.sh
#   After update:   git pull && ./deploy.sh
#   
# This script is SMART - it detects what needs to be done and does it safely!
###############################################################################

set -e

# Colors
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
║                                                            ║
║         🚀 PLATFORM DEPLOYMENT - SMART MODE 🚀             ║
║                                                            ║
║  One script for everything:                                ║
║  • First-time deployment                                   ║
║  • Code updates                                            ║
║  • Service management                                      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Step function
step() {
    echo -e "\n${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}▶ $1${NC}"
    echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Info function
info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

# Success function
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Warning function
warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Error function
error() {
    echo -e "${RED}✗ $1${NC}"
}

#==============================================================================
# DETECTION PHASE
#==============================================================================

step "Detecting Environment"

# Detect if first deployment or update
FIRST_DEPLOYMENT=false
if [ ! -f ".deployed" ]; then
    FIRST_DEPLOYMENT=true
    info "First-time deployment detected"
else
    info "Update deployment detected"
fi

# Get server IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
success "Server IP: $SERVER_IP"

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    success "OS: $PRETTY_NAME"
fi

#==============================================================================
# DEPENDENCY CHECK
#==============================================================================

step "Checking Dependencies"

DEPS_MISSING=false

# Node.js
if ! command -v node &> /dev/null; then
    warning "Node.js not found - will install"
    DEPS_MISSING=true
else
    success "Node.js: $(node --version)"
fi

# PM2
if ! command -v pm2 &> /dev/null; then
    warning "PM2 not found - will install"
    DEPS_MISSING=true
else
    success "PM2: $(pm2 --version)"
fi

# Nginx
if ! command -v nginx &> /dev/null; then
    warning "Nginx not found - will install"
    DEPS_MISSING=true
else
    success "Nginx: $(nginx -v 2>&1 | cut -d'/' -f2)"
fi

# Docker
if ! command -v docker &> /dev/null; then
    warning "Docker not found - will install"
    DEPS_MISSING=true
else
    success "Docker: $(docker --version | cut -d' ' -f3 | tr -d ',')"
fi

# Docker Compose
COMPOSE_CMD="docker-compose"
if ! command -v docker-compose &> /dev/null; then
    if ! docker compose version &> /dev/null 2>&1; then
        warning "Docker Compose not found - will install"
        DEPS_MISSING=true
    else
        COMPOSE_CMD="docker compose"
        success "Docker Compose: plugin"
    fi
else
    success "Docker Compose: standalone"
fi

#==============================================================================
# INSTALL DEPENDENCIES (if needed)
#==============================================================================

if [ "$DEPS_MISSING" = true ]; then
    step "Installing Missing Dependencies"
    
    # Node.js
    if ! command -v node &> /dev/null; then
        info "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
        success "Node.js installed"
    fi
    
    # PM2
    if ! command -v pm2 &> /dev/null; then
        info "Installing PM2..."
        sudo npm install -g pm2
        success "PM2 installed"
    fi
    
    # Nginx
    if ! command -v nginx &> /dev/null; then
        info "Installing Nginx..."
        sudo apt update
        sudo apt install nginx -y
        success "Nginx installed"
    fi
    
    # Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
        info "Installing Docker Compose..."
        sudo apt update
        sudo apt install docker-compose -y || sudo apt install docker-compose-plugin -y
        success "Docker Compose installed"
    fi
fi

#==============================================================================
# DATABASE SETUP
#==============================================================================

step "Database Setup (MongoDB + Redis)"

# Check if MongoDB is running
if docker ps | grep -q vercel-clone-mongodb; then
    success "MongoDB already running"
    MONGO_RUNNING=true
else
    info "Starting MongoDB and Redis..."
    $COMPOSE_CMD up -d mongodb redis
    sleep 5
    success "Databases started"
    MONGO_RUNNING=false
fi

# Wait for MongoDB to be ready
if [ "$MONGO_RUNNING" = false ]; then
    info "Waiting for MongoDB to initialize..."
    for i in {1..30}; do
        if docker exec vercel-clone-mongodb mongosh --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
            success "MongoDB ready"
            break
        fi
        sleep 1
    done
fi

#==============================================================================
# BACKEND SETUP
#==============================================================================

step "Backend Setup"

cd backend

# Create .env if missing
if [ ! -f .env ]; then
    warning ".env not found"
    if [ -f .env.example ]; then
        cp .env.example .env
        info "Created .env from example"
        warning "IMPORTANT: Edit backend/.env and set production values!"
    fi
fi

# Check if dependencies changed
BACKEND_INSTALL=false
if [ "$FIRST_DEPLOYMENT" = true ]; then
    BACKEND_INSTALL=true
else
    if [ package.json -nt node_modules/.package-lock.json ]; then
        BACKEND_INSTALL=true
    fi
fi

if [ "$BACKEND_INSTALL" = true ]; then
    info "Installing backend dependencies..."
    npm install
    success "Backend dependencies installed"
else
    success "Backend dependencies up to date"
fi

cd ..

#==============================================================================
# FRONTEND SETUP
#==============================================================================

step "Frontend Setup"

cd frontend

# Create .env.local
info "Configuring frontend environment..."
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://${SERVER_IP}:5000
EOF
success ".env.local configured"

# Check if dependencies changed
FRONTEND_INSTALL=false
FRONTEND_BUILD=false

if [ "$FIRST_DEPLOYMENT" = true ]; then
    FRONTEND_INSTALL=true
    FRONTEND_BUILD=true
else
    if [ package.json -nt node_modules/.package-lock.json ]; then
        FRONTEND_INSTALL=true
        FRONTEND_BUILD=true
    fi
    
    # Check if source code changed
    if [ ! -d .next ] || find app components lib -newer .next -type f | grep -q .; then
        FRONTEND_BUILD=true
    fi
fi

if [ "$FRONTEND_INSTALL" = true ]; then
    info "Installing frontend dependencies..."
    npm install
    success "Frontend dependencies installed"
else
    success "Frontend dependencies up to date"
fi

if [ "$FRONTEND_BUILD" = true ]; then
    info "Building frontend (this may take 1-2 minutes)..."
    npm run build
    success "Frontend built successfully"
else
    success "Frontend build up to date"
fi

cd ..

#==============================================================================
# PM2 PROCESS MANAGEMENT
#==============================================================================

step "Starting Platform Services"

# Create logs directory
mkdir -p logs

# Check if ecosystem.config.js exists
if [ ! -f ecosystem.config.js ]; then
    error "ecosystem.config.js not found!"
    exit 1
fi

# Stop and restart services
info "Restarting PM2 processes..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Start with ecosystem
pm2 start ecosystem.config.js

# Save PM2 state
pm2 save

# Setup startup (only on first deployment)
if [ "$FIRST_DEPLOYMENT" = true ]; then
    info "Configuring PM2 startup..."
    pm2 startup | grep "sudo env" | bash || true
fi

success "Platform services started"

# Wait for services to initialize
sleep 3

#==============================================================================
# NGINX CONFIGURATION
#==============================================================================

step "Nginx Configuration"

# Check if platform routes exist in Nginx
NGINX_CONFIGURED=false
if [ -f /etc/nginx/sites-available/default ]; then
    if grep -q "location /api/" /etc/nginx/sites-available/default 2>/dev/null; then
        NGINX_CONFIGURED=true
    fi
fi

if [ "$NGINX_CONFIGURED" = false ]; then
    warning "Nginx not configured for platform routes"
    echo -e ""
    echo -e "${YELLOW}${BOLD}MANUAL STEP REQUIRED:${NC}"
    echo -e "${CYAN}Edit Nginx config to add platform routes:${NC}"
    echo -e "  ${BLUE}sudo nano /etc/nginx/sites-available/default${NC}"
    echo -e ""
    echo -e "${CYAN}Add these two location blocks:${NC}"
    echo -e ""
    echo -e "${GREEN}1. After SSL config (BEFORE user deployments):${NC}"
    cat << 'NGINX1'
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
NGINX1
    echo -e ""
    echo -e "${GREEN}2. At the END (REPLACE 'return 404' line):${NC}"
    cat << 'NGINX2'
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
NGINX2
    echo -e ""
    echo -e "${CYAN}Then run:${NC}"
    echo -e "  ${BLUE}sudo nginx -t && sudo systemctl reload nginx${NC}"
    echo -e ""
else
    success "Nginx already configured for platform"
    
    # Reload Nginx
    sudo systemctl reload nginx 2>/dev/null || true
fi

#==============================================================================
# VERIFICATION
#==============================================================================

step "Verifying Deployment"

# Check PM2
PM2_COUNT=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.pm2_env.status == "online") | .name' | wc -l)
if [ "$PM2_COUNT" -ge 2 ]; then
    success "PM2: $PM2_COUNT processes online"
else
    warning "PM2: Only $PM2_COUNT process online (expected 2)"
fi

# Check backend
if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
    success "Backend: Healthy"
else
    warning "Backend: Health check failed"
fi

# Check frontend  
if curl -s http://localhost:3000/ > /dev/null 2>&1; then
    success "Frontend: Responding"
else
    warning "Frontend: Not responding"
fi

# Check Docker
DOCKER_COUNT=$(docker ps | grep -c vercel-clone || echo 0)
success "Docker: $DOCKER_COUNT containers running"

#==============================================================================
# SUMMARY
#==============================================================================

echo -e "\n${CYAN}${BOLD}"
cat << "EOF"
╔════════════════════════════════════════════════════════════╗
║              DEPLOYMENT COMPLETE!                          ║
╚════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Mark as deployed
touch .deployed

echo -e "${BLUE}${BOLD}📊 Platform Status:${NC}"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 list

echo -e "\n${BLUE}${BOLD}🐳 Docker Containers:${NC}"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep vercel-clone || echo "No platform containers"

echo -e "\n${BLUE}${BOLD}🌐 Access URLs:${NC}"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if SSL is configured
if [ -f /etc/letsencrypt/live/foodpanda.site/fullchain.pem ]; then
    echo -e "  Platform:      ${GREEN}${BOLD}https://foodpanda.site/${NC}"
    echo -e "  API:           ${GREEN}${BOLD}https://foodpanda.site/api${NC}"
    echo -e "  Admin Panel:   ${GREEN}${BOLD}https://foodpanda.site/admin${NC}"
else
    echo -e "  Platform:      ${GREEN}${BOLD}http://${SERVER_IP}/${NC} (HTTP)"
    echo -e "  API:           ${GREEN}${BOLD}http://${SERVER_IP}/api${NC}"
    echo -e "  Admin Panel:   ${GREEN}${BOLD}http://${SERVER_IP}/admin${NC}"
fi

# Count user deployments
USER_DEPLOYMENTS=$(docker ps | grep -c "EC3-user-" || echo 0)
if [ "$USER_DEPLOYMENTS" -gt 0 ]; then
    echo -e "  User Projects: ${GREEN}${BOLD}$USER_DEPLOYMENTS active deployments${NC}"
fi

echo -e "\n${BLUE}${BOLD}📋 Useful Commands:${NC}"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  View logs:         ${YELLOW}pm2 logs${NC}"
echo -e "  Check status:      ${YELLOW}pm2 status${NC}"
echo -e "  Restart services:  ${YELLOW}pm2 restart all${NC}"
echo -e "  Update code:       ${YELLOW}git pull && ./deploy.sh${NC}"
echo -e "  View Nginx logs:   ${YELLOW}sudo tail -f /var/log/nginx/access.log${NC}"

echo -e "\n${GREEN}${BOLD}✨ Deployment successful!${NC}"

# Show warnings if any
echo ""
if [ "$NGINX_CONFIGURED" = false ]; then
    echo -e "${YELLOW}${BOLD}⚠️  ACTION REQUIRED:${NC}"
    echo -e "${YELLOW}Nginx needs manual configuration (see above)${NC}"
    echo -e "${YELLOW}After configuring Nginx, your platform will be fully accessible.${NC}"
fi
