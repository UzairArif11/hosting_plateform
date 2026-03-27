# JazzCash Payment Integration Setup Guide

## 1. Create JazzCash Merchant Account

1. Visit [JazzCash Business Portal](https://www.jazzcash.com.pk/business/)
2. Click **"Register as Merchant"**
3. Fill in your business details:
   - Business Name
   - NTN Number (if applicable)
   - CNIC of owner
   - Business address
   - Mobile number (JazzCash registered)
4. Submit documents:
   - CNIC copy (front & back)
   - Business registration certificate
   - NTN certificate (if available)
5. Wait for approval (typically 2-3 business days)

## 2. Get API Credentials

After merchant approval:

1. Log into [JazzCash Merchant Portal](https://sandbox.jazzcash.com.pk/Sandbox)
2. Navigate to **Integration** → **API Credentials**
3. Note down:
   - **Merchant ID** (e.g., `MC12345`)
   - **Password** (API password, not login password)
   - **Integrity Salt** (HMAC key for hash verification)

> **Sandbox vs Production:**
> - Sandbox URL: `https://sandbox.jazzcash.com.pk/ApplicationAPI/API/Payment/DoTransaction`
> - Production URL: `https://payments.jazzcash.com.pk/ApplicationAPI/API/Payment/DoTransaction`

## 3. Environment Variables

Add these to your `.env` file:

```env
# JazzCash Configuration
JAZZCASH_MERCHANT_ID=MC12345
JAZZCASH_PASSWORD=your_api_password
JAZZCASH_INTEGRITY_SALT=your_integrity_salt_key
JAZZCASH_RETURN_URL=https://yourdomain.com/api/webhooks/jazzcash
JAZZCASH_API_URL=https://sandbox.jazzcash.com.pk/ApplicationAPI/API/Payment/DoTransaction

# For production, change API URL to:
# JAZZCASH_API_URL=https://payments.jazzcash.com.pk/ApplicationAPI/API/Payment/DoTransaction
```

## 4. How Payment Flow Works

```
1. User selects JazzCash → enters mobile number
2. Backend creates payment session via JazzCash API
3. User completes payment on JazzCash app/web
4. JazzCash sends callback to /api/webhooks/jazzcash
5. System verifies signature + updates payment status
6. User's plan is automatically upgraded
```

## 5. Webhook Configuration

In JazzCash Merchant Portal:
1. Go to **Settings** → **Callback URLs**
2. Set callback URL: `https://yourdomain.com/api/webhooks/jazzcash`
3. Enable POST callback method

## 6. Testing in Sandbox (On Your Computer)

When testing locally (`localhost`), JazzCash cannot send successful payment notifications (webhooks) to your computer because it's not public.

**How to test on localhost with ngrok:**
1. Download and install **ngrok** (https://ngrok.com/)
2. Open terminal and run: `ngrok http 5000` (assuming backend is port 5000)
3. Copy the secure Forwarding URL (e.g., `https://a1b2c3d4.ngrok.app`)
4. In your JazzCash Merchant Portal, set the **Callback URL** to: `https://a1b2c3d4.ngrok.app/api/webhooks/jazzcash`
5. Process a test transaction using a random mobile number like `03001234567`.
6. JazzCash will hit the ngrok URL, and your local app will automatically upgrade the user's plan.

---

## 🏦 A Note on Manual Bank Transfers

If you also enable "Manual Bank Transfer" in your **Admin Panel -> Settings**:
1. Type your Account Number carefully. A typo means users send money to the wrong person!
2. You will have to manually verify the user's uploaded screenshot in **Admin -> Payments** to approve their plan.

---

## 7. Go to Production

1. Complete JazzCash production approval
2. Update `.env`:
   - Replace sandbox credentials with production ones
   - Update `JAZZCASH_API_URL` to production URL
3. Update webhook URL in JazzCash portal to production domain
4. Test with a real small payment first

## Fees

| Type | Fee |
|------|-----|
| Transaction Fee | 1.5% - 2.5% per transaction |
| Settlement | Daily (T+1) to your JazzCash merchant account |
| Monthly Fee | PKR 0 (no monthly charges) |
| Withdrawal | Free to JazzCash account, standard bank transfer fee to bank |

## Troubleshooting

- **Hash mismatch errors**: Ensure Integrity Salt is correct and fields are in exact order
- **Timeout errors**: JazzCash sandbox can be slow, increase timeout to 30s
- **Callback not received**: Ensure your server is publicly accessible and callback URL is correct
- **Transaction failed (code 124)**: Insufficient balance in test wallet
