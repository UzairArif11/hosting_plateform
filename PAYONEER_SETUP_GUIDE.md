# 🇵🇰 Payoneer Setup Guide for Pakistan

## Step 1: Create Payoneer Account

1. Go to **[payoneer.com/signup](https://www.payoneer.com/signup/)**
2. Click **"Register"** → Select **"Get Paid by Clients"**
3. Fill details:
   - **Country:** Pakistan
   - **First/Last Name:** As on CNIC
   - **Email:** Your email
   - **Date of Birth:** As on CNIC
   - **Phone:** Pakistani number (+92...)
4. **Add Bank Account:**
   - Bank: Meezan Bank / SadaPay / NayaPay / HBL / UBL etc.
   - Account Number / IBAN
   - Bank Branch (for traditional banks)
5. **Upload CNIC** (front & back photo)
6. Wait **2-5 days** for verification email

> **Tip:** If signup fails, try a different browser, clear cookies, or wait 24 hours and try again.

---

## Step 2: Get API Keys (After Account Approved)

1. Login to **[payoneer.com](https://payoneer.com)**
2. Go to **Settings** → **API Access** (or Developer section)
3. If you don't see API option:
   - Contact Payoneer support: **support@payoneer.com**
   - Say: *"I need API access for my SaaS platform to accept payments"*
   - They will enable it within 1-3 business days
4. Once enabled, you'll get:

```
Client ID:      PAYO_XXXXXXXXXXXXXXXX
Client Secret:  PAYO_SECRET_XXXXXXXXX
Webhook Secret: WH_XXXXXXXXXXXXXXXXXX
```

---

## Step 3: Add to Your `.env` File

```env
# === PAYONEER CONFIGURATION ===

# For TESTING (use sandbox first!)
PAYONEER_API_URL=https://api.sandbox.payoneer.com
PAYONEER_CLIENT_ID=your_sandbox_client_id
PAYONEER_CLIENT_SECRET=your_sandbox_client_secret
PAYONEER_WEBHOOK_SECRET=your_sandbox_webhook_secret

# For PRODUCTION (switch after testing works)
# PAYONEER_API_URL=https://api.payoneer.com
# PAYONEER_CLIENT_ID=your_live_client_id
# PAYONEER_CLIENT_SECRET=your_live_client_secret
# PAYONEER_WEBHOOK_SECRET=your_live_webhook_secret
```

---

## Step 4: Set Up Webhooks

1. In Payoneer Dashboard → **Webhooks** → **Add Endpoint**
2. **URL:** `https://your-platform-domain.com/api/billing/webhook`
3. Subscribe to events:
   - `payment.completed`
   - `payment.failed`
   - `subscription.activated`
   - `subscription.cancelled`
   - `payout.completed`
   - `payout.failed`
4. Copy the **Webhook Secret** → paste in `.env` as `PAYONEER_WEBHOOK_SECRET`

---

## Step 5: Seed Plans (One-Time)

```bash
node backend/seeders/planSeeder.js
```

This creates your pricing plans:

| Plan | USD/month | PKR/month |
|------|-----------|-----------|
| Free | $0 | ₨0 |
| Starter | $5 | ₨1,400 |
| Professional | $15 | ₨4,200 |
| Business | $29 | ₨8,100 |

---

## 💰 How Payments Work (Full Flow)

### When a Customer Pays:

```
1. Customer clicks "Upgrade to Pro" ($15/month)
         ↓
2. Your backend calls Payoneer API → gets checkout URL
   (File: backend/routes/billing.js → POST /create-session)
         ↓
3. Customer redirected to Payoneer's checkout page
   (They enter card details on PAYONEER'S site, NOT yours)
         ↓
4. Customer pays → Payoneer charges their card
         ↓
5. Payoneer sends webhook to your server
   (File: backend/services/payoneer.js → handleWebhook)
         ↓
6. Your server upgrades user's plan automatically
   (User model updated: plan = "professional", status = "active")
         ↓
7. Customer sees Pro features immediately ✅
```

### Where Does the Money Go?

```
Customer pays $15
    ↓
Payoneer takes ~3% fee ($0.45)
    ↓
$14.55 appears in your Payoneer Balance
    ↓
You can see it at: payoneer.com → Activity → Balance
```

---

## 💸 How to Withdraw to Your Pakistani Bank

### Option A: Manual Withdrawal

1. Login to **payoneer.com**
2. Click **"Withdraw"** → **"To Bank Account"**
3. Select your Pakistani bank (Meezan/SadaPay/etc.)
4. Enter amount (minimum: **$50**)
5. Click **Withdraw**
6. Money arrives in **2-5 business days** in PKR

### Option B: Auto-Withdrawal (Recommended)

1. Go to **Settings** → **Auto Withdraw**
2. Set: "Withdraw when balance exceeds $100"
3. Select bank account
4. Payoneer will auto-send to your bank when threshold is reached

### Withdrawal Fees

| To Where | Fee | Time |
|----------|-----|------|
| Pakistani Bank (Meezan, HBL, UBL) | $1.50 per withdrawal | 2-5 days |
| SadaPay | $1.50 per withdrawal | 2-5 days |
| NayaPay | $1.50 per withdrawal | 2-5 days |
| JazzCash | $1.50 per withdrawal | 1-3 days |

### Exchange Rate

- Payoneer converts USD → PKR at their rate (slightly below market rate, ~1-2% difference)
- Example: If market rate is $1 = ₨280, Payoneer may give ₨275-278

---

## 📊 Tracking Your Earnings

### In Payoneer Dashboard:
- **Activity** → See all incoming payments
- **Balance** → See current available funds
- **Withdraw History** → See all withdrawals to bank

### In Your Platform Admin:
- **Admin Panel** → **Plans** → See user counts per plan
- **Billing API** → `GET /api/billing/payments` → Payment history

---

## 🧪 How to Test on Your Computer (Localhost)

When you are testing on your own computer (`http://localhost:3000`), Payoneer cannot send messages (webhooks) to your local server because your computer is not public. 

**Steps to test locally:**
1. Download and install **ngrok** (https://ngrok.com/)
2. Open terminal and run: `ngrok http 5000` (assuming your backend runs on port 5000)
3. Ngrok will give you a public URL like `https://a1b2c3d4.ngrok-free.app`
4. Go to Payoneer Dashboard → Webhooks
5. Set the Webhook URL to: `https://a1b2c3d4.ngrok-free.app/api/webhooks/payoneer`
6. Now when you do a test payment, Payoneer will hit your ngrok URL, which forwards it to your local backend. The user's plan will upgrade automatically!

---

## 🏦 A Note on Manual Bank Transfers

If you turn on "Manual Bank Transfers" in the Admin Panel (Settings -> Payment Methods), make sure you:
1. Double-check your **Bank Name** and **Account Number** when typing them in.
2. If the user sends money to a typo'd account, they will lose their money.
3. Users will upload screenshots. You must view them in the **Admin -> Payments** tab to verify and approve the upgrade.

---

## ❓ Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Can't create account | Try different browser, clear cookies, try after 24hrs |
| Account under review | Normal — takes 2-5 days, check email for updates |
| API access not visible | Email support@payoneer.com to enable API access |
| Webhook not receiving | Check URL is HTTPS, server is running, firewall allows POST |
| Withdrawal stuck | Check minimum $50 balance, bank details are correct |
| Low exchange rate | Normal — Payoneer's rate is ~1-2% below market. Compare with Wise |

---

## 🔒 Security Notes

- Never share your Client Secret publicly
- Always use HTTPS for webhook URLs
- Use sandbox keys for testing, production keys for live
- Your platform NEVER sees customer card numbers (Payoneer handles that)
