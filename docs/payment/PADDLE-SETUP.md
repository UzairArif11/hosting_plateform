# Paddle Setup Guide — Sandbox & Live

## Overview

Paddle is a **Merchant of Record (MoR)** — they are the legal seller. This means:
- Paddle handles taxes, compliance, chargebacks
- No NTN/FBR registration needed
- Payout to Payoneer → JazzCash/Bank
- Supports Visa, Mastercard, PayPal, Apple Pay, Google Pay

### Accounts You Need

| Account | URL | Purpose |
|---------|-----|---------|
| **Paddle Sandbox** | `sandbox-vendors.paddle.com` | Testing with fake cards |
| **Paddle Live** | `vendors.paddle.com` | Real payments |
| **Payoneer** | `payoneer.com` | Receive payouts from Paddle |

> Sandbox and Live are **completely separate** accounts with different logins, API keys, and dashboards.

### What You'll Get From Each Step (Save These!)

After completing setup, you'll have these values to enter in Admin → Settings:

```
FROM SANDBOX SETUP:
  □ Sandbox Seller ID          → Admin → Settings → Paddle → Sandbox Seller ID
  □ Sandbox API Key            → Admin → Settings → Paddle → Sandbox API Key
  □ Sandbox Client Token       → Admin → Settings → Paddle → Sandbox Client Token
  □ Sandbox Webhook Secret     → Admin → Settings → Paddle → Sandbox Webhook Secret
  □ Sandbox Price IDs (per plan) → Admin → Plans → each plan → Sandbox Price IDs

FROM LIVE SETUP:
  □ Live Seller ID             → Admin → Settings → Paddle → Live Seller ID
  □ Live API Key               → Admin → Settings → Paddle → Live API Key
  □ Live Client Token          → Admin → Settings → Paddle → Live Client Token
  □ Live Webhook Secret        → Admin → Settings → Paddle → Live Webhook Secret
  □ Live Price IDs (per plan)  → Admin → Plans → each plan → Live Price IDs
```

> The admin panel will show you which values are missing and exactly where to get them.

---

## SANDBOX SETUP (Test with Fake Money)

### Step 1: Create Sandbox Account

```
1. Go to: https://sandbox-vendors.paddle.com/signup
2. Sign up with your email
3. No verification needed for sandbox
4. You'll see "Test mode" badge in top-right corner
```

### Step 2: Create a Product (Your Hosting Plans)

You need ONE product in Paddle. All your plans (Starter, Pro, etc.) are different PRICES under this one product.

```
1. Sandbox Dashboard → Catalog → Products
2. Click "New Product"
3. Create one product: "DeployHub Hosting"
   - Name: DeployHub Hosting
   - Description: Web hosting and deployment platform
   - Tax category: Standard digital goods → Software (saas)
   - Image: (optional — upload your logo)
4. Save
```

> You only need ONE product. Each plan+period combo = one Price (created in Step 3).

### Step 3: Create Prices (One Per Plan + Billing Period)

For EACH plan on your platform AND EACH billing period, create a Paddle price.

**How to calculate the price (includes 5% processing fee):**
```
Formula: Base Price × 1.05 = Paddle Price

Example for Starter plan ($10/mo base):
  Monthly:     $10.00 × 1.05 = $10.50/mo
  Quarterly:   $10.00 × 3 × 1.05 × 0.96 = $30.24/3mo  (with 4% quarterly discount)
  Semi-Annual: $10.00 × 6 × 1.05 × 0.91 = $57.33/6mo  (with 9% semi-annual discount)
  Annual:      $10.00 × 12 × 1.05 × 0.80 = $100.80/yr  (with 20% annual discount)
```

**Create each price in Paddle:**
```
1. Catalog → Products → DeployHub Hosting → Add Price
2. Fill in:
   - Price name: "Starter Monthly" (descriptive name — plan + period)
   - Amount: 10.50 (the calculated price from above)
   - Currency: USD (ALWAYS USD — never PKR or other)
   - Billing period: Every 1 month (or 3 months, 6 months, 1 year)
   - Trial period: 0 days (we handle trials ourselves, not via Paddle)
3. Click Save
4. ⚠️ COPY THE PRICE ID — it looks like: pri_01abc123def456...
5. Repeat for every plan + period combination
```

**IMPORTANT — Save every Price ID! You'll enter these in Admin → Plans.**

Create a table and fill it in as you create each price:

```
Platform Plan       | Period      | Paddle Price (USD) | Paddle Price ID (Sandbox)
--------------------|-------------|--------------------|--------------------------
Free                | -           | $0 (no Paddle)     | (none — free plan)
Starter             | Monthly     | $10.50             | pri_________________
Starter             | Quarterly   | $30.24             | pri_________________
Starter             | Semi-Annual | $57.33             | pri_________________
Starter             | Annual      | $100.80            | pri_________________
Pro                 | Monthly     | $26.25             | pri_________________
Pro                 | Quarterly   | $75.60             | pri_________________
Pro                 | Semi-Annual | $143.64            | pri_________________
Pro                 | Annual      | $252.00            | pri_________________
(repeat for all plans...)
```

> **Where these go:** Admin → Plans → Select plan → Paddle Price IDs → Sandbox section
> Paste each Price ID in the matching billing period field, then click [Verify] to confirm it's correct.

### Step 4: Get API Credentials

```
1. Sandbox Dashboard → Developer Tools → Authentication
2. Create a new API key:
   - Name: "DeployHub Backend"
   - Click "Generate"
   - ⚠️ COPY the API key immediately (starts with "pdl_sdbx_...")
     You can only see it once! If lost, generate a new one.
3. Copy your Seller ID (shown at the top of the Authentication page)
```

**Where these go:**
```
API Key    → Admin → Settings → Paddle → Sandbox API Key
Seller ID  → Admin → Settings → Paddle → Sandbox Seller ID
```

### Step 5: Create Client-Side Token

```
1. Sandbox Dashboard → Developer Tools → Authentication
2. Scroll down to "Client-side tokens" section
3. Click "Generate"
4. ⚠️ COPY the token (starts with "test_...")
```

**Where this goes:**
```
Client Token → Admin → Settings → Paddle → Sandbox Client Token
```
> This token is used by Paddle.js in the frontend to open the checkout overlay.
> It's safe to expose — it's a public token (like a Stripe publishable key).

### Step 6: Set Checkout URL (Default Payment Link)

```
1. Sandbox Dashboard → Checkout → Checkout Settings
2. Set "Default payment link" to your frontend URL:
   - Sandbox: http://localhost:3000 (or your dev URL)
   - Production: https://foodpanda.site
3. Save
```

### Step 7: Create Webhook

```
1. Sandbox Dashboard → Developer Tools → Notifications
2. Click "New destination"
3. Configure:
   - Description: "DeployHub Backend"
   - URL: https://your-backend-url/api/webhooks/paddle
         
         For LOCAL development: use ngrok to expose localhost:
           npx ngrok http 5000
           Then use: https://abc123.ngrok.io/api/webhooks/paddle
         
         For PRODUCTION: use your actual domain:
           https://yourdomain.com/api/webhooks/paddle

   - Events to subscribe (check ALL of these):
     ✅ transaction.completed       — payment succeeded
     ✅ transaction.payment_failed  — payment failed
     ✅ subscription.created        — new subscription started
     ✅ subscription.updated        — plan changed
     ✅ subscription.canceled       — user canceled
     ✅ subscription.past_due       — payment overdue
     ✅ subscription.paused         — subscription paused
     ✅ subscription.resumed        — subscription resumed
     ✅ subscription.activated      — subscription now active
4. Save
5. ⚠️ COPY the "Webhook Secret" (starts with "pdl_ntfset_...")
```

**Where this goes:**
```
Webhook Secret → Admin → Settings → Paddle → Sandbox Webhook Secret
```

> The webhook URL can be updated later if your domain changes.
> Go to: Paddle Dashboard → Developer Tools → Notifications → Edit destination → Update URL

### Step 8: Configure in Admin UI

Now enter everything you collected into the admin panel:

```
Admin → Settings → Payment Methods → Paddle:
  ✅ Enabled: ON
  ✅ Test Mode: ON (MUST be ON for sandbox testing)
  
  🧪 Sandbox Credentials:
    📝 Seller ID:       (from Step 4)
    📝 API Key:         pdl_sdbx_... (from Step 4)
    📝 Client Token:    test_... (from Step 5)
    📝 Webhook Secret:  pdl_ntfset_... (from Step 7)
  
  🔴 Live Credentials: (leave empty for now — fill when going live)
  
  📝 Processing Fee %: 5
  📝 Crypto Discount %: 3
```

The admin panel will show ✅ next to each field that's filled and ❌ for missing ones.
All 4 sandbox fields must be ✅ before sandbox testing will work.

**Then set Price IDs for each plan:**
```
Admin → Plans → Select each plan:
  Paddle Price IDs — Sandbox:
    📝 Monthly:     pri_... (from Step 3)    [Click Verify to confirm]
    📝 Quarterly:   pri_... (from Step 3)    [Click Verify to confirm]
    📝 Semi-Annual: pri_... (from Step 3)    [Click Verify to confirm]
    📝 Annual:      pri_... (from Step 3)    [Click Verify to confirm]
  
  Paddle Price IDs — Live: (leave empty for now)
```

### Step 9: Environment Variables (Optional)

> **You don't NEED .env files** — all settings are stored in Admin UI (database).
> But you CAN set env vars as fallback defaults if the database settings are empty.

Add to `backend/.env` (optional fallback):
```env
# Paddle — these are ONLY used if Admin UI fields are empty
# Admin UI settings always take priority over env vars
PADDLE_ENVIRONMENT=sandbox
```

Add to `frontend/.env.local`:
```env
# Not needed — frontend gets Paddle config from backend API
# The backend returns the client token and environment based on test mode toggle
```

> **Why no secrets in .env?** All credentials are stored in Admin → Settings (in database).
> This means you can change keys, toggle test/live, without restarting the server.

### Step 10: Test Payment Flow

```
1. Go to billing page → select a plan
2. Click "Pay with Card" → Paddle checkout overlay opens
3. Use sandbox test card:
   Card: 4242 4242 4242 4242
   Expiry: Any future date (e.g. 01/2030)
   CVV: 100
   Name: Any name
   Country: Any
4. Submit payment
5. Paddle sends webhook → /api/webhooks/paddle
6. Backend verifies → upgrades plan → sends email
7. User sees "Plan Active" on billing page
```

**More test cards:**
| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 0069` | Expired card |
| `4000 0000 0000 0119` | Processing error |

### Step 11: Verify Webhooks Are Working

```
Check backend logs for:
  "Paddle webhook received: transaction.completed"
  "Payment completed for user xxx, plan xxx"

Or check Sandbox Dashboard → Developer Tools → Notifications → Event logs
```

---

## GOING LIVE (Real Money)

### Prerequisites
- ✅ Paddle live account verified (domain + identity via Onfido)
- ✅ Payoneer account linked for payouts
- ✅ Refund policy shows 14-day no-questions-asked
- ✅ Sandbox testing completed successfully

### Step 1: Get Live API Credentials

```
1. Go to vendors.paddle.com (NOT sandbox — this is the LIVE dashboard)
2. Developer Tools → Authentication
3. Create API key:
   - Name: "DeployHub Backend Live"
   - ⚠️ COPY immediately (starts with "pdl_live_...")
4. Copy Seller ID (top of the Authentication page)
5. Scroll to "Client-side tokens" → Generate
   - ⚠️ COPY immediately (starts with "live_...")
```

**Where these go:**
```
Live API Key      → Admin → Settings → Paddle → Live API Key
Live Seller ID    → Admin → Settings → Paddle → Live Seller ID
Live Client Token → Admin → Settings → Paddle → Live Client Token
```

### Step 2: Create Live Products & Prices

```
1. Live Dashboard → Catalog → Products → New Product
   - Name: "DeployHub Hosting" (same as sandbox)
   - Tax category: Software (saas)

2. Add Prices — SAME amounts as sandbox:
   - Create the EXACT same prices (same amounts, same billing periods)
   - Use the same table from Sandbox Step 3
   - ⚠️ COPY each new Price ID — they are DIFFERENT from sandbox IDs!
```

Fill in your live Price IDs:
```
Platform Plan       | Period      | Paddle Price (USD) | Paddle Price ID (LIVE)
--------------------|-------------|--------------------|--------------------------
Starter             | Monthly     | $10.50             | pri_________________
Starter             | Annual      | $100.80            | pri_________________
Pro                 | Monthly     | $26.25             | pri_________________
Pro                 | Annual      | $252.00            | pri_________________
(same plans as sandbox, but new IDs...)
```

**Where these go:**
```
Admin → Plans → Select each plan → Paddle Price IDs → LIVE section
Paste each Price ID, then click [Verify] to confirm
```

> **IMPORTANT:** Sandbox and live Price IDs are COMPLETELY DIFFERENT even for the same amount.
> A sandbox ID will NOT work in live mode and vice versa.

### Step 3: Create Live Webhook

```
1. Live Dashboard → Developer Tools → Notifications → New destination
2. Configure:
   - Description: "DeployHub Backend Live"
   - URL: https://yourdomain.com/api/webhooks/paddle (your PRODUCTION domain)
   - Events: Check ALL the same events as sandbox (Step 7 above)
3. Save
4. ⚠️ COPY the Webhook Secret (starts with "pdl_ntfset_...")
```

**Where this goes:**
```
Live Webhook Secret → Admin → Settings → Paddle → Live Webhook Secret
```

### Step 4: Setup Payoneer Payout

```
1. Live Dashboard → Business Account → Payouts
2. Add payout method → Payoneer
3. Enter your Payoneer email
4. Set payout currency: USD (IMPORTANT — avoid conversion fees!)
5. Set payout frequency: Monthly (reduces $15 SWIFT fee impact)
6. Set minimum payout threshold: $200+ (recommended)
```

### Step 5: Update Admin UI — Switch to Live

```
Admin → Settings → Payment Methods → Paddle:
  ✅ Enabled: ON
  
  🔴 Live Credentials (should be filled by now):
    ✅ Seller ID:       (from Step 1)
    ✅ API Key:         pdl_live_... (from Step 1)
    ✅ Client Token:    live_... (from Step 1)
    ✅ Webhook Secret:  pdl_ntfset_... (from Step 3)
  
  ❌ Test Mode: OFF          ← IMPORTANT: turn OFF for real payments!
```

When you toggle Test Mode OFF, the admin panel will validate:
- All 4 live credentials are filled ✅
- All plans have live Price IDs ✅
- If anything is missing, it shows what's missing and how to fix it

**Also update Plan Price IDs:**
```
Admin → Plans → Select each plan:
  Paddle Price IDs — Live:
    ✅ Monthly:     pri_... (from Step 2)    [Verified]
    ✅ Annual:      pri_... (from Step 2)    [Verified]
```

### Step 6: Environment Variables

> **No .env changes needed!** Everything is controlled from Admin UI.
> When you toggle Test Mode OFF, the code automatically uses live credentials from database.
> No server restart, no code deploy — just toggle and it's live.

### Step 7: Deploy & Test with Real Card

```
1. Deploy code changes (sudo bash deploy.sh)
2. Make a small real payment ($5 plan) with your own card
3. Verify webhook received, plan activated
4. Verify payment shows in Paddle live dashboard
5. Wait for first payout cycle → verify Payoneer receives USD
```

---

## Go-Live Checklist

The admin panel validates most of this automatically when you toggle to Live mode.
But here's the complete checklist:

```
PADDLE DASHBOARD (vendors.paddle.com):
  ☐ Live account verified (identity + domain approved)
  ☐ Product created ("DeployHub Hosting")
  ☐ All prices created (one per plan+period)
  ☐ Webhook created with production URL
  ☐ Payoneer payout configured (USD, monthly, $200+ minimum)

ADMIN PANEL (your platform):
  ☐ Live API Key set + verified        (Admin → Settings → Paddle)
  ☐ Live Client Token set              (Admin → Settings → Paddle)
  ☐ Live Webhook Secret set            (Admin → Settings → Paddle)
  ☐ Live Seller ID set                 (Admin → Settings → Paddle)
  ☐ All plans have Live Price IDs      (Admin → Plans → each plan)
  ☐ All Price IDs verified (✅)        (Click Verify on each one)
  ☐ Test Mode: OFF                     (Admin → Settings → Paddle)

WEBSITE PAGES (already done):
  ✅ Refund policy: 14-day money-back guarantee
  ✅ Terms page: references Paddle
  ✅ Privacy page: references Paddle

FINAL TEST:
  ☐ Make real $5 payment with your own card
  ☐ Verify plan activated
  ☐ Check Paddle live dashboard shows the transaction
  ☐ Verify webhook received in backend logs
```

---

## Webhook URL Updates (When Changing Domain)

```
Paddle Dashboard → Developer Tools → Notifications → Edit destination
New URL: https://yournewdomain.com/api/webhooks/paddle
```

No need to create new webhook — just update the URL.

---

## Troubleshooting

### Webhook not received
1. Check ngrok is running (local dev)
2. Check Paddle dashboard → Notifications → Event logs for delivery status
3. Verify webhook URL is correct and accessible
4. Check backend logs for errors

### Payment stuck on "processing"
1. Check Paddle dashboard → Transactions for the transaction status
2. Check webhook event logs — was event delivered?
3. Verify webhook secret matches in Admin Settings

### "Invalid API key" error
1. Make sure sandbox key is used for sandbox, live key for live
2. Keys start with `pdl_sdbx_` (sandbox) or `pdl_live_` (live)
3. Check key hasn't been revoked in Paddle dashboard

### Price ID won't verify
1. Make sure you're verifying against the right environment
   - Sandbox Price IDs only verify when Test Mode is ON
   - Live Price IDs only verify when Test Mode is OFF
2. Copy the FULL ID including `pri_` prefix
3. Make sure the price hasn't been archived in Paddle dashboard

### "Cannot verify — API Key not set"
1. You need to enter the API Key BEFORE verifying Price IDs
2. Go to Admin → Settings → Paddle → enter the API Key first
3. Then go to Admin → Plans → click Verify

---

## Quick Reference — Where Does Each Value Go?

| Value | From Where | Goes To |
|-------|-----------|---------|
| Sandbox Seller ID | Sandbox Dashboard → Authentication | Admin → Settings → Paddle → Sandbox Seller ID |
| Sandbox API Key | Sandbox Dashboard → Authentication → Generate | Admin → Settings → Paddle → Sandbox API Key |
| Sandbox Client Token | Sandbox Dashboard → Authentication → Client-side tokens | Admin → Settings → Paddle → Sandbox Client Token |
| Sandbox Webhook Secret | Sandbox Dashboard → Notifications → Your webhook | Admin → Settings → Paddle → Sandbox Webhook Secret |
| Sandbox Price IDs | Sandbox Dashboard → Catalog → Products → Prices | Admin → Plans → Each plan → Sandbox Price IDs |
| Live Seller ID | Live Dashboard → Authentication | Admin → Settings → Paddle → Live Seller ID |
| Live API Key | Live Dashboard → Authentication → Generate | Admin → Settings → Paddle → Live API Key |
| Live Client Token | Live Dashboard → Authentication → Client-side tokens | Admin → Settings → Paddle → Live Client Token |
| Live Webhook Secret | Live Dashboard → Notifications → Your webhook | Admin → Settings → Paddle → Live Webhook Secret |
| Live Price IDs | Live Dashboard → Catalog → Products → Prices | Admin → Plans → Each plan → Live Price IDs |

> The admin panel shows ❌ for missing values with instructions on where to find them.
> Click [Verify] on Price IDs to confirm they're valid before going live.
