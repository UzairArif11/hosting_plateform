# 🔧 ADMIN SCRIPTS GUIDE

## 📋 **AVAILABLE ADMIN SCRIPTS:**

### **1. Make User Admin**
```bash
cd backend
node make-admin.js user@example.com
```

**What it does:**
- Makes a user an admin
- Shows user details
- Lists available users if email not found

---

### **2. Test Resource Management**
```bash
cd backend
node test-resource-management.js
```

**What it does:**
- Tests bulk plan updates
- Tests admin overrides
- Tests container updates
- Tests shared containers
- Tests server statistics

---

### **3. Check User Details**
```bash
cd backend
node check-user.js user@example.com
```

**What it does:**
- Shows user details
- Shows resources
- Shows containers
- Shows plan

---

## 🎯 **QUICK ADMIN TASKS:**

### **Make First Admin:**
```bash
# 1. Find your email
node -e "
const mongoose = require('mongoose');
const User = require('./models/User');
mongoose.connect('mongodb://localhost:27017/vercel-clone').then(async () => {
  const users = await User.find().select('email username').limit(5);
  console.log('Available users:');
  users.forEach(u => console.log('  -', u.email));
  process.exit(0);
});
"

# 2. Make admin
node make-admin.js YOUR_EMAIL@example.com
```

---

### **Update Pro Plan Resources:**
```bash
# Using curl
curl -X POST http://localhost:5000/api/admin/plans/PLAN_ID/bulk-update \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actualResources": {
      "cpu": 1.5,
      "ram": 3072
    },
    "updateType": "backend"
  }'
```

---

### **Apply Admin Override:**
```bash
curl -X POST http://localhost:5000/api/admin/users/USER_ID/resources/override \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cpu": 4.0,
    "ram": 8192,
    "duration": 86400,
    "reason": "Product launch"
  }'
```

---

### **Get Server Stats:**
```bash
curl http://localhost:5000/api/admin/servers/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 📊 **ADMIN API ENDPOINTS:**

### **User Management:**
```
GET    /api/admin/users/:id/resources
PUT    /api/admin/users/:id/resources/backend
PUT    /api/admin/users/:id/resources/display
POST   /api/admin/users/:id/resources/override
DELETE /api/admin/users/:id/resources/override
```

### **Plan Management:**
```
POST   /api/admin/plans/:id/bulk-update
GET    /api/admin/plans
```

### **Server Management:**
```
GET    /api/admin/servers/stats
GET    /api/admin/servers/:key/stats
```

---

## 🔑 **GET ADMIN TOKEN:**

### **Method 1: Login as Admin**
```bash
# 1. Make yourself admin first
node make-admin.js your@email.com

# 2. Login via API
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "your-password"
  }'

# 3. Copy the token from response
```

### **Method 2: Frontend**
```
1. Login to frontend
2. Open browser DevTools (F12)
3. Go to Application > Local Storage
4. Find 'token' or 'authToken'
5. Copy the value
```

---

## 🧪 **TESTING WORKFLOW:**

### **1. Setup Admin:**
```bash
# Make yourself admin
node make-admin.js your@email.com
```

### **2. Get Token:**
```bash
# Login and get token
# (Use frontend or API)
```

### **3. Test Bulk Update:**
```bash
# Update all Pro users
curl -X POST http://localhost:5000/api/admin/plans/PLAN_ID/bulk-update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"actualResources": {"cpu": 1.5, "ram": 3072}, "updateType": "backend"}'
```

### **4. Verify:**
```bash
# Run test script
node test-resource-management.js
```

---

## 📝 **EXAMPLE WORKFLOW:**

### **Scenario: Reduce All Pro Users Resources**

```bash
# 1. Make yourself admin
node make-admin.js admin@example.com

# 2. Login and get token
# (via frontend or API)

# 3. Get Pro plan ID
curl http://localhost:5000/api/admin/plans \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Update Pro plan
curl -X POST http://localhost:5000/api/admin/plans/PLAN_ID/bulk-update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actualResources": {
      "cpu": 1.5,
      "ram": 3072,
      "storage": 50,
      "bandwidth": 1024,
      "projects": 20
    },
    "updateType": "backend"
  }'

# 5. Verify
# All Pro users now have:
# - Display: 2 CPU, 4GB (unchanged)
# - Actual: 1.5 CPU, 3GB (updated)
# - Containers updated without restart
```

---

## 🎯 **QUICK REFERENCE:**

| Task | Command |
|------|---------|
| Make admin | `node make-admin.js email@example.com` |
| Run tests | `node test-resource-management.js` |
| Check user | `node check-user.js email@example.com` |
| List users | See make-admin.js output when email not found |

---

**All scripts are in the `backend/` directory!** 📁
