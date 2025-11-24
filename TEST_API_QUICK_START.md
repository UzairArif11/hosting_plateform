# ✅ TEST API CREATED - Check EC2 vs EC3 Capacity!

**Status:** ✅ Test endpoints created and ready!

---

## 🎯 WHAT I CREATED

### 1. Test API Route
**File:** `backend/routes/test.js`

**Endpoints:**
- `GET /api/test/server-capacity` - Check EC2 vs EC3 capacity
- `POST /api/test/simulate-assignment` - Simulate user assignment

### 2. Added to Server
**File:** `backend/server.js` (line 148)
```javascript
app.use('/api/test', require('./routes/test'));
```

---

## 🚀 HOW TO USE

### Step 1: Restart Backend

```powershell
# Stop current backend (Ctrl+C in the terminal)
# Then start again:
cd backend
npm run dev
```

### Step 2: Test the API

**Option 1: Browser**
```
http://localhost:5000/api/test/server-capacity
```

**Option 2: PowerShell**
```powershell
Invoke-WebRequest http://localhost:5000/api/test/server-capacity | Select-Object -Expand Content
```

**Option 3: curl**
```powershell
curl http://localhost:5000/api/test/server-capacity
```

---

## 📊 WHAT YOU'LL SEE

### Without Oracle Cloud (Current):
```json
{
  "success": true,
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
    }
  },
  "configuration": {
    "EC2_SERVER_IP": "Not configured",
    "EC3_SERVER_IP": "Not configured",
    "note": "Add EC2_SERVER_IP and EC3_SERVER_IP to .env"
  }
}
```

### With Oracle Cloud (After Setup):
```json
{
  "success": true,
  "servers": {
    "EC2": {
      "connected": true,
      "utilization": {
        "sharedUsers": 45,
        "dedicatedUsers": 12,
        "totalUsers": 57,
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
        "sharedCapacity": 122,
        "dedicatedCapacity": 75
      }
    }
  },
  "recommendations": {
    "forNewFreeUser": {
      "server": "EC3",
      "reason": "EC3 has more shared container capacity"
    }
  }
}
```

---

## 🎯 WHAT IT CHECKS

### The API Automatically:
1. ✅ Connects to EC2 Docker (if configured)
2. ✅ Connects to EC3 Docker (if configured)
3. ✅ Counts shared users on each server
4. ✅ Counts dedicated users on each server
5. ✅ Calculates available capacity
6. ✅ Recommends best server for new users
7. ✅ Shows resource usage (CPU, RAM)

### Load Balancing Logic:
```
If EC2 has 105 free slots and EC3 has 122 free slots
→ New free user goes to EC3 (more capacity)

If EC2 has 38 dedicated slots and EC3 has 75 dedicated slots
→ New paid user goes to EC3 (more capacity)
```

---

## 🧪 TEST SCENARIOS

### Test 1: Check Current Status
```powershell
# See current configuration
Invoke-WebRequest http://localhost:5000/api/test/server-capacity
```

### Test 2: Simulate Free User Assignment
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/test/simulate-assignment" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"testuser","planType":"free"}'
```

### Test 3: Simulate Paid User Assignment
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/test/simulate-assignment" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"paiduser","planType":"paid"}'
```

---

## ✅ QUICK START

**1. Restart backend:**
```powershell
cd backend
# Ctrl+C to stop current
npm run dev
```

**2. Open browser:**
```
http://localhost:5000/api/test/server-capacity
```

**3. See results!**

---

## 📝 FILES CREATED

1. ✅ `backend/routes/test.js` - Test API endpoints
2. ✅ `backend/server.js` - Added test route (line 148)
3. ✅ `TEST_API_GUIDE.md` - Complete guide
4. ✅ `TEST_API_QUICK_START.md` - This file

---

## 🎉 SUMMARY

**Created:** Test API to check EC2 vs EC3 capacity  
**Endpoints:** 2 endpoints (capacity check + simulate assignment)  
**Auth:** No authentication required  
**Status:** ✅ Ready to use!  

**Next:** Restart backend and test it!

---

**Access:** http://localhost:5000/api/test/server-capacity  
**No Oracle Cloud needed to test!** 🚀
