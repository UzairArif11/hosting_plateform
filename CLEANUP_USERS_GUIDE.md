# 🔄 Clean Up Old Users & Reassign Containers

**Problem:** Old users don't have containers assigned  
**Solution:** Delete and re-register OR run cleanup script

---

## 🎯 Two Options

### Option 1: Delete Users & Re-register (Simple)

**Delete all users from MongoDB:**

```powershell
cd backend
node delete-all-users.js
```

**Then re-register:**
```
http://localhost:3000
Login with GitHub/Google
```

**New users will automatically get:**
- ✅ Container on EC2 or EC3
- ✅ Resource allocation
- ✅ Project capacity (10 projects)
- ✅ Deployment capacity (100/month)

---

### Option 2: Reassign Existing Users (Keep data)

**Run cleanup script:**

```powershell
cd backend
node cleanup-users.js
```

**This will:**
- ✅ Find users without containers
- ✅ Assign them to EC2 or EC3
- ✅ Set resource limits
- ✅ Keep their existing data

---

## 📝 Delete All Users Script

**Create this file:**

```javascript
// backend/delete-all-users.js
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

async function deleteAllUsers() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Count users
    const count = await User.countDocuments();
    console.log(`📊 Found ${count} users\n`);

    if (count === 0) {
      console.log('✅ No users to delete');
      process.exit(0);
    }

    // Ask for confirmation
    console.log('⚠️  WARNING: This will delete ALL users!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete all users
    const result = await User.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} users\n`);

    console.log('✅ Cleanup complete!');
    console.log('You can now register new users and they will get containers automatically.');
    
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteAllUsers();
```

**Run:**
```powershell
cd backend
node delete-all-users.js
```

---

## 🧪 Testing After Cleanup

### 1. Register New User:

```
http://localhost:3000
Click "Login with GitHub" or "Login with Google"
```

### 2. Check User Assignment:

**Via MongoDB:**
```powershell
# Connect to MongoDB
docker exec -it mongodb mongosh -u admin -p password123 --authenticationDatabase admin

# Check users
use vercel_clone
db.users.find({}, {email: 1, oracleAccountId: 1, containerType: 1})
```

**Should show:**
```javascript
{
  email: "user@example.com",
  oracleAccountId: "EC3",  // or EC2
  containerType: "shared"
}
```

### 3. Check via API:

```
http://localhost:5000/api/test/simulate-assignment
```

**Should show:**
```json
{
  "success": true,
  "assignment": {
    "serverId": "EC3",
    "containerType": "shared"
  }
}
```

---

## 📊 What Happens on Registration

### New User Flow:

```
1. User clicks "Login with GitHub/Google"
        ↓
2. OAuth completes, user created in DB
        ↓
3. Backend calls: assignUserToServer(userId, 'free-trial')
        ↓
4. Container Orchestrator:
   - Checks EC2 vs EC3 capacity
   - EC3 has more capacity (200 vs 150)
   - Assigns user to EC3
   - Creates shared container allocation
        ↓
5. User record updated:
   - oracleAccountId: "EC3"
   - containerType: "shared"
   - resourceAllocation: {
       cpu: 0.2,
       ram: 1.2,
       storage: 10,
       bandwidth: 1024,
       projects: 10,
       deployments: 100
     }
        ↓
6. User can now:
   - Create 10 projects
   - Deploy 100 times/month
   - Use shared container on EC3
```

---

## ✅ Verification Checklist

### After cleanup and re-registration:

- [ ] Old users deleted (or reassigned)
- [ ] New user registered
- [ ] User has `oracleAccountId` (EC2 or EC3)
- [ ] User has `containerType` (shared)
- [ ] User has `resourceAllocation` (projects: 10, deployments: 100)
- [ ] Can create projects
- [ ] Can connect GitHub repos
- [ ] Can trigger deployments

---

## 🎯 Recommended Approach

### For Testing (Now):

**Delete all users and start fresh:**

```powershell
cd backend

# Delete all users
node delete-all-users.js

# Re-register via frontend
# http://localhost:3000
```

**Benefits:**
- ✅ Clean slate
- ✅ All users get containers
- ✅ Easy to verify

---

### For Production (Later):

**Use cleanup script to reassign existing users:**

```powershell
cd backend
node cleanup-users.js
```

**Benefits:**
- ✅ Keeps user data
- ✅ Keeps projects
- ✅ Just adds container assignment

---

## 📝 Quick Commands

### Delete all users:
```powershell
cd backend
node delete-all-users.js
```

### Reassign existing users:
```powershell
cd backend
node cleanup-users.js
```

### Check user in DB:
```powershell
docker exec -it mongodb mongosh -u admin -p password123 --authenticationDatabase admin
use vercel_clone
db.users.find({}, {email: 1, oracleAccountId: 1, containerType: 1}).pretty()
```

### Register new user:
```
http://localhost:3000
```

---

## 🎉 Summary

**Problem:** Old users don't have containers  
**Solution:** Delete and re-register

**Steps:**
1. ✅ Run `delete-all-users.js`
2. ✅ Re-register via frontend
3. ✅ New users get containers automatically
4. ✅ Can create projects and deploy

**After this:**
- ✅ All users have containers
- ✅ Container assignment works
- ✅ Projects and deployments work
- ✅ Ready for production!

---

**Recommendation:** Delete old users and re-register for clean testing! 🚀
