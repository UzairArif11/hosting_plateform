#!/bin/bash

###############################################################################
# QUICK FIX: Socket.IO for Default Config (Works Immediately)
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         QUICK FIX: Socket.IO WebSocket                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

CONFIG_FILE="/etc/nginx/sites-available/default"

if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}✗ Config file not found: $CONFIG_FILE${NC}"
    exit 1
fi

echo "Config file: $CONFIG_FILE"
echo ""

# Backup
BACKUP="${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
sudo cp "$CONFIG_FILE" "$BACKUP"
echo "✓ Backup created: $BACKUP"
echo ""

# Check if Socket.IO exists in HTTPS block
if sudo grep -A 50 "listen 443" "$CONFIG_FILE" | grep -q "location /api/socket.io/"; then
    echo "✓ Socket.IO already in HTTPS block"
    SOCKET_EXISTS=true
else
    echo "→ Socket.IO NOT found in HTTPS block - will add"
    SOCKET_EXISTS=false
fi

# Check location order
SOCKET_LINE=$(sudo grep -n "location /api/socket.io/" "$CONFIG_FILE" | head -1 | cut -d: -f1 || echo "")
API_LINE=$(sudo grep -n "^\s*location /api/ {" "$CONFIG_FILE" | grep -v socket | head -1 | cut -d: -f1 || echo "")

if [ -n "$SOCKET_LINE" ] && [ -n "$API_LINE" ] && [ "$SOCKET_LINE" -lt "$API_LINE" ]; then
    echo "✓ Socket.IO is correctly positioned BEFORE /api/"
    CORRECT_POSITION=true
else
    echo "⚠ Socket.IO position issue - will fix"
    CORRECT_POSITION=false
fi

if [ "$SOCKET_EXISTS" = true ] && [ "$CORRECT_POSITION" = true ]; then
    echo ""
    echo -e "${GREEN}✅ Socket.IO is correctly configured!${NC}"
    echo "Testing nginx config..."
    if sudo nginx -t 2>&1 | grep -q "successful\|syntax is ok"; then
        sudo systemctl reload nginx
        echo -e "${GREEN}✅ Nginx reloaded${NC}"
    fi
    exit 0
fi

echo ""
echo -e "${BLUE}━━━ Fixing Socket.IO Configuration ━━━${NC}"

# Remove any existing Socket.IO blocks first
sudo sed -i '/location \/api\/socket\.io\/ {/,/^[[:space:]]*}/d' "$CONFIG_FILE"

# Create temp file with Socket.IO block
cat > /tmp/socket-block.txt << 'EOF'
    # Socket.IO WebSocket Support (MUST be before /api/ and /)
    location /api/socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

EOF

# Insert Socket.IO before location /api/ in HTTPS block
sudo awk '
/listen 443 ssl/ || /listen \[::\]:443 ssl/ { in_https = 1 }
in_https && /^\s*location \/api\/ \{/ && !socket_added {
    while ((getline line < "/tmp/socket-block.txt") > 0) print line
    close("/tmp/socket-block.txt")
    socket_added = 1
}
{ print }
/^}/ && in_https { in_https = 0 }
' "$CONFIG_FILE" > /tmp/nginx-fixed.conf

sudo mv /tmp/nginx-fixed.conf "$CONFIG_FILE"
rm -f /tmp/socket-block.txt

echo "✓ Socket.IO block added"
echo ""

# Test and reload
echo "→ Testing nginx configuration..."
if sudo nginx -t 2>&1 | grep -q "successful\|syntax is ok"; then
    echo -e "${GREEN}✓ Nginx config is valid${NC}"
    sudo systemctl reload nginx
    echo -e "${GREEN}✓ Nginx reloaded${NC}"
else
    echo -e "${RED}✗ Nginx config has errors!${NC}"
    sudo nginx -t 2>&1 | head -10
    echo ""
    echo "Restoring backup..."
    sudo cp "$BACKUP" "$CONFIG_FILE"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Socket.IO fixed successfully!${NC}"
echo ""
echo "Verify:"
echo "  curl -I https://foodpanda.site/api/socket.io/?EIO=4&transport=polling"
echo ""
