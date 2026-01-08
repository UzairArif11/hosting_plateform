#!/bin/bash

###############################################################################
# COMPLETE FIX: EC3 SSL + Database Update
###############################################################################

echo "╔══════════════════════════════════════════════════════════"
echo "║  🔧 Configuring EC3 with SSL Certificate"
echo "╚══════════════════════════════════════════════════════════"
echo ""

# Step 1: Update database to use ec3.foodpanda.site
echo "→ Step 1: Updating database..."
cd ~/hosting_plateform/backend
node -e "const m=require('mongoose');require('dotenv').config();const S=require('./models/Settings');m.connect(process.env.MONGODB_URI).then(async()=>{await S.updateOne({},{\$set:{'serverDomains.EC3':'ec3.foodpanda.site'}});console.log('✅ Database updated: EC3 = ec3.foodpanda.site');process.exit(0);});"

echo ""
echo "→ Step 2: Adding ec3.foodpanda.site server block to EC3 Nginx..."

EC3_HOST="129.154.255.90"
SSH_KEY="/home/ubuntu/.ssh/ec3_key"
SSH_USER="ubuntu"

ssh -i $SSH_KEY $SSH_USER@$EC3_HOST << 'SSHEOF'
    # Check if block already exists
    if sudo grep -q "server_name ec3.foodpanda.site" /etc/nginx/sites-available/default; then
        echo "✅ ec3.foodpanda.site block already exists"
    else
        echo "→ Adding ec3.foodpanda.site server block..."
        
        sudo tee -a /etc/nginx/sites-available/default > /dev/null << 'NGINXBLOCK'

# EC3 Subdomain - User Deployments
server {
    listen 80;
    server_name ec3.foodpanda.site;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ec3.foodpanda.site;

    ssl_certificate /etc/letsencrypt/live/ec3.foodpanda.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ec3.foodpanda.site/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        return 200 'EC3 Server - User Deployments Active';
        add_header Content-Type text/plain;
    }
}
NGINXBLOCK
        
        echo "✅ Server block added"
    fi
    
    echo ""
    echo "→ Testing Nginx configuration..."
    if sudo nginx -t 2>&1 | grep -q "successful"; then
        echo "✅ Nginx config valid"
        sudo systemctl reload nginx
        echo "✅ Nginx reloaded"
    else
        echo "❌ Nginx config error:"
        sudo nginx -t 2>&1
        exit 1
    fi
SSHEOF

if [ $? -eq 0 ]; then
    echo ""
    echo "╔══════════════════════════════════════════════════════════"
    echo "║  ✅ EC3 SSL CONFIGURED!"
    echo "╚══════════════════════════════════════════════════════════"
    echo ""
    echo "📋 Next deployment will use:"
    echo "   https://ec3.foodpanda.site/project-{id}/"
    echo ""
    echo "🧪 Test now:"
    echo "   curl -I https://ec3.foodpanda.site"
    echo ""
else
    echo "❌ Setup failed"
    exit 1
fi
