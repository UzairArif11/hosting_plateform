#!/bin/bash

###############################################################################
# FIX NGINX SOCKET.IO PROXY
# Correctly configures Nginx to proxy Socket.IO requests
###############################################################################

echo "╔══════════════════════════════════════════════════════════"
echo "║  🔧 Fixing Nginx Socket.IO Proxy"
echo "╚══════════════════════════════════════════════════════════"
echo ""

echo "→ Step 1: Checking current Nginx configuration..."
if sudo grep -q "location /socket.io/" /etc/nginx/sites-available/default; then
    echo "✅ Socket.IO location block exists"
    echo ""
    echo "Current configuration:"
    sudo grep -A8 "location /socket.io/" /etc/nginx/sites-available/default
else
    echo "❌ No Socket.IO location block found"
fi

echo ""
echo "→ Step 2: Backing up Nginx config..."
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.socket-$(date +%s)
echo "✅ Backup created"

echo ""
echo "→ Step 3: Finding the correct server block..."
# We need to add the socket.io location to the HTTPS server block for foodpanda.site

# Create a temporary fix script
cat > /tmp/fix-nginx-socket.sh << 'FIXSCRIPT'
#!/bin/bash

# Read the current config
CONFIG_FILE="/etc/nginx/sites-available/default"

# Check if socket.io location exists
if grep -q "location /socket.io/" "$CONFIG_FILE"; then
    echo "Removing old socket.io location..."
    # Remove the old socket.io block (it might be in the wrong place)
    sed -i '/# WebSocket support for Socket.IO/,/^[[:space:]]*}/d' "$CONFIG_FILE"
fi

# Find the HTTPS server block for foodpanda.site and add socket.io location BEFORE the api location
# We'll add it right after the server_name foodpanda.site line

# Create the socket.io location block
SOCKET_LOCATION='
    # WebSocket/Socket.IO Support
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
    }'

# Find the line number of "listen 443 ssl" in the foodpanda.site block
# Then find the next "location" directive and insert our socket.io location before it

awk -v socket_loc="$SOCKET_LOCATION" '
/listen 443 ssl.*foodpanda.site/ {
    in_https_block = 1
    print
    next
}
in_https_block && /location \// && !socket_added {
    print socket_loc
    socket_added = 1
}
{print}
' "$CONFIG_FILE" > "$CONFIG_FILE.new"

mv "$CONFIG_FILE.new" "$CONFIG_FILE"
echo "✅ Socket.IO location added"
FIXSCRIPT

chmod +x /tmp/fix-nginx-socket.sh
sudo /tmp/fix-nginx-socket.sh

echo ""
echo "→ Step 4: Testing Nginx configuration..."
if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo "✅ Nginx config valid"
    
    echo ""
    echo "→ Step 5: Reloading Nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded"
    
    echo ""
    echo "→ Step 6: Testing Socket.IO endpoint..."
    sleep 2
    RESPONSE=$(curl -s https://foodpanda.site/socket.io/\?EIO\=4\&transport\=polling)
    
    if echo "$RESPONSE" | grep -q '"sid"'; then
        echo "✅ Socket.IO is working!"
        echo "Response preview:"
        echo "$RESPONSE" | head -c 150
        echo "..."
    else
        echo "⚠️  Response:"
        echo "$RESPONSE" | head -c 200
    fi
    
else
    echo "❌ Nginx configuration error:"
    sudo nginx -t 2>&1
    echo ""
    echo "Restoring backup..."
    sudo cp /etc/nginx/sites-available/default.backup.socket-* /etc/nginx/sites-available/default
    echo "✅ Backup restored"
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════"
echo "║  ✅ FIX COMPLETE"
echo "╚══════════════════════════════════════════════════════════"
echo ""
echo "Now test in browser:"
echo "1. Open: https://foodpanda.site/dashboard/deployments/{id}"
echo "2. Open Console (F12)"
echo "3. You should see: '✅ Connected to deployment logs'"
echo ""
