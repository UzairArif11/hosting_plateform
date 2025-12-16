# 🔒 SSL/HTTPS SETUP GUIDE

## 🎯 **OBJECTIVE:**
Setup SSL/HTTPS for `foodpanda.site` using Let's Encrypt (Certbot)

---

## 📋 **PREREQUISITES:**

1. ✅ Domain `foodpanda.site` pointing to EC3 IP
2. ✅ Nginx installed on EC3
3. ✅ Port 80 and 443 open on EC3
4. ✅ SSH access to EC3

---

## 🚀 **STEP-BY-STEP SETUP:**

### **Step 1: Connect to EC3**

```bash
# From your local machine
ssh -i /path/to/ec3-key.pem ubuntu@<EC3_IP>
```

---

### **Step 2: Install Certbot**

```bash
# Update package list
sudo apt update

# Install Certbot and Nginx plugin
sudo apt install certbot python3-certbot-nginx -y

# Verify installation
certbot --version
```

**Expected Output:**
```
certbot 1.21.0
```

---

### **Step 3: Verify Nginx Configuration**

```bash
# Check Nginx config
sudo nginx -t

# If errors, fix them first
# Then reload
sudo systemctl reload nginx
```

---

### **Step 4: Get SSL Certificate**

```bash
# Get certificate for foodpanda.site
sudo certbot --nginx -d foodpanda.site -d www.foodpanda.site

# Follow the prompts:
# 1. Enter email: your-email@example.com
# 2. Agree to terms: Y
# 3. Share email: N (optional)
# 4. Redirect HTTP to HTTPS: 2 (Yes, recommended)
```

**Expected Output:**
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/foodpanda.site/fullchain.pem
Key is saved at: /etc/letsencrypt/live/foodpanda.site/privkey.pem
```

---

### **Step 5: Verify SSL Certificate**

```bash
# Check certificate
sudo certbot certificates

# Test renewal
sudo certbot renew --dry-run
```

**Expected Output:**
```
Certificate Name: foodpanda.site
  Domains: foodpanda.site www.foodpanda.site
  Expiry Date: 2025-03-04 (VALID: 89 days)
  Certificate Path: /etc/letsencrypt/live/foodpanda.site/fullchain.pem
  Private Key Path: /etc/letsencrypt/live/foodpanda.site/privkey.pem
```

---

### **Step 6: Update Nginx Configuration**

Certbot should have automatically updated your Nginx config, but let's verify:

```bash
# Check main Nginx config
sudo cat /etc/nginx/sites-available/default
```

**Should look like:**
```nginx
server {
    listen 80;
    server_name foodpanda.site www.foodpanda.site;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name foodpanda.site www.foodpanda.site;

    # SSL Configuration (added by Certbot)
    ssl_certificate /etc/letsencrypt/live/foodpanda.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/foodpanda.site/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Root location
    location / {
        root /var/www/html;
        index index.html;
    }

    # Deployment locations (added by your app)
    # These are added dynamically by nginxRouter.js
}
```

---

### **Step 7: Reload Nginx**

```bash
# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Check status
sudo systemctl status nginx
```

---

### **Step 8: Test HTTPS**

```bash
# Test from EC3
curl -I https://foodpanda.site

# Should return:
# HTTP/2 200
# server: nginx
```

**From browser:**
- Visit: `https://foodpanda.site`
- Should see 🔒 (secure padlock)

---

## 🔄 **AUTO-RENEWAL:**

Certbot automatically sets up auto-renewal. Verify:

```bash
# Check renewal timer
sudo systemctl status certbot.timer

# Manual renewal test
sudo certbot renew --dry-run
```

**Certificates auto-renew every 60 days.**

---

## 🔧 **UPDATE BACKEND CODE:**

### **Update nginxRouter.js to use HTTPS:**

```javascript
// backend/services/nginxRouter.js

// Change URL generation from HTTP to HTTPS
const fullUrl = `https://${domain}/${urlPath}/`;  // Changed from http to https
```

### **Update .env:**

```bash
# Add to .env
BASE_DOMAIN=foodpanda.site
PROTOCOL=https
```

---

## 🎨 **NGINX TEMPLATE FOR DEPLOYMENTS:**

When adding new deployments, use this template:

```nginx
# Location block for deployment
location /${urlPath}/ {
    proxy_pass http://localhost:${port}/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # SSL headers
    proxy_set_header X-Forwarded-Ssl on;
    proxy_set_header X-Forwarded-Port 443;
}
```

---

## 🔒 **SECURITY BEST PRACTICES:**

### **1. Strong SSL Configuration:**

```nginx
# /etc/nginx/nginx.conf or in server block

# SSL Protocols
ssl_protocols TLSv1.2 TLSv1.3;

# SSL Ciphers
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers on;

# SSL Session
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# HSTS (optional but recommended)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

### **2. Firewall Rules:**

```bash
# Allow HTTPS
sudo ufw allow 443/tcp

# Allow HTTP (for redirect)
sudo ufw allow 80/tcp

# Check status
sudo ufw status
```

---

## 🧪 **TESTING:**

### **Test 1: HTTP to HTTPS Redirect**
```bash
curl -I http://foodpanda.site

# Should return:
# HTTP/1.1 301 Moved Permanently
# Location: https://foodpanda.site/
```

### **Test 2: HTTPS Works**
```bash
curl -I https://foodpanda.site

# Should return:
# HTTP/2 200
```

### **Test 3: SSL Certificate Valid**
```bash
openssl s_client -connect foodpanda.site:443 -servername foodpanda.site

# Should show:
# Verify return code: 0 (ok)
```

### **Test 4: Deployment URL**
```bash
# After deploying a project
curl -I https://foodpanda.site/myproject-abc123-1234567890/

# Should return:
# HTTP/2 200
```

---

## 📊 **MONITORING:**

### **Check Certificate Expiry:**
```bash
# Check when certificate expires
sudo certbot certificates

# Set up monitoring (optional)
echo "0 0 * * * root certbot renew --quiet" | sudo tee -a /etc/crontab
```

### **Nginx Logs:**
```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log

# SSL logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

---

## ⚠️ **TROUBLESHOOTING:**

### **Issue 1: Certificate Not Working**
```bash
# Check Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Check certificate
sudo certbot certificates
```

### **Issue 2: Port 80/443 Not Open**
```bash
# Check firewall
sudo ufw status

# Open ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### **Issue 3: Domain Not Resolving**
```bash
# Check DNS
nslookup foodpanda.site

# Should return EC3 IP
```

### **Issue 4: Renewal Fails**
```bash
# Check renewal
sudo certbot renew --dry-run

# Check logs
sudo cat /var/log/letsencrypt/letsencrypt.log
```

---

## 🎯 **FINAL CHECKLIST:**

- [ ] Certbot installed
- [ ] SSL certificate obtained
- [ ] Nginx configured for HTTPS
- [ ] HTTP redirects to HTTPS
- [ ] Auto-renewal working
- [ ] Backend updated to use HTTPS
- [ ] Firewall allows 80/443
- [ ] Domain resolves to EC3
- [ ] HTTPS works in browser
- [ ] Deployment URLs use HTTPS

---

## 🚀 **QUICK SETUP SCRIPT:**

Save this as `setup-ssl.sh` on EC3:

```bash
#!/bin/bash

echo "🔒 Setting up SSL for foodpanda.site..."

# Update system
sudo apt update

# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot --nginx -d foodpanda.site -d www.foodpanda.site --non-interactive --agree-tos --email your-email@example.com --redirect

# Test renewal
sudo certbot renew --dry-run

# Reload Nginx
sudo systemctl reload nginx

echo "✅ SSL setup complete!"
echo "Test: https://foodpanda.site"
```

**Run:**
```bash
chmod +x setup-ssl.sh
./setup-ssl.sh
```

---

## 📝 **AFTER SSL SETUP:**

### **Update Backend:**

1. Update `nginxRouter.js`:
```javascript
const fullUrl = `https://${domain}/${urlPath}/`;
```

2. Update `.env`:
```
PROTOCOL=https
BASE_DOMAIN=foodpanda.site
```

3. Restart backend:
```bash
pm2 restart backend
```

---

**SSL setup takes ~5-10 minutes!** ⏱️

**After this, your platform will be 100% production-ready!** 🎉
