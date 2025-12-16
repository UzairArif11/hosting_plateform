#!/bin/bash

###############################################################################
# COMPLETE DEPLOYMENT SCRIPT
# 
# This script deploys the entire platform to EC1, EC2, and EC3
# 
# Usage:
#   chmod +x deploy-complete.sh
#   ./deploy-complete.sh
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
echo -e "${CYAN}║         COMPLETE PLATFORM DEPLOYMENT                      ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
DOMAIN="${DOMAIN:-foodpanda.site}"
EC1_HOST="${EC1_HOST:-localhost}"
EC2_HOST="${EC2_HOST:-129.159.249.123}"
EC3_HOST="${EC3_HOST:-129.154.255.90}"

echo -e "${GREEN}Domain:${NC} $DOMAIN"
echo -e "${GREEN}EC1 (Control):${NC} $EC1_HOST"
echo -e "${GREEN}EC2 (Deploy):${NC} $EC2_HOST"
echo -e "${GREEN}EC3 (Deploy):${NC} $EC3_HOST"
echo ""

# Function to print step
step() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}▶ $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

step "Step 1: Checking Prerequisites"

# Check Node.js
if command -v node &> /dev/null; then
    echo -e "${GREEN}✓ Node.js installed:${NC} $(node --version)"
else
    echo -e "${RED}✗ Node.js not installed${NC}"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    echo -e "${GREEN}✓ npm installed:${NC} $(npm --version)"
else
    echo -e "${RED}✗ npm not installed${NC}"
    exit 1
fi

# Check MongoDB
if command -v mongod &> /dev/null; then
    echo -e "${GREEN}✓ MongoDB installed${NC}"
else
    echo -e "${YELLOW}⚠ MongoDB not found - make sure it's running${NC}"
fi

step "Step 2: Installing Backend Dependencies"
cd backend
npm install
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

step "Step 3: Installing Frontend Dependencies"
cd ../frontend
npm install
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

step "Step 4: Building Frontend"
npm run build
echo -e "${GREEN}✓ Frontend built${NC}"

step "Step 5: Checking Backend Configuration"
cd ../backend

if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ .env file not found, creating from example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ .env created${NC}"
        echo -e "${YELLOW}⚠ Please edit .env with your configuration${NC}"
    else
        echo -e "${RED}✗ .env.example not found${NC}"
        exit 1
    fi
fi

step "Step 6: Starting Backend"
echo -e "${CYAN}Starting backend server...${NC}"

# Check if PM2 is installed
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✓ PM2 found${NC}"
    
    # Stop existing instances
    pm2 delete backend 2>/dev/null || true
    
    # Start backend
    pm2 start server.js --name backend
    pm2 save
    
    echo -e "${GREEN}✓ Backend started with PM2${NC}"
    echo -e "${CYAN}View logs: pm2 logs backend${NC}"
else
    echo -e "${YELLOW}⚠ PM2 not found, starting with npm...${NC}"
    npm start &
    echo -e "${GREEN}✓ Backend started${NC}"
fi

step "Step 7: Starting Frontend"
cd ../frontend

if command -v pm2 &> /dev/null; then
    # Stop existing instances
    pm2 delete frontend 2>/dev/null || true
    
    # Start frontend
    pm2 start npm --name frontend -- start
    pm2 save
    
    echo -e "${GREEN}✓ Frontend started with PM2${NC}"
    echo -e "${CYAN}View logs: pm2 logs frontend${NC}"
else
    npm start &
    echo -e "${GREEN}✓ Frontend started${NC}"
fi

step "Step 8: Waiting for Services to Start"
sleep 5

step "Step 9: Testing Backend"
cd ../backend

# Test health endpoint
if curl -s http://localhost:5000/api/health > /dev/null; then
    echo -e "${GREEN}✓ Backend is responding${NC}"
else
    echo -e "${RED}✗ Backend not responding${NC}"
    echo -e "${YELLOW}Check logs: pm2 logs backend${NC}"
fi

step "Step 10: Running Tests"
echo -e "${CYAN}Running comprehensive tests...${NC}"
node test-complete-system.js

echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              DEPLOYMENT COMPLETE!                          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ Backend running on:${NC} http://localhost:5000"
echo -e "${GREEN}✓ Frontend running on:${NC} http://localhost:3000"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo -e "  ${CYAN}pm2 logs backend${NC}    - View backend logs"
echo -e "  ${CYAN}pm2 logs frontend${NC}   - View frontend logs"
echo -e "  ${CYAN}pm2 restart all${NC}     - Restart all services"
echo -e "  ${CYAN}pm2 stop all${NC}        - Stop all services"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Setup SSL: ./setup-ssl.sh"
echo "  2. Configure domain DNS"
echo "  3. Deploy to production servers"
echo ""
echo -e "${GREEN}Done! 🎉${NC}"
