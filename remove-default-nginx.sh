#!/bin/bash

###############################################################################
# REMOVE DEFAULT NGINX CONFIG
# Safely removes default nginx config from deployment servers
# Only use on servers that ONLY serve user deployments (EC3, EC2, etc.)
# DO NOT run on main platform server (foodpanda.site)
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Remove Default Nginx Config                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Safety check - warn if this looks like main platform server
if hostname | grep -qi "foodpanda\|main\|platform" || [ -f "/etc/nginx/sites-available/default" ] && sudo grep -q "foodpanda.site" /etc/nginx/sites-available/default 2>/dev/null; then
    echo -e "${RED}⚠️  WARNING: This looks like a main platform server!${NC}"
    echo "   Default config is needed for main platform (foodpanda.site)"
    echo "   Only remove default on deployment-only servers (EC3, EC2, etc.)"
    echo ""
    read -p "Continue anyway? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Aborted."
        exit 1
    fi
fi

echo -e "${BLUE}━━━ Removing Default Nginx Config ━━━${NC}"
echo ""

# Check if default is enabled
if [ -L "/etc/nginx/sites-enabled/default" ] || [ -f "/etc/nginx/sites-enabled/default" ]; then
    echo "→ Removing default from sites-enabled..."
    sudo rm -f /etc/nginx/sites-enabled/default
    echo -e "${GREEN}✓ Removed default from sites-enabled${NC}"
else
    echo "✓ Default not in sites-enabled (already removed or never existed)"
fi

# Backup and remove from sites-available
if [ -f "/etc/nginx/sites-available/default" ]; then
    echo "→ Creating backup..."
    BACKUP_FILE="/etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)"
    sudo cp /etc/nginx/sites-available/default "$BACKUP_FILE"
    echo "  Backup saved to: $BACKUP_FILE"
    
    echo "→ Removing default from sites-available..."
    sudo rm -f /etc/nginx/sites-available/default
    echo -e "${GREEN}✓ Removed default from sites-available${NC}"
else
    echo "✓ Default not in sites-available (already removed or never existed)"
fi

# Verify other configs exist
echo ""
echo -e "${BLUE}━━━ Verifying Other Configs ━━━${NC}"
DEPLOYMENT_CONFIGS=$(sudo ls /etc/nginx/sites-enabled/*.conf 2>/dev/null | grep -v default || echo "")
if [ -z "$DEPLOYMENT_CONFIGS" ]; then
    echo -e "${YELLOW}⚠️  WARNING: No other nginx configs found in sites-enabled!${NC}"
    echo "   Make sure you have deployment config files enabled"
    echo "   Example: user-deployments-EC3.conf"
else
    echo -e "${GREEN}✓ Found other config files:${NC}"
    echo "$DEPLOYMENT_CONFIGS" | while read -r config; do
        echo "  - $(basename $config)"
    done
fi

# Test nginx config
echo ""
echo -e "${BLUE}━━━ Testing Nginx Config ━━━${NC}"
if sudo nginx -t 2>&1 | grep -q "successful\|syntax is ok"; then
    echo -e "${GREEN}✓ Nginx configuration is valid${NC}"
    echo ""
    echo "→ Reloading nginx..."
    sudo systemctl reload nginx
    echo -e "${GREEN}✓ Nginx reloaded successfully${NC}"
else
    echo -e "${RED}✗ Nginx configuration test FAILED!${NC}"
    echo ""
    echo "Error output:"
    sudo nginx -t 2>&1 | head -20
    echo ""
    echo -e "${YELLOW}⚠️  To restore default config, run:${NC}"
    echo "   sudo cp $BACKUP_FILE /etc/nginx/sites-available/default"
    echo "   sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default"
    exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         ✅ Default Config Removed Successfully!            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Summary:"
echo "  ✓ Default removed from sites-enabled"
echo "  ✓ Default removed from sites-available (backup created)"
echo "  ✓ Nginx config validated"
echo "  ✓ Nginx reloaded"
echo ""
echo "This server now uses only deployment-specific config files."
echo ""
