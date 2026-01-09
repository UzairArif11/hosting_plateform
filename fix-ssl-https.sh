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

# Step 2: Find Nginx config file for this domain
echo ""
echo -e "${BLUE}━━━ Step 2: Finding Nginx Config File ━━━${NC}"

# Try to find config file for this domain
CONFIG_FILE=""
if [ "$DOMAIN" = "foodpanda.site" ] || [ "$DOMAIN" = "www.foodpanda.site" ]; then
    # Main platform - use platform config
    CONFIG_FILE="/etc/nginx/sites-available/platform-foodpanda-site.conf"
    if [ ! -f "$CONFIG_FILE" ]; then
        echo -e "${YELLOW}⚠ Platform config not found, will create it${NC}"
        CONFIG_FILE=""  # Will be created by certbot or manually
    fi
else
    # Deployment server - find deployment config
    CONFIG_FILE=$(sudo find /etc/nginx/sites-available -name "user-deployments-*.conf" -type f 2>/dev/null | head -1)
    if [ -z "$CONFIG_FILE" ]; then
        # Try to find by domain
        CONFIG_FILE=$(sudo grep -l "server_name.*$DOMAIN" /etc/nginx/sites-available/*.conf 2>/dev/null | head -1)
    fi
fi

if [ -n "$CONFIG_FILE" ] && [ -f "$CONFIG_FILE" ]; then
    echo -e "${GREEN}✓ Found config file: $CONFIG_FILE${NC}"
    if sudo grep -q "listen 443" "$CONFIG_FILE"; then
        echo -e "${GREEN}✓ HTTPS server block exists${NC}"
    else
        echo -e "${YELLOW}⚠ No HTTPS server block found${NC}"
    fi
    
    if sudo grep -q "server_name.*$DOMAIN" "$CONFIG_FILE"; then
        echo -e "${GREEN}✓ Domain $DOMAIN found in config${NC}"
    else
        echo -e "${YELLOW}⚠ Domain $DOMAIN not found, certbot will add it${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Config file not found for $DOMAIN${NC}"
    echo "  Will search for deployment config or create new one..."
    CONFIG_FILE=""
fi

# Step 3: Clean up old backups (keep only last 10)
echo ""
echo -e "${BLUE}━━━ Step 3: Cleaning Up Old Backups ━━━${NC}"
sudo ls -t /etc/nginx/sites-available/*.backup.* 2>/dev/null | tail -n +11 | sudo xargs rm -f 2>/dev/null || true
echo "✓ Cleaned up old backups (kept last 10)"

# Step 4: Configure SSL
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
    echo "→ Certificate exists, configuring nginx..."
    
    # If config file exists, update SSL paths manually (certbot may not work with separate files)
    if [ -n "$CONFIG_FILE" ] && [ -f "$CONFIG_FILE" ]; then
        echo "→ Updating SSL certificate paths in $CONFIG_FILE..."
        
        # Get certificate path
        CERT_PATH=$(sudo certbot certificates 2>/dev/null | grep -A 10 "$DOMAIN" | grep "Certificate Path" | awk '{print $3}' | head -1)
        KEY_PATH=$(sudo certbot certificates 2>/dev/null | grep -A 10 "$DOMAIN" | grep "Private Key Path" | awk '{print $4}' | head -1)
        
        if [ -n "$CERT_PATH" ] && [ -n "$KEY_PATH" ]; then
            # Backup
            sudo cp "$CONFIG_FILE" "${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
            
            # Update SSL certificate paths (uncomment and set paths)
            sudo sed -i "s|# ssl_certificate /etc/letsencrypt/live/\$DOMAIN|ssl_certificate $CERT_PATH|g" "$CONFIG_FILE"
            sudo sed -i "s|# ssl_certificate_key /etc/letsencrypt/live/\$DOMAIN|ssl_certificate_key $KEY_PATH|g" "$CONFIG_FILE"
            sudo sed -i "s|# ssl_certificate|ssl_certificate|g" "$CONFIG_FILE" 2>/dev/null || true
            
            # Also handle paths without $DOMAIN variable
            sudo sed -i "s|ssl_certificate /etc/letsencrypt/live/\$DOMAIN|ssl_certificate $CERT_PATH|g" "$CONFIG_FILE"
            sudo sed -i "s|ssl_certificate_key /etc/letsencrypt/live/\$DOMAIN|ssl_certificate_key $KEY_PATH|g" "$CONFIG_FILE"
            
            echo "✓ SSL paths updated"
        fi
    else
        # Try certbot
        sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --reinstall --redirect --non-interactive || echo "⚠ Certbot failed, SSL paths may need manual update"
    fi
else
    echo "→ Obtaining new certificate..."
    
    # If config file doesn't exist, create basic one first
    if [ -z "$CONFIG_FILE" ] || [ ! -f "$CONFIG_FILE" ]; then
        echo "⚠ Config file not found, certbot will create one..."
    fi
    
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --agree-tos --email $EMAIL --redirect --non-interactive || {
        echo -e "${YELLOW}⚠ Certbot failed - this is normal if domain DNS is not pointing here yet${NC}"
        echo "  You can run this script again after DNS is configured"
    }
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
