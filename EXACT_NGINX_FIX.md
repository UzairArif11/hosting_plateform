# 🎯 EXACT FIX FOR EC3 NGINX ROUTING

## ⚠️ **UPDATED UNDERSTANDING:**

Both HTTP and HTTPS are returning 404 externally, which means:
- The location block was added to the WRONG server block
- OR it was added to a server block that doesn't handle `foodpanda.site`

---

## 🔍 **RUN DIAGNOSTIC FIRST:**

```bash
# On EC3, run this to see the full config structure:
chmod +x diagnose-nginx.sh
./diagnose-nginx.sh
```

This will show you:
1. How many server blocks exist
2. Which one handles `foodpanda.site`
3. Where the deployment location was added
4. Why it's not working

---

## 🛠️ **MANUAL FIX (Most Reliable):**

### **Step 1: View the config**
```bash
sudo cat /etc/nginx/sites-available/default
```

### **Step 2: Find the RIGHT server block**

Look for the server block that has:
```nginx
server {
    listen 80;
    server_name foodpanda.site www.foodpanda.site;
    ...
}
```

**This is the block you need to edit!**

### **Step 3: Add location block to the CORRECT server**

```bash
sudo nano /etc/nginx/sites-available/default
```

Find the server block with `server_name foodpanda.site` and add this INSIDE it:

```nginx
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

### **Step 4: Also add to HTTPS block (if exists)**

If there's a separate HTTPS block:
```nginx
server {
    listen 443 ssl;
    server_name foodpanda.site www.foodpanda.site;
    ...
}
```

Add the SAME location block there too!

### **Step 5: Test and reload**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### **Step 6: Verify**
```bash
curl -I http://foodpanda.site/uzairarif11t-693904aa-44714701/
curl -I https://foodpanda.site/uzairarif11t-693904aa-44714701/
```

Both should return **HTTP 200**!

---

## 📋 **EXAMPLE CORRECT CONFIG:**

```nginx
# HTTP Server Block
server {
    listen 80;
    listen [::]:80;
    server_name foodpanda.site www.foodpanda.site;

    # Your deployment
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

    # Other locations...
}

# HTTPS Server Block (if separate)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name foodpanda.site www.foodpanda.site;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # SAME location block here!
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

    # Other locations...
}
```

---

## 🚨 **COMMON MISTAKES:**

### **Mistake 1: Added to default server block**
```nginx
server {
    listen 80 default_server;  # ← This is NOT the right one!
    ...
}
```

### **Mistake 2: Added to localhost-only block**
```nginx
server {
    listen 80;
    server_name localhost;  # ← This only works for localhost!
    ...
}
```

### **Mistake 3: Added outside server block**
```nginx
# This is WRONG - location must be INSIDE server block!
location /uzairarif11t-693904aa-44714701/ {
    ...
}

server {
    ...
}
```

---

## ✅ **VERIFICATION:**

After fixing, ALL of these should return 200:

```bash
# 1. Container
curl -I http://localhost:4259
# Expected: HTTP/1.1 200 OK

# 2. Localhost
curl -I http://localhost/uzairarif11t-693904aa-44714701/
# Expected: HTTP/1.1 200 OK

# 3. Domain HTTP
curl -I http://foodpanda.site/uzairarif11t-693904aa-44714701/
# Expected: HTTP/1.1 200 OK or 301 (redirect to HTTPS)

# 4. Domain HTTPS
curl -I https://foodpanda.site/uzairarif11t-693904aa-44714701/
# Expected: HTTP/1.1 200 OK
```

---

## 🎯 **ACTION PLAN:**

1. **Run diagnostic:** `./diagnose-nginx.sh`
2. **Review output:** See which server block handles foodpanda.site
3. **Edit config:** Add location to the CORRECT server block(s)
4. **Test:** `sudo nginx -t`
5. **Reload:** `sudo systemctl reload nginx`
6. **Verify:** Test all URLs

---

**The key is finding the server block with `server_name foodpanda.site` and adding the location there!**
