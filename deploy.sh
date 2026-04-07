#!/bin/bash
########################################
# Platform Deployment Script
# 
# Usage: sudo bash deploy.sh
# 
# FIRST TIME: Run setup-ec2-ec3-SECURE.sh on EC2/EC3 servers
# UPDATES: Run this script for all deployments
########################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================"
echo -e "${BLUE}🚀 Platform Deployment${NC}"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}ERROR: Please run with sudo${NC}"
    echo "Usage: sudo bash deploy.sh"
    exit 1
fi

# Detect actual user (when using sudo)
ACTUAL_USER="${SUDO_USER:-$USER}"
USER_HOME=$(eval echo ~$ACTUAL_USER)

echo -e "${GREEN}Step 1: Pulling latest code...${NC}"
cd "$USER_HOME/hosting_plateform" || {
    echo -e "${RED}ERROR: Platform directory not found at $USER_HOME/hosting_plateform${NC}"
    exit 1
}

# Switch to actual user for git operations
sudo -u $ACTUAL_USER git pull origin optimization2 || {
    echo -e "${YELLOW}WARNING: Git pull failed. Continuing anyway...${NC}"
}

echo -e "${GREEN}✅ Code updated${NC}"

echo ""
echo -e "${GREEN}Step 2: Installing dependencies...${NC}"

# Backend dependencies
if [ -f "backend/package.json" ]; then
    cd backend
    echo "  Installing backend dependencies..."
    sudo -u $ACTUAL_USER npm install --production
    cd ..
    echo -e "${GREEN}✅ Backend dependencies installed${NC}"
fi

# Frontend dependencies (if needed)
if [ -f "frontend/package.json" ]; then
    cd frontend
    echo "  Building frontend..."
    sudo -u $ACTUAL_USER npm install
    sudo -u $ACTUAL_USER npm run build
    cd ..
    echo -e "${GREEN}✅ Frontend built${NC}"
fi

echo ""
echo -e "${GREEN}Step 3: Checking environment configuration...${NC}"

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}WARNING: backend/.env not found!${NC}"
    echo "  Create it from backend/.env.example"
    echo ""
    echo "  Required for SSH tunnels:"
    echo "    SSH_EC2_KEY=/home/$ACTUAL_USER/.ssh/id_rsa_ec2"
    echo "    SSH_EC3_KEY=/home/$ACTUAL_USER/.ssh/id_rsa_ec3"
    echo "    SSH_USERNAME=ubuntu"
    echo ""
    read -p "Continue anyway? (yes/no): " CONTINUE
    if [ "$CONTINUE" != "yes" ]; then
        exit 1
    fi
else
    echo -e "${GREEN}✅ Environment configuration found${NC}"
    
    # Check for SSH keys
    if grep -q "SSH_EC2_KEY" backend/.env && grep -q "SSH_EC3_KEY" backend/.env; then
        echo -e "${GREEN}✅ SSH tunnel configuration found${NC}"
    else
        echo -e "${YELLOW}⚠️  SSH tunnel configuration missing in .env${NC}"
        echo "  Add these lines to backend/.env:"
        echo "    SSH_EC2_KEY=/home/$ACTUAL_USER/.ssh/id_rsa_ec2"
        echo "    SSH_EC3_KEY=/home/$ACTUAL_USER/.ssh/id_rsa_ec3"
        echo "    SSH_USERNAME=ubuntu"
    fi
fi

echo ""
echo -e "${GREEN}Step 4: Restarting services with PM2...${NC}"

# Change to actual user for PM2 operations
sudo -u $ACTUAL_USER bash <<EOF
cd "$USER_HOME/hosting_plateform"

# Restart backend
echo "  Restarting backend..."
if pm2 status | grep -q "backend"; then
    pm2 restart backend --update-env
else
    echo "  Backend not running, starting..."
    cd backend
    pm2 start server.js --name backend
    cd ..
fi

# Restart frontend
echo "  Restarting frontend..."
if pm2 status | grep -q "frontend"; then
    pm2 restart frontend --update-env
else
    echo "  Frontend not running, starting..."
    cd frontend
    pm2 start npm --name frontend -- start
    cd ..
fi

# Save PM2 configuration
pm2 save

echo ""
EOF

echo -e "${GREEN}✅ Services restarted${NC}"

echo ""
echo -e "${GREEN}Step 4b: Ensuring Nginx WebSocket proxy for Socket.io...${NC}"

NGINX_CONF="/etc/nginx/sites-available/platform-foodpanda-site.conf"
NGINX_CHANGED=false

if [ -f "$NGINX_CONF" ]; then
    if ! grep -q "socket.io" "$NGINX_CONF"; then
        echo "  Adding Socket.io WebSocket proxy block..."
        # Insert the socket.io location BEFORE the first 'location /api/' block
        sed -i '/location \/api\//i \
    # Socket.io WebSocket proxy (auto-added by deploy.sh)\
    location /api/socket.io/ {\
        proxy_pass http://127.0.0.1:5000;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection "upgrade";\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_cache_bypass $http_upgrade;\
        proxy_read_timeout 86400;\
        proxy_send_timeout 86400;\
    }\
' "$NGINX_CONF"
        NGINX_CHANGED=true
        echo -e "${GREEN}✅ Socket.io proxy block added${NC}"
    else
        echo -e "${GREEN}✅ Socket.io proxy already configured${NC}"
    fi

    if [ "$NGINX_CHANGED" = true ]; then
        echo "  Testing Nginx config..."
        if nginx -t 2>&1; then
            systemctl reload nginx
            echo -e "${GREEN}✅ Nginx reloaded${NC}"
        else
            echo -e "${RED}❌ Nginx config test failed! Check manually:${NC}"
            echo "  sudo nano $NGINX_CONF"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Nginx config not found at $NGINX_CONF${NC}"
    echo "  Socket.io WebSocket proxy must be configured manually."
    echo "  Check: ls /etc/nginx/sites-available/"
fi

echo ""
echo -e "${GREEN}Step 5: Health checks...${NC}"

# Wait for services to start
echo "  Waiting for services to start..."
sleep 8

# Check backend health
echo "  Checking backend..."
if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Backend health check failed${NC}"
    echo "  Check logs: pm2 logs backend --lines 50"
fi

# Check frontend
echo "  Checking frontend..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is responding${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend health check failed${NC}"
    echo "  Check logs: pm2 logs frontend --lines 50"
fi

echo ""
echo "========================================"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "========================================"
echo ""

# Show PM2 status
echo "PM2 Services:"
sudo -u $ACTUAL_USER pm2 status

echo ""
echo "Backend logs (last 10 lines):"
sudo -u $ACTUAL_USER pm2 logs backend --lines 10 --nostream

echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  View all logs:     ${GREEN}pm2 logs${NC}"
echo "  View backend logs: ${GREEN}pm2 logs backend${NC}"
echo "  View frontend logs:${GREEN}pm2 logs frontend${NC}"
echo "  Restart all:       ${GREEN}pm2 restart all${NC}"
echo "  Stop all:          ${GREEN}pm2 stop all${NC}"
echo "  PM2 status:        ${GREEN}pm2 status${NC}"
echo ""
echo -e "${BLUE}Health Endpoints:${NC}"
echo "  Backend:  ${GREEN}curl http://localhost:5000/api/health${NC}"
echo "  Frontend: ${GREEN}curl http://localhost:3000${NC}"
echo ""
echo -e "${YELLOW}Look for 'SSH tunnels: 2/2 active' in backend logs!${NC}"
echo ""
