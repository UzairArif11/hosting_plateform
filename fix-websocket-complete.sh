#!/bin/bash

###############################################################################
# COMPLETE WEBSOCKET FIX
# Fixes Nginx proxy, frontend config, and WebSocket connection
###############################################################################

echo "╔══════════════════════════════════════════════════════════"
echo "║  🔧 Complete WebSocket Fix"
echo "╚══════════════════════════════════════════════════════════"
echo ""

cd ~/hosting_plateform

# Step 1: Check if Socket.IO endpoint is accessible
echo "→ Step 1: Testing Socket.IO endpoint..."
SOCKET_TEST=$(curl -s -o /dev/null -w "%{http_code}" https://foodpanda.site/socket.io/\?EIO\=4\&transport\=polling)

if [ "$SOCKET_TEST" = "200" ]; then
    echo "✅ Socket.IO endpoint accessible"
else
    echo "❌ Socket.IO endpoint not accessible (HTTP $SOCKET_TEST)"
    echo "   Need to configure Nginx proxy for WebSocket"
    echo ""
    echo "→ Adding Socket.IO proxy to Nginx..."
    
    # SSH to main server and update Nginx
    sudo bash << 'NGINXFIX'
        # Check if socket.io location already exists
        if grep -q "location /socket.io/" /etc/nginx/sites-available/default; then
            echo "✅ Socket.IO location already configured"
        else
            echo "→ Adding Socket.IO location to Nginx..."
            
            # Find the main server block and add socket.io location
            sed -i '/server_name foodpanda.site;/a\
    \
    # WebSocket support for Socket.IO\
    location /socket.io/ {\
        proxy_pass http://localhost:5000;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection "upgrade";\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_cache_bypass $http_upgrade;\
    }' /etc/nginx/sites-available/default
            
            echo "✅ Socket.IO location added"
        fi
        
        # Test and reload
        if nginx -t 2>&1 | grep -q "successful"; then
            systemctl reload nginx
            echo "✅ Nginx reloaded"
        else
            echo "❌ Nginx config error"
            nginx -t
            exit 1
        fi
NGINXFIX
fi

echo ""
echo "→ Step 2: Checking frontend environment..."

# Create proper frontend env
cat > frontend/.env.production << 'EOF'
NEXT_PUBLIC_API_URL=https://foodpanda.site
NEXT_PUBLIC_SOCKET_URL=https://foodpanda.site
NODE_ENV=production
EOF

echo "✅ Frontend .env.production updated"

# Also create .env.local for development testing
cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://foodpanda.site
NEXT_PUBLIC_SOCKET_URL=https://foodpanda.site
EOF

echo "✅ Frontend .env.local created"

echo ""
echo "→ Step 3: Rebuilding frontend..."
cd frontend
npm run build
cd ..

echo ""
echo "→ Step 4: Restarting services..."
pm2 restart all

echo ""
echo "→ Step 5: Waiting for services to stabilize..."
sleep 3

echo ""
echo "→ Step 6: Testing Socket.IO connection..."
FINAL_TEST=$(curl -s https://foodpanda.site/socket.io/\?EIO\=4\&transport\=polling)

if echo "$FINAL_TEST" | grep -q "sid"; then
    echo "✅ Socket.IO is responding!"
    echo "   Response: ${FINAL_TEST:0:100}..."
else
    echo "⚠️  Socket.IO response unexpected:"
    echo "   $FINAL_TEST"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════"
echo "║  📋 VERIFICATION STEPS"
echo "╚══════════════════════════════════════════════════════════"
echo ""
echo "1. Open browser: https://foodpanda.site"
echo "2. Open DevTools (F12) → Console tab"
echo "3. Start a new deployment"
echo "4. Look for:"
echo "   ✅ 'Connected to deployment logs'"
echo "   ✅ 'WebSocket client connected'"
echo ""
echo "If you see those messages, WebSocket is working!"
echo ""
echo "If NOT, check backend logs:"
echo "   pm2 logs backend --lines 50 | grep WebSocket"
echo ""
