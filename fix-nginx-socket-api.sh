#!/bin/bash

###############################################################################
# FIX NGINX SOCKET.IO FOR /api BACKEND SETUP
# Adds Socket.IO proxy alongside existing /api proxy
###############################################################################

echo "╔══════════════════════════════════════════════════════════"
echo "║  🔧 Fixing Nginx Socket.IO (with /api backend)"
echo "╚══════════════════════════════════════════════════════════"
echo ""

echo "→ Step 1: Verifying current Nginx setup..."
echo ""
echo "Checking /api location:"
if sudo grep -A5 "location /api" /etc/nginx/sites-available/default | head -10; then
    echo ""
    echo "✅ /api backend proxy found"
else
    echo "❌ No /api location found - please check Nginx config"
    exit 1
fi

echo ""
echo "→ Step 2: Backing up Nginx config..."
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%s)
echo "✅ Backup created"

echo ""
echo "→ Step 3: Adding Socket.IO location (right after /api location)..."

# Add socket.io location right after the /api location block
sudo tee /tmp/socket-io-block.conf > /dev/null << 'SOCKETBLOCK'

    # WebSocket/Socket.IO Support (Backend)
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
SOCKETBLOCK

# Insert the socket.io block right after the /api location block closes
sudo awk '
/location \/api/ {
    in_api_block = 1
}
in_api_block && /^[[:space:]]*}[[:space:]]*$/ && !socket_added {
    print
    while ((getline line < "/tmp/socket-io-block.conf") > 0) {
        print line
    }
    close("/tmp/socket-io-block.conf")
    socket_added = 1
    in_api_block = 0
    next
}
{print}
' /etc/nginx/sites-available/default > /tmp/nginx-new.conf

sudo mv /tmp/nginx-new.conf /etc/nginx/sites-available/default

echo "✅ Socket.IO location added after /api"

echo ""
echo "→ Step 4: Testing Nginx configuration..."
if sudo nginx -t 2>&1; then
    echo ""
    echo "✅ Nginx config valid"
    
    echo ""
    echo "→ Step 5: Reloading Nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded"
    
    echo ""
    echo "→ Step 6: Testing Socket.IO endpoint..."
    sleep 2
    
    echo "Testing HTTP endpoint..."
    RESPONSE=$(curl -s https://foodpanda.site/socket.io/\?EIO\=4\&transport\=polling)
    
    if echo "$RESPONSE" | grep -q 'sid'; then
        echo "✅ Socket.IO endpoint is working!"
        echo ""
        echo "Response preview:"
        echo "$RESPONSE" | head -c 200
        echo "..."
    else
        echo "Response received:"
        echo "$RESPONSE"
        echo ""
        echo "⚠️  Testing backend directly..."
        curl -s http://localhost:5000/socket.io/\?EIO\=4\&transport\=polling | head -c 200
    fi
    
else
    echo ""
    echo "❌ Nginx configuration error!"
    echo ""
    echo "Restoring backup..."
    sudo cp /etc/nginx/sites-available/default.backup.* /etc/nginx/sites-available/default 2>/dev/null | tail -1
    sudo systemctl reload nginx
    echo "✅ Backup restored"
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════"
echo "║  📋 FINAL VERIFICATION"
echo "╚══════════════════════════════════════════════════════════"
echo ""
echo "Your Nginx routing should now be:"
echo "   / → Frontend (port 3001)"
echo "   /api → Backend (port 5000)"
echo "   /socket.io → Backend (port 5000) with WebSocket"
echo ""
echo "Test in browser:"
echo "1. Go to: https://foodpanda.site/dashboard/deployments/{id}"
echo "2. Open Console (F12)"
echo "3. Look for: '✅ Connected to deployment logs'"
echo ""
echo "If working, start a deployment and watch real-time updates!"
echo ""
