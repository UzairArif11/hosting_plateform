#!/bin/bash

###############################################################################
# QUICK FIX: Fix SSL certificate paths in deployment config
# Fixes the error: "no ssl_certificate is defined for the listen ... ssl"
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Fix SSL Certificate Configuration                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Find deployment config file
DEPLOYMENT_CONFIG=$(sudo find /etc/nginx/sites-available -name "user-deployments-*.conf" -type f 2>/dev/null | head -1)

if [ -z "$DEPLOYMENT_CONFIG" ]; then
    echo -e "${RED}✗ No deployment config file found!${NC}"
    echo "   Run setup-deployment-server.sh first"
    exit 1
fi

echo "Found config: $DEPLOYMENT_CONFIG"
DOMAIN=$(sudo grep "server_name" "$DEPLOYMENT_CONFIG" | head -1 | awk '{print $2}' | tr -d ';')

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}✗ Could not detect domain from config${NC}"
    read -p "Enter domain name (e.g., ec3.foodpanda.site): " DOMAIN
fi

echo "Domain: $DOMAIN"
echo ""

# Check if SSL certificate exists
CERT_PATH=""
KEY_PATH=""

if sudo test -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"; then
    CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
    KEY_PATH="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
    echo -e "${GREEN}✓ SSL certificate found${NC}"
elif sudo certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
    CERT_INFO=$(sudo certbot certificates 2>/dev/null | grep -A 10 "$DOMAIN")
    CERT_PATH=$(echo "$CERT_INFO" | grep "Certificate Path" | awk '{print $3}' | head -1)
    KEY_PATH=$(echo "$CERT_INFO" | grep "Private Key Path" | awk '{print $4}' | head -1)
    if [ -z "$CERT_PATH" ] || [ ! -f "$CERT_PATH" ]; then
        echo -e "${YELLOW}⚠ SSL certificate path not accessible${NC}"
        # Try alternative path detection
        CERT_PATH=$(find /etc/letsencrypt/live -name "fullchain.pem" 2>/dev/null | grep "$DOMAIN" | head -1)
        KEY_PATH=$(find /etc/letsencrypt/live -name "privkey.pem" 2>/dev/null | grep "$DOMAIN" | head -1)
    fi
    if [ -n "$CERT_PATH" ] && sudo test -f "$CERT_PATH"; then
        echo -e "${GREEN}✓ SSL certificate found${NC}"
    fi
fi

if [ -z "$CERT_PATH" ] || [ ! -f "$CERT_PATH" ]; then
    echo -e "${RED}✗ SSL certificate not found for $DOMAIN${NC}"
    echo ""
    echo "Checking if config has SSL enabled without certificate..."
    if sudo grep -q "listen 443 ssl" "$DEPLOYMENT_CONFIG"; then
        echo "→ Config has SSL enabled but no certificate - disabling SSL..."
        # Backup
        BACKUP="${DEPLOYMENT_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
        sudo cp "$DEPLOYMENT_CONFIG" "$BACKUP"
        
        # Remove SSL from HTTPS block - change to HTTP only
        sudo sed -i 's/listen 443 ssl http2;/listen 80;/g' "$DEPLOYMENT_CONFIG"
        sudo sed -i 's/listen \[::\]:443 ssl http2;/listen [::]:80;/g' "$DEPLOYMENT_CONFIG"
        sudo sed -i '/ssl_certificate/d' "$DEPLOYMENT_CONFIG"
        sudo sed -i '/ssl_certificate_key/d' "$DEPLOYMENT_CONFIG"
        sudo sed -i '/ssl_protocols/d' "$DEPLOYMENT_CONFIG"
        sudo sed -i '/ssl_prefer_server_ciphers/d' "$DEPLOYMENT_CONFIG"
        
        if sudo nginx -t 2>&1 | grep -q "successful\|syntax is ok"; then
            sudo systemctl reload nginx
            echo -e "${GREEN}✓ Config fixed (HTTP only) - run fix-ssl-https.sh after SSL setup${NC}"
            exit 0
        else
            echo -e "${RED}✗ Failed to fix config${NC}"
            sudo cp "$BACKUP" "$DEPLOYMENT_CONFIG"
            exit 1
        fi
    else
        echo "   Run: sudo certbot --nginx -d $DOMAIN"
        exit 1
    fi
fi

# Certificate exists - fix the config
echo "→ Updating SSL certificate paths..."
CERT_PATH_ESC=$(echo "$CERT_PATH" | sed 's|/|\\/|g')
KEY_PATH_ESC=$(echo "$KEY_PATH" | sed 's|/|\\/|g')

# Backup
BACKUP="${DEPLOYMENT_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
sudo cp "$DEPLOYMENT_CONFIG" "$BACKUP"
echo "✓ Backup created: $BACKUP"

# Use Python for reliable replacement (pass paths as arguments)
sudo python3 << PYEOF
import re
import sys

cert_path = "$CERT_PATH"
key_path = "$KEY_PATH"

with open('$DEPLOYMENT_CONFIG', 'r') as f:
    content = f.read()

# Check if SSL certificate paths are missing
if 'listen 443 ssl' in content:
    # Find HTTPS server block and ensure SSL paths exist
    lines = content.split('\n')
    new_lines = []
    in_https_block = False
    ssl_added = False
    
    for i, line in enumerate(lines):
        if 'listen 443 ssl' in line:
            in_https_block = True
            ssl_added = False
        elif in_https_block and line.strip().startswith('server {'):
            # New server block started
            in_https_block = False
            ssl_added = False
        
        new_lines.append(line)
        
        # After server_name in HTTPS block, add SSL if missing
        if in_https_block and 'server_name' in line and not ssl_added:
            # Check if SSL certificate already exists in next few lines
            next_lines = '\n'.join(lines[i+1:min(i+10, len(lines))])
            next_block = next_lines.split('location')[0] if 'location' in next_lines else next_lines
            if 'ssl_certificate' not in next_block:
                # Add SSL configuration
                indent_level = len(line) - len(line.lstrip())
                indent = ' ' * indent_level
                new_lines.append(f'{indent}')
                new_lines.append(f'{indent}# SSL Configuration')
                new_lines.append(f'{indent}ssl_certificate {cert_path};')
                new_lines.append(f'{indent}ssl_certificate_key {key_path};')
                new_lines.append(f'{indent}ssl_protocols TLSv1.2 TLSv1.3;')
                new_lines.append(f'{indent}ssl_prefer_server_ciphers on;')
                ssl_added = True
            else:
                ssl_added = True
        
        if in_https_block and line.strip().startswith('location'):
            in_https_block = False
    
    content = '\n'.join(new_lines)
    
    with open('/tmp/nginx-ssl-fixed.conf', 'w') as f:
        f.write(content)
    print("✓ SSL configuration added")
else:
    print("⚠ No HTTPS block found in config")
    sys.exit(1)
PYEOF

if [ -f /tmp/nginx-ssl-fixed.conf ]; then
    sudo mv /tmp/nginx-ssl-fixed.conf "$DEPLOYMENT_CONFIG"
    echo "✓ Config updated with SSL paths"
else
    echo -e "${RED}✗ Failed to create fixed config${NC}"
    exit 1
fi

# Check and fix Socket.IO configuration (if this is main platform)
echo ""
echo -e "${BLUE}━━━ Step: Checking Socket.IO Configuration ━━━${NC}"

# Check if this is the main platform (foodpanda.site)
if [ "$DOMAIN" = "foodpanda.site" ] || [ "$DOMAIN" = "www.foodpanda.site" ]; then
    echo "→ Main platform detected - checking Socket.IO configuration..."
    
    # Determine which config file to check (could be platform config or deployment config)
    PLATFORM_CONFIG="/etc/nginx/sites-available/platform-foodpanda-site.conf"
    CONFIG_TO_CHECK="$DEPLOYMENT_CONFIG"
    
    # Check both platform config and deployment config for Socket.IO
    CONFIGS_TO_FIX=()
    if [ -f "$PLATFORM_CONFIG" ]; then
        CONFIGS_TO_FIX+=("$PLATFORM_CONFIG")
        echo "  Found platform config: $PLATFORM_CONFIG"
    fi
    # Also check the deployment config if it's for main platform
    if [ -f "$DEPLOYMENT_CONFIG" ] && [ "$CONFIG_TO_CHECK" = "$DEPLOYMENT_CONFIG" ]; then
        CONFIGS_TO_FIX+=("$DEPLOYMENT_CONFIG")
        echo "  Found deployment config: $DEPLOYMENT_CONFIG"
    fi
    
    # If no configs found, use deployment config
    if [ ${#CONFIGS_TO_FIX[@]} -eq 0 ]; then
        CONFIGS_TO_FIX=("$DEPLOYMENT_CONFIG")
    fi
    
    # Fix Socket.IO in all relevant config files
    for CONFIG_TO_CHECK in "${CONFIGS_TO_FIX[@]}"; do
        echo "  Checking: $CONFIG_TO_CHECK"
        
        # Check if Socket.IO is configured in HTTPS block
        if sudo grep -A 50 "listen 443" "$CONFIG_TO_CHECK" 2>/dev/null | grep -q "location /api/socket.io/"; then
            echo "  ✓ Socket.IO already configured in HTTPS block"
        else
            echo "  → Adding Socket.IO to HTTPS block in $CONFIG_TO_CHECK..."
        
        # Use Python to reliably insert Socket.IO block
        sudo python3 << PYEOF
import re

socket_block = '''    # Socket.IO WebSocket Support (MUST be before /api/ and /)
    location /api/socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

'''

with open('$CONFIG_TO_CHECK', 'r') as f:
    content = f.read()

# Check if Socket.IO already exists
if 'location /api/socket.io/' in content:
    print("✓ Socket.IO already exists")
    exit(0)

# Find HTTPS server block (listen 443) and insert Socket.IO before location /api/
# Pattern: find location /api/ in HTTPS block (after client_max_body_size)
pattern = r'(client_max_body_size[^\n]+\n)(\s+location /api/)'
replacement = r'\1' + socket_block + r'\2'

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

if new_content == content:
    # Try alternative: after server_name and before any location
    pattern2 = r'(server_name[^\n]+\n[^\n]*\n[^\n]*client_max_body_size[^\n]+\n)(\s+location)'
    replacement2 = r'\1' + socket_block + r'\2'
    new_content = re.sub(pattern2, replacement2, content, flags=re.DOTALL)

if new_content != content:
    with open('/tmp/nginx-socket-fixed.conf', 'w') as f:
        f.write(new_content)
    print("✓ Socket.IO added to HTTPS block")
else:
    print("⚠ Could not find insertion point - Socket.IO may need manual configuration")
    exit(0)
PYEOF
        
            if [ -f /tmp/nginx-socket-fixed.conf ]; then
                sudo mv /tmp/nginx-socket-fixed.conf "$CONFIG_TO_CHECK"
                echo "  ✓ Socket.IO configuration added to HTTPS block"
            fi
        fi
        
        # Also check HTTP block (default server) for Socket.IO
        if sudo grep -A 20 "listen 80 default_server" "$CONFIG_TO_CHECK" 2>/dev/null | grep -q "location /api/socket.io/"; then
            echo "  ✓ Socket.IO already configured in HTTP default block"
        else
            echo "  → Adding Socket.IO to HTTP default block in $CONFIG_TO_CHECK..."
        
        sudo python3 << PYEOF
import re

socket_block_http = '''    # Socket.IO WebSocket Support
    location /api/socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

'''

with open('$CONFIG_TO_CHECK', 'r') as f:
    content = f.read()

# Find HTTP default server block and insert Socket.IO before location /api/
if 'listen 80 default_server' in content:
    # Pattern: in default server block, before location /api/
    pattern = r'(listen 80 default_server[^\n]*\n[^\n]*\n[^\n]*server_name[^\n]*\n)(\s+location /api/)'
    replacement = r'\1' + socket_block_http + r'\2'
    
    new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    if new_content != content:
        with open('/tmp/nginx-socket-http-fixed.conf', 'w') as f:
            f.write(new_content)
        print("✓ Socket.IO added to HTTP default block")
    else:
        print("⚠ Could not find HTTP insertion point")
        exit(0)
else:
    print("⚠ No HTTP default server block found")
    exit(0)
PYEOF
        
            if [ -f /tmp/nginx-socket-http-fixed.conf ]; then
                sudo mv /tmp/nginx-socket-http-fixed.conf "$CONFIG_TO_CHECK"
                echo "  ✓ Socket.IO configuration added to HTTP block"
            fi
        fi
    done
else
    echo "→ Deployment server detected - Socket.IO not needed for platform"
    echo "  (User deployments handle their own Socket.IO if needed)"
fi

# Test nginx config
echo ""
echo "→ Testing nginx configuration..."
if sudo nginx -t 2>&1 | grep -q "successful\|syntax is ok"; then
    echo -e "${GREEN}✓ Nginx config valid${NC}"
    sudo systemctl reload nginx
    echo -e "${GREEN}✓ Nginx reloaded${NC}"
else
    echo -e "${RED}❌ Nginx config still has errors${NC}"
    sudo nginx -t 2>&1 | head -10
    echo ""
    echo "Restoring backup..."
    sudo cp "$BACKUP" "$DEPLOYMENT_CONFIG"
    exit 1
fi

# Clean up old backups (keep last 10)
echo ""
echo "→ Cleaning up old backups (keeping last 10)..."
sudo ls -t /etc/nginx/sites-available/*.backup.* 2>/dev/null | tail -n +11 | sudo xargs rm -f 2>/dev/null || true
echo "✓ Backup cleanup complete"

echo ""
echo -e "${GREEN}✅ SSL and Socket.IO configuration fixed!${NC}"
if [ "$DOMAIN" = "foodpanda.site" ] || [ "$DOMAIN" = "www.foodpanda.site" ]; then
    echo ""
    echo -e "${BLUE}Socket.IO endpoints:${NC}"
    echo "  HTTP:  http://foodpanda.site/api/socket.io/"
    echo "  HTTPS: https://foodpanda.site/api/socket.io/"
fi
echo ""
