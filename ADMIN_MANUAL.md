# 👑 Admin Panel User Manual

**Status:** Production Ready ✅  
**Last Updated:** December 24, 2025

This manual explains how to use the Admin Panel to manage your hosting platform. All features are fully functional and connected to the live database.

---

## 1. 💳 Plan Management
**Page:** `/admin/plans`

This is where you define what you sell (products) and what resources users actually get.

### Key Concepts
*   **Marketing (Display) Resources:** What the user SEES on their dashboard (e.g., "2GB RAM").
*   **Actual (Enforced) Resources:** What the Docker container ACTUALLY gets (e.g., "0.5GB RAM").
    *   *Why?* This allows you to "oversell" resources safely or create special marketing tiers.

### How to Use
1.  **Create a Plan:** Click "+ Create New Plan".
2.  **Edit Marketing Info:** Use the **"Display Resources"** tab to set what users see.
3.  **Edit Technical Limits:** Use the **"Actual Resources"** tab to set physical Docker limits.
4.  **Sync Users:** If you change a plan (e.g., increase RAM), click the **"Sync Users"** button. This will:
    *   Find all users on that plan.
    *   Re-create their containers with the new limits.
    *   Update their dashboard display.
    *   *Note:* This happens with almost zero downtime.

---

## 2. 📊 Capacity Planning
**Page:** `/admin/capacity`

This page prevents your servers from crashing by controlling how many users can sign up.

### How to Use
1.  **View Health:** Look at the progress bars for **EC2** and **EC3**.
    *   🟢 Green = Good
    *   🔴 Red = Danger (Server Full)
2.  **Set Limits:** You can tell the system: *"Only allow 50 Free users and 10 Enterprise users on this server."*
3.  **Calculator:** Type numbers into the calculator to see "What if?".
    *   *Example:* Type "500" for Free users. If the "Projected Free CPU" turns **Negative Red**, your server will crash! Do not save.
4.  **Apply:** Click "Apply Capacity Limits" to enforce your rules. New users won't be able to sign up if the limit is reached.

---

## 3. 🛡️ User Protection
**Page:** `/admin/users`

Sometimes you have special users (like yourself or VIP clients) who should **never** be deleted or downgraded, even if they don't pay or if a cleanup script runs.

### How to Use
1.  Find the user in the list.
2.  Click the **"PROTECT"** button.
3.  A 🛡️ shield icon will appear.
4.  **Effect:** This user is now immune to:
    *   Automated cleanups.
    *   Plan downgrades.
    *   Accidental deletion.

---

## 4. 🖥️ Infrastructure Health
**Page:** `/admin/servers`

This tool keeps your database clean.

### What it does
*   **Zombies:** Containers running on the server but NOT in the database. (Wasting money).
*   **Orphans:** Database says a container exists, but it's missing on the server. (Broken for user).

### How to Use
1.  Scroll to the bottom **"Infrastructure Health Scanner"**.
2.  Click **"Run Full System Scan"**.
3.  If it finds "Zombies" (Containers to delete), click the **Trash Icon** to remove them.

---

## 5. 📁 Project Management
**Page:** `/admin/projects`

Manage individual user applications.

### Key Actions
*   **Rebuild:** If a user says "My app is stuck", find their project and click **"REBUILD"**. It forces a fresh deployment.
*   **Protect:** You can protect specific projects from deletion, just like users.

---

## 💡 Admin Recommendations & Suggestions

### 1. Billing Automation (Future Step)
Currently, when you "Sync Users" to a more expensive plan, the system updates their resources immediately. However, it does not automatically charge their card for the difference.
*   **Suggestion:** In the future, integrate stripe/payoneer logic into the "Sync" button to issue pro-rated invoices.

### 2. Email Notifications
When you update a plan (e.g., "We doubled your RAM!"), users don't get an email automatically.
*   **Suggestion:** Send an email blast when clicking "Sync Users" to let them know about the upgrade.

### 3. Overselling Advice
Be careful with "Overselling" (Displaying 2GB but giving 1GB).
*   **Advice:** Only oversell **CPU**, never **Storage**. If a user fills their disk and it's actually smaller than promised, their app will crash and data might corrupt. CPU is safe to oversell because they just run slower.

### 4. Backup Policy
The "Protection" flag saves users from *deletion*, but not from *server failure*.
*   **Advice:** Ensure your EC2/EC3 servers have daily snapshots at the provider level (AWS/Oracle).

---

## 🆘 Troubleshooting

*   **"Sync Button is Spinning Forever"**
    *   Check the backend terminal logs. It usually means SSH to the server failed.
*   **"I updated limits but user dashboard didn't change"**
    *   Did you click "Sync Users"? Changing the plan definition doesn't affect existing users until you Sync.
*   **"Server shows 100% full but I have space"**
    *   Go to `/admin/capacity` and check if you have "Reserved Resources" set too high in the seeder code.

---

**System is Online.** Open `http://localhost:3000/admin` to begin.

---

## ❓ Frequently Asked Questions

### Q: If I update a Plan (e.g. decrease RAM), do existing users get updated automatically?
**No.** Updating a plan only changes the "blueprint" for *future* users. To update *existing* users, you **MUST** click the **"Sync Users"** button on the Plan Management page. This is a safety feature to prevent accidental mass-restarts.

### Q: Does the "Sync" process decrease real server usage?
**Yes.** When you Sync, the system:
1.  **Destroys** the old container (e.g., 1GB RAM).
2.  **Creates** a new container (e.g., 0.5GB RAM) on the server.
3.  The server instantly frees up the difference (e.g., 0.5GB RAM).

### Q: Will users lose data during Sync?
The system performs a "Zero-Downtime" upgrade.
*   **Database Data:** Safe (as long as it's stored in your external database).
*   **Container Files:** The container is **Recreated**. If users stored files *inside* the container's filesystem (not in a volume/database), those temporary files will be reset. This is standard for modern cloud platforms.

### Q: Sync logs say "No active deployments found" but container is running?
**Cause:** The database record for the deployment is missing or marked as 'failed', so the system ignores it to prevent errors.
**Fix:** Go to **Admin > Projects**, find the user's project, and click **Rebuild**. This will force a fresh deployment with the new limits and fix the database record.

---

**System is Online.** Open `http://localhost:3000/admin` to begin.
