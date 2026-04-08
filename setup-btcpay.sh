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
#   - Ubuntu/Debian VPS (minimum: 1 CPU, 2GB RAM, 80GB SSD for mainnet)
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

set -e

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
echo -e "${CYAN}[Step 1/5] Checking Docker...${NC}"

if command -v docker &> /dev/null; then
    echo -e "${GREEN}Docker already installed: $(docker --version)${NC}"
else
    echo -e "${YELLOW}Installing Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
    echo -e "${GREEN}Docker installed successfully${NC}"
fi

if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    echo -e "${GREEN}Docker Compose available${NC}"
else
    echo -e "${YELLOW}Installing Docker Compose...${NC}"
    apt-get install -y docker-compose-plugin 2>/dev/null || {
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    }
    echo -e "${GREEN}Docker Compose installed${NC}"
fi

# ─────────────────────────────────────────────────────────────
# Step 2: Clone BTCPay Docker Repository
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[Step 2/5] Setting up BTCPay repository...${NC}"

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
echo -e "${CYAN}[Step 3/5] Configuring BTCPay Server...${NC}"

export BTCPAY_HOST="$BTCPAY_DOMAIN"
export NBITCOIN_NETWORK="$NETWORK_MODE"
export BTCPAYGEN_CRYPTO1="btc"
export BTCPAYGEN_REVERSEPROXY="nginx"
export BTCPAY_ENABLE_SSH=true

# Add Lightning for mainnet (optional but recommended)
if [ "$NETWORK_MODE" == "mainnet" ]; then
    export BTCPAYGEN_LIGHTNING="clightning"
    echo -e "${GREEN}Lightning Network: enabled (clightning)${NC}"
fi

# Add regtest configurator
if [ "$NETWORK_MODE" == "regtest" ]; then
    export BTCPAYGEN_ADDITIONAL_FRAGMENTS="opt-add-configurator"
    echo -e "${GREEN}Regtest configurator: enabled${NC}"
fi

echo -e "${GREEN}Host:    $BTCPAY_HOST${NC}"
echo -e "${GREEN}Network: $NBITCOIN_NETWORK${NC}"
echo -e "${GREEN}Crypto:  $BTCPAYGEN_CRYPTO1${NC}"
echo -e "${GREEN}Proxy:   $BTCPAYGEN_REVERSEPROXY${NC}"

# ─────────────────────────────────────────────────────────────
# Step 4: Run BTCPay Setup
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[Step 4/5] Starting BTCPay Server...${NC}"
echo -e "${YELLOW}This may take 5-15 minutes (downloading Docker images)...${NC}"

. ./btcpay-setup.sh -i

# ─────────────────────────────────────────────────────────────
# Step 5: Generate Webhook Secret
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[Step 5/5] Generating webhook secret...${NC}"

WEBHOOK_SECRET=$(openssl rand -hex 32)

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              BTCPay Server is Running!                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}BTCPay URL:${NC}       https://$BTCPAY_DOMAIN"
echo -e "${GREEN}Network:${NC}          $NETWORK_MODE"
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
echo -e "  ${GREEN}Check status:${NC}     cd $BTCPAY_DIR && docker-compose ps"
echo -e "  ${GREEN}View logs:${NC}        cd $BTCPAY_DIR && docker-compose logs -f"
echo -e "  ${GREEN}Restart:${NC}          cd $BTCPAY_DIR && btcpay-restart.sh"
echo -e "  ${GREEN}Update:${NC}           cd $BTCPAY_DIR && btcpay-update.sh"
echo -e "  ${GREEN}Switch network:${NC}   Re-run this script with different mode"
echo ""

# Save config for reference
cat > /opt/btcpay-config.txt << EOF
# BTCPay Server Configuration (saved by setup script)
# Date: $(date)
BTCPAY_DOMAIN=$BTCPAY_DOMAIN
NETWORK_MODE=$NETWORK_MODE
WEBHOOK_SECRET=$WEBHOOK_SECRET
BTCPAY_DIR=$BTCPAY_DIR
EOF

echo -e "${GREEN}Config saved to /opt/btcpay-config.txt${NC}"
echo -e "${GREEN}Setup complete!${NC}"
