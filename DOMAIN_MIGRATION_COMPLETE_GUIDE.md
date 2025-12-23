# 🌐 COMPLETE DOMAIN MIGRATION GUIDE

## 📚 **TABLE OF CONTENTS**

1. [Overview](#overview)
2. [Automatic Migration (Recommended)](#automatic-migration-recommended)
3. [Manual Migration](#manual-migration)
4. [Migration Process Details](#migration-process-details)
5. [Troubleshooting](#troubleshooting)
6. [FAQ](#faq)

---

## 🎯 **OVERVIEW**

When you update a domain, the system needs to update:
1. ✅ **Database** - Deployment URLs, settings
2. ✅ **Server Configuration** - Nginx server_name
3. ✅ **SSL Certificates** - HTTPS for new domain
4. ✅ **User Notifications** - Email to affected users

**Two Migration Options:**
- **Automatic** - System updates everything (recommended)
- **Manual** - Admin updates server configuration manually

---

## 🤖 **AUTOMATIC MIGRATION (Recommended)**

### **What It Does:**

```
Admin updates domain via API
  ↓
System automatically:
1. ✅ Updates database (deployment URLs)
2. ✅ SSH to server
3. ✅ Backs up Nginx config
4. ✅ Updates Nginx server_name
5. ✅ Tests Nginx config
6. ✅ Reloads Nginx
7. ✅ Updates SSL certificate (certbot)
8. ✅ Sends email to users
  ↓
Complete! New domain works immediately
```

### **How to Use:**

#### **Option 1: Via API (Default)**

```bash
curl -X PUT http://localhost:5000/api/settings/domains \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "serverDomains": {
      "EC3": "newdomain.com"
    },
    "updateServerConfig": true
  }'
```

**Response:**
```json
{
  "message": "Domain configuration updated successfully. Database, server configuration, and SSL certificates are being updated. Users will be notified.",
  "serverDomains": {
    "EC2": "ec2.foodpanda.site",
    "EC3": "newdomain.com",
    "EC4": "ec4.foodpanda.site"
  },
  "migrationStarted": true,
  "migrationType": "complete"
}
```

#### **Option 2: Via Admin Panel**

```javascript
// In admin panel
const response = await fetch('/api/settings/domains', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    serverDomains: {
      EC3: 'newdomain.com'
    },
    updateServerConfig: true  // Enable automatic migration
  })
});
```

### **What Happens:**

#### **Step 1: Database Update** ✅
```
• Settings.serverDomains.EC3 updated
• All deployment URLs updated
• Migration history stored
```

#### **Step 2: Server Configuration** ✅
```
• SSH to EC3 server
• Backup: /etc/nginx/sites-available/default.backup.1734442800000
• Update server_name: foodpanda.site → newdomain.com
• Test: sudo nginx -t
• Reload: sudo systemctl reload nginx
```

#### **Step 3: SSL Certificate** ✅
```
• Check if certificate exists for newdomain.com
• If exists: sudo certbot --nginx -d newdomain.com --reinstall
• If not: sudo certbot --nginx -d newdomain.com --agree-tos
• HTTPS enabled for new domain
```

#### **Step 4: User Notification** ✅
```
• Email sent to all affected users
• Lists old and new URLs
• Provides migration details
```

### **Monitoring Progress:**

```bash
# Check backend logs
tail -f backend/logs/app.log

# Look for:
[info]: Starting complete domain migration for EC3: foodpanda.site → newdomain.com
[info]: [EC3] Step 1: Migrating database and notifying users...
[info]: [EC3] ✓ Database migration complete: 150 deployments, 42 users notified
[info]: [EC3] Step 2: Connecting to server...
[info]: [EC3] ✓ Connected to server
[info]: [EC3] Step 3: Backing up Nginx configuration...
[info]: [EC3] ✓ Nginx config backed up
[info]: [EC3] Step 4: Updating Nginx server_name...
[info]: [EC3] ✓ Nginx config updated
[info]: [EC3] Step 5: Testing Nginx configuration...
[info]: [EC3] ✓ Nginx config test passed
[info]: [EC3] Step 6: Reloading Nginx...
[info]: [EC3] ✓ Nginx reloaded
[info]: [EC3] Step 7: Updating SSL certificate...
[info]: [EC3] ✓ SSL certificate updated
[info]: [EC3] ✅ Complete domain migration successful!
```

### **Rollback on Failure:**

If Nginx test or reload fails:
```
1. System automatically restores backup
2. Old configuration restored
3. Old domain continues to work
4. Error logged
```

---

## 🔧 **MANUAL MIGRATION**

### **When to Use:**

- Testing domain changes
- Prefer manual control
- Troubleshooting issues
- SSH credentials not available

### **How to Use:**

#### **Step 1: Update Database Only**

```bash
curl -X PUT http://localhost:5000/api/settings/domains \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "serverDomains": {
      "EC3": "newdomain.com"
    },
    "updateServerConfig": false
  }'
```

**Response:**
```json
{
  "message": "Domain configuration updated successfully. Database is being updated and users will be notified. Server configuration must be updated manually.",
  "serverDomains": {
    "EC3": "newdomain.com"
  },
  "migrationStarted": true,
  "migrationType": "database-only",
  "manualSteps": [
    "SSH to each server",
    "Update /etc/nginx/sites-available/default",
    "Run: sudo nginx -t",
    "Run: sudo systemctl reload nginx",
    "Run: sudo certbot --nginx -d <new-domain>"
  ]
}
```

#### **Step 2: Update Server Configuration Manually**

**For EC3 (foodpanda.site → newdomain.com):**

```bash
# 1. SSH to server
ssh -i D:/work/ec3/uz.key ubuntu@129.154.255.90

# 2. Backup current config
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.manual

# 3. Edit Nginx config
sudo nano /etc/nginx/sites-available/default

# Find and replace:
# OLD:
server_name foodpanda.site www.foodpanda.site;

# NEW:
server_name newdomain.com www.newdomain.com;

# Save and exit (Ctrl+X, Y, Enter)

# 4. Test configuration
sudo nginx -t

# Expected output:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# 5. Reload Nginx
sudo systemctl reload nginx

# 6. Update SSL certificate
sudo certbot --nginx -d newdomain.com -d www.newdomain.com

# 7. Verify HTTPS works
curl -I https://newdomain.com/
```

#### **Step 3: Verify Migration**

```bash
# Test new domain
curl -I https://newdomain.com/

# Should return: HTTP/2 200

# Test deployment URL
curl -I https://newdomain.com/project-abc-123/

# Should return: HTTP/2 200
```

---

## 📋 **MIGRATION PROCESS DETAILS**

### **Complete Migration Steps:**

#### **1. Database Migration**
```javascript
// Find all deployments on changed server
const deployments = await Deployment.find({
    serverKey: 'EC3',
    status: 'success',
    url: { $exists: true }
});

// Update each deployment URL
for (const deployment of deployments) {
    const oldUrl = deployment.url;
    const newUrl = oldUrl.replace('foodpanda.site', 'newdomain.com');
    
    deployment.url = newUrl;
    deployment.metadata.domainMigration = {
        oldDomain: 'foodpanda.site',
        newDomain: 'newdomain.com',
        migratedAt: new Date(),
        oldUrl: oldUrl
    };
    
    await deployment.save();
}
```

#### **2. Nginx Configuration Update**
```bash
# Read current config
current_config=$(sudo cat /etc/nginx/sites-available/default)

# Replace server_name
new_config=$(echo "$current_config" | sed 's/server_name foodpanda.site/server_name newdomain.com/g')

# Write new config
echo "$new_config" | sudo tee /etc/nginx/sites-available/default > /dev/null

# Test
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

#### **3. SSL Certificate Update**
```bash
# Check if certificate exists
sudo certbot certificates | grep newdomain.com

# If exists, reinstall
sudo certbot --nginx -d newdomain.com -d www.newdomain.com --reinstall

# If not, obtain new
sudo certbot --nginx -d newdomain.com -d www.newdomain.com --agree-tos
```

#### **4. User Notification**
```javascript
// Group deployments by user
const userNotifications = new Map();

for (const deployment of deployments) {
    const userId = deployment.userId._id.toString();
    if (!userNotifications.has(userId)) {
        userNotifications.set(userId, {
            user: deployment.userId,
            deployments: []
        });
    }
    
    userNotifications.get(userId).deployments.push({
        projectName: deployment.projectId.name,
        oldUrl: oldUrl,
        newUrl: newUrl
    });
}

// Send email to each user
for (const [userId, data] of userNotifications) {
    await sendDomainChangeNotification(data.user, data.deployments);
}
```

---

## 🔍 **TROUBLESHOOTING**

### **Issue 1: Nginx Test Fails**

**Error:**
```
nginx: [emerg] invalid server name or wildcard "newdomain.com" on 0.0.0.0:80
```

**Solution:**
```bash
# Check for typos in domain name
sudo cat /etc/nginx/sites-available/default | grep server_name

# Restore backup
sudo cp /etc/nginx/sites-available/default.backup.* /etc/nginx/sites-available/default

# Try again with correct domain
```

### **Issue 2: SSL Certificate Fails**

**Error:**
```
Certbot failed to authenticate some domains
```

**Solution:**
```bash
# 1. Verify DNS is pointing to server
dig newdomain.com

# Should show server IP

# 2. Verify port 80 is accessible
curl -I http://newdomain.com/

# 3. Try manual certificate
sudo certbot certonly --standalone -d newdomain.com
```

### **Issue 3: Old Domain Still Works, New Doesn't**

**Cause:** DNS not updated

**Solution:**
```bash
# 1. Update DNS A record
# newdomain.com → <server-ip>

# 2. Wait for DNS propagation (up to 48 hours)
# Check: dig newdomain.com

# 3. Clear DNS cache locally
# Windows: ipconfig /flushdns
# Linux: sudo systemd-resolve --flush-caches
```

### **Issue 4: Migration Stuck**

**Check logs:**
```bash
tail -f backend/logs/app.log

# Look for errors in migration process
```

**Check server:**
```bash
# SSH to server
ssh -i /path/to/key.pem ubuntu@<server-ip>

# Check Nginx status
sudo systemctl status nginx

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

---

## ❓ **FAQ**

### **Q: Which migration method should I use?**

**A:** Use **automatic migration** (default). It's faster, safer, and handles everything automatically.

### **Q: Can I rollback if something goes wrong?**

**A:** Yes! Automatic migration creates backups and rolls back on failure. Manual migration requires you to restore backup manually.

### **Q: How long does migration take?**

**A:**
- Database update: ~30 seconds
- Server config update: ~1 minute
- SSL certificate: ~2-3 minutes
- **Total: ~5 minutes per server**

### **Q: Will deployments be down during migration?**

**A:** No! Old domain continues to work until new domain is ready. Zero downtime.

### **Q: What if I have multiple servers?**

**A:** System migrates each server sequentially. All servers updated automatically.

### **Q: Can I test before migrating?**

**A:** Yes! Use manual migration first to test, then use automatic for production.

### **Q: What happens to custom domains (paid users)?**

**A:** Custom domains are **skipped**. They're not affected by platform domain changes.

### **Q: Do I need to update DNS?**

**A:** Yes! You must update DNS A records to point new domain to server IP. This is always manual.

### **Q: Can I migrate just one server?**

**A:** Yes! Only specify the servers you want to migrate:

```json
{
  "serverDomains": {
    "EC3": "newdomain.com"
    // EC2, EC4 not changed
  }
}
```

---

## ✅ **SUMMARY**

### **Automatic Migration (Recommended):**
```
✅ Updates database
✅ Updates Nginx config
✅ Updates SSL certificate
✅ Sends user notifications
✅ Automatic rollback on failure
✅ Zero downtime
✅ 5 minutes per server
```

### **Manual Migration:**
```
✅ Updates database
✅ Sends user notifications
⚠️ Requires manual server update
⚠️ Requires manual SSL update
⚠️ More time-consuming
⚠️ Higher risk of errors
```

**Use automatic migration for production!** 🚀

---

## 📞 **NEED HELP?**

- **Automatic Migration:** Just call the API with `updateServerConfig: true`
- **Manual Migration:** Follow the step-by-step guide above
- **Issues:** Check troubleshooting section
- **Support:** Contact platform administrator
