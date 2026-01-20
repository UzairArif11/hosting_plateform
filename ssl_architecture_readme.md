# SSL Architecture & Limits Review

## ✅ CONFIRMED: You are Safe.

### 1. "Free Users" Limit (Path-Based)
**Limit: ZERO.**
*   Since you use `domain.com/project`, you use **1 certificate** for everyone.
*   You can have 10 million free users and you will never hit a limit.

### 2. "Custom Domains" Limit (Paid Users)
If paid users bring their own domains (e.g., `user1-shop.com`, `user2-blog.com`), here are the limits:

#### A. Your Code Limit (Configurable)
*   **Current Setting:** `maxCustomDomains: 1`
*   **Where:** `frontend/app/admin/plans/page.tsx`
*   **Meaning:** Each paid user can add 1 custom domain by default. You can increase this in the Admin Panel.

#### B. The Hard Limit (Let's Encrypt)
*   **Limit:** **300 New Orders per 3 Hours**.
*   **Meaning:** Your server can generate certificates for **300 NEW custom domains every 3 hours**. (That is 2,400 per day).

### 3. FAQ: Usage vs. New Issuance
**Q: Does the limit depend on how many domains I ALREADY have?**
**A: NO.**
*   The limit applies ONLY to **creating NEW certificates**.
*   **Example:**
    *   **Yesterday:** You added 500 domains. (They are active and working).
    *   **Today:** You start with **0** against your limit. You can add another 2,400 today.
    *   **Reset:** The limit is a "sliding window" of 3 hours. It resets continuously.

**Verdict:** Your architecture scales extremely well. The more users you have, the limits **DO NOT** get tighter. They stay the same for *new* users.
