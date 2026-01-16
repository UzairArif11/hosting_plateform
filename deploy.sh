#!/bin/bash

# Complete Production Deployment Script
# This should be run on your production server

set -e  # Exit on error

echo "🚀 Starting Production Deployment"
echo "=================================="
echo ""

# 1. Pull latest code
echo "📥 Step 1: Pulling latest code..."
git pull origin main  # or your production branch

# 2. Install/Update Dependencies
echo "📦 Step 2: Installing dependencies..."

cd backend
npm install --production
cd ..

cd frontend
npm install --production
npm run build  # Build frontend for production
cd ..

cd cli
npm install --production
cd ..

# 3. Run Database Seeders (ONLY FIRST TIME or when templates updated)
echo "🌱 Step 3: Checking database..."

# Check if templates exist
TEMPLATE_COUNT=$(node -e "
const mongoose = require('mongoose');
const Template = require('./backend/models/Template');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vercel-clone')
  .then(() => Template.countDocuments())
  .then(count => { console.log(count); process.exit(0); })
  .catch(() => { console.log(0); process.exit(0); });
" 2>/dev/null || echo "0")

if [ "$TEMPLATE_COUNT" -eq "0" ]; then
    echo "No templates found, seeding database..."
    node backend/scripts/seedTemplates.js
else
    echo "Templates already exist (count: $TEMPLATE_COUNT), skipping seed"
fi

# 4. Restart Services
echo "🔄 Step 4: Restarting services..."

# Stop existing processes
pkill -f "node.*backend/server.js" || true
pkill -f "next.*dev" || true

# Start backend
cd backend
npm start > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"
cd ..

# Start frontend (production mode)
cd frontend
npm start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"
cd ..

# Wait for services to start
sleep 5

# 5. Health Check
echo "🏥 Step 5: Running health checks..."

if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
    exit 1
fi

if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend health check passed"
else
    echo "⚠️  Frontend may still be starting..."
fi

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "Services:"
echo "  Backend:  http://localhost:5000"
echo "  Frontend: http://localhost:3000"
echo ""
echo "Logs:"
echo "  Backend:  tail -f logs/backend.log"
echo "  Frontend: tail -f logs/frontend.log"
echo ""
echo "Next: Run production tests"
echo "  chmod +x test-production.sh"
echo "  PROD_DOMAIN=your-domain.com ./test-production.sh"
