# 🔥 Fix Oracle Cloud Firewall via SSH

## ✅ **Your App is Working!**

```bash
curl http://localhost:4372
# Returns HTML ✅
```

The app is running perfectly! It's just blocked by Oracle Cloud's firewall.

---

## 🔧 **Fix Using Oracle Cloud CLI (on EC3)**

Since you're already SSH'd into EC3, run these commands:

### **Step 1: Install Oracle Cloud CLI (if not installed)**

```bash
# Check if OCI CLI is installed
oci --version

# If not installed:
bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)"
```

### **Step 2: Get Your Security List OCID**

```bash
# Get instance metadata
curl -s http://169.254.169.254/opc/v1/instance/ | grep -i vcn

# Or check your VCN in Oracle Cloud Console
```

### **Step 3: Add Ingress Rule**

```bash
# Replace <security-list-ocid> with your actual OCID
oci network security-list update \
  --security-list-id <security-list-ocid> \
  --ingress-security-rules '[{
    "source": "0.0.0.0/0",
    "protocol": "6",
    "tcpOptions": {
      "destinationPortRange": {
        "min": 4000,
        "max": 5000
      }
    }
  }]'
```

---

## 🚀 **EASIER: Use Oracle Cloud Console**

This is the recommended way:

### **1. Go to Oracle Cloud Console**
https://cloud.oracle.com/

### **2. Navigate to Security List**
```
Menu → Networking → Virtual Cloud Networks
→ Click your VCN
→ Security Lists → Default Security List
```

### **3. Add Ingress Rule**
```
Click "Add Ingress Rules"

Source Type: CIDR
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 4000-5000
Description: Deployment ports

Click "Add Ingress Rules"
```

### **4. Test Immediately**
```bash
curl http://129.154.255.90:4372
```

---

## 📋 **Current Ports You Need Open:**

```
22      - SSH (already open ✅)
80      - HTTP (for domain)
443     - HTTPS (for SSL)
2376    - Docker (already open ✅)
4000-5000 - App ports (BLOCKED ❌)
```

---

## ⚡ **Quick Alternative: Use Nginx Reverse Proxy**

If you can't open ports 4000-5000, use port 80 instead:

### **On EC3, install Nginx:**

```bash
sudo apt update
sudo apt install -y nginx

# Configure reverse proxy
sudo tee /etc/nginx/sites-available/default > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://localhost:4372;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# Restart Nginx
sudo systemctl restart nginx
```

### **Then access via:**
```
http://129.154.255.90
```

Port 80 is probably already open!

---

## 🎯 **Recommended Solution:**

**Use Nginx on port 80** (easiest and works immediately):

```bash
# On EC3
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/default
```

Add:
```nginx
server {
    listen 80;
    location / {
        proxy_pass http://localhost:4372;
    }
}
```

```bash
sudo systemctl restart nginx
```

**Then access:** `http://129.154.255.90` ✅

---

**Try the Nginx solution - it will work immediately!** 🚀
