# 🔍 NGINX CONFIG NOT FOUND - MANUAL FIX

## ✅ **GOOD NEWS:**
- Container is running ✅
- Container is responding (HTTP 200) ✅
- Just need to add Nginx routing!

---

## 🔍 **FIND NGINX CONFIG:**

Run these commands on EC3 to find where Nginx config is:

```bash
# Check what's in /etc/nginx/
ls -la /etc/nginx/

# Find the main config
ls -la /etc/nginx/sites-available/
ls -la /etc/nginx/sites-enabled/
ls -la /etc/nginx/conf.d/

# Check the main nginx.conf
cat /etc/nginx/nginx.conf | grep -i "include"
```

---

## 🛠️ **OPTION 1: Use Auto-Fix Script**

```bash
# Copy new script
# (On your local machine)
scp -i D:/work/ec3/uz.key find-and-fix-nginx.sh ubuntu@129.154.255.90:~/

# On EC3
chmod +x find-and-fix-nginx.sh
./find-and-fix-nginx.sh
```

---

## 🛠️ **OPTION 2: Manual Fix (Recommended)**

### **Step 1: Find the config file**
```bash
# Most likely it's one of these:
ls -la /etc/nginx/sites-available/default
ls -la /etc/nginx/sites-enabled/default
ls -la /etc/nginx/nginx.conf
```

### **Step 2: Edit the config**

If you found `/etc/nginx/sites-available/default`:
```bash
sudo nano /etc/nginx/sites-available/default
```

Or if using `/etc/nginx/nginx.conf`:
```bash
sudo nano /etc/nginx/nginx.conf
```

### **Step 3: Add this location block**

Find the `server {` block (or create one if it doesn't exist).

Add this INSIDE the server block, BEFORE the closing `}`:

```nginx
    # Deployment: uzairarif11t-693904aa-44714701
    location /uzairarif11t-693904aa-44714701/ {
        proxy_pass http://localhost:4259/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
```

### **Step 4: Save and test**
```bash
# Save (Ctrl+X, Y, Enter)

# Test config
sudo nginx -t

# If OK, reload
sudo systemctl reload nginx
```

### **Step 5: Test the URL**
```bash
# Test internal
curl -I http://localhost/uzairarif11t-693904aa-44714701/

# Test external
curl -I https://foodpanda.site/uzairarif11t-693904aa-44714701/

# Should return HTTP 200!
```

---

## 📋 **COMPLETE EXAMPLE:**

If your config file is `/etc/nginx/sites-available/default`, it should look like this:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name foodpanda.site www.foodpanda.site;

    # Deployment: uzairarif11t-693904aa-44714701
    location /uzairarif11t-693904aa-44714701/ {
        proxy_pass http://localhost:4259/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Other existing locations...
}
```

---

## 🚨 **QUICK COMMANDS:**

```bash
# 1. Find config
ls -la /etc/nginx/sites-available/

# 2. Edit it (replace 'default' with actual filename)
sudo nano /etc/nginx/sites-available/default

# 3. Add the location block above

# 4. Test
sudo nginx -t

# 5. Reload
sudo systemctl reload nginx

# 6. Test URL
curl -I https://foodpanda.site/uzairarif11t-693904aa-44714701/
```

---

## ✅ **EXPECTED RESULT:**

```
HTTP/1.1 200 OK
```

And your app should be live at:
```
https://foodpanda.site/uzairarif11t-693904aa-44714701/
```

---

**Run the commands above to find and fix the Nginx config!** 🚀
