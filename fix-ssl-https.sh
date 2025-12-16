#!/bin/bash

###############################################################################
# FIX SSL/HTTPS - UNIVERSAL SCRIPT
# Works on EC2, EC3, EC4, EC5 - any server
###############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         FIX SSL/HTTPS - UNIVERSAL                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Ask for domain
echo -e "${BLUE}━━━ Domain Configuration ━━━${NC}"
echo ""
echo "Which server is this?"
echo "  EC2: ec2.foodpanda.site"
echo "  EC3: foodpanda.site"
echo "  EC4: ec4.foodpanda.site"
echo "  EC5: ec5.foodpanda.site"
echo ""
read -p "Enter domain name (e.g., foodpanda.site or ec2.foodpanda.site): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Error: Domain is required${NC}"
    exit 1
fi

# Ask for email
read -p "Enter SSL email (default: admin@$DOMAIN): " EMAIL
EMAIL="${EMAIL:-admin@$DOMAIN}"

echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Domain: $DOMAIN"
echo "  Email: $EMAIL"
echo "  Server: $(hostname)"
echo "  IP: $(hostname -I | awk '{print $1}')"
echo ""

read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Step 1: Check current SSL status
echo ""
echo -e "${BLUE}━━━ Step 1: Checking SSL Status ━━━${NC}"
if sudo certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
    echo -e "${GREEN}✓ SSL certificate exists for $DOMAIN${NC}"
    sudo certbot certificates | grep -A 10 "$DOMAIN"
else
    echo -e "${YELLOW}⚠ No SSL certificate found for $DOMAIN${NC}"
    echo "  Will attempt to obtain new certificate..."
fi

# Step 2: Check Nginx config
echo ""
echo -e "${BLUE}━━━ Step 2: Checking Nginx Config ━━━${NC}"
if sudo cat /etc/nginx/sites-available/default | grep -q "listen 443"; then
    echo -e "${GREEN}✓ HTTPS server block exists${NC}"
else
    echo -e "${YELLOW}⚠ No HTTPS server block found${NC}"
    echo "  Certbot will add it..."
fi

# Step 3: Check if domain is in Nginx config
echo ""
echo -e "${BLUE}━━━ Step 3: Checking Domain in Nginx ━━━${NC}"
if sudo cat /etc/nginx/sites-available/default | grep -q "server_name.*$DOMAIN"; then
    echo -e "${GREEN}✓ Domain $DOMAIN found in Nginx config${NC}"
else
    echo -e "${RED}✗ Domain $DOMAIN NOT found in Nginx config${NC}"
    echo ""
    echo -e "${YELLOW}WARNING: You need to run setup-deployment-server.sh first!${NC}"
    echo "  Or manually add this domain to /etc/nginx/sites-available/default"
    echo ""
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 4: Re-run Certbot
echo ""
echo -e "${BLUE}━━━ Step 4: Configuring SSL ━━━${NC}"
echo "This will:"
echo "  1. Obtain/use SSL certificate for $DOMAIN"
echo "  2. Configure Nginx for HTTPS"
echo "  3. Add HTTP to HTTPS redirect"
echo "  4. Configure www.$DOMAIN (if applicable)"
echo ""

# Check if certificate exists
if sudo certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
    echo "Using existing certificate..."
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --reinstall --redirect
else
    echo "Obtaining new certificate..."
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --agree-tos --email $EMAIL --redirect --non-interactive
fi

# Step 5: Test Nginx
echo ""
echo -e "${BLUE}━━━ Step 5: Testing Nginx Config ━━━${NC}"
if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓ Nginx config is valid${NC}"
    
    # Reload Nginx
    sudo systemctl reload nginx
    echo -e "${GREEN}✓ Nginx reloaded${NC}"
else
    echo -e "${RED}✗ Nginx config has errors${NC}"
    sudo nginx -t
    exit 1
fi

# Step 6: Verify ports
echo ""
echo -e "${BLUE}━━━ Step 6: Verifying Ports ━━━${NC}"
echo "Checking if Nginx is listening on ports 80 and 443:"
sudo netstat -tlnp | grep nginx | grep -E ':(80|443) '

if sudo netstat -tlnp | grep nginx | grep -q ':443 '; then
    echo -e "${GREEN}✓ Nginx listening on port 443 (HTTPS)${NC}"
else
    echo -e "${RED}✗ Nginx NOT listening on port 443${NC}"
    echo "  This might be a firewall issue"
fi

# Step 7: Show SSL certificate info
echo ""
echo -e "${BLUE}━━━ Step 7: SSL Certificate Info ━━━${NC}"
sudo certbot certificates | grep -A 10 "$DOMAIN"

# Step 8: Final summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ SSL CONFIGURATION COMPLETE!                           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Configuration Summary:${NC}"
echo "  Domain: $DOMAIN"
echo "  Email: $EMAIL"
echo "  Server: $(hostname)"
echo "  IP: $(hostname -I | awk '{print $1}')"
echo ""
echo -e "${YELLOW}Test HTTPS:${NC}"
echo "  curl https://$DOMAIN/"
echo ""
echo -e "${YELLOW}If HTTPS still not working, check:${NC}"
echo ""
echo "1. ${BLUE}Oracle Cloud Security List:${NC}"
echo "   - Go to Oracle Cloud Console"
echo "   - Navigate to: Networking → Virtual Cloud Networks"
echo "   - Select your VCN → Security Lists"
echo "   - Add Ingress Rule:"
echo "     • Source: 0.0.0.0/0"
echo "     • Protocol: TCP"
echo "     • Destination Port: 443"
echo ""
echo "2. ${BLUE}Firewall (if using UFW):${NC}"
echo "   sudo ufw status"
echo "   sudo ufw allow 443/tcp"
echo ""
echo "3. ${BLUE}Nginx logs:${NC}"
echo "   sudo tail -f /var/log/nginx/error.log"
echo ""
echo "4. ${BLUE}Test from outside:${NC}"
echo "   curl -I https://$DOMAIN/"
echo ""
