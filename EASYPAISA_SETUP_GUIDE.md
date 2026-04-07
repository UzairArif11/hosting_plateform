# EasyPaisa Payment Integration Setup Guide

## 1. Create EasyPaisa Merchant Account

1. Visit [EasyPaisa Business](https://www.easypaisa.com.pk/business)
2. Click **"Become a Merchant"** or **"EasyPay Integration"**
3. Fill in business details:
   - Business Name (registered)
   - Business Type
   - Owner CNIC
   - Registered mobile number
   - Business address
4. Submit required documents:
   - CNIC copy (front & back)
   - Business registration certificate
   - Bank account details (for settlement)
5. Wait for approval (typically 3-5 business days)

## 2. Get API Credentials

After merchant account approval:

1. Log into [EasyPaisa Merchant Portal](https://easypay.easypaisa.com.pk/)
2. Navigate to **API Integration** section
3. Note down:
   - **Store ID** (your merchant store identifier)
   - **Hash Key** (HMAC secret for signature verification)
   - **Account Number** (your EasyPaisa merchant account)

> **Sandbox vs Production:**
> - Sandbox URL: `https://easypay.easypaisa.com.pk/easypay-sandbox/Index.jsf`
> - Production URL: `https://easypay.easypaisa.com.pk/easypay/Index.jsf`

## 3. Environment Variables

Add these to your `.env` file:

```env
# EasyPaisa Configuration
EASYPAISA_STORE_ID=your_store_id
EASYPAISA_HASH_KEY=your_secret_hash_key
EASYPAISA_ACCOUNT_NUM=your_easypaisa_account_number
EASYPAISA_API_URL=https://easypay.easypaisa.com.pk/easypay/Index.jsf
EASYPAISA_CONFIRM_URL=https://easypay.easypaisa.com.pk/easypay/Confirm.jsf

# For sandbox testing, change URLs to:
# EASYPAISA_API_URL=https://easypay.easypaisa.com.pk/easypay-sandbox/Index.jsf
# EASYPAISA_CONFIRM_URL=https://easypay.easypaisa.com.pk/easypay-sandbox/Confirm.jsf
```

## 4. How Payment Flow Works

```
1. User selects EasyPaisa → optionally enters mobile number
2. Backend generates checkout form data with HMAC hash
3. User is redirected to EasyPaisa hosted checkout page
4. User completes payment via mobile wallet or OTP
5. EasyPaisa sends POST callback to /api/webhooks/easypaisa
6. System verifies hash + records payment
7. User's plan is automatically upgraded
```

## 5. Webhook/Postback Configuration

In EasyPaisa Merchant Portal:
1. Go to **Integration Settings** → **Postback URL**
2. Set URL: `https://yourdomain.com/api/webhooks/easypaisa`
3. Choose POST method
4. Enable auto-redirect after payment

## 6. Testing in Sandbox (On Your Computer)

When testing locally (`localhost`), EasyPaisa cannot reach your local server to confirm the payment was successful. 

**How to test on localhost with ngrok:**
1. Download **ngrok** (https://ngrok.com/)
2. Open terminal and run: `ngrok http 5000` (assuming backend is port 5000)
3. Copy the Forwarding URL (e.g., `https://a1b2c3d4.ngrok.app`)
4. In the EasyPaisa Merchant Portal, set your **Postback URL** to: `https://a1b2c3d4.ngrok.app/api/webhooks/easypaisa`
5. Test a transaction using sandbox credentials.
6. EasyPaisa will notify your ngrok URL, and your local database will update and upgrade the user!

---

## 🏦 A Note on Manual Bank Transfers

If you also enable "Manual Bank Transfer" from your **Admin Panel -> Settings**:
1. Add your Account Number/IBAN perfectly accurately.
2. Users will manually send you money and upload screenshots.
3. You must verify these screenshots in **Admin -> Payments** before their plan upgrades.

---

## 7. Go to Production

1. Complete EasyPaisa production verification
2. Update `.env`:
   - Replace sandbox credentials with production ones
   - Switch URLs from sandbox to production
3. Update postback URL in merchant portal
4. Process a test transaction with a small amount

## Fees

| Type | Fee |
|------|-----|
| Transaction Fee | 1.8% - 2.5% per transaction |
| Settlement | T+1 to T+3 business days |
| Monthly Fee | PKR 0 (no fixed monthly charges) |
| Withdrawal | Free to EasyPaisa wallet, bank transfer fee applies for bank withdrawal |

## Supported Payment Methods

- EasyPaisa Mobile Account
- Debit/Credit Card (via EasyPaisa gateway)
- Bank Account (via EasyPaisa)

## Troubleshooting

- **Hash verification failed**: Double-check Hash Key and ensure fields are concatenated in the correct order
- **Redirect not working**: Set `autoRedirect: '1'` in form data
- **Postback not received**: Ensure server is publicly accessible, check firewall rules
- **Amount format error**: EasyPaisa expects amounts with 1 decimal place (e.g., `500.0`)
- **Session expired**: Payment sessions expire after 1 hour by default
