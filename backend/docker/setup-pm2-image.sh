#!/bin/bash

################################################################################
# Setup Custom PM2 Docker Image for Hosting Platform
# Run this ONCE on your EC3 server to enable instant container startups
################################################################################

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Custom PM2 Image Builder for Hosting Platform         ║"
echo "║   This will create node-pm2-alpine:latest image         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Create Dockerfile
echo "📝 Step 1: Creating Dockerfile..."
cat > /tmp/Dockerfile.pm2 << 'EOF'
# Custom Node.js Alpine Image with PM2 Pre-installed
# This eliminates the 20+ second PM2 installation wait on each container creation

FROM node:18-alpine

# Install PM2 globally with optimized flags
RUN npm install -g pm2@latest \
    --no-audit \
    --no-fund \
    --silent \
    --prefer-offline \
    --no-optional

# Verify PM2 installation
RUN pm2 --version

# Create app directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PM2_PUBLIC_KEY=
ENV PM2_SECRET_KEY=

# Expose default port (will be overridden by host networking)
EXPOSE 3000

# Keep container running
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
EOF

echo "✅ Dockerfile created at /tmp/Dockerfile.pm2"
echo ""

# Step 2: Build the image
echo "🏗️  Step 2: Building custom PM2 image..."
echo "This will take about 2-3 minutes..."
echo ""

cd /tmp
docker build -t node-pm2-alpine:latest -f Dockerfile.pm2 . 2>&1 | grep -E "(Step|Successfully|Removing)"

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo ""
    echo "✅ Image built successfully!"
else
    echo ""
    echo "❌ Image build failed"
    exit 1
fi

echo ""

# Step 3: Verify the image
echo "🔍 Step 3: Verifying image..."
docker images | grep node-pm2-alpine

echo ""
echo "📋 Step 4: Testing PM2 in image..."
docker run --rm node-pm2-alpine:latest pm2 --version

echo ""

# Step 4: Get image size
IMAGE_SIZE=$(docker images node-pm2-alpine:latest --format "{{.Size}}")

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅ SETUP COMPLETE!                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "📦 Image Created: node-pm2-alpine:latest"
echo "💾 Image Size: $IMAGE_SIZE"
echo "🚀 PM2 Version: $(docker run --rm node-pm2-alpine:latest pm2 --version)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ Next Steps:"
echo "   1. Your backend is already configured to use this image"
echo "   2. Try deploying a new project"
echo "   3. Container will start in <1 second instead of 20+ seconds!"
echo ""
echo "🧹 Cleanup:"
echo "   Temporary Dockerfile removed automatically"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Cleanup
rm -f /tmp/Dockerfile.pm2

echo ""
echo "🎉 All done! Your platform now has instant container startups!"
echo ""
