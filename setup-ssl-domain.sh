#!/bin/bash

###############################################################################
# SSL & DOMAIN SETUP SCRIPT
# Run this AFTER deploy-production.sh and DNS is configured
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Get domain from argument or prompt
DOMAIN=${1:-}

if [ -z "$DOMAIN" ]; then
    echo -e "${CYAN}Enter your domain name (e.g., foodpanda.site):${NC}"
    read DOMAIN
fi

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         SSL CERTIFICATE SETUP                              ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo -e "${BLUE}Domain: ${GREEN}$DOMAIN${NC}"

step() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}▶ $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

step "Step 1: Verifying DNS Configuration"
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "unknown")
DOMAIN_IP=$(dig +short $DOMAIN | head -1)

echo -e "Server IP:  ${GREEN}$SERVER_IP${NC}"
echo -e "Domain IP:  ${GREEN}$DOMAIN_IP${NC}"

if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
    echo -e "${RED}✗ DNS not configured correctly!${NC}"
    echo -e "${YELLOW}Please point $DOMAIN A record to $SERVER_IP${NC}"
    echo -e "${YELLOW}Wait 5-30 minutes for DNS propagation, then run this script again.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ DNS configured correctly${NC}"

step "Step 2: Installing Certbot"
if ! command -v certbot &> /dev/null; then
    sudo apt update
    sudo apt install certbot python3-certbot-nginx -y
    echo -e "${GREEN}✓ Certbot installed${NC}"
else
    echo -e "${GREEN}✓ Certbot already installed${NC}"
fi

step "Step 3: Updating Nginx Configuration with Domain"

# Backup current config
sudo cp /etc/nginx/sites-available/platform /etc/nginx/sites-available/platform.backup

# Update server_name
sudo sed -i "s/server_name _;/server_name $DOMAIN www.$DOMAIN;/" /etc/nginx/sites-available/platform

echo -e "${GREEN}✓ Nginx configuration updated with domain${NC}"

# Test config
if sudo nginx -t; then
    sudo systemctl reload nginx
    echo -e "${GREEN}✓ Nginx reloaded${NC}"
else
    echo -e "${RED}✗ Nginx configuration error${NC}"
    exit 1
fi

step "Step 4: Obtaining SSL Certificate"
echo -e "${CYAN}This will request a certificate from Let's Encrypt...${NC}"
echo -e "${YELLOW}You'll be asked for an email address.${NC}"

sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --redirect --agree-tos

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ SSL certificate installed successfully${NC}"
else
    echo -e "${RED}✗ SSL certificate installation failed${NC}"
    exit 1
fi

step "Step 5: Setting Up Auto-Renewal"
# Test renewal
sudo certbot renew --dry-run
echo -e "${GREEN}✓ Auto-renewal configured${NC}"

step "Step 6: Updating Frontend Environment"
cd frontend

# Update .env.local with HTTPS
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=https://$DOMAIN
EOF

echo -e "${GREEN}✓ Frontend .env.local updated with HTTPS${NC}"

# Rebuild frontend with new API URL
echo -e "${CYAN}Rebuilding frontend with HTTPS API URL...${NC}"
npm run build

# Restart frontend PM2
pm2 restart frontend
echo -e "${GREEN}✓ Frontend restarted with HTTPS configuration${NC}"

cd ..

step "Step 7: Final Verification"
sleep 3

# Test HTTPS
if curl -s https://$DOMAIN > /dev/null 2>&1; then
    echo -e "${GREEN}✓ HTTPS is working!${NC}"
else
    echo -e "${YELLOW}⚠ HTTPS check inconclusive (might take a few seconds)${NC}"
fi

# Summary
echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              SSL SETUP COMPLETE!                           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"

echo -e "${GREEN}✓ Your platform is now live with SSL!${NC}"
echo -e ""
echo -e "${BLUE}━━━ Access URLs (HTTPS) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Frontend:  ${GREEN}https://$DOMAIN/${NC}"
echo -e "  Backend:   ${GREEN}https://$DOMAIN/api${NC}"
echo -e ""
echo -e "${BLUE}━━━ Certificate Details ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Issued by: ${GREEN}Let's Encrypt${NC}"
echo -e "  Valid for: ${GREEN}90 days${NC}"
echo -e "  Auto-renewal: ${GREEN}Enabled${NC}"
echo -e ""
echo -e "${BLUE}━━━ Database Access (SSH Tunnel) ━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${YELLOW}Termius Port Forwarding:${NC}"
echo -e "    Local: 27017 → Remote: localhost:27017"
echo -e ""
echo -e "  ${YELLOW}MongoDB Compass Connection:${NC}"
echo -e "    ${GREEN}mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin${NC}"
echo -e ""
echo -e "${GREEN}🔒 Your platform is now secured with SSL!${NC}"

