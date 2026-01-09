#!/bin/bash

# Quick fix for Socket.IO path in Nginx

NGINX_CONFIG="/etc/nginx/sites-available/default"
BACKUP_FILE="${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"

echo "🔧 Fixing Socket.IO path in Nginx..."

# Backup
sudo cp "$NGINX_CONFIG" "$BACKUP_FILE"
echo "✅ Backup created: $BACKUP_FILE"

# Fix Socket.IO path
sudo sed -i 's|location /socket.io/ {|location /api/socket.io/ {|g' "$NGINX_CONFIG"
sudo sed -i 's|proxy_pass http://localhost:5000;|proxy_pass http://127.0.0.1:5000;|g' "$NGINX_CONFIG"

echo "✅ Socket.IO path updated to /api/socket.io/"

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

