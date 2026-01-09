#!/bin/bash

###############################################################################
# FINAL DEBUG - WHY NO SOCKET LOGS?
###############################################################################

echo "╔══════════════════════════════════════════════════════════"
echo "║  🔍 Final Socket Debugging"
echo "╚══════════════════════════════════════════════════════════"
echo ""

cd ~/hosting_plateform

echo "→ 1. Pull latest code..."
git pull
echo ""

echo "→ 2. Check what env vars the FRONTEND will see..."
cd frontend
echo "Current .env.production:"
cat .env.production 2>/dev/null || echo "❌ .env.production MISSING!"
echo ""

echo "→ 3. Rebuild with explicit env injection..."
cat > .env.production << 'EOF'
NEXT_PUBLIC_API_URL=https://foodpanda.site
NEXT_PUBLIC_SOCKET_URL=https://foodpanda.site
NODE_ENV=production
EOF

echo "✅ .env.production created"
echo ""

echo "→ 4. Clean and rebuild..."
rm -rf .next
rm -rf node_modules/.cache
echo "Building with environment variables..."
NEXT_PUBLIC_API_URL=https://foodpanda.site NEXT_PUBLIC_SOCKET_URL=https://foodpanda.site npm run build
echo ""

echo "→ 5. Verify socket code exists in build..."
echo "Searching for 'Initializing Socket' in build..."
if grep -r "Initializing Socket" .next/ 2>/dev/null | head -1; then
    echo "✅ Socket initialization code found in build"
else
    echo "❌ Socket code NOT in build!"
fi
echo ""

echo "Searching for 'socket.io-client' in build..."
if grep -r "socket.io" .next/ 2>/dev/null | head -1; then
    echo "✅ socket.io references found"
else
    echo "❌ NO socket.io in build!"
fi
echo ""

echo "→ 6. Restart frontend..."
cd ..
pm2 restart frontend
sleep 3
echo "✅ Frontend restarted"
echo ""

echo "→ 7. Test the Socket.IO endpoint..."
echo "Testing: https://foodpanda.site/socket.io/?EIO=4&transport=polling"
RESPONSE=$(curl -s https://foodpanda.site/socket.io/\?EIO\=4\&transport\=polling | head -c 200)
if echo "$RESPONSE" | grep -q "sid"; then
    echo "✅ Socket.IO endpoint working!"
    echo "Response: $RESPONSE"
else
    echo "❌ Socket.IO endpoint not working!"
    echo "Response: $RESPONSE"
fi
echo ""

echo "╔══════════════════════════════════════════════════════════"
echo "║  📋 MANUAL TESTS"
echo "╚══════════════════════════════════════════════════════════"
echo ""
echo "A. Test simple page first:"
echo "   1. Go to: https://foodpanda.site/test-socket"
echo "   2. Open Console (F12)"
echo "   3. Look for: '🧪 TEST PAGE LOADED'"
echo "   4. Check if NEXT_PUBLIC_SOCKET_URL is shown"
echo ""
echo "B. If test page works, try deployment page:"
echo "   1. Go to: https://foodpanda.site/dashboard/deployments/{any-id}"
echo "   2. Open Console (F12) BEFORE loading the page"
echo "   3. Refresh page"
echo "   4. Look for: '🔌 Connecting to Socket.IO'"
echo ""
echo "C. If STILL no logs:"
echo "   → Your browser is caching old JavaScript"
echo "   → Solution: Clear ALL site data:"
echo "      Chrome: F12 → Application → Clear storage → Clear site data"
echo "      Then hard refresh: Ctrl+Shift+R"
echo ""
echo "D. Check Network tab:"
echo "   1. Open Network tab in DevTools"
echo "   2. Filter: \"socket.io\""
echo "   3. Refresh page"
echo "   4. You should see a request to /socket.io/?EIO=4..."
echo ""
