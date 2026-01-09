#!/bin/bash

# Complete Nginx fix: Socket.IO path + cleanup orphaned deployment blocks

NGINX_CONFIG="/etc/nginx/sites-available/default"
BACKUP_FILE="${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║         COMPLETE NGINX FIX SCRIPT                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Backup
echo "📦 Step 1: Backing up Nginx config..."
sudo cp "$NGINX_CONFIG" "$BACKUP_FILE"
echo "✅ Backup created: $BACKUP_FILE"
echo ""

# Step 2: Fix Socket.IO path
echo "🔧 Step 2: Fixing Socket.IO path from /socket.io/ to /api/socket.io/..."
sudo sed -i 's|location /socket.io/ {|location /api/socket.io/ {|g' "$NGINX_CONFIG"
sudo sed -i 's|proxy_pass http://localhost:5000;|proxy_pass http://127.0.0.1:5000;|g' "$NGINX_CONFIG"
echo "✅ Socket.IO path updated"
echo ""

# Step 3: Cleanup orphaned deployment blocks (optional)
echo "🧹 Step 3: Checking for orphaned deployment location blocks..."
echo "   (Location blocks for deployments that no longer exist in database)"
echo ""

# Get deployment IDs from MongoDB
DEPLOYMENT_IDS=$(mongosh "mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin" --quiet --eval "
db.deployments.find({}, {_id: 1}).forEach(function(doc) {
    print(doc._id.toString());
});
" 2>/dev/null)

if [ -z "$DEPLOYMENT_IDS" ]; then
    echo "⚠️  Could not connect to MongoDB or no deployments found"
    echo "   Skipping orphaned block cleanup"
else
    # Extract deployment IDs from Nginx config
    NGINX_DEPLOYMENT_IDS=$(grep -E "^[[:space:]]*# .* - Port [0-9]+ - [0-9a-f]{24}" "$NGINX_CONFIG" 2>/dev/null | \
        sed -E 's/.* - ([0-9a-f]{24})$/\1/' | sort -u)
    
    if [ -n "$NGINX_DEPLOYMENT_IDS" ]; then
        ORPHANED_COUNT=0
        ORPHANED_IDS=""
        
        for nginx_id in $NGINX_DEPLOYMENT_IDS; do
            if ! echo "$DEPLOYMENT_IDS" | grep -q "^${nginx_id}$"; then
                ORPHANED_COUNT=$((ORPHANED_COUNT + 1))
                ORPHANED_IDS="${ORPHANED_IDS}${nginx_id}\n"
            fi
        done
        
        if [ "$ORPHANED_COUNT" -gt 0 ]; then
            echo "⚠️  Found $ORPHANED_COUNT orphaned location block(s)"
            echo -e "$ORPHANED_IDS" | head -5
            if [ "$ORPHANED_COUNT" -gt 5 ]; then
                echo "... and $((ORPHANED_COUNT - 5)) more"
            fi
            echo ""
            read -p "Remove orphaned location blocks? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                # Remove orphaned blocks
                TEMP_FILE=$(mktemp)
                IN_SKIP_BLOCK=0
                
                while IFS= read -r line; do
                    if echo "$line" | grep -qE "^[[:space:]]*# .* - Port [0-9]+ - [0-9a-f]{24}"; then
                        CURRENT_ID=$(echo "$line" | sed -E 's/.* - ([0-9a-f]{24})$/\1/')
                        if echo -e "$ORPHANED_IDS" | grep -q "^${CURRENT_ID}$"; then
                            IN_SKIP_BLOCK=1
                            continue
                        fi
                    fi
                    
                    if [ "$IN_SKIP_BLOCK" -eq 1 ]; then
                        if echo "$line" | grep -qE "^[[:space:]]*}[[:space:]]*$"; then
                            IN_SKIP_BLOCK=0
                            continue
                        fi
                        continue
                    fi
                    
                    echo "$line" >> "$TEMP_FILE"
                done < "$NGINX_CONFIG"
                
                sudo mv "$TEMP_FILE" "$NGINX_CONFIG"
                sudo chmod 644 "$NGINX_CONFIG"
                echo "✅ Removed $ORPHANED_COUNT orphaned location block(s)"
            else
                echo "⏭️  Skipping orphaned block cleanup"
            fi
        else
            echo "✅ No orphaned location blocks found"
        fi
    else
        echo "✅ No deployment location blocks found in Nginx config"
    fi
fi

echo ""

# Step 4: Test and reload
echo "🧪 Step 4: Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
    echo ""
    echo "🔄 Reloading Nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded successfully"
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                    ✅ FIX COMPLETE                      ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    echo "📋 Summary:"
    echo "   ✅ Socket.IO path fixed: /api/socket.io/"
    echo "   ✅ Orphaned location blocks cleaned up"
    echo "   ✅ Nginx configuration validated and reloaded"
    echo ""
else
    echo "❌ Nginx configuration test failed!"
    echo "📋 Restoring backup..."
    sudo cp "$BACKUP_FILE" "$NGINX_CONFIG"
    sudo nginx -t && sudo systemctl reload nginx
    echo ""
    echo "⚠️  Changes reverted. Please check the errors above."
    exit 1
fi

