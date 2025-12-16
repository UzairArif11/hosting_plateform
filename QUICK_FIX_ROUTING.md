# 🔧 QUICK FIX GUIDE

## ⚠️ **CURRENT ISSUE:**

The setup script failed because Oracle Cloud doesn't have `ufw` (firewall), and it stopped before configuring Nginx.

Your container is running (✅ `curl localhost:3975` works) but Nginx isn't routing to it.

---

## 🚀 **QUICK FIX (Run on EC3):**

### **Option 1: Auto-Fix Script (Recommended)**

```bash
# Copy the auto-fix script
# (On local machine)
scp -i D:/work/ec3/uz.key auto-fix-routing.sh ubuntu@129.154.255.90:~/

# Run it on EC3
ssh -i D:/work/ec3/uz.key ubuntu@129.154.255.90
chmod +x auto-fix-routing.sh
sudo ./auto-fix-routing.sh eccom-69397f04-76074692 3975
```

This will:
1. ✅ Check if container is running
2. ✅ Check Nginx configuration
3. ✅ Detect the issue
4. ✅ Fix it automatically
5. ✅ Verify the fix

---

### **Option 2: Run Fixed Setup Script**

```bash
# Copy the Oracle Cloud setup script
scp -i D:/work/ec3/uz.key setup-oracle-cloud.sh ubuntu@129.154.255.90:~/

# Run it
ssh -i D:/work/ec3/uz.key ubuntu@129.154.255.90
chmod +x setup-oracle-cloud.sh
sudo ./setup-oracle-cloud.sh
```

Then run the auto-fix script to add the current deployment.

---

### **Option 3: Manual Fix (Fastest)**

```bash
# On EC3
ssh -i D:/work/ec3/uz.key ubuntu@129.154.255.90

# Add server block for foodpanda.site
sudo tee -a /etc/nginx/sites-available/default > /dev/null << 'EOF'

server {
    listen 80;
    server_name foodpanda.site www.foodpanda.site;
    
    location /eccom-69397f04-76074692/ {
        proxy_pass http://localhost:3975/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Test and reload
sudo nginx -t
sudo systemctl reload nginx

# Test
curl http://foodpanda.site/eccom-69397f04-76074692/
```

---

## 📊 **WHAT WENT WRONG:**

1. ✅ Cleanup script worked perfectly
2. ❌ Setup script failed at Step 4 (ufw not installed on Oracle Cloud)
3. ❌ Nginx was never configured for foodpanda.site
4. ✅ Deployment succeeded, container created
5. ❌ But Nginx doesn't have routing for foodpanda.site

---

## ✅ **AFTER FIX:**

Both will work:
- ✅ `http://foodpanda.site/eccom-69397f04-76074692/`
- ✅ Future deployments will work automatically (with new nginxRouter.js)

---

## 🎯 **RECOMMENDED STEPS:**

```bash
# 1. Run auto-fix for current deployment
scp -i D:/work/ec3/uz.key auto-fix-routing.sh ubuntu@129.154.255.90:~/
ssh -i D:/work/ec3/uz.key ubuntu@129.154.255.90
chmod +x auto-fix-routing.sh
sudo ./auto-fix-routing.sh eccom-69397f04-76074692 3975

# 2. Run Oracle Cloud setup for future deployments
scp -i D:/work/ec3/uz.key setup-oracle-cloud.sh ubuntu@129.154.255.90:~/
chmod +x setup-oracle-cloud.sh
sudo ./setup-oracle-cloud.sh

# 3. Deploy again from user panel - should work!
```

---

**The auto-fix script will diagnose and fix the issue automatically!** 🚀
