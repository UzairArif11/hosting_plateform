#!/bin/bash

# Quick fix for Socket.IO path in Nginx - handles duplicates

NGINX_CONFIG="/etc/nginx/sites-available/default"
BACKUP_FILE="${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"

echo "🔧 Fixing Socket.IO path in Nginx..."

# Backup
sudo cp "$NGINX_CONFIG" "$BACKUP_FILE"
echo "✅ Backup created: $BACKUP_FILE"

# Check if /api/socket.io/ already exists
if sudo grep -q "location /api/socket.io/" "$NGINX_CONFIG"; then
    echo "⚠️  /api/socket.io/ already exists, removing old /socket.io/ block..."
    # Remove the old /socket.io/ location block (from location line to closing brace)
    sudo awk '
        /location \/socket\.io\/ \{/ { skip=1; next }
        skip && /^[[:space:]]*\}[[:space:]]*$/ { skip=0; next }
        !skip { print }
    ' "$NGINX_CONFIG" > /tmp/nginx-fixed.conf
    sudo mv /tmp/nginx-fixed.conf "$NGINX_CONFIG"
    sudo chmod 644 "$NGINX_CONFIG"
    echo "✅ Removed old /socket.io/ location block"
else
    # Change /socket.io/ to /api/socket.io/
    sudo sed -i 's|location /socket.io/ {|location /api/socket.io/ {|g' "$NGINX_CONFIG"
    echo "✅ Socket.IO path updated to /api/socket.io/"
fi

# Fix proxy_pass to use 127.0.0.1 in Socket.IO block
sudo sed -i '/location \/api\/socket\.io\/ {/,/^[[:space:]]*\}[[:space:]]*$/ s|proxy_pass http://localhost:5000;|proxy_pass http://127.0.0.1:5000;|g' "$NGINX_CONFIG"

# Test and reload
if sudo nginx -t; then
    echo "✅ Nginx config valid"
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded"
else
    echo "❌ Config test failed, restoring backup..."
    sudo cp "$BACKUP_FILE" "$NGINX_CONFIG"
    exit 1
fi

echo ""
echo "✅ Socket.IO path fixed! Now available at: https://foodpanda.site/api/socket.io/"
