# 🔒 SSL/HTTPS FIX GUIDE

## 📋 **USAGE:**

This script works on **any server** (EC2, EC3, EC4, EC5).

### **On EC3 (foodpanda.site):**

```bash
# Copy script
scp -i D:/work/ec3/uz.key fix-ssl-https.sh ubuntu@129.154.255.90:~/

# Run it
ssh -i D:/work/ec3/uz.key ubuntu@129.154.255.90
chmod +x fix-ssl-https.sh
sudo ./fix-ssl-https.sh

# When prompted:
Enter domain name: foodpanda.site
Enter SSL email: admin@foodpanda.site
Continue? y
```

---

### **On EC2 (ec2.foodpanda.site):**

```bash
# Copy script
scp -i D:/work/ec2/key.pem fix-ssl-https.sh ubuntu@<EC2_IP>:~/

# Run it
ssh -i D:/work/ec2/key.pem ubuntu@<EC2_IP>
chmod +x fix-ssl-https.sh
sudo ./fix-ssl-https.sh

# When prompted:
Enter domain name: ec2.foodpanda.site
Enter SSL email: admin@foodpanda.site
Continue? y
```

---

### **On EC4 (ec4.foodpanda.site):**

```bash
# Copy script
scp -i D:/work/ec4/key.pem fix-ssl-https.sh ubuntu@<EC4_IP>:~/

# Run it
ssh -i D:/work/ec4/key.pem ubuntu@<EC4_IP>
chmod +x fix-ssl-https.sh
sudo ./fix-ssl-https.sh

# When prompted:
Enter domain name: ec4.foodpanda.site
Enter SSL email: admin@foodpanda.site
Continue? y
```

---

## ✅ **WHAT IT DOES:**

1. ✅ Asks for domain name
2. ✅ Asks for SSL email
3. ✅ Checks current SSL status
4. ✅ Checks Nginx configuration
5. ✅ Runs Certbot (obtains/reinstalls certificate)
6. ✅ Configures Nginx for HTTPS
7. ✅ Adds HTTP → HTTPS redirect
8. ✅ Tests and reloads Nginx
9. ✅ Verifies ports
10. ✅ Shows certificate info

---

## 🎯 **AFTER RUNNING:**

### **1. Check Oracle Cloud Security List:**

```
Oracle Cloud Console
  ↓
Networking → Virtual Cloud Networks
  ↓
Select your VCN
  ↓
Security Lists → Default Security List
  ↓
Add Ingress Rule:
  - Source: 0.0.0.0/0
  - Protocol: TCP
  - Destination Port: 443
  ↓
Save
```

### **2. Test HTTPS:**

```bash
# From your local machine
curl -I https://foodpanda.site/
curl -I https://ec2.foodpanda.site/
curl -I https://ec4.foodpanda.site/

# Should return: HTTP/2 200
```

### **3. Test Deployment URL:**

```bash
# HTTP (should redirect to HTTPS)
curl -I http://foodpanda.site/ss-693be90e-79435108/

# HTTPS (should work)
curl -I https://foodpanda.site/ss-693be90e-79435108/
```

---

## 🔧 **TROUBLESHOOTING:**

### **If HTTPS still not working:**

**1. Check if Nginx is listening on 443:**
```bash
sudo netstat -tlnp | grep :443
```

**2. Check firewall:**
```bash
sudo ufw status
sudo ufw allow 443/tcp
```

**3. Check Nginx logs:**
```bash
sudo tail -f /var/log/nginx/error.log
```

**4. Check SSL certificate:**
```bash
sudo certbot certificates
```

**5. Test Nginx config:**
```bash
sudo nginx -t
```

---

## 📊 **DOMAIN MAPPING:**

```
Server  Domain                  IP
EC2     ec2.foodpanda.site     <EC2_IP>
EC3     foodpanda.site         129.154.255.90
EC4     ec4.foodpanda.site     <EC4_IP>
EC5     ec5.foodpanda.site     <EC5_IP>
```

**Make sure:**
1. ✅ Domain points to correct IP (DNS A record)
2. ✅ Port 443 open in Security List
3. ✅ Nginx configured with domain
4. ✅ SSL certificate obtained

---

## ✅ **SUMMARY:**

**The script is now universal!**

**Works on any server:**
- ✅ EC2 (ec2.foodpanda.site)
- ✅ EC3 (foodpanda.site)
- ✅ EC4 (ec4.foodpanda.site)
- ✅ EC5 (ec5.foodpanda.site)

**Just run it and enter the domain when prompted!** 🚀
