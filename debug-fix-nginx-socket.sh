#!/bin/bash

###############################################################################
# DEBUG AND FIX NGINX SOCKET.IO
###############################################################################

echo "╔══════════════════════════════════════════════════════════"
echo "║  🔍 Debugging Nginx Socket.IO Configuration"
echo "╚══════════════════════════════════════════════════════════"
echo ""

echo "→ Step 1: Checking actual Nginx configuration..."
echo ""
echo "Looking for socket.io location block:"
sudo grep -n -A10 "location /socket.io" /etc/nginx/sites-available/default | head -20
echo ""

echo "→ Step 2: Checking all location blocks in order..."
sudo grep -n "location " /etc/nginx/sites-available/default | grep -v "#"
echo ""

echo "→ Step 3: Testing different Socket.IO URLs..."
echo ""
echo "Test 1: https://foodpanda.site/socket.io/?EIO=4&transport=polling"
curl -s https://foodpanda.site/socket.io/\?EIO\=4\&transport\=polling | head -c 150
echo ""
echo ""

echo "Test 2: Direct backend http://localhost:5000/socket.io/?EIO=4&transport=polling"
curl -s http://localhost:5000/socket.io/\?EIO\=4\&transport\=polling | head -c 150
echo ""
echo ""

echo "→ Step 4: Checking if location is catching..."
echo "Making request and checking Nginx access log:"
curl -s https://foodpanda.site/socket.io/\?EIO\=4\&transport\=polling > /dev/null
sudo tail -n 3 /var/log/nginx/access.log | grep socket.io
echo ""

echo "→ Step 5: Checking Nginx error log for issues..."
sudo tail -n 10 /var/log/nginx/error.log | grep -i socket || echo "No socket errors in error log"
echo ""

echo "╔══════════════════════════════════════════════════════════"
echo "║  🔧 APPLYING FIX"
echo "╚══════════════════════════════════════════════════════════"
echo ""

echo "→ Creating correct Socket.IO location block..."
echo ""

# Backup
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.debug.$(date +%s)

# Remove any existing socket.io blocks
sudo sed -i '/# WebSocket.*Socket\.IO/,/^[[:space:]]*}/d' /etc/nginx/sites-available/default

# Find the server block with https and foodpanda.site
# Add socket.io location at the very top of the location blocks

sudo awk '
/listen 443 ssl/ {https=1}
https && /server_name.*foodpanda.site/ {found_server=1}
found_server && /location/ && !socket_added {
    print "    # Socket.IO WebSocket Support"
    print "    location /socket.io/ {"
    print "        proxy_pass http://localhost:5000;"
    print "        proxy_http_version 1.1;"
    print "        proxy_set_header Upgrade $http_upgrade;"
    print "        proxy_set_header Connection \"upgrade\";"
    print "        proxy_set_header Host $host;"
    print "        proxy_set_header X-Real-IP $remote_addr;"
    print "        proxy_cache_bypass $http_upgrade;"
    print "    }"
    print ""
    socket_added=1
}
{print}
/^}$/ {https=0; found_server=0}
' /etc/nginx/sites-available/default > /tmp/nginx-fixed.conf

sudo mv /tmp/nginx-fixed.conf /etc/nginx/sites-available/default

echo "✅ Socket.IO location added"
echo ""

echo "→ Testing configuration..."
if sudo nginx -t 2>&1; then
    echo ""
    echo "✅ Config valid"
    echo ""
    echo "→ RESTARTING Nginx (not just reload)..."
    sudo systemctl restart nginx
    sleep 2
    echo "✅ Nginx restarted"
else
    echo "❌ Config error, restoring backup"
    sudo cp /etc/nginx/sites-available/default.backup.debug.* /etc/nginx/sites-available/default 2>/dev/null | tail -1
    sudo systemctl reload nginx
    exit 1
fi

echo ""
echo "→ Final test..."
sleep 1
RESULT=$(curl -s https://foodpanda.site/socket.io/\?EIO\=4\&transport\=polling)

if echo "$RESULT" | grep -q 'sid'; then
    echo "✅✅✅ SUCCESS! Socket.IO is working!"
    echo ""
    echo "Response:"
    echo "$RESULT"
else
    echo "❌ Still not working:"
    echo "$RESULT"
    echo ""
    echo "Showing current socket.io location:"
    sudo grep -A10 "location /socket.io" /etc/nginx/sites-available/default
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "If working, test in browser:"
echo "1. Go to: https://foodpanda.site/dashboard/deployments/{id}"
echo "2. Open Console (F12)"
echo "3. You should see: '✅ Connected to deployment logs'"
echo "═══════════════════════════════════════════════════════════"
