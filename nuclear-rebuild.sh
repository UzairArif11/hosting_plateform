#!/bin/bash

###############################################################################
# NUCLEAR OPTION - COMPLETE CACHE CLEAR & REBUILD
###############################################################################

echo "╔══════════════════════════════════════════════════════════"
echo "║  💣 NUCLEAR REBUILD - Clearing EVERYTHING"
echo "╚══════════════════════════════════════════════════════════"
echo ""

cd ~/hosting_plateform

# 1. Pull latest
echo "→ 1. Pulling latest code..."
git pull
echo ""

cd frontend

# 2. STOP frontend
echo "→ 2. Stopping frontend..."
pm2 stop frontend
sleep 2
echo "✅ Stopped"
echo ""

# 3. NUCLEAR clean
echo "→ 3. NUCLEAR CLEAN (deleting everything)..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .turbo
rm -rf out
echo "✅ Cleaned"
echo ""

# 4. Set env with TIMESTAMP (forces rebuild)
echo "→ 4. Setting environment with timestamp..."
TIMESTAMP=$(date +%s)
cat > .env.production << EOF
NEXT_PUBLIC_API_URL=https://foodpanda.site
NEXT_PUBLIC_SOCKET_URL=https://foodpanda.site
NODE_ENV=production
NEXT_PUBLIC_BUILD_TIME=${TIMESTAMP}
EOF

cat > .env.local << EOF
NEXT_PUBLIC_API_URL=https://foodpanda.site
NEXT_PUBLIC_SOCKET_URL=https://foodpanda.site
NEXT_PUBLIC_BUILD_TIME=${TIMESTAMP}
EOF

echo "✅ Environment set with build time: $TIMESTAMP"
echo ""

# 5. Verify socket.io-client
echo "→ 5. Verifying socket.io-client..."
if ! npm list socket.io-client 2>/dev/null | grep -q "socket.io-client@"; then
    echo "Installing socket.io-client..."
    npm install socket.io-client@4.8.1
fi
echo "✅ socket.io-client OK"
echo ""

# 6. BUILD with explicit env injection
echo "→ 6. Building (with env vars explicitly set)..."
echo "This will take 30-60 seconds..."
NEXT_PUBLIC_API_URL=https://foodpanda.site \
NEXT_PUBLIC_SOCKET_URL=https://foodpanda.site \
NEXT_PUBLIC_BUILD_TIME=${TIMESTAMP} \
NODE_ENV=production \
npm run build

echo "✅ Build complete"
echo ""

# 7. Verify version in build
echo "→ 7. Verifying new code in build..."
echo "Looking for version string '2.0-SOCKET-FIX'..."
if grep -r "2.0-SOCKET-FIX" .next/ 2>/dev/null | head -1; then
    echo "✅ NEW CODE FOUND IN BUILD!"
else
    echo "❌ Version not found - check build!"
fi
echo ""

# 8. Verify socket code
echo "Looking for socket initialization code..."
if grep -r "DEPLOYMENT PAGE LOADED" .next/ 2>/dev/null | head -1; then
    echo "✅ Socket code found"
else
    echo "⚠️  Socket code not found"
fi
echo ""

# 9. Start frontend
echo "→ 8. Starting frontend..."
pm2 start frontend
sleep 3
echo "✅ Started"
echo ""

# 10. Show status
pm2 list | grep frontend
echo ""

echo "╔══════════════════════════════════════════════════════════"
echo "║  ⚠️  CRITICAL: CLEAR BROWSER CACHE NOW!"
echo "╚══════════════════════════════════════════════════════════"
echo ""
echo "The server has NEW code, but your browser has OLD cached files."
echo ""
echo "OPTION 1: Private/Incognito Window (EASIEST)"
echo "   → Open a new Incognito/Private window"
echo "   → Go to: https://foodpanda.site/dashboard/deployments/{id}"
echo "   → No cache = guaranteed fresh"
echo ""
echo "OPTION 2: Clear cache properly"
echo "   Chrome/Edge:"
echo "   1. F12 (DevTools)"
echo "   2. Right-click the refresh button"
echo "   3. Select 'Empty Cache and Hard Reload'"
echo ""
echo "OPTION 3: Manual clear"
echo "   1. Ctrl+Shift+Delete"
echo "   2. Select 'Cached images and files'"
echo "   3. Clear"
echo "   4. Close and reopen browser"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "WHAT TO LOOK FOR:"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "A. IN CONSOLE (F12):"
echo "   ════════════════════════════════════"
echo "   🚀 DEPLOYMENT PAGE LOADED - VERSION 2.0-SOCKET-FIX"
echo "   📁 File: /dashboard/deployments/[id]/page.tsx"
echo "   ⏰ Loaded at: ..."
echo "   ════════════════════════════════════"
echo ""
echo "B. ON PAGE (top gray bar):"
echo "   v2.0-SOCKET-FIX | Status: Connected | URL: https://foodpanda.site"
echo ""
echo "C. If you DON'T see these:"
echo "   → Browser is STILL using cached code"
echo "   → Try incognito window"
echo ""
