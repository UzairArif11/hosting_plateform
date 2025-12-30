#!/bin/bash

# Build and push custom PM2 image to Oracle Cloud servers
# Run this script ONCE to set up the optimized base image

set -e

echo "🏗️  Building Custom PM2 Image for Hosting Platform"
echo "=================================================="
echo ""

# Configuration
IMAGE_NAME="node-pm2-alpine"
IMAGE_TAG="latest"
FULL_IMAGE="${IMAGE_NAME}:${IMAGE_TAG}"

# Load environment variables
if [ -f ../.env ]; then
    source ../.env
else
    echo "❌ .env file not found. Please create one with EC3_HOST and SSH_EC3_KEY"
    exit 1
fi

echo "📦 Step 1: Building Docker image locally..."
docker build -t ${FULL_IMAGE} -f Dockerfile.pm2 .

if [ $? -eq 0 ]; then
    echo "✅ Image built successfully: ${FULL_IMAGE}"
else
    echo "❌ Image build failed"
    exit 1
fi

echo ""
echo "📤 Step 2: Saving image to tar archive..."
docker save ${FULL_IMAGE} | gzip > node-pm2-alpine.tar.gz

if [ $? -eq 0 ]; then
    echo "✅ Image saved: node-pm2-alpine.tar.gz ($(du -h node-pm2-alpine.tar.gz | cut -f1))"
else
    echo "❌ Image save failed"
    exit 1
fi

echo ""
echo "🚀 Step 3: Uploading to EC3 server..."
scp -i ${SSH_EC3_KEY} node-pm2-alpine.tar.gz ${SSH_USERNAME}@${EC3_HOST}:/tmp/

if [ $? -eq 0 ]; then
    echo "✅ Image uploaded to EC3"
else
    echo "❌ Upload failed"
    exit 1
fi

echo ""
echo "📥 Step 4: Loading image on EC3 server..."
ssh -i ${SSH_EC3_KEY} ${SSH_USERNAME}@${EC3_HOST} << 'EOF'
    echo "Loading Docker image..."
    docker load < /tmp/node-pm2-alpine.tar.gz
    echo "Verifying image..."
    docker images | grep node-pm2-alpine
    echo "Cleaning up tar file..."
    rm -f /tmp/node-pm2-alpine.tar.gz
EOF

if [ $? -eq 0 ]; then
    echo "✅ Image loaded on EC3"
else
    echo "❌ Load failed"
    exit 1
fi

echo ""
echo "🧹 Step 5: Cleaning up local tar file..."
rm -f node-pm2-alpine.tar.gz
echo "✅ Cleanup complete"

echo ""
echo "=================================================="
echo "🎉 CUSTOM PM2 IMAGE DEPLOYED SUCCESSFULLY!"
echo "=================================================="
echo ""
echo "Image: ${FULL_IMAGE}"
echo "Location: EC3 Server"
echo ""
echo "Next steps:"
echo "1. Update containerUpgrade.js to use '${IMAGE_NAME}:${IMAGE_TAG}'"
echo "2. Restart your platform backend"
echo "3. Try 'Sync Now' - containers will start in <1 second!"
echo ""
