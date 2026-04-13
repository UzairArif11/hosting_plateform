# 💳 Payment Setup Guide

## Payment Gateways

| Gateway | Type | Config |
|---------|------|--------|
| **BTCPay** | Bitcoin (crypto) | Self-hosted at `pay.yourdomain.com` |
| **Paddle** | Cards (international) | Paddle dashboard |
| **JazzCash** | Mobile wallet (PK) | API credentials |
| **EasyPaisa** | Mobile wallet (PK) | API credentials |

---

## BTCPay Server (Bitcoin Payments)

### Quick Setup

```bash
ssh root@your-vps-ip
chmod +x setup-btcpay.sh

# Development (fake BTC):
./setup-btcpay.sh pay.yourdomain.com testnet

# Production (real BTC):
./setup-btcpay.sh pay.yourdomain.com mainnet

# Local testing (instant blocks):
./setup-btcpay.sh pay.yourdomain.com regtest
```

The script automatically:
- Installs Docker + Docker Compose v2
- Downloads and configures BTCPay Server
- Fixes port conflicts (uses port 49392, not 80)
- Configures nginx reverse proxy
- Sets up SSL via Let's Encrypt
- Generates webhook secret

### After Script Completes

Open `https://pay.yourdomain.com` and:

1. **Create admin account** (first visitor = admin)
2. **Create Store** → name it
3. **Setup wallet** → Store → Wallets → Bitcoin → "Create new wallet" → **SAVE seed words!**
4. **Create API Key** → Account → API Keys → permissions: `cancreateinvoice`, `canviewinvoices`
5. **Create Webhook** → Store → Webhooks:
   - URL: `https://yourdomain.com/api/webhooks/btcpay`
   - Secret: (shown at end of script output)
   - Events: `InvoiceSettled`, `InvoiceExpired`, `InvoiceReceivedPayment`
6. **Copy Store ID** → Store → Settings → General

### Enter in Platform Admin

Admin → Settings → Payment Methods → BTCPay:

| Field | Value |
|-------|-------|
| Server URL | `https://pay.yourdomain.com` |
| API Key | From step 4 |
| Store ID | From step 6 |
| Webhook Secret | From step 5 |
| Test Mode | `true` (testnet) / `false` (mainnet) |

Or via `.env`:
```env
BTCPAY_SERVER_URL=https://pay.yourdomain.com
BTCPAY_API_KEY=your-api-key
BTCPAY_STORE_ID=your-store-id
BTCPAY_WEBHOOK_SECRET=your-webhook-secret
BTCPAY_TEST_MODE=true
```

### Useful Commands

```bash
docker ps | grep btcpay                        # Status
docker logs -f generated_btcpayserver_1         # Logs
docker restart generated_btcpayserver_1         # Restart
cd /opt/btcpayserver-docker && btcpay-update.sh # Update
```

### Testnet Faucets
- https://coinfaucet.eu/en/btc-testnet/
- https://testnet-faucet.com/btc-testnet/

---

## Paddle (Card Payments)

```env
PADDLE_API_KEY=your-paddle-api-key
PADDLE_WEBHOOK_SECRET=your-webhook-secret
PADDLE_ENVIRONMENT=sandbox
```

Webhook: `https://yourdomain.com/api/webhooks/paddle`

---

## JazzCash & EasyPaisa

```env
JAZZCASH_MERCHANT_ID=your-merchant-id
JAZZCASH_PASSWORD=your-password
JAZZCASH_INTEGRITY_SALT=your-salt
JAZZCASH_ENVIRONMENT=sandbox

EASYPAISA_STORE_ID=your-store-id
EASYPAISA_TOKEN=your-token
EASYPAISA_ENVIRONMENT=sandbox
```

Webhooks:
- `https://yourdomain.com/api/webhooks/jazzcash`
- `https://yourdomain.com/api/webhooks/easypaisa`
