#!/bin/bash

# Container Host Deployment Script
# Run this on EC2-2/EC2-3+ servers

set -e

echo "🚀 Starting Container Host Deployment..."

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should not be run as root for security reasons"
   exit 1
fi

# Variables
INSTALL_DIR="/opt/container-host"
SERVICE_NAME="container-agent"
NODE_VERSION="18"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if this is a free users server (EC2-2) or paid users server (EC2-3+)
echo "Server type selection:"
echo "1) Free users server (EC2-2) - Will create shared container"
echo "2) Paid users server (EC2-3+) - Will create dedicated containers dynamically"
read -p "Select server type (1 or 2): " SERVER_TYPE

if [[ "$SERVER_TYPE" != "1" && "$SERVER_TYPE" != "2" ]]; then
    print_error "Invalid selection. Please run the script again."
    exit 1
fi

# Update system packages
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js
print_status "Installing Node.js ${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js installation
NODE_VER=$(node --version)
print_status "Node.js installed: ${NODE_VER}"

# Install Docker
print_status "Installing Docker..."
sudo apt install docker.io -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Create project directory
print_status "Creating project directory..."
sudo mkdir -p $INSTALL_DIR
sudo chown $USER:$USER $INSTALL_DIR
cd $INSTALL_DIR

# Download container host agent
print_status "Downloading container host agent..."
curl -o container-host-agent.js https://raw.githubusercontent.com/yourusername/vercel-clone-platform/main/container-host-agent.js

if [[ ! -f "container-host-agent.js" ]]; then
    print_error "Failed to download container-host-agent.js"
    print_warning "Please manually copy the file from your repository"
    exit 1
fi

# Initialize npm project and install dependencies
print_status "Installing Node.js dependencies..."
npm init -y
npm install express dockerode

# Create user workspace Docker image
print_status "Creating user workspace Docker image..."
mkdir -p user-workspace
cd user-workspace

cat << 'EOF' > Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install build tools
RUN apk add --no-cache git python3 make g++ curl

# Install common build tools
RUN npm install -g npm@latest

# Create directory structure
RUN mkdir -p /app/workspace /app/projects /app/.cache /app/builds /app/users

# Create non-root user
RUN adduser -D -s /bin/sh appuser
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 3000 3002

# Keep container running
CMD ["tail", "-f", "/dev/null"]
EOF

# Build Docker image
print_status "Building user workspace Docker image..."
docker build -t user-workspace:latest .

cd $INSTALL_DIR

# Create shared container for free users server only
if [[ "$SERVER_TYPE" == "1" ]]; then
    print_status "Creating shared container for free users..."
    
    docker run -d \
        --name shared-free-container \
        --restart unless-stopped \
        --cpus="1" \
        --memory="6g" \
        -p 3002:3000 \
        -v shared-free-data:/app/users \
        user-workspace:latest
    
    print_status "Shared container created successfully"
    docker ps | grep shared-free-container
else
    print_status "Paid users server - no shared container needed"
    print_warning "Dedicated containers will be created dynamically per user"
fi

# Create systemd service
print_status "Creating systemd service..."
sudo tee /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Container Host Agent
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node container-host-agent.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
print_status "Starting container host agent service..."
sudo systemctl enable $SERVICE_NAME
sudo systemctl start $SERVICE_NAME

# Check service status
sleep 2
if sudo systemctl is-active --quiet $SERVICE_NAME; then
    print_status "Container host agent is running successfully"
    sudo systemctl status $SERVICE_NAME --no-pager -l
else
    print_error "Failed to start container host agent"
    sudo journalctl -u $SERVICE_NAME -n 20
    exit 1
fi

# Test the service
print_status "Testing container host agent..."
sleep 3

if curl -s http://localhost:3001/health > /dev/null; then
    print_status "Health check passed"
    echo "Response: $(curl -s http://localhost:3001/health)"
else
    print_warning "Health check failed - service might still be starting"
fi

# Show final status
echo ""
echo "🎉 Container Host Deployment Complete!"
echo ""
echo "📋 Summary:"
echo "  • Server Type: $([ "$SERVER_TYPE" == "1" ] && echo "Free Users (EC2-2)" || echo "Paid Users (EC2-3+)")"
echo "  • Agent Status: $(sudo systemctl is-active $SERVICE_NAME)"
echo "  • Agent Port: 3001"
echo "  • Docker Images: $(docker images --format 'table {{.Repository}}:{{.Tag}}' | grep user-workspace)"
if [[ "$SERVER_TYPE" == "1" ]]; then
    echo "  • Shared Container: $(docker ps --format 'table {{.Names}}\t{{.Status}}' | grep shared-free-container)"
fi
echo ""
echo "📡 Network Configuration Needed:"
echo "  • Allow inbound port 3001 from EC2-1 (Control Plane) only"
echo "  • Security Group: Custom TCP, Port 3001, Source: EC2-1 private IP"
echo ""
echo "🔧 Management Commands:"
echo "  • Check status: sudo systemctl status $SERVICE_NAME"
echo "  • View logs: sudo journalctl -u $SERVICE_NAME -f"
echo "  • Restart: sudo systemctl restart $SERVICE_NAME"
echo "  • Stop: sudo systemctl stop $SERVICE_NAME"
echo ""
echo "🧪 Test Commands:"
echo "  • Health check: curl http://localhost:3001/health"
echo "  • System stats: curl http://localhost:3001/stats"
echo "  • Container list: docker ps"
echo ""

if [[ "$SERVER_TYPE" == "1" ]]; then
    echo "🆓 Free Users Server Notes:"
    echo "  • All free users will share the 'shared-free-container'"
    echo "  • Check users: docker exec shared-free-container ls -la /app/users/"
    echo ""
else
    echo "💰 Paid Users Server Notes:"
    echo "  • Dedicated containers will be created automatically per paid user"
    echo "  • Monitor containers: docker ps | grep user-.*-container"
    echo ""
fi

echo "✅ Ready to receive container requests from EC2-1!"

# Reminder about reboot
print_warning "IMPORTANT: Reboot the server to apply Docker group permissions:"
echo "sudo reboot"
