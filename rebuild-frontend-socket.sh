#!/bin/bash

###############################################################################
# REBUILD FRONTEND WITH SOCKET.IO
###############################################################################

echo "╔══════════════════════════════════════════════════════════"
echo "║  🔧 Rebuilding Frontend with Socket.IO Config"
echo "╚══════════════════════════════════════════════════════════"
echo ""

cd ~/hosting_plateform/frontend

echo "→ Step 1: Verify environment variables..."
echo ""
echo "Current .env.production:"
cat .env.production
echo ""

echo "→ Step 2: Check if socket.io-client is installed..."
if npm list socket.io-client 2>/dev/null | grep -q "socket.io-client@"; then
    VERSION=$(npm list socket.io-client 2>/dev/null | grep socket.io-client@ | awk '{print $2}')
    echo "✅ socket.io-client installed: $VERSION"
else
    echo "❌ socket.io-client NOT installed, installing..."
    npm install socket.io-client
fi

echo ""
echo "→ Step 3: Clear Next.js cache..."
rm -rf .next
echo "✅ Cache cleared"

echo ""
echo "→ Step 4: Building frontend with production config..."
npm run build

echo ""
echo "→ Step 5: Verify build includes socket.io..."
if find .next -name "*.js" -type f -exec grep -l "socket.io" {} \; | head -1; then
    echo "✅ Socket.IO code found in build"
else
    echo "⚠️  Socket.IO not found in build - checking source..."
    grep -r "socket.io-client" app/
fi

echo ""
echo "→ Step 6: Restarting frontend..."
cd ..
pm2 restart frontend

echo ""
echo "→ Step 7: Checking frontend logs..."
sleep 2
pm2 logs frontend --lines 5 --nostream

echo ""
echo "╔══════════════════════════════════════════════════════════"
echo "║  ✅ FRONTEND REBUILT"
echo "╚══════════════════════════════════════════════════════════"
echo ""
echo "Now test in browser:"
echo "1. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)"
echo "2. Open DevTools (F12) → Console tab"
echo "3. Go to: https://foodpanda.site/dashboard/deployments/{id}"
echo "4. Look for: '✅ Connected to deployment logs'"
echo ""
echo "If still not seeing socket connection:"
echo "→ Check browser console for JavaScript errors"
echo "→ In console, type: process.env.NEXT_PUBLIC_SOCKET_URL"
echo "→ Should show: https://foodpanda.site"
echo ""
