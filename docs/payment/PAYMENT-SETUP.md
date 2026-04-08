# Payment System — Setup & Configuration Guide

## Quick Overview

This platform supports multiple payment methods. **Paddle** is the primary gateway for card/PayPal payments, **BTCPay** for crypto payments, and several local/manual methods.

| Method | Type | Gateway | Fee | Test Mode |
|--------|------|---------|-----|-----------|
| **Paddle** | Card / PayPal / Apple Pay | Automatic | 5% + $0.50 | Yes (sandbox) |
| **BTCPay** | Bitcoin (Lightning + On-chain) + Litecoin | Automatic | 0% (self-hosted) | Yes (testnet) |
| **JazzCash** | Mobile Wallet (PKR) | Automatic | ~2% | No |
| **EasyPaisa** | Mobile Wallet (PKR) | Automatic | ~2% | No |
| **Manual Bank** | Bank Transfer | Manual (admin verifies) | 0% | N/A |
| **Manual Crypto** | USDT/USDC/BTC wallets | Manual (admin verifies) | 0% | N/A |


---

## Payment Flow

```
Customer selects plan → Choose payment method:

  AUTOMATIC (no admin action needed):
  ├── "Pay with Card/PayPal"  → Paddle checkout overlay → webhook → plan activated
  ├── "Pay with Crypto"       → BTCPay invoice (QR code) → blockchain confirms → plan activated
  ├── "JazzCash"              → JazzCash redirect → callback → plan activated
  └── "EasyPaisa"             → EasyPaisa redirect → callback → plan activated

  MANUAL (admin must verify):
  ├── "Bank Transfer"         → Show bank details → user uploads screenshot → admin verifies
  └── "Manual Crypto"         → Show wallet address → user uploads screenshot → admin verifies
```

---

## Setup Guides

### 1. Paddle (Card / PayPal) — Primary Gateway

**Full setup guide:** See [PADDLE-SETUP.md](PADDLE-SETUP.md)

**Quick summary:**
1. Create sandbox account at `sandbox-vendors.paddle.com`
2. Create product + prices in Paddle dashboard
3. Enter credentials in **Admin → Settings → Paddle**
4. Enter Price IDs in **Admin → Plans → each plan → Paddle Price IDs**
5. Test with card `4242 4242 4242 4242`
6. When ready, create live account at `vendors.paddle.com` and repeat

**Implementation details:** See [PADDLE-IMPLEMENTATION.md](PADDLE-IMPLEMENTATION.md)

**Webhook URL:** `https://yourdomain.com/api/webhooks/paddle`

---

### 2. BTCPay Server (Crypto) — Self-Hosted

BTCPay is self-hosted, meaning **0% fees** — you only pay blockchain network fees (paid by customer).

#### Quick Setup (SSH Script)

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

#### Manual Setup

```bash
# SSH into your VPS (minimum: 1 CPU, 2GB RAM, 80GB SSD for Bitcoin node)
curl -fsSL https://get.docker.com | sh
git clone https://github.com/btcpayserver/btcpayserver-docker
cd btcpayserver-docker

export BTCPAY_HOST="pay.yourdomain.com"
export NBITCOIN_NETWORK="mainnet"        # or testnet/regtest
export BTCPAYGEN_CRYPTO1="btc"
export BTCPAYGEN_LIGHTNING="clightning"  # Optional: Lightning Network
export BTCPAYGEN_REVERSEPROXY="nginx"
export BTCPAY_ENABLE_SSH=true

. ./btcpay-setup.sh -i

# Point DNS: A record → pay.yourdomain.com → VPS IP
# SSL auto-configured via Let's Encrypt
```

#### Configure BTCPay Dashboard

```
1. Open https://pay.yourdomain.com → create admin account
2. Create Store → Name: "Your Platform Name"
3. Connect Bitcoin wallet (create new or import xpub)
4. Create API Key:
   Account → API Keys → Generate
   Permissions: btcpay.store.cancreateinvoice, btcpay.store.canviewinvoices
5. Create Webhook:
   Store → Settings → Webhooks → Create
   URL: https://yourplatform.com/api/webhooks/btcpay
   Secret: generate with `openssl rand -hex 32`
   Events: InvoiceSettled, InvoiceExpired, InvoiceReceivedPayment, InvoicePaymentSettled
6. Copy Store ID: Store → Settings → General → Store ID
```

#### Admin UI Configuration

```
Admin → Settings → Payment Methods → BTCPay Server:
  ✅ Enabled: ON
  📝 Server URL: https://pay.yourdomain.com
  📝 API Key: (from step 4)
  📝 Store ID: (from step 6)
  📝 Webhook Secret: (from step 5)
  ✅ Test Mode: ON/OFF
```

#### BTCPay Network Fees (Paid by Customer)

| Network | Fee | Speed |
|---------|-----|-------|
| Lightning | ~$0.01 | Instant |
| On-chain BTC | ~$0.50-$2 | 10-60 min |
| Litecoin | ~$0.01 | 2.5 min |

> Network fee is passed to the customer via BTCPay's `spreadNetworkFee` setting.

---

### 3. Local/Manual Methods

Configure in **Admin → Settings → Payment Methods**:

- **JazzCash / EasyPaisa** — Toggle ON/OFF
- **Manual Bank Transfer** — Add bank accounts (name, IBAN, etc.)
- **Manual Crypto** — Add wallet addresses (USDT, USDC, BTC, etc.)

---

## Admin Settings (UI)

All payment configuration is done from **Admin → Settings → Payment Configuration**:

```
Payment Methods:
  ├── Paddle (Card/PayPal) — PRIMARY
  │   ├── Enabled: ON/OFF
  │   ├── Test Mode: ON/OFF (sandbox vs live)
  │   ├── Sandbox Credentials (Seller ID, API Key, Client Token, Webhook Secret)
  │   ├── Live Credentials (same 4 fields)
  │   ├── Processing Fee %: 5 (passed to customer)
  │   └── Crypto Discount %: 3 (incentive for BTCPay payments)
  │
  ├── BTCPay Server (Crypto)
  │   ├── Enabled: ON/OFF
  │   ├── Server URL, API Key, Store ID, Webhook Secret
  │   └── Test Mode: ON/OFF (testnet vs mainnet)
  │
  ├── JazzCash / EasyPaisa: ON/OFF
  │
  ├── Manual Bank Transfer
  │   ├── Enabled: ON/OFF
  │   └── Bank Accounts: [add/remove]
  │
  └── Manual Crypto
      ├── Enabled: ON/OFF
      └── Wallets: [add/remove]
```

---

## Webhook URLs

Set these in the respective dashboards:

| Gateway | Webhook URL | Where to Set |
|---------|-------------|--------------|
| **Paddle** | `https://yourdomain.com/api/webhooks/paddle` | Paddle Dashboard → Notifications → Webhooks |
| **BTCPay** | `https://yourdomain.com/api/webhooks/btcpay` | BTCPay Dashboard → Store → Webhooks |

> For local development, use [ngrok](https://ngrok.com) to expose your localhost:
> ```bash
> ngrok http 5000
> # Use the https://xxx.ngrok.io URL as your webhook base
> ```

---

## Switching from Test to Production

### Paddle
```
1. ☐ Complete identity verification (Onfido — CNIC + video selfie)
2. ☐ Create live account at vendors.paddle.com
3. ☐ Create same products/prices with live Price IDs
4. ☐ Enter live credentials in Admin → Settings → Paddle
5. ☐ Enter live Price IDs in Admin → Plans
6. ☐ Set Paddle Webhook URL to production domain
7. ☐ Admin → Settings → Paddle → Test Mode: OFF
8. ☐ Test with a small real payment
```

### BTCPay
```
1. ☐ Reconfigure BTCPay with NBITCOIN_NETWORK="mainnet"
2. ☐ Connect a real Bitcoin wallet (mainnet)
3. ☐ Update webhook URL to production domain
4. ☐ Admin → Settings → BTCPay → Test Mode: OFF
5. ☐ Send a small real BTC payment to test
```

---

## Fee Comparison

| Method | Transaction Fee | Monthly Cost | Withdrawal |
|--------|----------------|--------------|------------|
| **Paddle** | 5% + $0.50 | $0 | Payoneer → Bank |
| **BTCPay** | 0% | $0 (self-hosted) | Exchange → Bank |
| JazzCash | ~2% | $0 | Direct PKR |
| EasyPaisa | ~2% | $0 | Direct PKR |
| Manual Bank | 0% | $0 | Already in bank |
| Manual Crypto | 0% | $0 | Exchange fee only |

> **Processing fee strategy:** 5% is added to the customer price (admin-configurable). Crypto payments get a discount (default 3%) to incentivize the cheaper gateway.

---

## File Architecture

### Backend Files

```
backend/
├── services/
│   ├── paddle.js              ← Paddle API client (sandbox/live aware)
│   ├── btcpay.js              ← BTCPay Server API client
│   ├── jazzcash.js            ← JazzCash integration
│   └── easypaisa.js           ← EasyPaisa integration
├── routes/
│   ├── billing.js             ← POST /create-paddle-checkout, /paddle-subscription-cancel, etc.
│   ├── webhooks-paddle.js     ← POST /api/webhooks/paddle (signature verified)
│   └── webhooks.js            ← POST /api/webhooks/btcpay, /api/webhooks/jazzcash, etc.
├── models/
│   ├── Settings.js            ← paddle + btcpay config with testMode
│   ├── Payment.js             ← paddleTransactionId, btcpayInvoiceId fields
│   ├── Plan.js                ← paddlePriceIds (sandbox + live, per billing period)
│   ├── User.js                ← paddleCustomerId, paddleSubscriptionId
│   └── ManualPayment.js       ← Manual bank + crypto payments
```

### Frontend Files

```
frontend/app/
├── admin/settings/page.tsx    ← Paddle config UI (credentials, test mode, fees)
├── admin/plans/page.tsx       ← Paddle Price IDs per plan (sandbox + live)
├── dashboard/billing/page.tsx ← Paddle checkout overlay, payment method selection
├── layout.tsx                 ← Paddle.js CDN script
├── terms/page.tsx             ← References Paddle as payment processor
└── privacy/page.tsx           ← References Paddle as payment processor
```

### Setup Scripts (SSH)

```
project root/
├── setup-btcpay.sh            ← BTCPay Server installer (Docker, testnet/mainnet/regtest)
└── setup-payments.sh          ← Master script (Paddle + BTCPay guidance)
```

---

## Environment Variables

**No env vars needed for Paddle/BTCPay** — all configuration is done via Admin UI and stored in MongoDB Settings collection.
