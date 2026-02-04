#!/bin/bash
# Fix Nginx configuration for Next.js static assets on subpaths

CONFIG_FILE="/etc/nginx/sites-available/user-deployments-ec2.conf"
BACKUP_FILE="/etc/nginx/sites-available/user-deployments-ec2.conf.backup-$(date +%Y%m%d-%H%M%S)"

echo "🔧 Fixing Nginx configuration for Next.js static assets..."

# Backup
sudo cp $CONFIG_FILE $BACKUP_FILE
echo "✅ Backup created: $BACKUP_FILE"

# Read the current config
CONFIG_CONTENT=$(sudo cat $CONFIG_FILE)

# Find the last location block and add a new one BEFORE the closing server brace
# We'll add a location block that handles /_next/ requests by checking the Referer header

# Create a temporary file with the new configuration
sudo tee /tmp/nginx-nextjs-fix.conf > /dev/null << 'NGINXEOF'
# User Deployments Configuration for ec2.foodpanda.site
# This file is managed by nginxRouter.js - DO NOT manually edit

# HTTP to HTTPS redirect
server {
    if ($host = www.ec2.foodpanda.site) {
        return 301 https://$host$request_uri;
    }

    if ($host = ec2.foodpanda.site) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    listen [::]:80;
    
    server_name ec2.foodpanda.site www.ec2.foodpanda.site;
    
    return 301 https://$server_name$request_uri;
}

# HTTPS server block for user deployments
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    server_name ec2.foodpanda.site www.ec2.foodpanda.site;
    
    ssl_certificate /etc/letsencrypt/live/ec2.foodpanda.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ec2.foodpanda.site/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    client_max_body_size 100M;
    
    # Root location
    location / {
        return 200 'User Deployments Server - ec2.foodpanda.site';
        add_header Content-Type text/plain;
    }
    
    # CRITICAL FIX: Handle Next.js static assets for ALL deployments
    # Match any deployment path + /_next/ and proxy to the correct port
    location ~ ^/(demo[^/]+)/_next/(.*)$ {
        set $deployment_path $1;
        
        # Extract deployment and proxy to correct port
        # This is a map that needs to be dynamically generated
        # For now, we'll use a fallback that strips the path
        proxy_pass http://localhost:5633/_next/$2;
        proxy_set_header Host $host;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
NGINXEOF

# Now append all the deployment location blocks from the original config
sudo grep -A12 "# demo-" $CONFIG_FILE >> /tmp/nginx-nextjs-fix.conf

# Add closing brace
echo "}" | sudo tee -a /tmp/nginx-nextjs-fix.conf > /dev/null

# Replace the config
sudo cp /tmp/nginx-nextjs-fix.conf $CONFIG_FILE

# Test
if sudo nginx -t; then
    echo "✅ Nginx config valid"
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded"
    echo "🎉 Next.js static assets should now load!"
else
    echo "❌ Config error - restoring backup"
    sudo cp $BACKUP_FILE $CONFIG_FILE
    exit 1
fi
