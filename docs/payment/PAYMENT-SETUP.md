# 💳 Payment Setup Guide

> **Platform:** foodpanda.site  
> **Last Updated:** 2026-04-13

---

## Payment Gateways Overview

| Gateway | Type | Status | Domain |
|---------|------|:------:|--------|
| **Paddle** | Card payments (international) | ✅ Ready | Via Paddle hosted checkout |
| **BTCPay** | Crypto (Bitcoin) | ✅ Configured | `pay.foodpanda.site` |
| **JazzCash** | Mobile wallet (Pakistan) | ✅ Ready | Via API |
| **EasyPaisa** | Mobile wallet (Pakistan) | ✅ Ready | Via API |

---

## BTCPay Server Setup

### Architecture
```
User Browser → https://pay.foodpanda.site (port 443)
                    ↓
              nginx (existing, port 80/443)
                    ↓ proxy_pass
              BTCPay Docker container (port 49392)
                    ↓
              PostgreSQL + Bitcoin Node (testnet) + NBXplorer
```

### Server Details
- **URL:** `https://pay.foodpanda.site`
- **Network:** testnet (switch to mainnet for production)
- **Port:** 49392 (internal, proxied via nginx)
- **Docker containers:** btcpayserver, bitcoind, nbxplorer, postgres, tor
- **SSL:** Let's Encrypt (auto-renewal via certbot)
- **Install dir:** `/opt/btcpayserver-docker`
- **Env file:** `/opt/.env`
- **Systemd:** `btcpayserver.service`

### BTCPay Dashboard Setup

After opening `https://pay.foodpanda.site`:

1. **Create admin account** (first visitor = admin)
2. **Create Store** → Name: "YourPlatform"
3. **Connect Bitcoin Wallet** → Store → Wallets → Bitcoin → Setup → "Create new wallet" → **SAVE the 12 seed words!**
4. **Create API Key** → Account → API Keys → Generate
   - Permissions: `btcpay.store.cancreateinvoice`, `btcpay.store.canviewinvoices`
5. **Create Webhook** → Store → Settings → Webhooks → Create
   - URL: `https://foodpanda.site/api/webhooks/btcpay`
   - Secret: Generate a random string (`openssl rand -hex 32`)
   - Events: `InvoiceSettled`, `InvoiceExpired`, `InvoiceReceivedPayment`, `InvoicePaymentSettled`
6. **Get Store ID** → Store → Settings → General → copy Store ID

### Platform Configuration

Add to **Admin UI → Settings → Payment Methods → BTCPay Server**:

| Field | Value |
|-------|-------|
| Server URL | `https://pay.foodpanda.site` |
| API Key | From step 4 above |
| Store ID | From step 6 above |
| Webhook Secret | From step 5 above |
| Test Mode | `true` (testnet) / `false` (mainnet) |
| Enabled | `true` |

Or via `.env` on the API server:
```env
BTCPAY_SERVER_URL=https://pay.foodpanda.site
BTCPAY_API_KEY=your-api-key
BTCPAY_STORE_ID=your-store-id
BTCPAY_WEBHOOK_SECRET=your-webhook-secret
BTCPAY_TEST_MODE=true
```

### Switching to Mainnet (Production)

```bash
sudo su -
source /etc/profile.d/btcpay-env.sh
export NBITCOIN_NETWORK=mainnet
export BTCPAYGEN_LIGHTNING=clightning  # optional
cd /opt/btcpayserver-docker
. ./btcpay-setup.sh -i
# Then fix port:
sed -i 's/${NOREVERSEPROXY_HTTP_PORT:-80}:49392/49392:49392/' Generated/docker-compose.generated.yml
docker compose -f Generated/docker-compose.generated.yml up -d btcpayserver
```

> ⚠️ **Mainnet requires ~80GB SSD for full Bitcoin blockchain sync (takes 1-3 days)**

### Useful Commands

```bash
# BTCPay status
cd /opt/btcpayserver-docker && docker compose ps

# BTCPay logs
docker logs -f generated_btcpayserver_1

# Bitcoin node status
docker logs btcpayserver_bitcoind --tail 20

# Restart BTCPay
docker restart generated_btcpayserver_1

# Update BTCPay
cd /opt/btcpayserver-docker && btcpay-update.sh

# Test connection from API server
curl -s https://pay.foodpanda.site/api/v1/health
```

### Testnet Faucets (get free test BTC)
- https://coinfaucet.eu/en/btc-testnet/
- https://testnet-faucet.com/btc-testnet/

---

## Paddle Setup

### Environment Variables
```env
PADDLE_API_KEY=your-paddle-api-key
PADDLE_WEBHOOK_SECRET=your-webhook-secret
PADDLE_ENVIRONMENT=sandbox  # or production
```

### Webhook URL
`https://foodpanda.site/api/webhooks/paddle`

---

## JazzCash & EasyPaisa Setup

### Environment Variables
```env
JAZZCASH_MERCHANT_ID=your-merchant-id
JAZZCASH_PASSWORD=your-password
JAZZCASH_INTEGRITY_SALT=your-salt
JAZZCASH_ENVIRONMENT=sandbox  # or production

EASYPAISA_STORE_ID=your-store-id
EASYPAISA_TOKEN=your-token
EASYPAISA_ENVIRONMENT=sandbox  # or production
```

### Webhook URLs
- JazzCash: `https://foodpanda.site/api/webhooks/jazzcash`
- EasyPaisa: `https://foodpanda.site/api/webhooks/easypaisa`

---

## Troubleshooting

### BTCPay container won't start
```bash
# Check for port conflicts
sudo lsof -i :49392
# Remove stale container
docker rm -f generated_btcpayserver_1
# Recreate
cd /opt/btcpayserver-docker
docker compose -f Generated/docker-compose.generated.yml up -d btcpayserver
```

### Bitcoin node not syncing
```bash
docker logs btcpayserver_bitcoind --tail 50
# Testnet sync takes ~1-2 hours, mainnet takes 1-3 days
```

### Webhook not receiving events
1. Check BTCPay dashboard → Store → Webhooks → check delivery log
2. Verify webhook URL is accessible: `curl https://foodpanda.site/api/webhooks/btcpay`
3. Check API server logs: `pm2 logs backend --lines 50`
