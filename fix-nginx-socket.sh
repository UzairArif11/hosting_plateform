#!/bin/bash

# Quick fix for Socket.IO path in Nginx - handles duplicates properly

NGINX_CONFIG="/etc/nginx/sites-available/default"
BACKUP_FILE="${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"

echo "🔧 Fixing Socket.IO path in Nginx..."

# Backup
sudo cp "$NGINX_CONFIG" "$BACKUP_FILE"
echo "✅ Backup created: $BACKUP_FILE"

# Remove ALL old /socket.io/ location blocks (not /api/socket.io/)
echo "🗑️  Removing old /socket.io/ location blocks..."
sudo awk '
    BEGIN { skip = 0; in_block = 0 }
    /location \/socket\.io\/ \{/ && !/location \/api\/socket\.io\/ \{/ {
        skip = 1
        in_block = 1
        next
    }
    skip && in_block && /^[[:space:]]*\}[[:space:]]*$/ {
        skip = 0
        in_block = 0
        next
    }
    !skip { print }
' "$NGINX_CONFIG" > /tmp/nginx-fixed.conf

sudo mv /tmp/nginx-fixed.conf "$NGINX_CONFIG"
sudo chmod 644 "$NGINX_CONFIG"

# Check if /api/socket.io/ exists, if not add it
if ! sudo grep -q "location /api/socket.io/" "$NGINX_CONFIG"; then
    echo "⚠️  /api/socket.io/ not found, adding it..."
    # Find the /api/ location block and add Socket.IO block before it
    sudo awk '
        /location \/api\/ \{/ {
            print "    # Socket.IO WebSocket Support"
            print "    location /api/socket.io/ {"
            print "        proxy_pass http://127.0.0.1:5000;"
            print "        proxy_http_version 1.1;"
            print "        proxy_set_header Upgrade $http_upgrade;"
            print "        proxy_set_header Connection \"upgrade\";"
            print "        proxy_set_header Host $host;"
            print "        proxy_set_header X-Real-IP $remote_addr;"
            print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
            print "        proxy_set_header X-Forwarded-Proto $scheme;"
            print "        proxy_cache_bypass $http_upgrade;"
            print "    }"
            print ""
        }
        { print }
    ' "$NGINX_CONFIG" > /tmp/nginx-with-socket.conf
    sudo mv /tmp/nginx-with-socket.conf "$NGINX_CONFIG"
    echo "✅ Added /api/socket.io/ location block"
else
    echo "✅ /api/socket.io/ location block already exists"
fi

# Ensure proxy_pass uses 127.0.0.1 in Socket.IO block
sudo sed -i '/location \/api\/socket\.io\/ {/,/^[[:space:]]*\}[[:space:]]*$/ s|proxy_pass http://localhost:5000;|proxy_pass http://127.0.0.1:5000;|g' "$NGINX_CONFIG"

# Test and reload
if sudo nginx -t; then
    echo "✅ Nginx config valid"
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded"
else
    echo "❌ Config test failed, restoring backup..."
    sudo cp "$BACKUP_FILE" "$NGINX_CONFIG"
    sudo nginx -t
    exit 1
fi

echo ""
echo "✅ Socket.IO path fixed! Now available at: https://foodpanda.site/api/socket.io/"
