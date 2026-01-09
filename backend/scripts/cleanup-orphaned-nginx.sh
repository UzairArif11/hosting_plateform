#!/bin/bash

# Cleanup orphaned Nginx location blocks for deleted deployments
# This script removes Nginx location blocks that don't have corresponding deployments in the database

echo "🧹 Cleaning up orphaned Nginx location blocks..."

# Connect to MongoDB and get all active deployment IDs
DEPLOYMENT_IDS=$(mongosh "mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin" --quiet --eval "
db.deployments.find({}, {_id: 1}).forEach(function(doc) {
    print(doc._id.toString());
});
" 2>/dev/null)

if [ -z "$DEPLOYMENT_IDS" ]; then
    echo "⚠️  No deployments found in database"
    exit 0
fi

echo "📋 Found deployments in database:"
echo "$DEPLOYMENT_IDS" | head -5
echo "..."

# Backup Nginx config
NGINX_CONFIG="/etc/nginx/sites-available/default"
BACKUP_FILE="${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
sudo cp "$NGINX_CONFIG" "$BACKUP_FILE"
echo "✅ Backup created: $BACKUP_FILE"

# Read current config
CURRENT_CONFIG=$(sudo cat "$NGINX_CONFIG")

# Find all location blocks with deployment IDs
echo ""
echo "🔍 Scanning Nginx config for deployment location blocks..."

# Extract deployment IDs from Nginx config (pattern: # projectname - Port XXXX - deploymentId)
NGINX_DEPLOYMENT_IDS=$(grep -E "^[[:space:]]*# .* - Port [0-9]+ - [0-9a-f]{24}" "$NGINX_CONFIG" | \
    sed -E 's/.* - ([0-9a-f]{24})$/\1/' | sort -u)

if [ -z "$NGINX_DEPLOYMENT_IDS" ]; then
    echo "✅ No deployment location blocks found in Nginx config"
    exit 0
fi

echo "📋 Found location blocks in Nginx:"
echo "$NGINX_DEPLOYMENT_IDS" | head -5
echo "..."

# Find orphaned IDs (in Nginx but not in database)
ORPHANED_IDS=""
for nginx_id in $NGINX_DEPLOYMENT_IDS; do
    if ! echo "$DEPLOYMENT_IDS" | grep -q "^${nginx_id}$"; then
        ORPHANED_IDS="${ORPHANED_IDS}${nginx_id}\n"
    fi
done

if [ -z "$ORPHANED_IDS" ]; then
    echo "✅ No orphaned location blocks found - all deployments exist in database"
    exit 0
fi

ORPHANED_COUNT=$(echo -e "$ORPHANED_IDS" | grep -c . || echo "0")
echo ""
echo "⚠️  Found $ORPHANED_COUNT orphaned location block(s):"
echo -e "$ORPHANED_IDS" | head -10
if [ "$ORPHANED_COUNT" -gt 10 ]; then
    echo "... and $((ORPHANED_COUNT - 10)) more"
fi

# Remove orphaned blocks
echo ""
read -p "Do you want to remove these orphaned location blocks? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 0
fi

# Create cleaned config
TEMP_FILE=$(mktemp)
IN_SKIP_BLOCK=0
CURRENT_DEPLOYMENT_ID=""
REMOVED_COUNT=0

while IFS= read -r line; do
    # Check if this is a comment line with a deployment ID
    if echo "$line" | grep -qE "^[[:space:]]*# .* - Port [0-9]+ - [0-9a-f]{24}"; then
        # Extract deployment ID
        CURRENT_DEPLOYMENT_ID=$(echo "$line" | sed -E 's/.* - ([0-9a-f]{24})$/\1/')
        
        # Check if this ID is orphaned
        if echo -e "$ORPHANED_IDS" | grep -q "^${CURRENT_DEPLOYMENT_ID}$"; then
            IN_SKIP_BLOCK=1
            REMOVED_COUNT=$((REMOVED_COUNT + 1))
            echo "🗑️  Removing location block for deployment $CURRENT_DEPLOYMENT_ID"
            continue # Skip the comment line
        fi
    fi
    
    # If we're in a skip block, continue until we find the closing brace
    if [ "$IN_SKIP_BLOCK" -eq 1 ]; then
        # Check if this is the closing brace of the location block
        if echo "$line" | grep -qE "^[[:space:]]*}[[:space:]]*$"; then
            # Check if previous line ends with $http_upgrade; (end of proxy_cache_bypass)
            if echo "$line" | grep -qE "^[[:space:]]*}[[:space:]]*$"; then
                IN_SKIP_BLOCK=0
                CURRENT_DEPLOYMENT_ID=""
                continue # Skip the closing brace
            fi
        fi
        # Skip all lines in the block
        continue
    fi
    
    # Keep all other lines
    echo "$line" >> "$TEMP_FILE"
done < "$NGINX_CONFIG"

# Replace config
sudo mv "$TEMP_FILE" "$NGINX_CONFIG"
sudo chmod 644 "$NGINX_CONFIG"

echo ""
echo "✅ Removed $REMOVED_COUNT orphaned location block(s)"

# Test Nginx config
echo ""
echo "🧪 Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
    echo "🔄 Reloading Nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded successfully"
    echo ""
    echo "✅ Cleanup complete! Removed $REMOVED_COUNT orphaned location block(s)"
else
    echo "❌ Nginx configuration test failed!"
    echo "📋 Restoring backup..."
    sudo cp "$BACKUP_FILE" "$NGINX_CONFIG"
    sudo nginx -t && sudo systemctl reload nginx
    exit 1
fi

