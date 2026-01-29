#!/bin/bash
# Production Deployment Script for Template System Fixes
# Run this on: ubuntu@instance-20250713-1730

set -e  # Exit on error

echo "🚀 Deploying Template System Fixes..."
echo ""

# Navigate to backend
cd ~/hosting_plateform/backend

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
git pull origin main
echo "✅ Code updated"
echo ""

# Restart backend
echo "🔄 Restarting backend service..."
pm2 restart backend
sleep 3
echo "✅ Backend restarted"
echo ""

# Check backend status
echo "📊 Backend Status:"
pm2 list | grep backend
echo ""

# Re-seed templates
echo "🌱 Re-seeding templates with Smart Commerce and Smart Portfolio..."
node scripts/seedTemplates.js
echo ""

# Show recent logs
echo "📋 Recent Backend Logs:"
pm2 logs backend --lines 30 --nostream
echo ""

echo "✅ Deployment Complete!"
echo ""
echo "🧪 Next Steps:"
echo "1. Visit: https://foodpanda.site/admin"
echo "2. Go to Templates section"
echo "3. Deploy 'Smart Portfolio' template"
echo "4. Watch for real-time progress in UI"
echo "5. Check deployment succeeds without Prisma errors"
echo ""
echo "Expected to see:"
echo "  ✓ Progress bar: 0% → 100%"
echo "  ✓ Live logs appearing"
echo "  ✓ 'Repository cloned successfully'"
echo "  ✓ 'Dependencies installed'"
echo "  ✓ 'Deployment successful!'"
