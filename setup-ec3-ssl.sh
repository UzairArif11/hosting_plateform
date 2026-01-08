#!/bin/bash

###############################################################################
# REVERT TO EC3.FOODPANDA.SITE & SETUP SSL
# This configures ec3.foodpanda.site with proper SSL certificate
###############################################################################

echo "╔══════════════════════════════════════════════════════════"
echo "║  🔧 Setting up ec3.foodpanda.site with SSL"
echo "╚══════════════════════════════════════════════════════════"
echo ""

# 1. Revert database to use ec3.foodpanda.site
echo "→ Step 1: Updating database to use ec3.foodpanda.site..."
cd ~/hosting_plateform/backend
node -e "const m=require('mongoose');require('dotenv').config();const S=require('./models/Settings');m.connect(process.env.MONGODB_URI).then(async()=>{await S.updateOne({},{\$set:{'serverDomains.EC3':'ec3.foodpanda.site'}});console.log('✅ EC3 domain set to ec3.foodpanda.site');process.exit(0);});"

echo ""
echo "→ Step 2: Checking DNS for ec3.foodpanda.site..."
nslookup ec3.foodpanda.site | grep Address || echo "⚠️  DNS not configured"

echo ""
echo "→ Step 3: Setting up SSL certificate on EC3..."
echo ""

EC3_HOST="129.154.255.90"
SSH_KEY="/home/ubuntu/.ssh/ec3_key"
SSH_USER="ubuntu"

ssh -i $SSH_KEY $SSH_USER@$EC3_HOST << 'EOF'
    echo "📋 Current SSL certificates:"
    sudo ls -la /etc/letsencrypt/live/ 2>/dev/null || echo "⚠️  No certificates found"
    echo ""
    
    # Check if wildcard cert exists
    if [ -d "/etc/letsencrypt/live/foodpanda.site" ]; then
        echo "✅ Wildcard certificate for foodpanda.site found!"
        echo "   This covers *.foodpanda.site (including ec3.foodpanda.site)"
        echo ""
        
        # Check if it's actually a wildcard
        sudo openssl x509 -in /etc/letsencrypt/live/foodpanda.site/fullchain.pem -text -noout | grep -A1 "Subject Alternative Name" | grep "*.foodpanda.site" && echo "✅ Certificate IS wildcard" || echo "⚠️  Certificate NOT wildcard"
        echo ""
        
        echo "→ Adding ec3.foodpanda.site server block to Nginx..."
        
        # Check if block already exists
        if sudo grep -q "ec3.foodpanda.site" /etc/nginx/sites-available/default; then
            echo "✅ ec3.foodpanda.site block already exists"
        else
            echo "→ Creating ec3.foodpanda.site server block..."
            
            sudo tee -a /etc/nginx/sites-available/default > /dev/null << 'NGINXBLOCK'

# EC3 Subdomain - User Deployments
server {
    listen 80;
    listen [::]:80;
    server_name ec3.foodpanda.site;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ec3.foodpanda.site;

    ssl_certificate /etc/letsencrypt/live/foodpanda.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/foodpanda.site/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Root location
    location / {
        return 200 'EC3 Server - User Deployments Active';
        add_header Content-Type text/plain;
    }

    # User deployment locations will be added here dynamically
}
NGINXBLOCK
            
            echo "✅ Server block added"
        fi
        
        echo ""
        echo "→ Testing Nginx configuration..."
        if sudo nginx -t 2>&1 | grep -q "successful"; then
            echo "✅ Nginx config valid"
            
            echo "→ Reloading Nginx..."
            sudo systemctl reload nginx
            echo "✅ Nginx reloaded"
            
            echo ""
            echo "╔══════════════════════════════════════════════════════════"
            echo "║  ✅ SUCCESS!"
            echo "╚══════════════════════════════════════════════════════════"
            echo ""
            echo "ec3.foodpanda.site is now configured with SSL!"
            echo ""
            
        else
            echo "❌ Nginx config has errors:"
            sudo nginx -t 2>&1
        fi
        
    else
        echo "⚠️  No SSL certificate found for foodpanda.site"
        echo ""
        echo "You need to either:"
        echo "  1. Get a wildcard certificate: sudo certbot certonly --nginx -d '*.foodpanda.site'"
        echo "  2. Get specific certificate: sudo certbot certonly --nginx -d ec3.foodpanda.site"
    fi
EOF

echo ""
echo "╔══════════════════════════════════════════════════════════"
echo "║  📋 FINAL STEPS"
echo "╚══════════════════════════════════════════════════════════"
echo ""
echo "1. Verify DNS points to EC3:"
echo "   - ec3.foodpanda.site → 129.154.255.90"
echo ""
echo "2. Test SSL:"
echo "   curl -I https://ec3.foodpanda.site"
echo ""
echo "3. Redeploy your project - it will use ec3.foodpanda.site"
echo ""
