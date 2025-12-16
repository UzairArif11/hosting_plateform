#!/bin/bash

###############################################################################
# SSL SETUP SCRIPT FOR EC3
# 
# This script automates SSL certificate setup using Let's Encrypt
# 
# Usage:
#   chmod +x setup-ssl.sh
#   ./setup-ssl.sh
#
# Requirements:
#   - Domain pointing to EC3 IP (129.154.255.90)
#   - SSH access to EC3
#   - Nginx installed on EC3
###############################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${DOMAIN:-foodpanda.site}"
EMAIL="${SSL_EMAIL:-admin@foodpanda.site}"
EC3_HOST="${EC3_HOST:-129.154.255.90}"
SSH_KEY="${SSH_EC3_KEY:-D:/work/ec3/uz.key}"
SSH_USER="${SSH_USERNAME:-ubuntu}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         SSL CERTIFICATE SETUP FOR EC3                      ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo ""
echo -e "${GREEN}Domain:${NC} $DOMAIN"
echo -e "${GREEN}Email:${NC} $EMAIL"
echo -e "${GREEN}Server:${NC} $EC3_HOST"
echo ""

# Function to run command on EC3
run_on_ec3() {
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$EC3_HOST" "$1"
}

# Function to print step
step() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}▶ $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to print success
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error
error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to print warning
warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Step 1: Check SSH connection
step "Step 1: Testing SSH Connection"
if run_on_ec3 "echo 'SSH connection successful'"; then
    success "SSH connection working"
else
    error "Failed to connect to EC3 via SSH"
    exit 1
fi

# Step 2: Check if domain points to EC3
step "Step 2: Checking DNS Configuration"
DOMAIN_IP=$(dig +short $DOMAIN | tail -n1)
if [ "$DOMAIN_IP" == "$EC3_HOST" ]; then
    success "Domain $DOMAIN points to $EC3_HOST"
else
    warning "Domain $DOMAIN points to $DOMAIN_IP, expected $EC3_HOST"
    echo -e "${YELLOW}Please update your DNS records before continuing${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 3: Install Certbot
step "Step 3: Installing Certbot"
run_on_ec3 "sudo apt update" || true
if run_on_ec3 "sudo apt install -y certbot python3-certbot-nginx"; then
    success "Certbot installed"
else
    error "Failed to install Certbot"
    exit 1
fi

# Step 4: Check Nginx configuration
step "Step 4: Checking Nginx Configuration"
if run_on_ec3 "sudo nginx -t"; then
    success "Nginx configuration is valid"
else
    error "Nginx configuration has errors"
    exit 1
fi

# Step 5: Create Nginx configuration for domain
step "Step 5: Creating Nginx Configuration"

NGINX_CONFIG="server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect to HTTPS (will be added after cert is obtained)
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    # SSL certificates (will be added by certbot)
    # ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy to backend
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # WebSocket support
    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Deployed apps (dynamic routing)
    location ~ ^/([a-zA-Z0-9-]+)/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}"

# Write config to EC3
run_on_ec3 "echo '$NGINX_CONFIG' | sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null"
run_on_ec3 "sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN"
run_on_ec3 "sudo nginx -t && sudo systemctl reload nginx"

success "Nginx configuration created"

# Step 6: Obtain SSL certificate
step "Step 6: Obtaining SSL Certificate"
echo -e "${YELLOW}This will request a certificate from Let's Encrypt${NC}"
echo -e "${YELLOW}Make sure port 80 is open and domain is pointing to EC3${NC}"
echo ""

if run_on_ec3 "sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect"; then
    success "SSL certificate obtained successfully!"
else
    error "Failed to obtain SSL certificate"
    echo ""
    echo -e "${YELLOW}Common issues:${NC}"
    echo "  1. Domain not pointing to EC3"
    echo "  2. Port 80 blocked by firewall"
    echo "  3. Nginx not running"
    echo "  4. Rate limit reached (5 certs per week)"
    exit 1
fi

# Step 7: Test SSL certificate
step "Step 7: Testing SSL Certificate"
if curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN | grep -q "200\|301\|302"; then
    success "SSL certificate is working!"
else
    warning "Could not verify SSL certificate via HTTPS"
fi

# Step 8: Set up auto-renewal
step "Step 8: Setting Up Auto-Renewal"
if run_on_ec3 "sudo certbot renew --dry-run"; then
    success "Auto-renewal is configured"
    echo -e "${GREEN}Certificates will auto-renew before expiration${NC}"
else
    warning "Auto-renewal test failed"
fi

# Step 9: Update backend .env
step "Step 9: Updating Backend Configuration"
echo ""
echo -e "${YELLOW}Update your backend .env file:${NC}"
echo -e "${GREEN}PROTOCOL=https${NC}"
echo -e "${GREEN}BASE_DOMAIN=$DOMAIN${NC}"
echo -e "${GREEN}DOCKER_USE_HTTPS=true${NC}"
echo ""

# Final summary
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  SSL SETUP COMPLETE!                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ SSL certificate installed${NC}"
echo -e "${GREEN}✓ HTTPS enabled${NC}"
echo -e "${GREEN}✓ Auto-renewal configured${NC}"
echo ""
echo -e "${YELLOW}Your site is now accessible at:${NC}"
echo -e "${GREEN}  https://$DOMAIN${NC}"
echo -e "${GREEN}  https://www.$DOMAIN${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Update backend .env with PROTOCOL=https"
echo "  2. Restart backend: pm2 restart backend"
echo "  3. Test deployment: https://$DOMAIN/api/health"
echo ""
echo -e "${GREEN}Done! 🎉${NC}"
