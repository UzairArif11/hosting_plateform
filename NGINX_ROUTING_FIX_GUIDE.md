# 🔧 NGINX ROUTING - MANUAL TEST & FIX GUIDE

## 🎯 **YOUR DEPLOYMENT:**
```
URL: https://foodpanda.site/uzairarif11t-693904aa-44714701/
Container Port: 4259
Server: EC3 (129.154.255.90)
Status: 404 Not Found
```

---

## 🧪 **QUICK TEST (Run on EC3):**

### **Step 1: SSH to EC3**
```bash
ssh -i D:/work/ec3/uz.key ubuntu@129.154.255.90
```

### **Step 2: Check Container**
```bash
# List running containers
docker ps | grep trello

# Expected output:
# CONTAINER ID   IMAGE                                    STATUS    PORTS
# abc123...      uzairarif11-trello-clone-693904aa...    Up        0.0.0.0:4259->80/tcp
```

### **Step 3: Test Container Directly**
```bash
# Test if container is responding
curl -I http://localhost:4259

# Expected: HTTP/1.1 200 OK
# If 404: Container has an issue
```

### **Step 4: Check Nginx Config**
```bash
# Check if deployment is in Nginx config
sudo grep -r "uzairarif11t-693904aa-44714701" /etc/nginx/

# If nothing found: THIS IS THE PROBLEM!
```

### **Step 5: Check Nginx Logs**
```bash
# Check for errors
sudo tail -50 /var/log/nginx/error.log

# Check access log
sudo tail -50 /var/log/nginx/access.log | grep "uzairarif11t"
```

---

## 🔧 **AUTOMATED FIX:**

### **Option 1: Run Test Script**
```bash
# Copy script to EC3
scp -i D:/work/ec3/uz.key test-nginx-routing.sh ubuntu@129.154.255.90:~/

# SSH and run
ssh -i D:/work/ec3/uz.key ubuntu@129.154.255.90
chmod +x test-nginx-routing.sh
./test-nginx-routing.sh
```

The script will:
- ✅ Check if container is running
- ✅ Test container directly
- ✅ Check Nginx configuration
- ✅ Offer to fix Nginx config automatically
- ✅ Test routing after fix

---

## 🛠️ **MANUAL FIX:**

### **If Nginx Config is Missing:**

```bash
# 1. Edit Nginx config
sudo nano /etc/nginx/sites-available/deployments.conf

# 2. Add this location block (inside the server block):
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
        
        # Handle trailing slashes
        rewrite ^/uzairarif11t-693904aa-44714701/(.*)$ /$1 break;
    }

# 3. Test Nginx config
sudo nginx -t

# 4. If OK, reload Nginx
sudo systemctl reload nginx

# 5. Test the URL
curl -I https://foodpanda.site/uzairarif11t-693904aa-44714701/
```

---

## 🔍 **COMMON ISSUES & FIXES:**

### **Issue 1: Container Not Running**
```bash
# Check container status
docker ps -a | grep trello

# If stopped, start it
docker start <container_name>
```

### **Issue 2: Wrong Port in Nginx**
```bash
# Check what port container is using
docker port <container_name>

# Update Nginx config to match
sudo nano /etc/nginx/sites-available/deployments.conf
# Change proxy_pass to correct port
sudo systemctl reload nginx
```

### **Issue 3: Nginx Not Reloaded**
```bash
# Reload Nginx
sudo systemctl reload nginx

# Or restart if reload doesn't work
sudo systemctl restart nginx
```

### **Issue 4: Firewall Blocking**
```bash
# Check firewall
sudo ufw status

# Allow HTTPS
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp
```

### **Issue 5: SSL Certificate Issue**
```bash
# Check SSL certificate
sudo certbot certificates

# Renew if needed
sudo certbot renew
```

---

## 📊 **EXPECTED RESULTS:**

### **After Fix:**
```bash
# Test internal
curl -I http://localhost/uzairarif11t-693904aa-44714701/
# Expected: HTTP/1.1 200 OK

# Test external
curl -I https://foodpanda.site/uzairarif11t-693904aa-44714701/
# Expected: HTTP/1.1 200 OK
```

### **In Browser:**
```
https://foodpanda.site/uzairarif11t-693904aa-44714701/
# Should show your Trello Clone app
```

---

## 🚨 **IF STILL 404:**

### **Check 1: Container Logs**
```bash
docker logs <container_name> --tail 50
```

### **Check 2: Nginx Error Logs**
```bash
sudo tail -100 /var/log/nginx/error.log
```

### **Check 3: Container Health**
```bash
docker inspect <container_name> | grep -A 10 "Health"
```

### **Check 4: Port Conflict**
```bash
# Check if port 4259 is in use by another process
sudo netstat -tulpn | grep 4259
```

---

## 🎯 **MOST LIKELY ISSUE:**

Based on your logs, the deployment succeeded but Nginx doesn't have the routing configuration.

**The nginxRouter service probably failed to update the Nginx config.**

**Quick Fix:**
1. SSH to EC3
2. Manually add the location block to Nginx config
3. Reload Nginx
4. Test the URL

---

## 📝 **COMMANDS TO RUN:**

```bash
# All in one:
ssh -i D:/work/ec3/uz.key ubuntu@129.154.255.90 << 'EOF'
  # Check container
  docker ps | grep trello
  
  # Test container
  curl -I http://localhost:4259
  
  # Check Nginx config
  sudo grep "uzairarif11t-693904aa-44714701" /etc/nginx/sites-available/deployments.conf
  
  # If not found, add it manually
  # (See manual fix section above)
EOF
```

---

**Run the test script or follow the manual steps above to fix the 404 issue!**
