#!/bin/bash

###############################################################################
# PRE-BUILD PM2 IMAGE ON ALL SERVERS
# Run this once to avoid 30-second wait for first users
###############################################################################

echo "╔══════════════════════════════════════════════════════════"
echo "║  Building PM2 Image on All Servers"
echo "╚══════════════════════════════════════════════════════════"
echo ""

# Load environment variables
if [ -f backend/.env ]; then
    export $(cat backend/.env | grep -v '^#' | xargs)
fi

# Dockerfile content
DOCKERFILE='FROM node:18-alpine
RUN npm install -g pm2@latest --no-audit --no-fund --silent --prefer-offline --no-optional
RUN pm2 --version
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pm2-runtime", "start", "ecosystem.config.js"]'

echo "→ Building on EC2 (${EC2_HOST})..."
ssh -i ${SSH_EC2_KEY} ${SSH_USERNAME}@${EC2_HOST} << EOF
    # Check if image exists
    if docker images node-pm2-alpine:latest -q | grep -q .; then
        echo "  ✅ Image already exists on EC2"
    else
        echo "  📦 Building PM2 image on EC2..."
        mkdir -p /tmp/pm2-image
        echo '${DOCKERFILE}' > /tmp/pm2-image/Dockerfile
        cd /tmp/pm2-image && docker build -t node-pm2-alpine:latest .
        rm -rf /tmp/pm2-image
        echo "  ✅ Image built on EC2"
    fi
    
    # Verify
    docker images node-pm2-alpine:latest
EOF

echo ""
echo "→ Building on EC3 (${EC3_HOST})..."
ssh -i ${SSH_EC3_KEY} ${SSH_USERNAME}@${EC3_HOST} << EOF
    # Check if image exists
    if docker images node-pm2-alpine:latest -q | grep -q .; then
        echo "  ✅ Image already exists on EC3"
    else
        echo "  📦 Building PM2 image on EC3..."
        mkdir -p /tmp/pm2-image
        echo '${DOCKERFILE}' > /tmp/pm2-image/Dockerfile
        cd /tmp/pm2-image && docker build -t node-pm2-alpine:latest .
        rm -rf /tmp/pm2-image
        echo "  ✅ Image built on EC3"
    fi
    
    # Verify
    docker images node-pm2-alpine:latest
EOF

echo ""
echo "╔══════════════════════════════════════════════════════════"
echo "║  ✅ PM2 Images Ready on All Servers!"
echo "╚══════════════════════════════════════════════════════════"
echo ""
echo "All future deployments will be instant (no build wait)."
echo ""
