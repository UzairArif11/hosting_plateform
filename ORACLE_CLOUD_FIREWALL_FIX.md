# 🔥 FIREWALL FIX - Oracle Cloud Security List

## ⚠️ **The Problem:**

Your app is running in Docker on EC3, but Oracle Cloud's firewall is blocking external access.

**What's happening:**
- ✅ Container is running
- ✅ App responds on localhost
- ❌ Port 4372 blocked by Oracle Cloud firewall

---

## 🔧 **Solution: Open Ports in Oracle Cloud**

### **Step 1: Log into Oracle Cloud Console**

Go to: https://cloud.oracle.com/

### **Step 2: Navigate to Your VCN**

1. Click **☰ Menu** (top left)
2. Click **Networking** → **Virtual Cloud Networks**
3. Click on your VCN (the one EC3 is in)

### **Step 3: Find Security List**

1. Click **Security Lists** (left sidebar)
2. Click on **Default Security List** (or the one your instance uses)

### **Step 4: Add Ingress Rule**

1. Click **Add Ingress Rules**
2. Fill in:
   ```
   Source Type: CIDR
   Source CIDR: 0.0.0.0/0
   IP Protocol: TCP
   Source Port Range: All
   Destination Port Range: 4000-5000
   Description: Deployment platform ports
   ```
3. Click **Add Ingress Rules**

### **Step 5: Also Add These Ports**

Add separate rules for:
- Port 80 (HTTP)
- Port 443 (HTTPS)
- Port 3000-5000 (App ports)

---

## 🚀 **Alternative: Use iptables (Quick Fix)**

If you have SSH access, run this on EC3:

```bash
ssh -i D:/work/ec3/uz.key ubuntu@129.154.255.90

# Open port range
sudo iptables -I INPUT -p tcp --dport 4000:5000 -j ACCEPT

# Save rules
sudo netfilter-persistent save

# Or if that doesn't work:
sudo iptables-save > /etc/iptables/rules.v4
```

---

## 🧪 **Test After Opening Ports**

```bash
# From your local machine
curl http://129.154.255.90:4372

# Should return HTML
```

Or open in browser:
```
http://129.154.255.90:4372
```

---

## 📋 **Ports You Need Open:**

```
22    - SSH (already open)
80    - HTTP (for domain)
443   - HTTPS (for SSL)
2376  - Docker API (already open)
3000-5000 - App deployment ports
```

---

## 💡 **Why This Happens:**

Oracle Cloud has **two layers** of firewall:

1. **OS Firewall (ufw/iptables)** - Usually disabled ✅
2. **Security List** - Oracle Cloud's firewall ❌ **THIS IS THE ISSUE**

You need to configure the Security List in Oracle Cloud Console.

---

## ✅ **After Opening Ports:**

Your app will be accessible at:
```
http://129.154.255.90:4372
```

And future deployments will work on ports 4000-5000!

---

**Go to Oracle Cloud Console now and add the ingress rule!** 🚀
