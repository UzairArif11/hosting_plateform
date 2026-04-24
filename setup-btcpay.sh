#!/bin/bash

###############################################################################
# BTCPay Server Setup Script
#
# This script installs and configures BTCPay Server on your VPS using Docker.
# It supports both TESTNET (development) and MAINNET (production) modes.
#
# Usage:
#   chmod +x setup-btcpay.sh
#   ./setup-btcpay.sh <DOMAIN> [MODE]
#
# Examples:
#   ./setup-btcpay.sh pay.yourdomain.com testnet    # Development (fake BTC)
#   ./setup-btcpay.sh pay.yourdomain.com mainnet    # Production (real BTC)
#   ./setup-btcpay.sh pay.yourdomain.com regtest    # Local testing (instant blocks)
#
# Prerequisites:
#   - Ubuntu/Debian VPS (minimum: 1 CPU, 2GB RAM, 20GB SSD — pruned node)
#   - Root or sudo access
#   - Domain DNS A record pointing to this server's IP
#
# What this script does:
#   1. Installs Docker & Docker Compose (if not installed)
#   2. Clones BTCPay Server Docker repository
#   3. Configures BTCPay for your domain and network mode
#   4. Starts BTCPay Server with nginx reverse proxy + auto SSL
#   5. Shows you next steps to complete setup in BTCPay dashboard
#
###############################################################################

# NOTE: Not using 'set -e' because btcpay-setup.sh may partially fail
# (e.g., old docker-compose ContainerConfig bug) and we fix it in step 5

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Arguments
BTCPAY_DOMAIN=${1}
NETWORK_MODE=${2:-testnet}

# Validate
if [ -z "$BTCPAY_DOMAIN" ]; then
    echo -e "${RED}Usage: $0 <DOMAIN> [MODE]${NC}"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo -e "  $0 pay.yourdomain.com testnet    # Development"
    echo -e "  $0 pay.yourdomain.com mainnet    # Production"
    echo -e "  $0 pay.yourdomain.com regtest    # Local testing"
    echo ""
    echo -e "${YELLOW}Modes:${NC}"
    echo -e "  testnet  - Bitcoin Testnet (fake BTC for testing)"
    echo -e "  mainnet  - Bitcoin Mainnet (real BTC for production)"
    echo -e "  regtest  - Regtest (mine instant blocks, no network needed)"
    exit 1
fi

# Validate network mode
if [[ "$NETWORK_MODE" != "testnet" && "$NETWORK_MODE" != "mainnet" && "$NETWORK_MODE" != "regtest" ]]; then
    echo -e "${RED}Invalid mode: $NETWORK_MODE${NC}"
    echo -e "${YELLOW}Valid modes: testnet, mainnet, regtest${NC}"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              BTCPay Server Setup                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Domain:${NC}  $BTCPAY_DOMAIN"
echo -e "${GREEN}Network:${NC} $NETWORK_MODE"
echo -e "${GREEN}Server:${NC}  $(hostname -I | awk '{print $1}')"
echo ""

# Confirm
if [ "$NETWORK_MODE" == "mainnet" ]; then
    echo -e "${RED}WARNING: You are setting up MAINNET (real money)!${NC}"
    echo -e "${YELLOW}Make sure you have backups and understand the risks.${NC}"
    echo ""
fi
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Cancelled.${NC}"
    exit 0
fi

# ─────────────────────────────────────────────────────────────
# Step 1: Install Docker
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[Step 1/7] Checking Docker...${NC}"

if command -v docker &> /dev/null; then
    echo -e "${GREEN}Docker already installed: $(docker --version)${NC}"
else
    echo -e "${YELLOW}Installing Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
    echo -e "${GREEN}Docker installed successfully${NC}"
fi

# Install docker-compose v2 (required — old v1.29 has ContainerConfig bug)
if docker compose version &>/dev/null; then
    echo -e "${GREEN}Docker Compose v2 available${NC}"
else
    echo -e "${YELLOW}Installing Docker Compose v2...${NC}"
    apt-get install -y docker-compose-v2 2>/dev/null || \
    apt-get install -y docker-compose-plugin 2>/dev/null || {
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    }
    echo -e "${GREEN}Docker Compose v2 installed${NC}"
fi

# ─────────────────────────────────────────────────────────────
# Step 2: Clone BTCPay Docker Repository
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[Step 2/7] Setting up BTCPay repository...${NC}"

BTCPAY_DIR="/opt/btcpayserver-docker"

if [ -d "$BTCPAY_DIR" ]; then
    echo -e "${YELLOW}BTCPay directory already exists at $BTCPAY_DIR${NC}"
    echo -e "${YELLOW}Pulling latest updates...${NC}"
    cd "$BTCPAY_DIR"
    git pull
else
    echo -e "${GREEN}Cloning BTCPay Server Docker...${NC}"
    git clone https://github.com/btcpayserver/btcpayserver-docker "$BTCPAY_DIR"
    cd "$BTCPAY_DIR"
fi

# ─────────────────────────────────────────────────────────────
# Step 3: Configure BTCPay Environment
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[Step 3/7] Configuring BTCPay Server...${NC}"

export BTCPAY_HOST="$BTCPAY_DOMAIN"
export NBITCOIN_NETWORK="$NETWORK_MODE"
export BTCPAYGEN_CRYPTO1="btc"
# Use "none" to avoid port 80 conflict with existing nginx
export BTCPAYGEN_REVERSEPROXY="none"
export BTCPAY_ENABLE_SSH=true

BTCPAY_INTERNAL_PORT=49392

# ── CRITICAL: Enable pruned Bitcoin node to save storage ──
# Without this, Bitcoin downloads the FULL blockchain (500GB+ mainnet, 50GB+ testnet)
# opt-save-storage-s = aggressive pruning, keeps blockchain under ~5GB
# This does NOT affect payment functionality — BTCPay/NBXplorer only needs the UTXO set
STORAGE_FRAGMENTS="opt-save-storage-s"

# Add Lightning for mainnet (optional but recommended)
if [ "$NETWORK_MODE" == "mainnet" ]; then
    export BTCPAYGEN_LIGHTNING="clightning"
    echo -e "${GREEN}Lightning Network: enabled (clightning)${NC}"
fi

# Add regtest configurator
if [ "$NETWORK_MODE" == "regtest" ]; then
    STORAGE_FRAGMENTS="${STORAGE_FRAGMENTS};opt-add-configurator"
    echo -e "${GREEN}Regtest configurator: enabled${NC}"
fi

# Apply storage optimization fragments
export BTCPAYGEN_ADDITIONAL_FRAGMENTS="$STORAGE_FRAGMENTS"
echo -e "${GREEN}Storage mode: PRUNED (opt-save-storage-s) — max ~5GB blockchain data${NC}"

echo -e "${GREEN}Host:        $BTCPAY_HOST${NC}"
echo -e "${GREEN}Network:     $NBITCOIN_NETWORK${NC}"
echo -e "${GREEN}Crypto:      $BTCPAYGEN_CRYPTO1${NC}"
echo -e "${GREEN}Proxy:       none (uses existing nginx)${NC}"
echo -e "${GREEN}Internal:    port $BTCPAY_INTERNAL_PORT${NC}"
echo -e "${GREEN}Fragments:   $BTCPAYGEN_ADDITIONAL_FRAGMENTS${NC}"
echo -e "${GREEN}Max Storage: ~5-10GB (pruned)${NC}"

# ─────────────────────────────────────────────────────────────
# Step 4: Run BTCPay Setup
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[Step 4/7] Starting BTCPay Server...${NC}"
echo -e "${YELLOW}This may take 5-15 minutes (downloading Docker images)...${NC}"

# btcpay-setup.sh may fail on container start (port conflict, old docker-compose)
# That's OK — we fix it in step 5
. ./btcpay-setup.sh -i || echo -e "${YELLOW}BTCPay initial setup had errors (expected on shared servers). Fixing...${NC}"

# ─────────────────────────────────────────────────────────────
# Step 5: Fix port mapping (avoid port 80 conflict)
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[Step 5/7] Fixing port mapping...${NC}"

COMPOSE_FILE="$BTCPAY_DIR/Generated/docker-compose.generated.yml"

# Change port 80 → 49392 to avoid conflict with existing nginx
if grep -q 'NOREVERSEPROXY_HTTP_PORT:-80' "$COMPOSE_FILE"; then
    sed -i "s/\${NOREVERSEPROXY_HTTP_PORT:-80}:${BTCPAY_INTERNAL_PORT}/${BTCPAY_INTERNAL_PORT}:${BTCPAY_INTERNAL_PORT}/" "$COMPOSE_FILE"
    echo -e "${GREEN}Port mapping fixed: 80 → $BTCPAY_INTERNAL_PORT${NC}"
fi

# Remove any stale BTCPay container and recreate
docker rm -f generated_btcpayserver_1 2>/dev/null || true

# Start all BTCPay services with correct port
docker compose -f "$COMPOSE_FILE" up -d
echo -e "${GREEN}BTCPay containers started${NC}"

# Wait for postgres + nbxplorer to be ready (creates databases)
echo -e "${YELLOW}Waiting for database initialization (15s)...${NC}"
sleep 15

# Restart nbxplorer (creates nbxplorertestnet/nbxplorer DB if missing)
docker restart generated_nbxplorer_1 2>/dev/null || true
sleep 5

# Restart BTCPay (now DB exists)
docker restart generated_btcpayserver_1 2>/dev/null || true
sleep 5

# Verify BTCPay is running
if docker ps | grep -q btcpayserver_1; then
    echo -e "${GREEN}BTCPay container running on port $BTCPAY_INTERNAL_PORT${NC}"
else
    echo -e "${RED}BTCPay container failed to start. Check: docker logs generated_btcpayserver_1${NC}"
fi

# ─────────────────────────────────────────────────────────────
# Step 6: Configure nginx reverse proxy
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[Step 6/7] Configuring nginx reverse proxy...${NC}"

cat > /etc/nginx/sites-available/btcpay << NGINXEOF
server {
    listen 80;
    server_name $BTCPAY_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$BTCPAY_INTERNAL_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/btcpay /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
echo -e "${GREEN}nginx configured for $BTCPAY_DOMAIN → port $BTCPAY_INTERNAL_PORT${NC}"

# ─────────────────────────────────────────────────────────────
# Step 7: SSL + webhook secret
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[Step 7/7] Setting up SSL and generating secrets...${NC}"

# SSL via certbot
if command -v certbot &>/dev/null; then
    certbot --nginx -d "$BTCPAY_DOMAIN" --non-interactive --agree-tos -m "admin@$(echo $BTCPAY_DOMAIN | cut -d. -f2-)" 2>/dev/null && \
        echo -e "${GREEN}SSL certificate installed${NC}" || \
        echo -e "${YELLOW}SSL setup failed — run manually: certbot --nginx -d $BTCPAY_DOMAIN${NC}"
else
    echo -e "${YELLOW}certbot not found. Install: apt install certbot python3-certbot-nginx${NC}"
fi

WEBHOOK_SECRET=$(openssl rand -hex 32)

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              BTCPay Server is Running!                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}BTCPay URL:${NC}       https://$BTCPAY_DOMAIN"
echo -e "${GREEN}Network:${NC}          $NETWORK_MODE"
echo -e "${GREEN}Internal Port:${NC}    $BTCPAY_INTERNAL_PORT"
echo -e "${GREEN}Webhook Secret:${NC}   $WEBHOOK_SECRET"
echo ""

if [ "$NETWORK_MODE" == "testnet" ]; then
    echo -e "${YELLOW}TESTNET MODE — No real money. Get free testnet BTC from:${NC}"
    echo -e "  https://coinfaucet.eu/en/btc-testnet/"
    echo -e "  https://testnet-faucet.com/btc-testnet/"
    echo ""
fi

echo -e "${CYAN}═══ NEXT STEPS (do these in the BTCPay dashboard) ═══${NC}"
echo ""
echo -e "${GREEN}1. Open${NC} https://$BTCPAY_DOMAIN"
echo -e "   First visitor becomes the admin — create your account now!"
echo ""
echo -e "${GREEN}2. Create Store${NC}"
echo -e "   Store → Create → Name: \"Your Platform Name\""
echo ""
echo -e "${GREEN}3. Connect Bitcoin Wallet${NC}"
echo -e "   Store → Wallets → Bitcoin → Setup"
echo -e "   Choose \"Create new wallet\" (easiest) — SAVE the 12 seed words!"
echo ""
echo -e "${GREEN}4. Create API Key${NC}"
echo -e "   Account (top-right) → API Keys → Generate"
echo -e "   Permissions: btcpay.store.cancreateinvoice, btcpay.store.canviewinvoices"
echo -e "   Copy the key — you'll need it for Admin Settings"
echo ""
echo -e "${GREEN}5. Create Webhook${NC}"
echo -e "   Store → Settings → Webhooks → Create"
echo -e "   URL:    https://YOUR-PLATFORM-DOMAIN/api/webhooks/btcpay"
echo -e "   Secret: $WEBHOOK_SECRET"
echo -e "   Events: InvoiceSettled, InvoiceExpired, InvoiceReceivedPayment, InvoicePaymentSettled"
echo ""
echo -e "${GREEN}6. Get Store ID${NC}"
echo -e "   Store → Settings → General → copy the Store ID"
echo ""
echo -e "${GREEN}7. Enter in Your Platform Admin UI${NC}"
echo -e "   Admin → Settings → Payment Methods → BTCPay Server:"
echo -e "   Server URL:      https://$BTCPAY_DOMAIN"
echo -e "   API Key:         (from step 4)"
echo -e "   Store ID:        (from step 6)"
echo -e "   Webhook Secret:  $WEBHOOK_SECRET"
if [ "$NETWORK_MODE" == "testnet" ] || [ "$NETWORK_MODE" == "regtest" ]; then
    echo -e "   Test Mode:       ON"
else
    echo -e "   Test Mode:       OFF"
fi
echo ""
echo -e "${CYAN}═══ USEFUL COMMANDS ═══${NC}"
echo ""
echo -e "  ${GREEN}Check status:${NC}     cd $BTCPAY_DIR && docker compose ps"
echo -e "  ${GREEN}View logs:${NC}        docker logs -f generated_btcpayserver_1"
echo -e "  ${GREEN}Restart:${NC}          docker restart generated_btcpayserver_1"
echo -e "  ${GREEN}Update:${NC}           cd $BTCPAY_DIR && btcpay-update.sh"
echo -e "  ${GREEN}Switch network:${NC}   Re-run this script with different mode"
echo ""

# Save config for reference
cat > /opt/btcpay-config.txt << EOF
# BTCPay Server Configuration (saved by setup script)
# Date: $(date)
BTCPAY_DOMAIN=$BTCPAY_DOMAIN
NETWORK_MODE=$NETWORK_MODE
BTCPAY_INTERNAL_PORT=$BTCPAY_INTERNAL_PORT
WEBHOOK_SECRET=$WEBHOOK_SECRET
BTCPAY_DIR=$BTCPAY_DIR
EOF

echo -e "${GREEN}Config saved to /opt/btcpay-config.txt${NC}"
echo -e "${GREEN}Setup complete!${NC}"
