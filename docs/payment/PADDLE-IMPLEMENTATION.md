# Paddle Integration — Implementation Plan

## Fee Strategy & Optimization

### The Problem: Paddle Fees Eat Into Revenue

```
Paddle fee:    5% + $0.50 per transaction
Payoneer fee:  ~2% on withdrawal to PKR bank
SWIFT fee:     $15 per payout (if currency mismatch)
```

### The Solution: Pass 5% Processing Fee to Customer

Add 5% on top of base plan price. Customer sees it as a "processing fee" or built into the price.

**Fee calculation per plan (USD pricing):**

| Base Plan | +5% Price | Paddle Fee (5%+$0.50) | You Receive | Your Loss |
|-----------|-----------|----------------------|-------------|-----------|
| $5/mo     | $5.25     | $0.76                | $4.49       | $0.51 (10%) |
| $10/mo    | $10.50    | $1.03                | $9.48       | $0.53 (5%) |
| $25/mo    | $26.25    | $1.81                | $24.44      | $0.56 (2%) |
| $50/mo    | $52.50    | $3.13                | $49.38      | $0.63 (1%) |

> The $0.50 fixed fee can't be fully covered on small plans. On $10+ plans the loss is minimal.

### Crypto (BTCPay) — Much Lower Fees

**Network fees by payment method (paid by CUSTOMER, not you):**

| Network | Fee | Speed | Best For |
|---------|-----|-------|----------|
| **Bitcoin Lightning** | ~$0.01 | Instant | All plans (cheapest) |
| **Bitcoin On-chain** | ~$0.50-$2.00 | 10-60 min | Large payments |
| **Litecoin** | ~$0.01 | 2.5 min | Alternative to Lightning |

BTCPay setting `spreadNetworkFee: true` adds network fee to invoice → customer pays it.

| Base Plan | BTCPay Fee | Network Fee (Customer Pays) | You Receive | Savings vs Paddle |
|-----------|-----------|---------------------------|-------------|-------------------|
| $5/mo     | $0 (free) | $0.01 (Lightning)         | **$5.00**   | +$0.51 |
| $10/mo    | $0        | $0.01 (Lightning)         | **$10.00**  | +$0.52 |
| $25/mo    | $0        | $0.01 (Lightning)         | **$25.00**  | +$0.56 |
| $50/mo    | $0        | $0.01 (Lightning)         | **$50.00**  | +$0.62 |

> BTCPay is self-hosted = **0% fee to you**. Network fee is passed to customer via `spreadNetworkFee`.
> With Lightning Network, customer pays ~$0.01 extra — practically free for them too.

**Supported wallets/networks shown in checkout:**
```
Pay with Crypto:
  ⚡ Lightning Network (Bitcoin) — Instant, ~$0.01 fee    ← Recommended
  ₿  Bitcoin On-chain           — 10-60 min, ~$0.50-$2 fee
  Ł  Litecoin                   — 2.5 min, ~$0.01 fee
```
Admin can enable/disable each network in BTCPay Server settings.

### Admin-Configurable Crypto Discount

Since crypto saves ~5%, admin can offer a discount to incentivize crypto payments:

```
Admin → Settings → Payment Methods → Crypto Discount:
  📝 Discount %: 3%    (adjustable 0-10%)

Example: $10.50 plan via Paddle = $10.50
         $10.50 plan via Crypto  = $10.19 (3% off)
         
Customer saves $0.31, you save ~$0.53 in Paddle fees = win-win
```

### Fee Minimization Checklist

```
✅ Set ALL Paddle prices in USD (no conversion fee)
✅ Set Payoneer receiving account to USD (no conversion fee)
✅ Set Paddle payout to USD (no $15 SWIFT fee)
✅ Set payout frequency: Monthly (fewer payouts = less total fees)  ← Set in Paddle dashboard
✅ Set minimum payout: $200+ (accumulate balance)                   ← Set in Paddle dashboard
✅ Customer's bank handles card currency conversion (cheaper than Paddle)
✅ Add 5% to plan prices to cover Paddle fee
✅ Offer crypto discount to shift volume to BTCPay (0% fees)
```

> **NOTE:** Payout frequency and minimum threshold are configured in **Paddle's dashboard** (not our admin panel).
> Our admin panel will show an info warning: "For best results, set monthly payouts with $200+ minimum in your Paddle dashboard."
> We do NOT enforce or limit withdrawals — that's Paddle's responsibility.

**Optimal money flow:**
```
PADDLE (Card/PayPal):
  Customer pays $10.50 USD (base $10 + 5% fee)
    → Paddle takes 5% + $0.50 = $1.03
    → Paddle sends $9.48 USD to Payoneer (monthly batch)
    → Payoneer holds USD (no conversion yet)
    → You convert to PKR when rate is good
    → Withdraw to JazzCash/Bank
    → You receive: ~$9.48

BTCPAY (Lightning — BEST option):
  Customer pays $10.19 USD (3% crypto discount) + $0.01 network fee
    → BTCPay receives full $10.19 in BTC (0% platform fee)
    → Network fee ($0.01) paid by customer, not deducted from you
    → Send to Binance → sell for USDT/PKR
    → Withdraw to bank
    → You receive: $10.19 (100% of discounted price!)

BTCPAY (On-chain):
  Customer pays $10.19 USD (3% discount) + ~$0.50-$2 network fee
    → Same flow as above
    → You still receive: $10.19 (network fee is customer's cost)
```

---

## What's Automatic (Code) vs Manual (Human)

### Things CODE Does Automatically
```
✅ Create Paddle checkout session when user clicks "Pay with Card"
✅ Open Paddle.js overlay (card input, 3DS, PayPal)
✅ Receive & verify webhook signature (HMAC-SHA256)
✅ Activate/upgrade/downgrade plan on successful payment
✅ Store payment records (transaction ID, subscription ID, customer ID)
✅ Handle subscription lifecycle (cancel, pause, resume, past_due)
✅ Calculate 5% processing fee and display to customer
✅ Calculate crypto discount and display to customer
✅ Create BTCPay invoice with QR code
✅ Pass network fee to customer (spreadNetworkFee: true)
✅ Verify Paddle Price IDs are valid (API call on admin save)
✅ Switch between sandbox/live based on toggle (different API URLs + keys)
✅ Send email notifications (payment success, failure, renewal, cancellation)
✅ Show subscription status, next billing date, cancel button on billing page
```

### Things ADMIN Does Manually (One-Time Setup)
```
⚙️ Create Paddle account (sandbox + live) — paddle.com
⚙️ Complete identity verification (Onfido — CNIC + selfie)
⚙️ Create Product in Paddle dashboard ("DeployHub Hosting")
⚙️ Create Prices in Paddle dashboard (one per plan+period combo)
⚙️ Copy Price IDs (pri_xxx) into Admin → Plans for each plan
⚙️ Copy API Key, Client Token, Webhook Secret into Admin → Settings
⚙️ Set webhook URL in Paddle dashboard → our backend URL
⚙️ Set payout method (Payoneer) in Paddle dashboard
⚙️ Set payout frequency (Monthly) and minimum ($200+) in Paddle dashboard
⚙️ Link Payoneer account for receiving USD payouts
⚙️ Configure BTCPay Server wallets (Bitcoin, Lightning, Litecoin)
⚙️ Set BTCPay webhook URL to our backend
⚙️ Toggle Test Mode ON/OFF in Admin → Settings when ready to go live
⚙️ Replace sandbox Price IDs with live Price IDs when going live
```

### Price ID Verification Flow
```
Admin enters Price ID: pri_01abc123...
  → Click "Verify" button
  → Code calls Paddle API: GET /prices/pri_01abc123
  → If valid: ✅ Shows price name, amount, currency, billing period
  → If invalid: ❌ Shows "Invalid Price ID — check Paddle dashboard"
```

---

## Live / Test Mode Toggle

Single toggle in Admin → Settings controls both Paddle and BTCPay:

```
Admin → Settings → Payment Methods:

  🔘 Test Mode: ON
     └── Paddle uses: sandbox API URL + sandbox keys (pdl_sdbx_...)
     └── BTCPay uses: testnet Bitcoin (fake BTC, no real money)
     └── Checkout shows "TEST MODE" badge
     └── Webhooks go to: ngrok/dev URL

  🔘 Test Mode: OFF  
     └── Paddle uses: live API URL + live keys (pdl_live_...)
     └── BTCPay uses: mainnet Bitcoin (real BTC)
     └── Checkout is real — customers are charged
     └── Webhooks go to: production URL
```

**How it works in code:**
```js
// Admin toggles Test Mode → saves to Settings.paymentConfig.paddle.testMode

// Backend reads the toggle:
const settings = await Settings.findOne();
const isTest = settings.paymentConfig.paddle.testMode;

// Paddle SDK uses different environment:
const paddle = new Paddle(apiKey, {
    environment: isTest ? 'sandbox' : 'production'
});

// Frontend Paddle.js also reads it:
Paddle.Initialize({
    token: isTest ? testClientToken : liveClientToken,
    environment: isTest ? 'sandbox' : 'production'
});
```

**Admin needs TWO sets of credentials:**
```
Sandbox credentials (for testing):
  - API Key: pdl_sdbx_...
  - Client Token: test_...
  - Webhook Secret: pdl_ntfset_... (sandbox)
  - Price IDs: pri_... (sandbox)

Live credentials (for real payments):
  - API Key: pdl_live_...
  - Client Token: live_...
  - Webhook Secret: pdl_ntfset_... (live)
  - Price IDs: pri_... (live)
```

Both sets stored in Admin → Settings. Toggle switches which set is used.

---

## Admin Panel — Setup Validation & Guidance

When admin toggles Paddle ON or switches between Test/Live mode, the admin panel **validates all required fields** and shows clear status + instructions for any missing items.

### Validation on Toggle — What Admin Sees

```
┌─────────────────────────────────────────────────────────────┐
│  Paddle (Card/PayPal)     [Enabled: ✅ ON]  [Mode: 🧪 Test] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Setup Status:  3 of 4 complete                              │
│  ████████████░░░░  75%                                       │
│                                                              │
│  ✅ Sandbox API Key         pdl_sdbx_a8f2...  [Valid]        │
│  ✅ Sandbox Client Token    test_7bc3...      [Valid]        │
│  ✅ Sandbox Webhook Secret  pdl_ntfset_...    [Set]          │
│  ❌ Sandbox Seller ID       (empty)                          │
│     ↳ How to get: Go to sandbox-vendors.paddle.com           │
│       → Developer Tools → Authentication → Copy Seller ID    │
│       See: PADDLE-SETUP.md → Step 4                          │
│                                                              │
│  ℹ️ Payout Settings (configure in Paddle dashboard):         │
│     Set monthly payouts with $200+ minimum for best results  │
│                                                              │
│  Processing Fee: [5] %    Crypto Discount: [3] %             │
├─────────────────────────────────────────────────────────────┤
│  🔴 Live Credentials (for when you switch to Live mode)      │
│                                                              │
│  ⚠️ Live API Key           (empty)                           │
│     ↳ How to get: Go to vendors.paddle.com                   │
│       → Developer Tools → Authentication → Generate API Key  │
│       See: PADDLE-SETUP.md → Going Live → Step 1             │
│  ⚠️ Live Client Token      (empty)                           │
│     ↳ How to get: Same page → Client-side tokens → Generate  │
│  ⚠️ Live Webhook Secret    (empty)                           │
│     ↳ How to get: vendors.paddle.com → Developer Tools        │
│       → Notifications → New destination → Copy secret         │
│  ⚠️ Live Seller ID         (empty)                           │
│     ↳ How to get: vendors.paddle.com → Authentication page   │
│                                                              │
│  ℹ️ Live credentials are only needed when you turn off       │
│     Test Mode. You can set them up later.                    │
└─────────────────────────────────────────────────────────────┘
```

### Validation on Mode Switch

When admin switches from Test → Live:
```
⚠️ WARNING: Switching to LIVE mode

Before switching, make sure:
  ✅ Live API Key is set                          → Set ✅
  ❌ Live Client Token is missing                 → Go to vendors.paddle.com → Authentication
  ✅ Live Webhook Secret is set                   → Set ✅
  ❌ Live Seller ID is missing                    → Go to vendors.paddle.com → Authentication
  ❌ 2 of 3 plans have missing Live Price IDs     → Go to Admin → Plans → Set Live Price IDs

[Cancel] [Switch Anyway (payments will fail for plans without Price IDs)]
```

When admin switches from Live → Test:
```
ℹ️ Switching to TEST mode

Customers will use sandbox checkout (no real charges).
Sandbox credentials will be used.

  ✅ All sandbox credentials are set
  ✅ 3 of 3 plans have sandbox Price IDs

[Cancel] [Switch to Test Mode]
```

### Plan Price ID Validation

In Admin → Plans, each plan shows validation for BOTH environments:

```
┌─────────────────────────────────────────────────────────────┐
│  Plan: Starter ($10/mo)                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🧪 Sandbox Price IDs:                                       │
│  Monthly:     [pri_01abc...  ] [✅ Verify] Starter Monthly $10.50/mo USD │
│  Quarterly:   [pri_01def...  ] [✅ Verify] Starter Quarterly $30.24 USD  │
│  Semi-Annual: [              ] [⚠️ Empty]  Not required if not offered   │
│  Annual:      [pri_01jkl...  ] [✅ Verify] Starter Annual $100.80 USD   │
│                                                              │
│  ↳ How to create Price IDs:                                  │
│    1. Go to sandbox-vendors.paddle.com → Catalog → Products  │
│    2. Click your product → Add Price                         │
│    3. Set amount in USD, billing period (month/year)         │
│    4. Save → Copy the Price ID (starts with pri_...)         │
│    See: PADDLE-SETUP.md → Step 3                             │
│                                                              │
│  🔴 Live Price IDs:                                          │
│  Monthly:     [pri_01xyz...  ] [✅ Verify] Starter Monthly $10.50/mo USD │
│  Quarterly:   [              ] [⚠️ Empty]                    │
│  Semi-Annual: [              ] [⚠️ Empty]                    │
│  Annual:      [              ] [⚠️ Empty]                    │
│                                                              │
│  ↳ Live Price IDs are DIFFERENT from sandbox.                │
│    Create them in vendors.paddle.com (live dashboard).       │
│    See: PADDLE-SETUP.md → Going Live → Step 2               │
└─────────────────────────────────────────────────────────────┘
```

### Verify Button Behavior

```
Click [Verify] →
  
  Loading state: "Verifying..."
  
  If valid:
    ✅ "Starter Monthly - $10.50/mo - USD - Recurring"
    (shows price name, amount, currency, billing type from Paddle API)
  
  If invalid:
    ❌ "Invalid Price ID — not found in Paddle"
    ↳ "Make sure you copied the full ID (starts with pri_)"
    ↳ "Sandbox IDs only work in sandbox, live IDs only in live"
  
  If wrong environment:
    ❌ "This is a sandbox Price ID but you're verifying against live"
    ↳ "Move this ID to the Sandbox section instead"
  
  If API key missing:
    ❌ "Cannot verify — API Key not set for this environment"
    ↳ "Set the API Key in Settings first"
```

---

## Customer Checkout — Simple & User-Friendly

### Checkout Page Design (What Customer Sees)

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  Upgrade to Starter Plan                                     │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Starter Plan                                           │ │
│  │  10 OCPU · 20 GB RAM · 50 GB Storage · 100 GB Bandwidth│ │
│  │  5 Projects                                             │ │
│  │                                                         │ │
│  │  Billing Period:                                        │ │
│  │  [Monthly ▼]  ← dropdown: Monthly, Quarterly, Annual   │ │
│  │                                                         │ │
│  │  Base price:           $10.00/mo                        │ │
│  │  Processing fee (5%):  + $0.50                          │ │
│  │  ─────────────────────────────                          │ │
│  │  Total:                $10.50/mo                        │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  Choose Payment Method:                                      │
│                                                              │
│  ┌───────────────────────┐  ┌───────────────────────┐       │
│  │  💳 Card / PayPal     │  │  ₿ Crypto             │       │
│  │                       │  │  Save 3%!             │       │
│  │  Visa, Mastercard,    │  │                       │       │
│  │  PayPal, Apple Pay    │  │  ⚡ Lightning (instant)│       │
│  │                       │  │  ₿ Bitcoin            │       │
│  │  $10.50/mo            │  │  Ł Litecoin           │       │
│  │                       │  │                       │       │
│  │  [ Pay with Card ]    │  │  $10.19/mo (-3%)      │       │
│  └───────────────────────┘  │                       │       │
│                              │  [ Pay with Crypto ]  │       │
│                              └───────────────────────┘       │
│                                                              │
│  ┌───────────────────────┐  ┌───────────────────────┐       │
│  │  🏦 Bank Transfer     │  │  📱 JazzCash/EasyPaisa│       │
│  │  (Manual)             │  │  (Manual)             │       │
│  │  $10.00/mo            │  │  $10.00/mo            │       │
│  │  [ View Details ]     │  │  [ View Details ]     │       │
│  └───────────────────────┘  └───────────────────────┘       │
│                                                              │
│  🔒 Payments processed securely. We never store your card.   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### After Clicking "Pay with Card"

```
Paddle.js overlay opens ON TOP of current page (no redirect):
┌─────────────────────────────────────────────────────────────┐
│                   ┌──────────────────────┐                   │
│   (dimmed bg)     │  Paddle Checkout     │    (dimmed bg)    │
│                   │                      │                   │
│                   │  DeployHub Hosting   │                   │
│                   │  Starter Monthly     │                   │
│                   │  $10.50 USD          │                   │
│                   │                      │                   │
│                   │  Card number:        │                   │
│                   │  [________________]  │                   │
│                   │  Expiry:    CVV:     │                   │
│                   │  [______]  [____]    │                   │
│                   │                      │                   │
│                   │  [Pay $10.50]        │                   │
│                   │                      │                   │
│                   │  or pay with PayPal  │                   │
│                   │  🍎 Apple Pay        │                   │
│                   └──────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```
> This overlay is Paddle's own UI — we don't build it. Paddle handles card input, 3DS, fraud, tax.
> We just call `Paddle.Checkout.open({ transactionId })` and it appears.

### After Clicking "Pay with Crypto"

```
BTCPay invoice page opens:
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  Pay $10.19 USD                                              │
│                                                              │
│  Choose network:                                             │
│  [⚡ Lightning]  [₿ On-chain]  [Ł Litecoin]                 │
│                                                              │
│  ┌─────────────┐                                             │
│  │  QR CODE    │   Scan with any Bitcoin wallet              │
│  │             │                                             │
│  │  ▓▓▓▓▓▓▓▓  │   Amount: 0.00032 BTC                      │
│  │  ▓▓▓▓▓▓▓▓  │   Network fee: ~$0.01 (included)           │
│  │  ▓▓▓▓▓▓▓▓  │                                             │
│  │             │   Expires in: 14:32                         │
│  └─────────────┘                                             │
│                                                              │
│  [Copy Invoice]  [Open in Wallet]                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### After Successful Payment

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  ✅ Payment Successful!                                      │
│                                                              │
│  Your plan has been upgraded to Starter.                     │
│                                                              │
│  Plan: Starter                                               │
│  Billing: Monthly ($10.50/mo)                                │
│  Next billing date: May 8, 2026                              │
│  Payment method: Visa ending in 4242                         │
│                                                              │
│  [Go to Dashboard]  [Manage Subscription]                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key UX Principles

```
1. ONE PAGE — no multi-step wizard. Select plan, select method, pay.
2. OVERLAY — Paddle checkout opens as overlay, not a redirect. User stays on your site.
3. CRYPTO HIGHLIGHT — "Save 3%!" badge on crypto option to incentivize cheaper method.
4. PRICE TRANSPARENCY — Base price, processing fee, and total shown clearly.
5. NO CLUTTER — Only show payment methods that are enabled by admin.
6. INSTANT FEEDBACK — Loading spinner while creating checkout, success/error after.
7. MOBILE FRIENDLY — Payment method cards stack vertically on mobile.
8. TRUST SIGNALS — Lock icon, "We never store your card", Paddle's security badge.
```

---

## Implementation Plan — File Changes

### Phase 1: Backend — Paddle Service & Models

#### 1.1 Create `backend/services/paddle.js`
New file — Paddle Billing API client.

```
Functions:
- initializePaddle() — setup API client with key
- createTransaction(userId, planId, priceId, customerEmail) — create checkout
- getTransaction(transactionId) — fetch transaction details
- cancelSubscription(subscriptionId) — cancel sub
- updateSubscription(subscriptionId, newPriceId) — upgrade/downgrade
- verifyWebhookSignature(rawBody, signature, secret) — HMAC-SHA256 verify
- getSubscription(subscriptionId) — get sub details
```

Uses: `@paddle/paddle-node-sdk` npm package (official SDK)

#### 1.2 Update `backend/models/Settings.js`
Add `paddle` config to `paymentConfig`:

```js
paymentConfig: {
    paddle: {                           // ← Primary card/PayPal gateway
        enabled: { type: Boolean, default: false },
        testMode: { type: Boolean, default: true },  // true=sandbox, false=live
        
        // Sandbox credentials (test mode)
        sandboxSellerId: { type: String, default: '' },
        sandboxApiKey: { type: String, default: '' },         // pdl_sdbx_...
        sandboxClientToken: { type: String, default: '' },    // test_...
        sandboxWebhookSecret: { type: String, default: '' },  // pdl_ntfset_...
        
        // Live credentials (production)
        liveSellerId: { type: String, default: '' },
        liveApiKey: { type: String, default: '' },            // pdl_live_...
        liveClientToken: { type: String, default: '' },       // live_...
        liveWebhookSecret: { type: String, default: '' },     // pdl_ntfset_...
        
        // Fee settings
        processingFeePercent: { type: Number, default: 5 },   // pass to customer
        cryptoDiscountPercent: { type: Number, default: 3 }    // discount for crypto
    },
    // Keep btcpay, jazzcash, manual methods unchanged
    btcpay: { ... },
    ...
}
```

> **No payout/withdrawal limits in admin panel.** Payouts are managed in Paddle's dashboard.
> Admin panel shows info text: "Configure payout frequency and minimum threshold in your Paddle dashboard."
```

#### 1.3 Update `backend/models/Payment.js`
Add Paddle fields:

```js
paddleTransactionId: { type: String, index: true },
paddleSubscriptionId: { type: String, index: true },
paddleCustomerId: { type: String },
// Add 'paddle' to gateway enum
gateway: { enum: ['paddle', 'payoneer', 'btcpay', 'jazzcash', 'easypaisa', 'manual'] }
```

#### 1.4 Update `backend/models/User.js`
Add Paddle subscription tracking:

```js
paddleCustomerId: { type: String },       // Paddle customer ID
paddleSubscriptionId: { type: String },   // Active subscription ID
```

### Phase 2: Backend — Routes

#### 2.1 Add Paddle routes to `backend/routes/billing.js`

```
POST /create-paddle-checkout
  - Receives: planId, billingPeriod, currency
  - Looks up Paddle price ID for the plan
  - Returns: transactionId + clientToken (for Paddle.js overlay)
  
POST /paddle-subscription-update
  - Receives: newPlanId
  - Calls Paddle API to update subscription
  
POST /paddle-subscription-cancel
  - Cancels subscription at end of billing period
```

#### 2.2 Create `backend/routes/webhooks-paddle.js`
New file — Paddle webhook handler.

```
POST /api/webhooks/paddle
  - Verify webhook signature (HMAC-SHA256 with webhook secret)
  - Handle events:
    transaction.completed → activate plan, create Payment record
    transaction.payment_failed → log failure, notify user
    subscription.created → store subscription ID on user
    subscription.updated → handle plan change
    subscription.canceled → schedule plan downgrade at period end
    subscription.past_due → warn user, grace period
    subscription.paused → pause user's projects
    subscription.resumed → reactivate
    subscription.activated → confirm active
  - Return 200 OK
```

#### 2.3 Update `backend/server.js`
- Mount Paddle webhook route (public, no auth):
  `app.use('/api/webhooks/paddle', paddleWebhookRoutes)`
- Keep existing webhook routes for btcpay, etc.

### Phase 3: Backend — Plan ↔ Paddle Price Mapping

#### 3.1 Update `backend/models/Plan.js`
Add Paddle price ID mapping (both sandbox AND live):

```js
paddlePriceIds: {
    sandbox: {
        monthly: { type: String, default: '' },    // pri_xxx for monthly (sandbox)
        quarterly: { type: String, default: '' },   // pri_xxx for 3-month (sandbox)
        semiannual: { type: String, default: '' },  // pri_xxx for 6-month (sandbox)
        annual: { type: String, default: '' }       // pri_xxx for annual (sandbox)
    },
    live: {
        monthly: { type: String, default: '' },    // pri_xxx for monthly (live)
        quarterly: { type: String, default: '' },   // pri_xxx for 3-month (live)
        semiannual: { type: String, default: '' },  // pri_xxx for 6-month (live)
        annual: { type: String, default: '' }       // pri_xxx for annual (live)
    }
}
```

Admin sets these in Admin → Plans. Each plan has **two sets** of Price IDs:
- Sandbox IDs: used when Test Mode is ON
- Live IDs: used when Test Mode is OFF

Code picks the right set based on `settings.paymentConfig.paddle.testMode`.

**Verify button** next to each Price ID field calls Paddle API to confirm the ID exists and shows the price details.

### Phase 4: Frontend — Paddle.js Checkout

#### 4.1 Install Paddle.js
Add to `frontend/app/layout.tsx` or billing page:

```html
<Script src="https://cdn.paddle.com/paddle/v2/paddle.js" />
```

Initialize in billing page:
```js
Paddle.Initialize({
    token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
    environment: process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT // 'sandbox' or 'production'
});
```

#### 4.2 Update `frontend/app/dashboard/billing/page.tsx`
Paddle checkout button:

```
When user clicks "Pay with Card":
1. Call POST /billing/create-paddle-checkout → get transactionId
2. Open Paddle checkout overlay:
   Paddle.Checkout.open({
       transactionId: transactionId,
       settings: {
           successUrl: '/dashboard/billing?success=true',
           displayMode: 'overlay'  // overlay on current page, not redirect
       }
   });
3. Paddle overlay handles card input, 3DS, etc.
4. On success → webhook fires → backend activates plan
5. Frontend polls or listens for plan activation
```

#### 4.3 Show processing fee in billing UI
Display the 5% processing fee transparently:

```
Plan: Starter - $10.00/mo
Processing fee (5%): $0.50
Total: $10.50/mo
```

#### 4.4 Show crypto discount
When user selects crypto payment:

```
Plan: Starter - $10.50/mo
Crypto discount (3%): -$0.32
Total: $10.19/mo
```

### Phase 5: Frontend — Admin Settings

#### 5.1 Update `frontend/app/admin/settings/page.tsx`
Paddle config section in admin settings:

```
Payment Methods:
  ├── Paddle (Card/PayPal)
  │   ├── Enabled: ON/OFF
  │   ├── Test Mode: ON/OFF  ← Toggle switches which credentials are used
  │   │
  │   ├── 🧪 Sandbox Credentials (Test Mode)
  │   │   ├── Seller ID: xxxxxxx
  │   │   ├── API Key: pdl_sdbx_...
  │   │   ├── Client Token: test_...
  │   │   └── Webhook Secret: pdl_ntfset_...
  │   │
  │   ├── 🔴 Live Credentials (Production)
  │   │   ├── Seller ID: xxxxxxx
  │   │   ├── API Key: pdl_live_...
  │   │   ├── Client Token: live_...
  │   │   └── Webhook Secret: pdl_ntfset_...
  │   │
  │   ├── Processing Fee %: 5
  │   ├── Crypto Discount %: 3
  │   │
  │   └── ℹ️ Info: "Configure payout frequency and minimum threshold
  │              in your Paddle dashboard (recommended: Monthly, $200+ minimum)"
  │
  ├── BTCPay (Crypto)
  │   ├── Enabled: ON/OFF
  │   ├── Supported Networks:
  │   │   ├── ⚡ Lightning Network: ON/OFF (recommended — ~$0.01 fee)
  │   │   ├── ₿ Bitcoin On-chain: ON/OFF (~$0.50-$2 fee)
  │   │   └── Ł Litecoin: ON/OFF (~$0.01 fee)
  │   ├── Network Fee: Paid by Customer (spreadNetworkFee: true)
  │   └── ... (existing BTCPay settings)
```

#### 5.2 Update Admin → Plans
Add Paddle Price ID fields to each plan (sandbox + live):

```
Plan: Starter
  ...existing fields...
  
  Paddle Price IDs — Sandbox (Test):
    Monthly:     pri_01abc...  [✅ Verify] → "Starter Monthly - $10.50/mo USD"
    Quarterly:   pri_01def...  [✅ Verify] → "Starter Quarterly - $30.24/3mo USD"
    Semi-Annual: pri_01ghi...  [✅ Verify] → "Starter Semi-Annual - $57.46/6mo USD"
    Annual:      pri_01jkl...  [✅ Verify] → "Starter Annual - $100.80/yr USD"
  
  Paddle Price IDs — Live (Production):
    Monthly:     pri_01xyz...  [✅ Verify] → "Starter Monthly - $10.50/mo USD"
    Quarterly:   pri_01uvw...  [✅ Verify]
    Semi-Annual: (empty)       [⚠️ Not set]
    Annual:      pri_01rst...  [✅ Verify]
```

**Verify button** calls `GET /prices/{priceId}` on Paddle API to confirm the Price ID exists and shows its details (name, amount, currency, period). Shows error if ID is invalid or from wrong environment.

### Phase 6: Cleanup (COMPLETED)

All 2Checkout code has been removed:
- Deleted `backend/services/twocheckout.js`
- Deleted `setup-2checkout.sh`
- Removed 2Checkout routes from `billing.js`
- Removed 2Checkout webhook from `webhooks.js`
- Removed `twocheckout` from Settings model
- Removed `twocheckout` option from frontend billing page
- Removed `twocheckout` from admin settings UI
- Updated `PAYMENT-SETUP.md` to reference Paddle as primary gateway

---

## NPM Packages Needed

```bash
# Backend
cd backend
npm install @paddle/paddle-node-sdk

# Frontend (Paddle.js loaded via CDN script tag, no npm package needed)
```

---

## File Summary — What Changes

### New Files
```
backend/services/paddle.js              ← Paddle API client
backend/routes/webhooks-paddle.js       ← Paddle webhook handler
PADDLE-SETUP.md                         ← This setup guide
PADDLE-IMPLEMENTATION.md                ← This implementation plan
```

### Modified Files
```
backend/models/Settings.js              ← Add paddle config to paymentConfig
backend/models/Payment.js               ← Add paddleTransactionId, paddleSubscriptionId
backend/models/User.js                  ← Add paddleCustomerId, paddleSubscriptionId
backend/models/Plan.js                  ← Add paddlePriceIds mapping
backend/routes/billing.js               ← Add create-paddle-checkout route
backend/server.js                       ← Mount paddle webhook route
frontend/app/dashboard/billing/page.tsx ← Paddle.js checkout overlay
frontend/app/admin/settings/page.tsx    ← Paddle config section
frontend/app/layout.tsx                 ← Paddle.js script tag
```

---

## Implementation Order

```
Step 1: npm install @paddle/paddle-node-sdk
Step 2: Create backend/services/paddle.js
Step 3: Update Settings.js model (add paddle config)
Step 4: Update Payment.js model (add paddle fields)
Step 5: Update User.js model (add paddle IDs)
Step 6: Update Plan.js model (add paddlePriceIds)
Step 7: Create webhooks-paddle.js route
Step 8: Add create-paddle-checkout to billing.js
Step 9: Mount routes in server.js
Step 10: Add Paddle.js to frontend layout
Step 11: Update billing page (Paddle.js overlay checkout)
Step 12: Update admin settings page (Paddle config)
Step 13: Update admin plans page (Paddle price ID fields)
Step 14: Test full flow in sandbox
Step 15: Remove 2Checkout code (DONE)
Step 16: Update PAYMENT-SETUP.md (DONE)
```

---

## Payment Flow — After Implementation

```
Customer selects plan → Choose payment method:

  AUTOMATIC (Paddle — card/PayPal):
  ├── Click "Pay with Card" → Paddle.js overlay opens
  ├── Customer enters card → Paddle handles 3DS/security
  ├── Paddle charges customer (price + 5% fee)
  ├── Paddle sends webhook → transaction.completed
  ├── Backend verifies signature → activates plan
  └── Customer sees "Plan Active"

  AUTOMATIC (BTCPay — crypto, 3% discount):
  ├── Click "Pay with Crypto" → BTCPay invoice (QR code)
  ├── Customer pays BTC (discounted price)
  ├── Blockchain confirms → BTCPay webhook
  ├── Backend verifies → activates plan
  └── Customer sees "Plan Active"

  MANUAL (unchanged):
  ├── Bank Transfer → upload screenshot → admin verifies
  └── Manual Crypto → upload screenshot → admin verifies
```

---

## Fees Comparison (Updated)

| Method | Your Fee | Network Fee | Customer Pays | You Receive (on $10 plan) |
|--------|----------|-------------|---------------|--------------------------|
| **Paddle (Card/PayPal)** | 5% + $0.50/tx | N/A | $10.50 (+5%) | ~$9.48 |
| **BTCPay Lightning** | 0% | ~$0.01 (customer) | $10.19 (3% off + $0.01) | **$10.19** |
| **BTCPay On-chain** | 0% | ~$0.50-$2 (customer) | $10.19 (3% off + fee) | **$10.19** |
| **BTCPay Litecoin** | 0% | ~$0.01 (customer) | $10.19 (3% off + $0.01) | **$10.19** |
| **JazzCash** | ~2% | N/A | $10.00 | ~$9.80 |
| **EasyPaisa** | ~2% | N/A | $10.00 | ~$9.80 |
| **Manual Bank** | 0% | N/A | $10.00 | $10.00 |
| **Manual Crypto** | 0% | N/A | $10.00 | $10.00 |

> With BTCPay + crypto discount: You receive the **full discounted price** ($10.19).
> Network fee is added ON TOP and paid by the customer, not deducted from you.
> Lightning Network is the best option: instant, ~$0.01 fee, you keep 100%.
