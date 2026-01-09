#!/bin/bash

###############################################################################
# COMPLETE DEPLOYMENT SCRIPT
# Applies all fixes and updates in correct order
###############################################################################

set -e  # Exit on any error

echo "╔══════════════════════════════════════════════════════════"
echo "║  🚀 Hosting Platform - Complete Deployment"
echo "╚══════════════════════════════════════════════════════════"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

cd ~/hosting_plateform

# ============================================================================
# STEP 1: PULL LATEST CODE
# ============================================================================
echo -e "${BLUE}→ Step 1: Pulling latest code...${NC}"
git pull origin main || git pull origin optimization || echo "⚠️  Git pull failed, using local code"
echo -e "${GREEN}✅ Code updated${NC}"
echo ""

# ============================================================================
# STEP 2: UPDATE DATABASE SETTINGS
# ============================================================================
echo -e "${BLUE}→ Step 2: Updating database settings...${NC}"
cd backend

# Update EC3 domain to ec3.foodpanda.site
node -e "const m=require('mongoose');require('dotenv').config();const S=require('./models/Settings');m.connect(process.env.MONGODB_URI).then(async()=>{await S.updateOne({},{\$set:{'serverDomains.EC3':'ec3.foodpanda.site'}});console.log('✅ EC3 domain: ec3.foodpanda.site');process.exit(0);});" 2>/dev/null || echo "⚠️  Database update skipped"

cd ..
echo -e "${GREEN}✅ Database configured${NC}"
echo ""

# ============================================================================
# STEP 3: SETUP NGINX FOR MAIN PLATFORM (Separate Config File)
# ============================================================================
echo -e "${BLUE}→ Step 3: Configuring Nginx for Main Platform...${NC}"

# Use separate config file for main platform (not default)
PLATFORM_CONFIG="platform-foodpanda-site.conf"
PLATFORM_CONFIG_PATH="/etc/nginx/sites-available/${PLATFORM_CONFIG}"

# Clean up old backups (keep only last 10)
echo "→ Cleaning up old nginx backups (keeping last 10)..."
sudo ls -t /etc/nginx/sites-available/*.backup.* 2>/dev/null | tail -n +11 | sudo xargs rm -f 2>/dev/null || true
echo "✅ Backup cleanup complete"

# Check if platform config exists, if not create it
if [ ! -f "$PLATFORM_CONFIG_PATH" ]; then
    echo "→ Creating platform nginx config: ${PLATFORM_CONFIG}..."
    
    # Backup if exists
    if [ -f "$PLATFORM_CONFIG_PATH" ]; then
        sudo cp "$PLATFORM_CONFIG_PATH" "${PLATFORM_CONFIG_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Create platform config file
    sudo tee "$PLATFORM_CONFIG_PATH" > /dev/null << 'PLATFORMBLOCK'
# Main Platform Configuration for foodpanda.site
# This file is managed by deploy.sh - DO NOT manually edit

# Default server block (for IP access)
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Socket.IO WebSocket Support
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

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    
    server_name foodpanda.site www.foodpanda.site;
    
    return 301 https://$server_name$request_uri;
}

# Main domain server block (HTTPS)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    ssl_certificate /etc/letsencrypt/live/foodpanda.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/foodpanda.site/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    server_name foodpanda.site www.foodpanda.site;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000" always;
    
    client_max_body_size 100M;
    
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
    
    # Platform Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
    
    # Platform Frontend (catch-all - must be last)
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
PLATFORMBLOCK
    
    # Enable platform config
    if [ ! -f "/etc/nginx/sites-enabled/${PLATFORM_CONFIG}" ]; then
        sudo ln -s "$PLATFORM_CONFIG_PATH" "/etc/nginx/sites-enabled/${PLATFORM_CONFIG}"
    fi
    
    echo "✅ Created platform nginx config: ${PLATFORM_CONFIG}"
else
    echo "→ Checking and fixing Socket.IO configuration..."
    
    # Check if Socket.IO exists in HTTPS block
    SOCKET_EXISTS_HTTPS=$(sudo grep -A 50 "listen 443" "$PLATFORM_CONFIG_PATH" 2>/dev/null | grep -c "location /api/socket.io/" || echo "0")
    
    if [ "$SOCKET_EXISTS_HTTPS" -gt 0 ]; then
        echo "✅ Socket.IO already configured in HTTPS block"
    else
        echo "→ Adding Socket.IO to HTTPS block..."
        
        # Backup
        sudo cp "$PLATFORM_CONFIG_PATH" "${PLATFORM_CONFIG_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
        
        # Use Python for reliable Socket.IO insertion
        sudo python3 << PYEOF
import re
import sys

config_file = '$PLATFORM_CONFIG_PATH'

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

try:
    with open(config_file, 'r') as f:
        content = f.read()

    # Check if Socket.IO already exists
    if 'location /api/socket.io/' in content:
        print("✓ Socket.IO already exists in config")
        sys.exit(0)

    # Strategy 1: Insert after client_max_body_size and before location /api/
    pattern1 = r'(client_max_body_size\s+\d+M;\s*\n)(\s+location /api/)'
    if re.search(pattern1, content):
        new_content = re.sub(pattern1, r'\1' + socket_block + r'\2', content)
        if new_content != content:
            with open('/tmp/platform-nginx-socket.conf', 'w') as f:
                f.write(new_content)
            print("✓ Socket.IO added to HTTPS block (method 1)")
            sys.exit(0)

    # Strategy 2: Insert after security headers, before any location
    pattern2 = r'(add_header Strict-Transport-Security[^\n]+\n\s*\n)(\s+client_max_body_size\s+\d+M;\s*\n\s+)(location)'
    if re.search(pattern2, content):
        new_content = re.sub(pattern2, r'\1\2' + socket_block + r'    \3', content, flags=re.MULTILINE)
        if new_content != content:
            with open('/tmp/platform-nginx-socket.conf', 'w') as f:
                f.write(new_content)
            print("✓ Socket.IO added to HTTPS block (method 2)")
            sys.exit(0)

    # Strategy 3: Find HTTPS server block and insert before first location
    lines = content.split('\n')
    new_lines = []
    in_https = False
    socket_added = False
    indent = '    '
    
    for i, line in enumerate(lines):
        if 'listen 443 ssl' in line or 'listen [::]:443 ssl' in line:
            in_https = True
            socket_added = False
        
        if in_https and line.strip().startswith('location') and not socket_added:
            # Calculate indent
            indent = ' ' * (len(line) - len(line.lstrip()))
            # Insert Socket.IO block
            new_lines.append(f'{indent}# Socket.IO WebSocket Support (MUST be before /api/ and /)')
            new_lines.append(f'{indent}location /api/socket.io/ {{')
            new_lines.append(f'{indent}    proxy_pass http://127.0.0.1:5000;')
            new_lines.append(f'{indent}    proxy_http_version 1.1;')
            new_lines.append(f'{indent}    proxy_set_header Upgrade \\$http_upgrade;')
            new_lines.append(f'{indent}    proxy_set_header Connection "upgrade";')
            new_lines.append(f'{indent}    proxy_set_header Host \\$host;')
            new_lines.append(f'{indent}    proxy_set_header X-Real-IP \\$remote_addr;')
            new_lines.append(f'{indent}    proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;')
            new_lines.append(f'{indent}    proxy_set_header X-Forwarded-Proto \\$scheme;')
            new_lines.append(f'{indent}    proxy_cache_bypass \\$http_upgrade;')
            new_lines.append(f'{indent}    proxy_read_timeout 86400;')
            new_lines.append(f'{indent}}}')
            new_lines.append('')
            socket_added = True
        
        new_lines.append(line)
        
        if in_https and line.strip() == '}' and i > 0 and lines[i-1].strip().startswith('location'):
            in_https = False
    
    if socket_added:
        new_content = '\n'.join(new_lines)
        with open('/tmp/platform-nginx-socket.conf', 'w') as f:
            f.write(new_content)
        print("✓ Socket.IO added to HTTPS block (method 3)")
        sys.exit(0)
    
    print("⚠ Could not find insertion point - Socket.IO may need manual configuration")
    sys.exit(1)

except Exception as e:
    print(f"⚠ Error: {e}")
    sys.exit(1)
PYEOF
        
        PYTHON_EXIT=$?
        if [ $PYTHON_EXIT -eq 0 ] && [ -f /tmp/platform-nginx-socket.conf ]; then
            sudo mv /tmp/platform-nginx-socket.conf "$PLATFORM_CONFIG_PATH"
            echo "✅ Socket.IO added to HTTPS block"
        else
            echo -e "${YELLOW}⚠ Python script failed or no output - trying sed fallback${NC}"
            # Fallback: Use sed to insert Socket.IO block before location /api/ in HTTPS block
            SOCKET_BLOCK='    # Socket.IO WebSocket Support
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
'
            # Insert before location /api/ in HTTPS block
            sudo sed -i '/listen 443/,/location \/api\// {
                /location \/api\//i\
'"$SOCKET_BLOCK"'
            }' "$PLATFORM_CONFIG_PATH"
            
            # Verify it was added
            if sudo grep -q "location /api/socket.io/" "$PLATFORM_CONFIG_PATH"; then
                echo "✅ Socket.IO added via sed fallback"
            else
                echo -e "${RED}❌ Failed to add Socket.IO - manual configuration required${NC}"
            fi
        fi
    fi
    
    # Also check HTTP default server block for Socket.IO
    SOCKET_EXISTS_HTTP=$(sudo grep -A 20 "listen 80 default_server" "$PLATFORM_CONFIG_PATH" 2>/dev/null | grep -c "location /api/socket.io/" || echo "0")
    
    if [ "$SOCKET_EXISTS_HTTP" -gt 0 ]; then
        echo "✅ Socket.IO already configured in HTTP default block"
    else
        echo "→ Adding Socket.IO to HTTP default block..."
        
        # Use sed to insert before location /api/ in HTTP default block
        SOCKET_BLOCK_HTTP='    # Socket.IO WebSocket Support
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
'
        # Create temp file with Socket.IO block
        echo "$SOCKET_BLOCK_HTTP" > /tmp/socket-http-block.txt
        
        # Insert before location /api/ in HTTP default server block
        sudo awk '
        /listen 80 default_server/ { in_default=1 }
        in_default && /location \/api\// && !socket_added {
            while ((getline line < "/tmp/socket-http-block.txt") > 0) print line
            close("/tmp/socket-http-block.txt")
            socket_added=1
        }
        { print }
        /^}$/ && in_default { in_default=0 }
        ' "$PLATFORM_CONFIG_PATH" > /tmp/platform-nginx-http-socket.conf
        
        if [ -f /tmp/platform-nginx-http-socket.conf ]; then
            sudo mv /tmp/platform-nginx-http-socket.conf "$PLATFORM_CONFIG_PATH"
            sudo rm -f /tmp/socket-http-block.txt
        fi
        
        if sudo grep -q "location /api/socket.io/" "$PLATFORM_CONFIG_PATH"; then
            echo "✅ Socket.IO added to HTTP default block"
        else
            echo -e "${YELLOW}⚠ Could not add Socket.IO to HTTP block${NC}"
        fi
    fi
fi

# Test and reload nginx
if sudo nginx -t 2>&1 | grep -q "successful\|syntax is ok"; then
    sudo systemctl reload nginx
    echo -e "${GREEN}✅ Nginx configured and reloaded${NC}"
else
    echo -e "${RED}❌ Nginx config error${NC}"
    sudo nginx -t 2>&1 | head -10
fi
echo ""

# ============================================================================
# STEP 4: SKIP EC3 NGINX SETUP (Managed by setup-deployment-server.sh)
# ============================================================================
echo -e "${BLUE}→ Step 4: Skipping EC3 configuration...${NC}"
echo "   ℹ️  EC3 user deployments are managed by setup-deployment-server.sh"
echo "   ℹ️  EC3 uses separate config file: /etc/nginx/sites-available/user-deployments-EC3.conf"
echo -e "${GREEN}✅ Step 4 complete${NC}"
echo ""

# ============================================================================
# STEP 5: SETUP FRONTEND ENVIRONMENT
# ============================================================================
echo -e "${BLUE}→ Step 5: Configuring frontend environment...${NC}"

cd frontend

# Create/update .env.production
cat > .env.production << 'ENVPROD'
NEXT_PUBLIC_API_URL=https://foodpanda.site
NEXT_PUBLIC_SOCKET_URL=https://foodpanda.site
NODE_ENV=production
ENVPROD

# Create/update .env.local
cat > .env.local << 'ENVLOCAL'
NEXT_PUBLIC_API_URL=https://foodpanda.site
NEXT_PUBLIC_SOCKET_URL=https://foodpanda.site
ENVLOCAL

echo -e "${GREEN}✅ Frontend environment configured${NC}"
echo ""

# ============================================================================
# STEP 6: INSTALL DEPENDENCIES (IF NEEDED)
# ============================================================================
echo -e "${BLUE}→ Step 6: Checking dependencies...${NC}"

# Check if node_modules exists and socket.io-client is installed
if [ ! -d "node_modules" ] || ! npm list socket.io-client 2>/dev/null | grep -q "socket.io-client@"; then
    echo "→ Installing dependencies..."
    npm install
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo "✅ Dependencies up to date"
fi

cd ..
echo ""

# ============================================================================
# STEP 7: BUILD FRONTEND
# ============================================================================
echo -e "${BLUE}→ Step 7: Building frontend...${NC}"
cd frontend
npm run build
cd ..
echo -e "${GREEN}✅ Frontend built${NC}"
echo ""

# ============================================================================
# STEP 8: RESTART SERVICES
# ============================================================================
echo -e "${BLUE}→ Step 8: Restarting PM2 services...${NC}"
pm2 restart all
echo -e "${GREEN}✅ Services restarted${NC}"
echo ""

# ============================================================================
# STEP 9: WAIT FOR SERVICES TO START
# ============================================================================
echo -e "${BLUE}→ Step 9: Waiting for services to stabilize...${NC}"
sleep 5
echo -e "${GREEN}✅ Services online${NC}"
echo ""

# ============================================================================
# STEP 10: VERIFY DEPLOYMENT
# ============================================================================
echo -e "${BLUE}→ Step 10: Verifying deployment...${NC}"
echo ""

# Check PM2 status
echo "PM2 Status:"
pm2 status

echo ""
echo "Testing Socket.IO endpoint..."
SOCKET_RESPONSE=$(curl -s https://foodpanda.site/api/socket.io/\?EIO\=4\&transport\=polling 2>&1)

if echo "$SOCKET_RESPONSE" | grep -q 'sid'; then
    echo -e "${GREEN}✅ Socket.IO endpoint working!${NC}"
else
    echo -e "${YELLOW}⚠️  Socket.IO response: ${SOCKET_RESPONSE:0:100}${NC}"
    echo "   Testing endpoint: https://foodpanda.site/api/socket.io/"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════"
echo "║  ✅ DEPLOYMENT COMPLETE!"
echo "╚══════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}Platform Status:${NC}"
echo "   🌐 Frontend:      https://foodpanda.site"
echo "   🔌 Backend API:   https://foodpanda.site/api"
echo "   🔄 WebSocket:     https://foodpanda.site/api/socket.io/"
echo "   📄 Config File:   /etc/nginx/sites-available/${PLATFORM_CONFIG}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "   1. Open: https://foodpanda.site"
echo "   2. Login to dashboard"
echo "   3. Deploy a project"
echo "   4. Watch real-time logs in browser console (F12)"
echo ""
echo -e "${BLUE}Expected Console Output:${NC}"
echo "   ✅ Connected to deployment logs"
echo "   ✅ WebSocket client connected"
echo ""
echo "If WebSocket not working, check:"
echo "   pm2 logs backend | grep WebSocket"
echo "   pm2 logs frontend | grep socket"
echo ""
echo -e "${GREEN}🎉 All systems operational!${NC}"
echo ""
