#!/bin/bash

###############################################################################
# IMMEDIATE FIX: Socket.IO WebSocket Connection
# Fixes the actual nginx config file on the server
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         FIXING SOCKET.IO WEBSOCKET NOW                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Find the correct config file
PLATFORM_CONFIG="/etc/nginx/sites-available/platform-foodpanda-site.conf"
DEFAULT_CONFIG="/etc/nginx/sites-available/default"

if [ -f "$PLATFORM_CONFIG" ]; then
    CONFIG_FILE="$PLATFORM_CONFIG"
    echo "✓ Using platform config: $PLATFORM_CONFIG"
elif [ -f "$DEFAULT_CONFIG" ]; then
    CONFIG_FILE="$DEFAULT_CONFIG"
    echo "⚠ Using default config: $DEFAULT_CONFIG"
else
    echo -e "${RED}✗ No nginx config found!${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}━━━ Step 1: Checking Current Socket.IO Configuration ━━━${NC}"

# Check if Socket.IO exists
if sudo grep -q "location /api/socket.io/" "$CONFIG_FILE"; then
    echo "✓ Socket.IO location block found"
    echo ""
    echo "Current Socket.IO blocks:"
    sudo grep -n "location /api/socket.io/" "$CONFIG_FILE"
    
    # Check if it's in HTTPS block
    if sudo grep -A 50 "listen 443" "$CONFIG_FILE" | grep -q "location /api/socket.io/"; then
        echo "✓ Socket.IO found in HTTPS block"
    else
        echo -e "${YELLOW}⚠ Socket.IO not in HTTPS block - will fix${NC}"
    fi
    
    # Check location order
    echo ""
    echo "Location block order (Socket.IO should be BEFORE /api/ and /):"
    sudo awk '/listen 443/,/^[[:space:]]*}/ {
        if (/location/) {
            print NR": "$0
        }
    }' "$CONFIG_FILE" | head -10
    
    SOCKET_LINE=$(sudo grep -n "location /api/socket.io/" "$CONFIG_FILE" | head -1 | cut -d: -f1)
    API_LINE=$(sudo grep -n "location /api/" "$CONFIG_FILE" | grep -v socket | head -1 | cut -d: -f1)
    
    if [ -n "$SOCKET_LINE" ] && [ -n "$API_LINE" ] && [ "$SOCKET_LINE" -lt "$API_LINE" ]; then
        echo "✓ Socket.IO is correctly placed BEFORE /api/"
    else
        echo -e "${YELLOW}⚠ Socket.IO might be in wrong position - will fix${NC}"
    fi
else
    echo -e "${RED}✗ Socket.IO location block NOT FOUND${NC}"
fi

echo ""
echo -e "${BLUE}━━━ Step 2: Creating Backup ━━━${NC}"
BACKUP="${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
sudo cp "$CONFIG_FILE" "$BACKUP"
echo "✓ Backup created: $BACKUP"

echo ""
echo -e "${BLUE}━━━ Step 3: Fixing Socket.IO Configuration ━━━${NC}"

# Use Python to properly fix the config (pass config file path as environment variable)
export CONFIG_FILE_PATH="$CONFIG_FILE"
sudo -E python3 << PYEOF
import re
import sys
import os

config_file = os.environ.get('CONFIG_FILE_PATH', '$CONFIG_FILE')

socket_block = '''    # Socket.IO WebSocket Support (MUST be before /api/ and /)
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

'''

try:
    with open(config_file, 'r') as f:
        content = f.read()
    
    # Remove any existing Socket.IO blocks first
    # Remove location /api/socket.io/ blocks
    content = re.sub(r'[ \t]*# Socket\.IO.*?\n[ \t]*location /api/socket\.io/ \{.*?\n[ \t]*\}.*?\n', '', content, flags=re.DOTALL)
    
    # Find HTTPS server block and insert Socket.IO before location /api/
    # Look for pattern: client_max_body_size followed by location /api/
    pattern = r'(client_max_body_size\s+\d+M;\s*\n)(\s+location /api/)'
    
    if re.search(pattern, content):
        new_content = re.sub(pattern, r'\1' + socket_block + r'\2', content, flags=re.MULTILINE)
        
        if new_content != content:
            with open('/tmp/nginx-socket-fixed.conf', 'w') as f:
                f.write(new_content)
            print("✓ Socket.IO inserted before /api/ in HTTPS block")
            sys.exit(0)
    
    # Alternative: Insert after client_max_body_size, before any location
    pattern2 = r'(client_max_body_size\s+\d+M;\s*\n)(\s+location)'
    if re.search(pattern2, content):
        new_content = re.sub(pattern2, r'\1' + socket_block + r'\2', content, flags=re.MULTILINE)
        
        if new_content != content:
            with open('/tmp/nginx-socket-fixed.conf', 'w') as f:
                f.write(new_content)
            print("✓ Socket.IO inserted after client_max_body_size")
            sys.exit(0)
    
    # Last resort: Insert after server_name in HTTPS block
    lines = content.split('\n')
    new_lines = []
    in_https = False
    socket_added = False
    
    for i, line in enumerate(lines):
        # Detect HTTPS server block start
        if 'listen 443 ssl' in line or 'listen [::]:443 ssl' in line:
            in_https = True
            socket_added = False
        
        new_lines.append(line)
        
        # After client_max_body_size in HTTPS block, add Socket.IO before first location
        if in_https and 'client_max_body_size' in line and not socket_added:
            # Check next few lines for location
            next_lines = '\n'.join(lines[i+1:min(i+10, len(lines))])
            if 'location' in next_lines and 'location /api/socket.io/' not in next_lines:
                indent = ' ' * 4
                new_lines.append(f'{indent}# Socket.IO WebSocket Support (MUST be before /api/ and /)')
                new_lines.append(f'{indent}location /api/socket.io/ {{')
                new_lines.append(f'{indent}    proxy_pass http://127.0.0.1:5000;')
                new_lines.append(f'{indent}    proxy_http_version 1.1;')
                new_lines.append(f'{indent}    proxy_set_header Upgrade $http_upgrade;')
                new_lines.append(f'{indent}    proxy_set_header Connection "upgrade";')
                new_lines.append(f'{indent}    proxy_set_header Host $host;')
                new_lines.append(f'{indent}    proxy_set_header X-Real-IP $remote_addr;')
                new_lines.append(f'{indent}    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;')
                new_lines.append(f'{indent}    proxy_set_header X-Forwarded-Proto $scheme;')
                new_lines.append(f'{indent}    proxy_cache_bypass $http_upgrade;')
                new_lines.append(f'{indent}    proxy_read_timeout 86400;')
                new_lines.append(f'{indent}}}')
                new_lines.append('')
                socket_added = True
        
        # End of HTTPS server block
        if in_https and line.strip() == '}' and i > 0:
            # Check if this is end of server block (not location block)
            prev_content = '\n'.join(lines[max(0, i-5):i])
            if 'server {' in prev_content or 'listen 443' in prev_content:
                in_https = False
    
    if socket_added:
        new_content = '\n'.join(new_lines)
        with open('/tmp/nginx-socket-fixed.conf', 'w') as f:
            f.write(new_content)
        print("✓ Socket.IO added to HTTPS block (line-by-line method)")
        sys.exit(0)
    
    print("⚠ Could not find insertion point")
    sys.exit(1)

except Exception as e:
    print(f"⚠ Error: {e}")
    sys.exit(1)
PYEOF

PYTHON_EXIT=$?

if [ $PYTHON_EXIT -eq 0 ] && [ -f /tmp/nginx-socket-fixed.conf ]; then
    sudo mv /tmp/nginx-socket-fixed.conf "$CONFIG_FILE"
    echo "✓ Config file updated"
else
    echo -e "${RED}✗ Python script failed - trying manual fix${NC}"
    exit 1
fi

# Also fix HTTP default server block
echo ""
echo -e "${BLUE}━━━ Step 4: Fixing HTTP Default Server Block ━━━${NC}"

if sudo grep -A 20 "listen 80 default_server" "$CONFIG_FILE" | grep -q "location /api/socket.io/"; then
    echo "✓ Socket.IO already in HTTP default block"
else
    echo "→ Adding Socket.IO to HTTP default block..."
    
    # Use sed to insert Socket.IO block
    sudo sed -i '/listen 80 default_server/,/location \/api\// {
        /location \/api\//i\
    # Socket.IO WebSocket Support\
    location /api/socket.io/ {\
        proxy_pass http://127.0.0.1:5000;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection "upgrade";\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_cache_bypass $http_upgrade;\
        proxy_read_timeout 86400;\
    }\
'
    }' "$CONFIG_FILE"
    
    if sudo grep -q "location /api/socket.io/" "$CONFIG_FILE"; then
        echo "✓ Socket.IO added to HTTP block"
    fi
fi

echo ""
echo -e "${BLUE}━━━ Step 5: Testing and Reloading Nginx ━━━${NC}"

# Test nginx config
if sudo nginx -t 2>&1 | grep -q "successful\|syntax is ok"; then
    echo "✓ Nginx configuration is valid"
    sudo systemctl reload nginx
    echo "✓ Nginx reloaded"
else
    echo -e "${RED}✗ Nginx configuration has errors!${NC}"
    sudo nginx -t 2>&1 | head -10
    echo ""
    echo "Restoring backup..."
    sudo cp "$BACKUP" "$CONFIG_FILE"
    exit 1
fi

echo ""
echo -e "${BLUE}━━━ Step 6: Verifying Socket.IO Configuration ━━━${NC}"

echo "Location blocks in HTTPS server (should show Socket.IO first):"
sudo awk '/listen 443/,/^[[:space:]]*}/ {
    if (/location /) {
        print "  " NR": "$0
    }
}' "$CONFIG_FILE" | head -5

echo ""
echo -e "${GREEN}✅ Socket.IO configuration fixed!${NC}"
echo ""
echo "Test the connection:"
echo "  curl -I https://foodpanda.site/api/socket.io/?EIO=4&transport=polling"
echo ""
