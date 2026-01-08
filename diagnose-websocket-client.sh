#!/bin/bash

###############################################################################
# DIAGNOSE & FIX WEBSOCKET CLIENT ISSUE
###############################################################################

echo "╔══════════════════════════════════════════════════════════"
echo "║  🔍 Diagnosing WebSocket Client Issue"
echo "╚══════════════════════════════════════════════════════════"
echo ""

cd ~/hosting_plateform/frontend

echo "→ Step 1: Checking if socket.io-client is installed..."
if npm list socket.io-client 2>/dev/null | grep -q "socket.io-client@"; then
    VERSION=$(npm list socket.io-client 2>/dev/null | grep socket.io-client@ | awk '{print $2}')
    echo "✅ socket.io-client installed: $VERSION"
else
    echo "❌ socket.io-client NOT installed!"
    echo "→ Installing socket.io-client..."
    npm install socket.io-client
    echo "✅ Installed"
fi

echo ""
echo "→ Step 2: Checking environment variables..."
echo "Production env:"
cat .env.production 2>/dev/null || echo "⚠️  .env.production not found"
echo ""
echo "Local env:"
cat .env.local 2>/dev/null || echo "⚠️  .env.local not found"

echo ""
echo "→ Step 3: Verifying build includes socket dependencies..."
if [ -f ".next/package.json" ]; then
    echo "✅ Next.js build exists"
else
    echo "⚠️  No .next build found, rebuilding..."
    npm run build
fi

echo ""
echo "→ Step 4: Testing Socket.IO endpoint from server..."
SOCKET_TEST=$(curl -s https://foodpanda.site/socket.io/?EIO=4\&transport=polling)
echo "Socket.IO response:"
echo "$SOCKET_TEST" | head -c 200
echo ""

if echo "$SOCKET_TEST" | grep -q "sid"; then
    echo "✅ Socket.IO endpoint is working!"
else
    echo "❌ Socket.IO endpoint not responding correctly"
    echo ""
    echo "Checking backend logs..."
    pm2 logs backend --lines 20 --nostream | grep -i websocket
fi

echo ""
echo "→ Step 5: Checking if page includes socket.io client..."
if grep -r "socket.io-client" .next/server/app 2>/dev/null | head -n 1; then
    echo "✅ Socket.IO client code found in build"
else
    echo "⚠️  Socket.IO client not found in build"
    echo "   This might be a tree-shaking issue"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════"
echo "║  📋 MANUAL VERIFICATION STEPS"
echo "╚══════════════════════════════════════════════════════════"
echo ""
echo "1. Open: https://foodpanda.site/dashboard/projects"
echo "2. Click on a project"
echo "3. Click 'Deploy'"
echo "4. Open Browser Console (F12)"
echo "5. You should see:"
echo "   ✅ '✅ Connected to deployment logs'"
echo "   ✅ 'WebSocket client connected'"
echo ""
echo "If you DON'T see these messages:"
echo "   → Check browser console for errors"
echo "   → Look for: 'socket.io-client' errors"
echo "   → Try hard refresh: Ctrl+Shift+R"
echo ""
echo "6. If still not working, add debug logging:"
echo "   → Open deployment page"
echo "   → In console, type: localStorage.debug = 'socket.io-client:*'"
echo "   → Refresh page"
echo "   → You'll see detailed socket.io logs"
echo ""
