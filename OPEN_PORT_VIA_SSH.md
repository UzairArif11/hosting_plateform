# ✅ Open Port 2376 via SSH (No Console Needed!)

**Question:** Can we add firewall rules via SSH instead of Oracle Console?

**Answer:** ✅ **YES! Use iptables!**

---

## 🚀 Quick Method (Via SSH)

### For EC2 (140.238.229.147):

```bash
# SSH into EC2
ssh ubuntu@140.238.229.147

# Open port 2376
sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT

# Save rules (try one of these)
sudo netfilter-persistent save
# OR if that doesn't work:
sudo iptables-save | sudo tee /etc/iptables/rules.v4

# Verify
sudo iptables -L -n | grep 2376
```

---

### For EC3 (129.154.255.90):

```bash
# SSH into EC3
ssh ubuntu@129.154.255.90

# Open port 2376
sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT

# Save rules
sudo netfilter-persistent save
# OR
sudo iptables-save | sudo tee /etc/iptables/rules.v4

# Verify
sudo iptables -L -n | grep 2376
```

---

## 🎯 Complete Setup Script

### Run this on BOTH EC2 and EC3:

```bash
#!/bin/bash
echo "Opening port 2376 for Docker..."

# Open port 2376
sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT

# Try to save with netfilter-persistent
if sudo netfilter-persistent save 2>/dev/null; then
    echo "✅ Rules saved with netfilter-persistent"
else
    # Fallback: save manually
    sudo mkdir -p /etc/iptables
    sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null
    echo "✅ Rules saved manually"
fi

# Verify
if sudo iptables -L -n | grep -q 2376; then
    echo "✅ Port 2376 is open!"
else
    echo "❌ Failed to open port 2376"
fi

# Test Docker API
echo ""
echo "Testing Docker API..."
if curl -s http://localhost:2376/version > /dev/null; then
    echo "✅ Docker API is accessible!"
else
    echo "⚠️ Docker API not responding (may need to configure Docker)"
fi
```

**Save as `open-port-2376.sh` and run:**
```bash
chmod +x open-port-2376.sh
sudo bash open-port-2376.sh
```

---

## 🔍 Two Firewalls Explained

### Oracle Cloud has TWO firewalls:

#### 1. Oracle Cloud Firewall (Console):
- **Location:** Oracle Cloud infrastructure
- **Managed via:** Oracle Cloud Console
- **Default:** Blocks everything except SSH (port 22)

#### 2. iptables (On VM):
- **Location:** Inside the VM
- **Managed via:** SSH commands
- **Default:** Usually allows everything

---

## ⚠️ Important: You Need BOTH!

### Option 1: Open Both Firewalls (Recommended)

**Oracle Console:**
- Add ingress rule for port 2376

**iptables (via SSH):**
```bash
sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT
sudo netfilter-persistent save
```

### Option 2: Only iptables (May Work)

**If Oracle Cloud firewall is permissive:**
```bash
# Just open iptables
sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT
sudo netfilter-persistent save
```

**Test from Windows:**
```powershell
Test-NetConnection -ComputerName 129.154.255.90 -Port 2376
```

**If it works:** ✅ Oracle firewall is open!  
**If it fails:** ⚠️ Need to open Oracle Console firewall too

---

## 🧪 Testing

### After Opening Port via SSH:

**Test 1: From the VM itself (via SSH):**
```bash
curl http://localhost:2376/version
# Should return Docker version JSON
```

**Test 2: From your Windows PC:**
```powershell
Test-NetConnection -ComputerName 129.154.255.90 -Port 2376
# TcpTestSucceeded : True ✅
```

**Test 3: Via Backend API:**
```
http://localhost:5000/api/test/server-capacity
# Should show "connected": true
```

---

## 📝 Complete Commands

### For EC2 (140.238.229.147):

```bash
# 1. SSH into EC2
ssh ubuntu@140.238.229.147

# 2. Open port 2376
sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT

# 3. Save rules
sudo netfilter-persistent save || sudo iptables-save | sudo tee /etc/iptables/rules.v4

# 4. Verify
sudo iptables -L -n | grep 2376

# 5. Test locally
curl http://localhost:2376/version

# 6. Exit
exit
```

### For EC3 (129.154.255.90):

```bash
# Same commands as EC2
ssh ubuntu@129.154.255.90
sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT
sudo netfilter-persistent save || sudo iptables-save | sudo tee /etc/iptables/rules.v4
sudo iptables -L -n | grep 2376
curl http://localhost:2376/version
exit
```

---

## 🎯 Quick One-Liner

### Open port 2376 on both servers:

```bash
# EC2
ssh ubuntu@140.238.229.147 "sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT && sudo netfilter-persistent save"

# EC3
ssh ubuntu@129.154.255.90 "sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT && sudo netfilter-persistent save"
```

---

## ✅ Verification Checklist

### After running iptables commands:

- [ ] SSH into EC2
- [ ] Run: `sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT`
- [ ] Run: `sudo netfilter-persistent save`
- [ ] Test: `curl http://localhost:2376/version`
- [ ] Exit EC2

- [ ] SSH into EC3
- [ ] Run: `sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT`
- [ ] Run: `sudo netfilter-persistent save`
- [ ] Test: `curl http://localhost:2376/version`
- [ ] Exit EC3

- [ ] Test from Windows: `Test-NetConnection -ComputerName 129.154.255.90 -Port 2376`
- [ ] Test backend: `http://localhost:5000/api/test/server-capacity`
- [ ] See both servers `"connected": true` ✅

---

## 🎉 Summary

**Question:** Can we add firewall rules via SSH?  
**Answer:** ✅ **YES! Use iptables!**

**Commands:**
```bash
# Open port
sudo iptables -I INPUT -p tcp --dport 2376 -j ACCEPT

# Save rules
sudo netfilter-persistent save
```

**Advantages:**
- ✅ Faster than Oracle Console
- ✅ Can script it
- ✅ No web UI needed

**May still need Oracle Console if:**
- ⚠️ Oracle Cloud firewall is strict
- ⚠️ iptables alone doesn't work

**Try iptables first!** If it works, you're done! 🚀

---

**Status:** ✅ **Can open port 2376 via SSH!**  
**Method:** iptables commands  
**Faster than:** Oracle Console  
**Try it now!** 🎯
