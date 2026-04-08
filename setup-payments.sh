#!/bin/bash

###############################################################################
# Payment Gateway Setup Script (Master)
#
# Guides you through setting up payment gateways:
#   - Paddle (Card/PayPal) — configured via Admin UI, no server setup needed
#   - BTCPay Server (Crypto) — self-hosted Docker setup on your VPS
#
# Usage:
#   chmod +x setup-payments.sh
#   ./setup-payments.sh                    # Interactive — choose what to set up
#   ./setup-payments.sh --paddle           # Show Paddle setup guide
#   ./setup-payments.sh --btcpay           # Set up BTCPay only
#   ./setup-payments.sh --status           # Check status of all gateways
#
# Individual scripts:
#   ./setup-btcpay.sh DOMAIN testnet       # BTCPay testnet (development)
#   ./setup-btcpay.sh DOMAIN mainnet       # BTCPay mainnet (production)
#
#
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Payment Gateway Setup                             ║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║  Paddle   — Card/PayPal (Visa, MC, Apple Pay, Google Pay) ║${NC}"
echo -e "${BLUE}║  BTCPay   — Crypto payments (BTC Lightning, On-chain, LTC)║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ─────────────────────────────────────────────────────────────
# Status check
# ─────────────────────────────────────────────────────────────
if [ "$1" == "--status" ]; then
    echo -e "${CYAN}═══ Payment Gateway Status ═══${NC}"
    echo ""

    # Paddle — all config is in Admin UI / MongoDB
    echo -e "${PURPLE}Paddle:${NC}     Configured via Admin UI (no server-side config needed)"
    echo -e "            Check: Admin → Settings → Payment Methods → Paddle"
    echo ""

    # Check BTCPay
    if [ -f "/opt/btcpay-config.txt" ]; then
        BP_DOMAIN=$(grep -oP 'BTCPAY_DOMAIN=\K.*' /opt/btcpay-config.txt 2>/dev/null || echo "unknown")
        BP_NETWORK=$(grep -oP 'NETWORK_MODE=\K.*' /opt/btcpay-config.txt 2>/dev/null || echo "unknown")
        echo -e "${GREEN}BTCPay:${NC}     Running at https://$BP_DOMAIN ($BP_NETWORK)"
    elif docker ps 2>/dev/null | grep -q btcpay; then
        echo -e "${GREEN}BTCPay:${NC}     Docker container running"
    else
        echo -e "${YELLOW}BTCPay:${NC}     Not detected on this server"
    fi

    echo ""
    echo -e "${CYAN}All payment settings are managed in Admin → Settings → Payment Methods${NC}"
    exit 0
fi

# ─────────────────────────────────────────────────────────────
# Direct mode
# ─────────────────────────────────────────────────────────────
if [ "$1" == "--paddle" ]; then
    echo -e "${PURPLE}═══ Paddle Setup Guide ═══${NC}"
    echo ""
    echo -e "${YELLOW}Paddle is configured entirely via the Admin UI — no server setup needed.${NC}"
    echo ""
    echo -e "  ${GREEN}1.${NC} Create sandbox account: ${CYAN}https://sandbox-vendors.paddle.com/signup${NC}"
    echo -e "  ${GREEN}2.${NC} Create product + prices in Paddle dashboard"
    echo -e "  ${GREEN}3.${NC} Go to Admin → Settings → Paddle → enter sandbox credentials"
    echo -e "  ${GREEN}4.${NC} Go to Admin → Plans → enter sandbox Price IDs for each plan"
    echo -e "  ${GREEN}5.${NC} Set webhook URL in Paddle: ${CYAN}https://yourdomain.com/api/webhooks/paddle${NC}"
    echo -e "  ${GREEN}6.${NC} Test with card: ${CYAN}4242 4242 4242 4242${NC}"
    echo ""
    echo -e "  For detailed instructions, see: ${CYAN}PADDLE-SETUP.md${NC}"
    echo ""
    echo -e "${YELLOW}For live mode:${NC}"
    echo -e "  ${GREEN}1.${NC} Create live account: ${CYAN}https://vendors.paddle.com/signup${NC}"
    echo -e "  ${GREEN}2.${NC} Complete identity verification (CNIC + video selfie)"
    echo -e "  ${GREEN}3.${NC} Repeat steps 2-5 with live credentials + Price IDs"
    echo -e "  ${GREEN}4.${NC} Toggle Test Mode OFF in Admin → Settings → Paddle"
    exit 0
fi

if [ "$1" == "--btcpay" ]; then
    shift
    bash "$SCRIPT_DIR/setup-btcpay.sh" "$@"
    exit 0
fi

# ─────────────────────────────────────────────────────────────
# Interactive mode
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}What would you like to set up?${NC}"
echo ""
echo -e "  ${GREEN}1)${NC} Paddle setup guide   (Card/PayPal — via Admin UI)"
echo -e "  ${GREEN}2)${NC} BTCPay Server         (Crypto — Docker on this server)"
echo -e "  ${GREEN}3)${NC} Both (Paddle guide + BTCPay install)"
echo -e "  ${GREEN}4)${NC} Check status"
echo -e "  ${GREEN}5)${NC} Exit"
echo ""
read -p "$(echo -e ${GREEN}Choose [1-5]: ${NC})" CHOICE

case $CHOICE in
    1)
        bash "$0" --paddle
        ;;
    2)
        echo ""
        echo -e "${YELLOW}BTCPay requires a domain pointed to this server.${NC}"
        read -p "$(echo -e ${GREEN}Enter BTCPay domain [pay.yourdomain.com]: ${NC})" BP_DOMAIN
        BP_DOMAIN=${BP_DOMAIN:-"pay.yourdomain.com"}

        echo ""
        echo -e "${YELLOW}Select network mode:${NC}"
        echo -e "  ${GREEN}1)${NC} testnet  — Development (fake BTC)"
        echo -e "  ${GREEN}2)${NC} mainnet  — Production (real BTC)"
        echo -e "  ${GREEN}3)${NC} regtest  — Local testing (instant blocks)"
        read -p "$(echo -e ${GREEN}Choose [1-3]: ${NC})" NET_CHOICE

        case $NET_CHOICE in
            1) NET_MODE="testnet" ;;
            2) NET_MODE="mainnet" ;;
            3) NET_MODE="regtest" ;;
            *) NET_MODE="testnet" ;;
        esac

        bash "$SCRIPT_DIR/setup-btcpay.sh" "$BP_DOMAIN" "$NET_MODE"
        ;;
    3)
        echo ""
        echo -e "${CYAN}═══ Paddle Setup Guide ═══${NC}"
        echo ""
        bash "$0" --paddle

        echo ""
        echo -e "${CYAN}═══ Now setting up BTCPay Server... ═══${NC}"
        echo ""
        read -p "$(echo -e ${GREEN}Enter BTCPay domain [pay.yourdomain.com]: ${NC})" BP_DOMAIN
        BP_DOMAIN=${BP_DOMAIN:-"pay.yourdomain.com"}

        echo -e "${YELLOW}Select network mode:${NC}"
        echo -e "  ${GREEN}1)${NC} testnet  — Development (fake BTC)"
        echo -e "  ${GREEN}2)${NC} mainnet  — Production (real BTC)"
        read -p "$(echo -e ${GREEN}Choose [1-2]: ${NC})" NET_CHOICE

        case $NET_CHOICE in
            1) NET_MODE="testnet" ;;
            2) NET_MODE="mainnet" ;;
            *) NET_MODE="testnet" ;;
        esac

        bash "$SCRIPT_DIR/setup-btcpay.sh" "$BP_DOMAIN" "$NET_MODE"
        ;;
    4)
        bash "$0" --status
        ;;
    5)
        echo -e "${GREEN}Bye!${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac
