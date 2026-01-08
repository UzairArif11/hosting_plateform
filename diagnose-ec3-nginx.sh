#!/bin/bash

###############################################################################
# MANUAL EC3 NGINX FIX
# Checks EC3 Nginx config and provides manual fix instructions
###############################################################################

echo "╔══════════════════════════════════════════════════════════"
echo "║  Diagnosing EC3 Nginx Configuration"
echo "╚══════════════════════════════════════════════════════════"
echo ""

EC3_HOST="129.154.255.90"
SSH_KEY="/home/ubuntu/.ssh/ec3_key"
SSH_USER="ubuntu"

echo "→ Checking EC3 Nginx config for errors..."
echo ""

ssh -i $SSH_KEY $SSH_USER@$EC3_HOST << 'EOF'
    echo "1️⃣  Testing current Nginx config..."
    sudo nginx -t 2>&1
    echo ""
    
    echo "2️⃣  Checking for ec3.foodpanda.site block..."
    if sudo grep -q "ec3.foodpanda.site" /etc/nginx/sites-available/default 2>/dev/null; then
        echo "✅ ec3.foodpanda.site block found"
    else
        echo "❌ ec3.foodpanda.site block NOT found"
    fi
    echo ""
    
    echo "3️⃣  Checking existing server blocks..."
    sudo grep -n "server_name" /etc/nginx/sites-available/default | head -10
    echo ""
    
    echo "4️⃣  Checking for foodpanda.site block..."
    sudo grep -A2 "server_name.*foodpanda.site" /etc/nginx/sites-available/default | head -20
    echo ""
    
    echo "5️⃣  Checking SSL certificate..."
    if [ -f /etc/letsencrypt/live/foodpanda.site/fullchain.pem ]; then
        echo "✅ SSL certificate exists"
    else
        echo "⚠️  SSL certificate not found at standard location"
        echo "   Checking alternatives..."
        sudo find /etc/letsencrypt/live -name "fullchain.pem" 2>/dev/null
    fi
EOF

echo ""
echo "╔══════════════════════════════════════════════════════════"
echo "║  📋 MANUAL FIX INSTRUCTIONS"
echo "╚══════════════════════════════════════════════════════════"
echo ""
echo "Based on the diagnosis above, here's what to do:"
echo ""
echo "OPTION 1: If foodpanda.site block exists on EC3:"
echo "─────────────────────────────────────────────────────"
echo "The router will fallback to foodpanda.site block."
echo "This is ACCEPTABLE - deployments will work at:"
echo "  https://foodpanda.site/projectname-{id}/"
echo ""
echo "No action needed! Just deploy and it will work."
echo ""
echo "OPTION 2: Add ec3.foodpanda.site block manually:"
echo "─────────────────────────────────────────────────────"
echo "1. SSH to EC3:"
echo "   ssh -i ~/.ssh/ec3_key ubuntu@129.154.255.90"
echo ""
echo "2. Edit Nginx config:"
echo "   sudo nano /etc/nginx/sites-available/default"
echo ""
echo "3. Add this server block at the end (before the last }):"
echo ""
cat << 'NGINXBLOCK'
# EC3 Subdomain
server {
    listen 443 ssl http2;
    server_name ec3.foodpanda.site;
    
    ssl_certificate /etc/letsencrypt/live/foodpanda.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/foodpanda.site/privkey.pem;
    
    location / {
        return 200 'EC3 Server';
        add_header Content-Type text/plain;
    }
}
NGINXBLOCK
echo ""
echo "4. Test config:"
echo "   sudo nginx -t"
echo ""
echo "5. If successful, reload:"
echo "   sudo systemctl reload nginx"
echo ""
