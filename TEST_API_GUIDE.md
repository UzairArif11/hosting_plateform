# 🧪 TEST API ENDPOINTS - Check Server Capacity

**Created:** Test endpoints to check EC2 vs EC3 capacity  
**Location:** `/api/test/*`  
**Auth:** No authentication required (for testing)

---

## 🎯 AVAILABLE TEST ENDPOINTS

### 1. Check Server Capacity

**Endpoint:** `GET /api/test/server-capacity`

**What it does:**
- Checks if EC2 and EC3 are reachable
- Shows current utilization
- Recommends best server for new users
- Shows configuration status

**How to use:**

```powershell
# Using PowerShell
Invoke-WebRequest -Uri "http://localhost:5000/api/test/server-capacity" | Select-Object -Expand Content | ConvertFrom-Json | ConvertTo-Json -Depth 10

# Or using curl
curl http://localhost:5000/api/test/server-capacity
```

**Or in browser:**
```
http://localhost:5000/api/test/server-capacity
```

---

### 2. Simulate User Assignment

**Endpoint:** `POST /api/test/simulate-assignment`

**What it does:**
- Simulates assigning a user to EC2 or EC3
- Shows which server would be chosen
- Shows resource allocation
- Works for both free and paid users

**How to use:**

```powershell
# Test free user assignment
Invoke-WebRequest -Uri "http://localhost:5000/api/test/simulate-assignment" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"testuser","planType":"free"}' | Select-Object -Expand Content

# Test paid user assignment
Invoke-WebRequest -Uri "http://localhost:5000/api/test/simulate-assignment" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"paiduser","planType":"paid"}' | Select-Object -Expand Content
```

---

## 📊 EXAMPLE RESPONSES

### Server Capacity (No Oracle Configured):

```json
{
  "success": true,
  "timestamp": "2025-11-24T12:30:00.000Z",
  "servers": {
    "EC2": {
      "connected": false,
      "error": "Cannot connect to Docker",
      "note": "Server not configured or not reachable"
    },
    "EC3": {
      "connected": false,
      "error": "Cannot connect to Docker",
      "note": "Server not configured or not reachable"
    }
  },
  "recommendations": {
    "forNewFreeUser": {
      "server": "EC2",
      "reason": "EC2 has more shared container capacity",
      "containerType": "shared"
    },
    "forNewPaidUser": {
      "server": "EC2",
      "reason": "EC2 has more dedicated container capacity",
      "containerType": "dedicated"
    }
  },
  "configuration": {
    "EC2_SERVER_IP": "Not configured",
    "EC3_SERVER_IP": "Not configured",
    "note": "Add EC2_SERVER_IP and EC3_SERVER_IP to .env to enable Oracle Cloud deployment"
  }
}
```

---

### Server Capacity (With Oracle Configured):

```json
{
  "success": true,
  "timestamp": "2025-11-24T12:30:00.000Z",
  "servers": {
    "EC2": {
      "connected": true,
      "utilization": {
        "sharedUsers": 45,
        "dedicatedUsers": 12,
        "totalUsers": 57,
        "cpuUsed": 0.8,
        "ramUsed": 5.2,
        "cpuAvailable": 1.2,
        "ramAvailable": 6.8,
        "sharedCapacity": 105,
        "dedicatedCapacity": 38
      },
      "capacity": {
        "shared": "105/150 users",
        "dedicated": "38/50 containers"
      },
      "resources": {
        "cpu": "0.80/2 OCPU",
        "ram": "5.20/12 GB"
      }
    },
    "EC3": {
      "connected": true,
      "utilization": {
        "sharedUsers": 78,
        "dedicatedUsers": 25,
        "totalUsers": 103,
        "cpuUsed": 1.5,
        "ramUsed": 12.3,
        "cpuAvailable": 2.5,
        "ramAvailable": 11.7,
        "sharedCapacity": 122,
        "dedicatedCapacity": 75
      },
      "capacity": {
        "shared": "122/200 users",
        "dedicated": "75/100 containers"
      },
      "resources": {
        "cpu": "1.50/4 OCPU",
        "ram": "12.30/24 GB"
      }
    }
  },
  "recommendations": {
    "forNewFreeUser": {
      "server": "EC3",
      "reason": "EC3 has more shared container capacity",
      "containerType": "shared"
    },
    "forNewPaidUser": {
      "server": "EC3",
      "reason": "EC3 has more dedicated container capacity",
      "containerType": "dedicated"
    }
  },
  "configuration": {
    "EC2_SERVER_IP": "150.136.XX.XX",
    "EC3_SERVER_IP": "150.136.YY.YY",
    "note": "Both servers configured"
  }
}
```

---

### Simulate Assignment (Free User):

```json
{
  "success": true,
  "simulation": {
    "user": {
      "username": "testuser",
      "email": "testuser@test.com"
    },
    "plan": {
      "type": "free",
      "name": "free-trial",
      "containerType": "shared"
    },
    "assignment": {
      "server": "EC3",
      "serverName": "EC3-Mixed-Server",
      "containerType": "shared",
      "resources": {
        "cpu": "0.2 OCPU (10% cap)",
        "ram": "1.2 GB (10% cap)",
        "storage": "10 GB",
        "bandwidth": "100 GB/month"
      }
    },
    "serverStatus": {
      "currentUsers": 103,
      "sharedUsers": 78,
      "dedicatedUsers": 25,
      "availableCapacity": 122
    }
  },
  "note": "This is a simulation. Actual container creation requires Oracle Cloud servers to be configured."
}
```

---

### Simulate Assignment (Paid User):

```json
{
  "success": true,
  "simulation": {
    "user": {
      "username": "paiduser",
      "email": "paiduser@test.com"
    },
    "plan": {
      "type": "paid",
      "name": "pro",
      "containerType": "dedicated"
    },
    "assignment": {
      "server": "EC3",
      "serverName": "EC3-Mixed-Server",
      "containerType": "dedicated",
      "resources": {
        "cpu": 2,
        "ram": 8,
        "storage": 100,
        "bandwidth": 2048
      }
    },
    "serverStatus": {
      "currentUsers": 103,
      "sharedUsers": 78,
      "dedicatedUsers": 25,
      "availableCapacity": 75
    }
  },
  "note": "This is a simulation. Actual container creation requires Oracle Cloud servers to be configured."
}
```

---

## 🎯 WHAT YOU CAN TEST

### Before Oracle Setup:
- ✅ Check if endpoints work
- ✅ See configuration status
- ✅ Understand server selection logic
- ✅ See expected resource allocation

### After Oracle Setup:
- ✅ Verify EC2/EC3 connection
- ✅ Check real-time capacity
- ✅ See actual utilization
- ✅ Monitor load balancing

---

## 🚀 HOW TO USE

### Step 1: Test Locally (No Oracle)

**Check capacity:**
```powershell
# Open browser or use PowerShell
Invoke-WebRequest http://localhost:5000/api/test/server-capacity | Select-Object -Expand Content
```

**Expected:**
- EC2: Not connected
- EC3: Not connected
- Configuration: Not configured
- Recommendations: Default to EC2

---

### Step 2: Add Oracle IPs

**Update backend/.env:**
```env
EC2_SERVER_IP=150.136.XX.XX
EC3_SERVER_IP=150.136.YY.YY
```

**Restart backend:**
```powershell
# Ctrl+C to stop
npm run dev
```

---

### Step 3: Test With Oracle

**Check capacity again:**
```powershell
Invoke-WebRequest http://localhost:5000/api/test/server-capacity | Select-Object -Expand Content
```

**Expected (if Oracle configured correctly):**
- EC2: ✅ Connected
- EC3: ✅ Connected
- Shows real utilization
- Recommends server with more capacity

---

### Step 4: Simulate User Assignment

**Test free user:**
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/test/simulate-assignment" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"freeuser","planType":"free"}'
```

**Test paid user:**
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/test/simulate-assignment" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"paiduser","planType":"paid"}'
```

---

## 🔍 UNDERSTANDING THE RESULTS

### Server Selection Logic:

**For Free Users (Shared):**
```
1. Check EC2 shared capacity
2. Check EC3 shared capacity
3. Choose server with MORE capacity
4. Assign to that server
```

**For Paid Users (Dedicated):**
```
1. Check EC2 dedicated capacity
2. Check EC3 dedicated capacity
3. Choose server with MORE capacity
4. Assign to that server
```

### Load Balancing:

**Example:**
- EC2: 45 shared users (105 capacity left)
- EC3: 78 shared users (122 capacity left)
- **New free user → EC3** (more capacity)

---

## 📊 MONITORING

### Check Regularly:

```powershell
# Create a monitoring script
while ($true) {
  Clear-Host
  Write-Host "=== Server Capacity Check ===" -ForegroundColor Cyan
  Write-Host "Time: $(Get-Date)" -ForegroundColor Yellow
  Invoke-WebRequest http://localhost:5000/api/test/server-capacity | 
    Select-Object -Expand Content | 
    ConvertFrom-Json | 
    ConvertTo-Json -Depth 10
  Start-Sleep -Seconds 30
}
```

---

## ✅ VERIFICATION CHECKLIST

- [ ] Test endpoints accessible
- [ ] Server capacity check works
- [ ] Shows "Not configured" (before Oracle)
- [ ] Add Oracle IPs to .env
- [ ] Restart backend
- [ ] Server capacity shows "Connected"
- [ ] Real utilization displayed
- [ ] Simulate assignment works
- [ ] Correct server recommended

---

## 🎉 SUMMARY

**Created:**
- ✅ `GET /api/test/server-capacity` - Check EC2 vs EC3
- ✅ `POST /api/test/simulate-assignment` - Simulate user assignment

**What it shows:**
- ✅ Server connection status
- ✅ Current utilization
- ✅ Available capacity
- ✅ Best server recommendation
- ✅ Resource allocation

**Use it to:**
- ✅ Verify Oracle Cloud setup
- ✅ Monitor capacity
- ✅ Test load balancing
- ✅ Debug assignment issues

---

**Status:** ✅ **Test endpoints ready!**  
**Access:** http://localhost:5000/api/test/server-capacity  
**No auth required!** 🎯
