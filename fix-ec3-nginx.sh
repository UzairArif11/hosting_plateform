#!/bin/bash

###############################################################################
# FIX EC3 NGINX CONFIGURATION
# Removes corrupted location blocks and sets up clean configuration
###############################################################################

echo "╔══════════════════════════════════════════════════════════"
echo "║  🔧 Fixing EC3 Nginx Configuration"
echo "╚══════════════════════════════════════════════════════════"
echo ""

EC3_HOST="129.154.255.90"
SSH_KEY="/home/ubuntu/.ssh/ec3_key"
SSH_USER="ubuntu"

echo "→ Step 1: Backing up current Nginx config..."
ssh -i $SSH_KEY $SSH_USER@$EC3_HOST << 'EOF'
    sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%s)
    echo "✅ Backup created"
EOF

echo ""
echo "→ Step 2: Analyzing current configuration..."
ssh -i $SSH_KEY $SSH_USER@$EC3_HOST << 'EOF'
    echo "Current Nginx config issues:"
    sudo nginx -t 2>&1 || true
    echo ""
    
    echo "Searching for problematic location blocks..."
    sudo grep -n "location.*695" /etc/nginx/sites-available/default || echo "No deployment locations found"
EOF

echo ""
echo "→ Step 3: Removing corrupted deployment location blocks..."
ssh -i $SSH_KEY $SSH_USER@$EC3_HOST << 'EOF'
    # Remove all deployment location blocks (they start with # projectname - Port)
    # This preserves the main server blocks but removes user deployments
    
    sudo cp /etc/nginx/sites-available/default /tmp/nginx-clean.conf
    
    # Use awk to remove deployment blocks
    awk '
    BEGIN { skip = 0 }
    /^[[:space:]]*# .* - Port [0-9]+ - 695/ { skip = 1; next }
    /^[[:space:]]*location.*695.*{/ { skip = 1 }
    skip == 1 && /^[[:space:]]*}[[:space:]]*$/ { skip = 0; next }
    skip == 0 { print }
    ' /tmp/nginx-clean.conf | sudo tee /etc/nginx/sites-available/default > /dev/null
    
    echo "✅ Removed deployment location blocks"
EOF

echo ""
echo "→ Step 4: Testing cleaned configuration..."
ssh -i $SSH_KEY $SSH_USER@$EC3_HOST << 'EOF'
    if sudo nginx -t 2>&1 | grep -q "successful"; then
        echo "✅ Nginx configuration is now valid!"
        
        echo ""
        echo "→ Step 5: Reloading Nginx..."
        sudo systemctl reload nginx
        echo "✅ Nginx reloaded successfully"
        
        echo ""
        echo "✅ EC3 Nginx configuration cleaned!"
        echo ""
        echo "📋 Summary:"
        echo "   - Removed corrupted location blocks"
        echo "   - Nginx config is now valid"
        echo "   - Ready for new deployments"
        echo ""
        
    else
        echo "❌ Configuration still has errors!"
        echo ""
        echo "Restoring backup..."
        sudo cp /etc/nginx/sites-available/default.backup.* /etc/nginx/sites-available/default 2>/dev/null || true
        echo ""
        echo "Please check the issues above."
        exit 1
    fi
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "╔══════════════════════════════════════════════════════════"
    echo "║  ✅ EC3 Nginx Fixed!"
    echo "╚══════════════════════════════════════════════════════════"
    echo ""
    echo "Next steps:"
    echo "  1. Deploy your project again via UI"
    echo "  2. Nginx will now work correctly"
    echo "  3. Your site will be live!"
    echo ""
else
    echo ""
    echo "╔══════════════════════════════════════════════════════════"
    echo "║  ⚠️  Manual Intervention Needed"
    echo "╚══════════════════════════════════════════════════════════"
    echo ""
    echo "SSH to EC3 and manually review Nginx config:"
    echo "  ssh -i ~/.ssh/ec3_key ubuntu@129.154.255.90"
    echo "  sudo nano /etc/nginx/sites-available/default"
    echo ""
    echo "Look for lines with '695' and remove problematic location blocks"
    echo ""
fi
