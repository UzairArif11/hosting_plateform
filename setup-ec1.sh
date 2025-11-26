#!/bin/bash
########################################
# EC1 - Complete Project Setup (Ubuntu)
# Main server: Backend + Frontend + MongoDB
# For Oracle Cloud or any Ubuntu server
########################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================"
echo "EC1 - Complete Project Setup (Ubuntu)"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}ERROR: Don't run as root! Run as regular user with sudo access${NC}"
    exit 1
fi

echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"
echo ""

# Check if we're on Ubuntu
if ! grep -q "Ubuntu" /etc/os-release; then
    echo -e "${YELLOW}WARNING: This script is designed for Ubuntu${NC}"
fi

echo -e "${GREEN}Step 2: Installing system dependencies...${NC}"
echo ""

# Update system
sudo apt update

# Install Node.js (if not installed)
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo -e "${GREEN}[OK] Node.js already installed: $(node --version)${NC}"
fi

# Install Docker (if not installed)
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo apt install -y docker.io
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
else
    echo -e "${GREEN}[OK] Docker already installed: $(docker --version)${NC}"
fi

# Install Docker Compose (if not installed)
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo apt install -y docker-compose
else
    echo -e "${GREEN}[OK] Docker Compose already installed${NC}"
fi

# Install Git (if not installed)
if ! command -v git &> /dev/null; then
    echo "Installing Git..."
    sudo apt install -y git
else
    echo -e "${GREEN}[OK] Git already installed${NC}"
fi

echo ""
echo -e "${GREEN}Step 3: Installing project dependencies...${NC}"
echo ""

# Install backend dependencies
if [ -d "backend" ]; then
    echo "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    echo -e "${GREEN}[OK] Backend dependencies installed${NC}"
else
    echo -e "${RED}ERROR: backend directory not found!${NC}"
    echo "Make sure you're in the project root directory"
    exit 1
fi

# Install frontend dependencies
if [ -d "frontend" ]; then
    echo "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    echo -e "${GREEN}[OK] Frontend dependencies installed${NC}"
else
    echo -e "${RED}ERROR: frontend directory not found!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Step 4: Setting up environment files...${NC}"
echo ""

# Create backend .env if not exists
if [ ! -f "backend/.env" ]; then
    echo "Creating backend/.env..."
    cat > backend/.env <<EOF
# Server
PORT=5000
NODE_ENV=development

# Frontend
FRONTEND_URL=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin

# JWT & Session
JWT_SECRET=your-secret-key-change-this-in-production
SESSION_SECRET=your-session-secret-change-this-in-production

# GitHub OAuth (get from https://github.com/settings/developers)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback

# Google OAuth (get from https://console.cloud.google.com)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Oracle Cloud Servers (add your EC2/EC3 IPs)
# EC2_SERVER_IP=140.238.229.147
# EC3_SERVER_IP=129.154.255.90
EOF
    echo -e "${GREEN}[OK] Created backend/.env${NC}"
    echo ""
    echo -e "${YELLOW}IMPORTANT: Edit backend/.env and add your OAuth credentials!${NC}"
    echo ""
else
    echo -e "${GREEN}[OK] backend/.env already exists${NC}"
fi

# Create frontend .env.local if not exists
if [ ! -f "frontend/.env.local" ]; then
    echo "Creating frontend/.env.local..."
    echo "NEXT_PUBLIC_API_URL=http://localhost:5000" > frontend/.env.local
    echo -e "${GREEN}[OK] Created frontend/.env.local${NC}"
else
    echo -e "${GREEN}[OK] frontend/.env.local already exists${NC}"
fi

echo ""
echo -e "${GREEN}Step 5: Starting MongoDB...${NC}"
echo ""

# Start MongoDB with Docker Compose
if [ -f "docker-compose.yml" ]; then
    docker-compose up -d
    echo -e "${GREEN}[OK] MongoDB started${NC}"
    echo "Waiting for MongoDB to be ready..."
    sleep 10
else
    echo -e "${YELLOW}WARNING: docker-compose.yml not found${NC}"
    echo "You'll need to start MongoDB manually"
fi

echo ""
echo "========================================"
echo -e "${GREEN}Setup Complete!${NC}"
echo "========================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Edit backend/.env and add your OAuth credentials:"
echo "   ${BLUE}nano backend/.env${NC}"
echo "   - GITHUB_CLIENT_ID"
echo "   - GITHUB_CLIENT_SECRET"
echo "   - GOOGLE_CLIENT_ID"
echo "   - GOOGLE_CLIENT_SECRET"
echo ""
echo "2. Start the backend:"
echo "   ${BLUE}cd backend${NC}"
echo "   ${BLUE}npm run dev${NC}"
echo ""
echo "3. Start the frontend (in a new terminal):"
echo "   ${BLUE}cd frontend${NC}"
echo "   ${BLUE}npm run dev${NC}"
echo ""
echo "4. Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:5000"
echo "   MongoDB:  http://localhost:8081 (admin/password123)"
echo ""
echo "5. Make yourself admin:"
echo "   ${BLUE}cd backend${NC}"
echo "   ${BLUE}node make-admin.js your-email@gmail.com${NC}"
echo ""
echo "6. Open firewall ports (if on Oracle Cloud):"
echo "   ${BLUE}sudo ufw allow 3000/tcp${NC}  # Frontend"
echo "   ${BLUE}sudo ufw allow 5000/tcp${NC}  # Backend"
echo "   ${BLUE}sudo ufw allow 8081/tcp${NC}  # MongoDB UI"
echo ""
echo "========================================"
echo ""
echo -e "${YELLOW}Note: If you added yourself to docker group, logout and login again${NC}"
echo ""
