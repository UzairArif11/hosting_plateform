#!/bin/bash

###############################################################################
# COMPLETE SELF-HEALING DEPLOYMENT SCRIPT
# 
# This script ensures infrastructure is ready, builds, and deploys the platform.
# It handles Docker, Docker Compose, Node.js, and PM2 automatically.
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         AUTO-HEALING PLATFORM DEPLOYMENT                   ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"

# Function to print step
step() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}▶ $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

step "Step 1: Checking System Environment"

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    echo -e "${GREEN}✓ OS Detected:${NC} $PRETTY_NAME"
else
    echo -e "${RED}✗ Unknown OS. This script prefers Ubuntu/Debian.${NC}"
fi

# Check Node.js & npm
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠ Node.js not found. Installing...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo -e "${GREEN}✓ Node.js:${NC} $(node --version)"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠ Docker not found. Installing...${NC}"
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✓ Docker installed. Note: You might need to re-login for group changes.${NC}"
fi

# Check Docker Compose (Plugin vs Standalone)
COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        echo -e "${YELLOW}⚠ Docker Compose plugin not found. Attempting install...${NC}"
        sudo apt-get update && sudo apt-get install -y docker-compose-plugin || sudo apt-get install -y docker-compose
        if ! docker compose version &> /dev/null; then COMPOSE_CMD="docker-compose"; fi
    fi
fi
echo -e "${GREEN}✓ Using Compose Command:${NC} $COMPOSE_CMD"

# Check PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠ PM2 not found. Installing globally...${NC}"
    sudo npm install -g pm2
fi
echo -e "${GREEN}✓ PM2 installed${NC}"

step "Step 2: Starting Infrastructure (Databases)"
if [ -f "docker-compose.yml" ]; then
    echo -e "${CYAN}Starting MongoDB, Redis, and Mongo Express...${NC}"
    # Use sudo if current user can't run docker
    if docker ps &> /dev/null; then
        $COMPOSE_CMD up -d
    else
        sudo $COMPOSE_CMD up -d
    fi
    echo -e "${GREEN}✓ Databases are running${NC}"
else
    echo -e "${RED}✗ Error: docker-compose.yml not found in current directory!${NC}"
    exit 1
fi

step "Step 3: Preparing Backend"
cd backend
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ Backend .env not found, creating from example...${NC}"
    cp .env.example .env
fi
npm install
echo -e "${GREEN}✓ Backend ready${NC}"

step "Step 4: Preparing Frontend"
cd ../frontend
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ Frontend .env not found, creating from example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
    else
        echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api" > .env
    fi
fi
npm install
echo -e "${CYAN}Building frontend (this may take a few minutes)...${NC}"
npm run build
echo -e "${GREEN}✓ Frontend ready and built${NC}"

step "Step 5: Starting Services with PM2"
cd ..

# Restart Backend
echo -e "${CYAN}Starting/Restarting Backend...${NC}"
cd backend
pm2 stop backend 2>/dev/null || true
pm2 delete backend 2>/dev/null || true
pm2 start server.js --name backend --time
cd ..

# Restart Frontend
echo -e "${CYAN}Frontend is now STATIC (output: 'export'). No PM2 needed.${NC}"
cd frontend
pm2 stop frontend 2>/dev/null || true
pm2 delete frontend 2>/dev/null || true
echo -e "${GREEN}✓ Frontend built at: $(pwd)/out${NC}"
echo -e "${YELLOW}ℹ Note: Ensure Nginx is pointing to $(pwd)/out${NC}"
cd ..

pm2 save
echo -e "${GREEN}✓ Services are live in PM2${NC}"

step "Step 6: Final Verification"
echo -e "${CYAN}Checking health endpoints...${NC}"
sleep 5
if curl -s http://localhost:5000/api/health > /dev/null; then
    echo -e "${GREEN}✓ Backend Health OK${NC}"
else
    echo -e "${RED}✗ Backend Health Check Failed. Check logs: pm2 logs backend${NC}"
fi

echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              DEPLOYMENT SUCCESSFUL!                        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo -e "${GREEN}✓ Platform is live!${NC}"
echo -e "${BLUE}Frontend:${NC} http://$(curl -s ifconfig.me):3000"
echo -e "${BLUE}Backend: ${NC} http://$(curl -s ifconfig.me):5000"
echo -e "${BLUE}DB UI:   ${NC} http://$(curl -s ifconfig.me):8081 (admin/password123)"
echo -e "\n${YELLOW}Logs:${NC} pm2 logs"
echo -e "${YELLOW}Status:${NC} pm2 status"
echo -e "${CYAN}Note: If you just installed Docker, run 'newgrp docker' to use without sudo.${NC}"
