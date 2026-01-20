# Template Tiering System - Live Verification Guide

This document explains **How It Works** and **How To Test** the new template tiering functionality on your live platform.

---

## 🛠️ How It Works

The system now supports three tiers of templates: **Free**, **Pro**, and **Enterprise**. Access is controlled by comparing the template's `minPlan` requirement against the user's current plan.

### 1. The Logic (Hierarchy)
We use a documented hierarchy to determine access:
- **Free Plan** (Level 0)
- **Pro Plan** (Level 1)
- **Enterprise Plan** (Level 2)

**Rule:** `User Plan Level >= Template Minimum Plan Level`
- If User is **Free** and Template is **Pro**, access is **LOCKED**.
- If User is **Pro** and Template is **Pro**, access is **UNLOCKED**.

### 2. Backend Enforcement
The API route `POST /api/templates/:id/deploy` enforces this rule strictly.
- It fetches the user's full plan details.
- It compares the user's plan level against the template's `minPlan`.
- If the user's level is too low, it returns a `403 Forbidden` error with `upgradeRequired: true`.
- **Security Note:** This prevents proficient users from bypassing the UI by sending direct API requests.

### 3. Frontend Experience
- **Badges:** Templates display "PRO" or "ENTERPRISE" badges based on their `minPlan`.
- **Locking:** Locked templates are grayed out with a transparent overlay and a Lock icon.
- **Redirection:** Clicking a locked template redirects the user to `/dashboard/billing` to encourage an upgrade.
- **Live Preview:** A "Live Website" button appears if a `previewUrl` is set, allowing all users (even free ones) to see what they *could* build.

---

## 🧪 How To Test (Live)

Follow these steps to verify everything is working correctly on your live deployment.

### Phase 1: Admin Setup (Configure a Pro Template)
1.  **Log in** to your Admin Panel.
2.  Navigate to **Templates** sidebar item.
3.  **Create** OR **Edit** a template.
4.  In the **Basic Info** tab:
    *   Find the **Minimum Plan** dropdown.
    *   Select **"Pro (Paid)"**.
    *   Ensure **Published** is checked.
5.  In the **Preview Info** tab (Optional):
    *   Add a URL to **Live Website Preview URL** (e.g., `https://example.com`) to test the new button.
6.  **Save** the template.

### Phase 2: Free User Verification (The "Upsell" Flow)
1.  **Log out** of Admin and log in as a **Free** user (or use an incognito window).
2.  Go to **Dashboard > New Project**.
3.  Locate the template you configured in Phase 1.
4.  **Verify Visuals:**
    *   [ ] Does it show a **"PRO"** badge in the top-left?
    *   [ ] Is the image **grayed out**?
    *   [ ] Is there a **Lock Icon** in the center?
    *   [ ] Does the overlay button say **"Unlock with Pro"** or **"Upgrade to Use"**?
    *   [ ] (If configured) Is the **"Live Website"** button visible and clickable?
5.  **Verify Action:**
    *   [ ] Click anywhere on the locked card.
    *   [ ] **Result:** You should be immediately redirected to `/dashboard/billing`.

### Phase 3: Pro User Verification (The "Happy" Flow)
1.  **Log in** as a **Pro** user (or use Admin to change your test user's plan).
2.  Go to **Dashboard > New Project**.
3.  Locate the same template.
4.  **Verify Visuals:**
    *   [ ] The image should vary normally (colorful, no graying out).
    *   [ ] **No** Lock icon should be visible.
    *   [ ] The overlay button should say **"Deploy Template"**.
5.  **Verify Action:**
    *   [ ] Click the card.
    *   [ ] **Result:** You should be taken to the **Project Configuration** screen (Name, Env Vars, etc.).

### Phase 4: Safety Check
*If you are technical, you can try this test:*
1.  As a **Free** user, try to "Hack" the deploy.
2.  If you know how to use browser DevTools, try to find the API request used for deployment and replay it for the Pro template.
3.  **Result:** The server will reject the request with a `403` error, proving the backend security is active.
