# 🔥 EC3 Not Connecting - Oracle Cloud Firewall!

**Problem:** EC2 works, but EC3 times out

**Cause:** Oracle Cloud firewall is blocking port 2376 on EC3!

---

## 🔍 Why EC2 Works but EC3 Doesn't

### EC2 (140.238.229.147):
```
Your Windows PC
    ↓
Internet
    ↓
Oracle Cloud Firewall ✅ (port 2376 already open)
    ↓
iptables ✅ (opened by script)
    ↓
Docker ✅ (configured by script)
    ↓
CONNECTED! ✅
```

### EC3 (129.154.255.90):
```
Your Windows PC
    ↓
Internet
    ↓
Oracle Cloud Firewall ❌ (port 2376 BLOCKED!)
    ↓
(Can't reach iptables or Docker)
    ↓
TIMEOUT! ❌
```

---

## 🎯 THE FIX: Open Oracle Cloud Firewall

**You MUST do this in Oracle Cloud Console!**

### Step-by-Step with Screenshots:

#### 1. Login to Oracle Cloud
```
https://cloud.oracle.com
```

#### 2. Go to Instances
```
☰ Menu → Compute → Instances
```

#### 3. Find EC3 Instance
```
Look for instance with IP: 129.154.255.90
Click on the instance name
```

#### 4. Go to Subnet
```
Scroll down to "Primary VNIC"
Click the "Subnet" link (looks like: subnet-20250713-1730)
```

#### 5. Go to Security List
```
Under "Security Lists"
Click the security list name (looks like: Default Security List for...)
```

#### 6. Add Ingress Rule
```
Click "Add Ingress Rules" button
```

#### 7. Fill in the Form
```
Stateless: No (leave unchecked)
Source Type: CIDR
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Source Port Range: (leave empty)
Destination Port Range: 2376
Description: Docker Remote API
```

#### 8. Save
```
Click "Add Ingress Rules" button at bottom
```

#### 9. Wait
```
Wait 1-2 minutes for the rule to apply
```

---

## 🧪 Test After Opening Firewall

### From Windows:

```powershell
# Test EC3 port
Test-NetConnection -ComputerName 129.154.255.90 -Port 2376

# Should show:
# TcpTestSucceeded : True ✅
```

### Test Backend API:

```
http://localhost:5000/api/test/server-capacity
```

**Should show:**
```json
{
  "servers": {
    "EC2": { "connected": true },
    "EC3": { "connected": true }  ← This!
  }
}
```

---

## 📊 Two Firewalls Explained

### Oracle Cloud has TWO separate firewalls:

#### 1. Oracle Cloud Firewall (Console)
- **Location:** Oracle's infrastructure
- **Managed:** Via Oracle Cloud Console
- **Default:** Blocks everything except SSH (port 22)
- **Status for EC3:** ❌ Blocking port 2376

#### 2. iptables (Inside VM)
- **Location:** Inside the VM
- **Managed:** Via SSH commands
- **Status for EC3:** ✅ Already open (script did this)

**Both must be open!**

---

## ⚠️ Why EC2 Works

**EC2's Oracle Cloud firewall already has port 2376 open!**

**Possible reasons:**
1. You opened it before
2. It was open by default
3. Different security list configuration

**EC3's Oracle Cloud firewall is still blocking!**

---

## 🎯 Visual Comparison

### EC2 Firewall Status:
```
Oracle Cloud Firewall: ✅ Open (port 2376)
iptables:              ✅ Open (script)
Docker:                ✅ HTTP (script)
Result:                ✅ CONNECTED
```

### EC3 Firewall Status:
```
Oracle Cloud Firewall: ❌ BLOCKED (port 2376)  ← FIX THIS!
iptables:              ✅ Open (script)
Docker:                ✅ HTTP (script)
Result:                ❌ TIMEOUT
```

---

## 📝 Quick Verification

### Check if Oracle firewall is the issue:

**From EC3 itself (via SSH):**
```bash
ssh ubuntu@129.154.255.90

# Test locally (this should work)
curl http://localhost:2376/version
# ✅ Works! (because no firewall locally)

exit
```

**From Windows:**
```powershell
# Test from outside (this will fail)
Test-NetConnection -ComputerName 129.154.255.90 -Port 2376
# ❌ Fails! (because Oracle firewall blocks)
```

**This confirms Oracle Cloud firewall is blocking!**

---

## 🚀 Alternative: Use Oracle CLI

**If you don't want to use the console:**

```bash
# On your local machine (if you have OCI CLI installed)
oci network security-list update \
  --security-list-id <your-security-list-id> \
  --ingress-security-rules '[{
    "protocol": "6",
    "source": "0.0.0.0/0",
    "tcpOptions": {
      "destinationPortRange": {
        "min": 2376,
        "max": 2376
      }
    }
  }]'
```

**But using the console is easier!**

---

## 🎉 Summary

**Why EC2 works:**
- ✅ Oracle Cloud firewall: Open
- ✅ iptables: Open
- ✅ Docker: HTTP

**Why EC3 doesn't work:**
- ❌ Oracle Cloud firewall: **BLOCKED!**
- ✅ iptables: Open
- ✅ Docker: HTTP

**Fix:**
1. Open port 2376 in Oracle Cloud Console for EC3
2. Wait 1-2 minutes
3. Test from Windows
4. **Done!** ✅

---

## 📞 Exact Steps

1. **Go to:** https://cloud.oracle.com
2. **Click:** ☰ → Compute → Instances
3. **Find:** Instance with IP 129.154.255.90
4. **Click:** Instance name
5. **Click:** Subnet link
6. **Click:** Security List name
7. **Click:** "Add Ingress Rules"
8. **Fill:**
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: `TCP`
   - Destination Port: `2376`
9. **Click:** "Add Ingress Rules"
10. **Wait:** 1-2 minutes
11. **Test:** `Test-NetConnection -ComputerName 129.154.255.90 -Port 2376`

**That's it!** 🚀

---

**Status:** ⚠️ **Must open Oracle Cloud firewall for EC3!**  
**Location:** Oracle Cloud Console (not SSH!)  
**Port:** 2376  
**Then EC3 will work!** ✅
