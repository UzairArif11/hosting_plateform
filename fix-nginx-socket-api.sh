#!/bin/bash

# Fix Nginx Socket.IO configuration to use /api/socket.io/ path

NGINX_CONFIG="/etc/nginx/sites-available/default"
BACKUP_FILE="/etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)"

echo "🔧 Fixing Nginx Socket.IO configuration..."

# Backup current config
sudo cp "$NGINX_CONFIG" "$BACKUP_FILE"
echo "✅ Backup created: $BACKUP_FILE"

# Fix Socket.IO location block
sudo sed -i 's|location /socket.io/ {|location /api/socket.io/ {|g' "$NGINX_CONFIG"

# Ensure Socket.IO proxies correctly
sudo sed -i '/location \/api\/socket.io\/ {/,/}/ {
    s|proxy_pass http://localhost:5000;|proxy_pass http://127.0.0.1:5000;|
}' "$NGINX_CONFIG"

echo "✅ Updated Socket.IO location to /api/socket.io/"

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
    echo "🔄 Reloading Nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded successfully"
else
    echo "❌ Nginx configuration test failed!"
    echo "📋 Restoring backup..."
    sudo cp "$BACKUP_FILE" "$NGINX_CONFIG"
    exit 1
fi

echo ""
echo "✅ Socket.IO configuration fixed!"
echo "📍 Socket.IO now available at: https://foodpanda.site/api/socket.io/"
