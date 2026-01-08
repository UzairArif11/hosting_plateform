#!/bin/bash

###############################################################################
# SETUP EC3 NGINX SERVER BLOCK
# Creates ec3.foodpanda.site server block on EC3 server
###############################################################################

echo "╔══════════════════════════════════════════════════════════"
echo "║  Setting up ec3.foodpanda.site Nginx configuration"
echo "╚══════════════════════════════════════════════════════════"
echo ""

# SSH connection details
EC3_HOST="129.154.255.90"
SSH_KEY="/home/ubuntu/.ssh/ec3_key"
SSH_USER="ubuntu"

echo "→ Connecting to EC3 server..."
ssh -i $SSH_KEY $SSH_USER@$EC3_HOST << 'EOF'
    echo "→ Checking current Nginx configuration..."
    
    # Check if ec3.foodpanda.site block exists
    if sudo grep -q "ec3.foodpanda.site" /etc/nginx/sites-available/default; then
        echo "✅ ec3.foodpanda.site server block already exists"
        exit 0
    fi
    
    echo "→ Creating ec3.foodpanda.site server block..."
    
    # Create backup
    sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%s)
    
    # Add new server block for ec3.foodpanda.site
    sudo tee -a /etc/nginx/sites-available/default > /dev/null << 'NGINXCONF'

# EC3 Subdomain Server Block
server {
    listen 80;
    listen [::]:80;
    server_name ec3.foodpanda.site www.ec3.foodpanda.site;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ec3.foodpanda.site www.ec3.foodpanda.site;

    # SSL Configuration (using Let's Encrypt wildcard cert)
    ssl_certificate /etc/letsencrypt/live/foodpanda.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/foodpanda.site/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Root location (health check)
    location / {
        return 200 'EC3 Server - User Deployments';
        add_header Content-Type text/plain;
    }

    # User deployment locations will be added here dynamically
    # Format: location /projectname-{id}/ { proxy_pass http://localhost:{port}/; }
}
NGINXCONF

    echo "→ Testing Nginx configuration..."
    if sudo nginx -t 2>&1 | grep -q "successful"; then
        echo "✅ Nginx configuration valid"
        
        echo "→ Reloading Nginx..."
        sudo systemctl reload nginx
        echo "✅ Nginx reloaded successfully"
        
        echo ""
        echo "✅ ec3.foodpanda.site server block created!"
        echo ""
        echo "📋 Configuration Details:"
        echo "   - Domain: ec3.foodpanda.site"
        echo "   - SSL: Using foodpanda.site wildcard certificate"
        echo "   - Purpose: User deployment routing"
        echo ""
    else
        echo "❌ Nginx configuration test failed!"
        echo "→ Rolling back..."
        sudo mv /etc/nginx/sites-available/default.backup.* /etc/nginx/sites-available/default
        echo "✅ Rolled back to previous configuration"
        exit 1
    fi
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "╔══════════════════════════════════════════════════════════"
    echo "║  ✅ EC3 Nginx Setup Complete!"
    echo "╚══════════════════════════════════════════════════════════"
    echo ""
    echo "Next steps:"
    echo "  1. Deploy a project via UI"
    echo "  2. It will be deployed on EC3"
    echo "  3. URL will be: https://ec3.foodpanda.site/{project}-{id}/"
    echo ""
else
    echo ""
    echo "╔══════════════════════════════════════════════════════════"
    echo "║  ❌ EC3 Nginx Setup Failed"
    echo "╚══════════════════════════════════════════════════════════"
    echo ""
    echo "Please check the errors above and try again."
    echo ""
    exit 1
fi
