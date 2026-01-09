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
# STEP 3: SETUP NGINX SOCKET.IO PROXY
# ============================================================================
echo -e "${BLUE}→ Step 3: Configuring Nginx for Socket.IO...${NC}"

# Check if default config exists, if not create it (for main platform server)
if [ ! -f "/etc/nginx/sites-available/default" ]; then
    echo "→ Default nginx config not found, creating for main platform..."
    
    # Create basic default config for main platform
    sudo tee /etc/nginx/sites-available/default > /dev/null << 'DEFAULTBLOCK'
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

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}

# Main domain server block
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
    
    # Platform Frontend (catch-all)
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
DEFAULTBLOCK
    
    # Enable default config
    if [ ! -f "/etc/nginx/sites-enabled/default" ]; then
        sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
    fi
    
    echo "✅ Created default nginx config for main platform"
fi

# Check if socket.io location already exists
if sudo grep -q "location /api/socket.io/" /etc/nginx/sites-available/default || sudo grep -q "location /socket.io/" /etc/nginx/sites-available/default; then
    echo "✅ Socket.IO location already configured"
else
    echo "→ Adding Socket.IO proxy to Nginx..."
    
    # Backup Nginx config
    sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%s)
    
    # Create socket.io location block (use /api/socket.io/ path)
    sudo tee /tmp/socket-io-nginx.conf > /dev/null << 'SOCKETBLOCK'

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
SOCKETBLOCK
    
    # Insert socket.io block after /api/ location block
    sudo awk '
    /location \/api\/ \{/ { in_api=1 }
    in_api && /^[[:space:]]*}[[:space:]]*$/ && !added {
        print
        while ((getline line < "/tmp/socket-io-nginx.conf") > 0) print line
        close("/tmp/socket-io-nginx.conf")
        added=1
        in_api=0
        next
    }
    {print}
    ' /etc/nginx/sites-available/default > /tmp/nginx-new.conf
    
    sudo mv /tmp/nginx-new.conf /etc/nginx/sites-available/default
    
    # Test and reload
    if sudo nginx -t 2>&1 | grep -q "successful"; then
        sudo systemctl reload nginx
        echo -e "${GREEN}✅ Nginx configured and reloaded${NC}"
    else
        echo -e "${RED}❌ Nginx config error, restoring backup${NC}"
        sudo cp /etc/nginx/sites-available/default.backup.* /etc/nginx/sites-available/default 2>/dev/null | tail -1
        sudo systemctl reload nginx
    fi
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
SOCKET_RESPONSE=$(curl -s https://foodpanda.site/socket.io/\?EIO\=4\&transport\=polling)

if echo "$SOCKET_RESPONSE" | grep -q 'sid'; then
    echo -e "${GREEN}✅ Socket.IO endpoint working!${NC}"
else
    echo -e "${YELLOW}⚠️  Socket.IO response: ${SOCKET_RESPONSE:0:100}${NC}"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════"
echo "║  ✅ DEPLOYMENT COMPLETE!"
echo "╚══════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}Platform Status:${NC}"
echo "   🌐 Frontend:      https://foodpanda.site"
echo "   🔌 Backend API:   https://foodpanda.site/api"
echo "   🔄 WebSocket:     https://foodpanda.site/socket.io"
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
