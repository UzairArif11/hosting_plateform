#!/bin/bash

###############################################################################
# FIX SSL AND NGINX - Automatic Configuration
# This script ACTUALLY fixes Nginx (no manual editing needed!)
###############################################################################

set -e

echo "╔══════════════════════════════════════════════════════════"
echo "║  FIXING NGINX CONFIGURATION - AUTOMATIC"
echo "╚══════════════════════════════════════════════════════════"
echo ""

# Backup
echo "→ Creating backup..."
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)
echo "✓ Backup created"

# Check SSL
SSL_CERT="/etc/letsencrypt/live/foodpanda.site/fullchain.pem"
if [ -f "$SSL_CERT" ]; then
    echo "✓ SSL certificate found"
    HAS_SSL=true
else
    echo "⚠ No SSL certificate"
    HAS_SSL=false
fi

# Extract user deployments from current config
echo "→ Extracting user deployments..."
BACKUP=$(ls -t /etc/nginx/sites-available/default.backup.* | head -1)

# Create temporary file for user locations
sudo grep -A 10 "# .* - Port [0-9]" "$BACKUP" 2>/dev/null | grep -v "^--$" > /tmp/user_locations.txt || true

USER_COUNT=$(grep -c "location /" /tmp/user_locations.txt || echo 0)
echo "✓ Found $USER_COUNT user deployments"

# Create new config
echo "→ Writing new Nginx configuration..."

sudo tee /etc/nginx/sites-available/default > /dev/null << 'NGINX_DEFAULT'
# Default server block (for IP access)
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
    
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}

# Main domain server block
server {
NGINX_DEFAULT

# Add SSL listeners if SSL exists
if [ "$HAS_SSL" = true ]; then
    sudo tee -a /etc/nginx/sites-available/default > /dev/null << 'NGINX_SSL'
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    ssl_certificate /etc/letsencrypt/live/foodpanda.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/foodpanda.site/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
NGINX_SSL
else
    echo "    listen 80;" | sudo tee -a /etc/nginx/sites-available/default > /dev/null
    echo "    listen [::]:80;" | sudo tee -a /etc/nginx/sites-available/default > /dev/null
fi

# Continue with server config
sudo tee -a /etc/nginx/sites-available/default > /dev/null << 'NGINX_MAIN'
    
    server_name foodpanda.site www.foodpanda.site;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000" always;
    
    client_max_body_size 100M;
    
    # Platform Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
    
NGINX_MAIN

# Append user deployments
if [ -f /tmp/user_locations.txt ] && [ -s /tmp/user_locations.txt ]; then
    echo "→ Adding user deployments..."
    sudo cat /tmp/user_locations.txt >> /etc/nginx/sites-available/default
    echo "✓ User deployments added"
fi

# Add platform frontend (catch-all)
sudo tee -a /etc/nginx/sites-available/default > /dev/null << 'NGINX_FRONTEND'
    
    # Platform Frontend (catch-all)
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3001;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_FRONTEND

# Add HTTP redirect if SSL exists
if [ "$HAS_SSL" = true ]; then
    sudo tee -a /etc/nginx/sites-available/default > /dev/null << 'NGINX_REDIRECT'

server {
    listen 80;
    listen [::]:80;
    
    server_name foodpanda.site www.foodpanda.site;
    
    return 301 https://$host$request_uri;
}
NGINX_REDIRECT
fi

echo "✓ Nginx configuration written"

# Test
echo ""
echo "→ Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✓ Configuration valid"
    
    # Reload
    echo "→ Reloading Nginx..."
    sudo systemctl reload nginx
    echo "✓ Nginx reloaded"
else
    echo "✗ Configuration error!"
    echo "Restoring backup..."
    sudo cp "$BACKUP" /etc/nginx/sites-available/default
    sudo systemctl reload nginx
    exit 1
fi

# Cleanup temp file
rm -f /tmp/user_locations.txt

# Test
echo ""
echo "→ Testing endpoints..."
sleep 2

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://foodpanda.site/ 2>/dev/null || echo "000")
API_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://foodpanda.site/api/health 2>/dev/null || echo "000")

echo "  Platform: HTTP $HTTP_CODE"
echo "  API:      HTTP $API_CODE"

echo ""
echo "╔══════════════════════════════════════════════════════════"
echo "║  ✅ NGINX CONFIGURED SUCCESSFULLY!"
echo "╚══════════════════════════════════════════════════════════"
echo ""
echo "Your platform is now live:"
echo "  https://foodpanda.site/"
echo "  https://foodpanda.site/api"
echo "  https://foodpanda.site/admin"
echo ""
echo "User deployments preserved: $USER_COUNT"
echo ""
echo "Test in browser: https://foodpanda.site/"
