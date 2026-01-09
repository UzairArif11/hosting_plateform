#!/bin/bash

###############################################################################
# COMPLETE FRONTEND REBUILD - FORCE FRESH BUILD
###############################################################################

echo "╔══════════════════════════════════════════════════════════"
echo "║  🔄 Complete Frontend Rebuild"
echo "╚══════════════════════════════════════════════════════════"
echo ""

cd ~/hosting_plateform/frontend

# 1. Stop frontend
echo "→ Stopping frontend..."
pm2 stop frontend
echo "✅ Frontend stopped"
echo ""

# 2. Clean everything
echo "→ Cleaning caches and old builds..."
rm -rf .next
rm -rf node_modules/.cache
echo "✅ Caches cleared"
echo ""

# 3. Verify environment
echo "→ Setting up environment..."
cat > .env.production << 'EOF'
NEXT_PUBLIC_API_URL=https://foodpanda.site
NEXT_PUBLIC_SOCKET_URL=https://foodpanda.site
NODE_ENV=production
EOF

cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://foodpanda.site
NEXT_PUBLIC_SOCKET_URL=https://foodpanda.site
EOF

echo "✅ Environment configured"
echo ""
echo "Current .env.production:"
cat .env.production
echo ""

# 4. Check socket.io-client
echo "→ Verifying socket.io-client..."
if npm list socket.io-client 2>/dev/null | grep -q "socket.io-client@"; then
    echo "✅ socket.io-client found"
else
    echo "❌ Installing socket.io-client..."
    npm install socket.io-client@4.8.1
fi
echo ""

# 5. Build
echo "→ Building frontend (this may take 30-60 seconds)..."
NODE_ENV=production npm run build
echo "✅ Build complete"
echo ""

# 6. Verify socket code in build
echo "→ Verifying socket.io code in build..."
if find .next -type f -name "*.js" -exec grep -l "socket.io" {} \; | head -1; then
    echo "✅ Socket.IO code found in build"
else
    echo "⚠️  Socket.IO code NOT found in build!"
fi
echo ""

# 7. Start frontend
echo "→ Starting frontend..."
pm2 start frontend
sleep 3
echo "✅ Frontend started"
echo ""

# 8. Check status
echo "→ PM2 Status:"
pm2 list | grep frontend
echo ""

# 9. Check logs
echo "→ Recent frontend logs:"
pm2 logs frontend --lines 10 --nostream
echo ""

echo "╔══════════════════════════════════════════════════════════"
echo "║  ✅ REBUILD COMPLETE"
echo "╚══════════════════════════════════════════════════════════"
echo ""
echo "IMPORTANT: Clear your browser cache!"
echo "  - Chrome: Ctrl+Shift+Delete → Clear cache"
echo "  - Or: Hard refresh: Ctrl+Shift+R"
echo ""
echo "Then:"
echo "  1. Go to: https://foodpanda.site/dashboard/deployments/{any-id}"
echo "  2. Look for the DEBUG BAR at the top"
echo "  3. It should show: Status: Connected (green)"
echo ""
echo "If Status shows 'Connecting...' or 'Error', check console for details"
echo ""
