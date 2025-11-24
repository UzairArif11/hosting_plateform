# 🔐 Admin Panel Access Guide

## How to Access Admin Panel

### Step 1: Login with OAuth
The admin panel uses the **same login** as the user panel:
- Go to http://localhost:3000/login
- Click "Continue with Google" or "Continue with GitHub"
- Complete OAuth authentication

### Step 2: Make Your Account Admin

After logging in for the first time, you need to promote your account to admin role.

#### Option A: Using the Script (Recommended)

1. **Find your email** (the one you used to login with Google/GitHub)

2. **Run the admin script:**
   ```bash
   cd backend
   node make-admin.js your-email@gmail.com
   ```

3. **Example:**
   ```bash
   node make-admin.js john.doe@gmail.com
   ```

4. **Output:**
   ```
   ✅ Connected to MongoDB
   ✅ User updated successfully!
   
   User Details:
     Email: john.doe@gmail.com
     Name: John Doe
     Role: admin
   
   You can now access the admin panel at:
     http://localhost:3000/admin
   ```

#### Option B: Using MongoDB Directly

1. **Open Mongo Express:**
   - Go to http://localhost:8081
   - Username: `admin`
   - Password: `password123`

2. **Navigate to the database:**
   - Click on `vercel_clone` database
   - Click on `users` collection

3. **Find your user:**
   - Look for your email address

4. **Edit the document:**
   - Click the edit icon
   - Change `"role": "user"` to `"role": "admin"`
   - Click "Save"

#### Option C: Using MongoDB Shell

```bash
docker exec -it vercel-clone-mongodb mongosh -u admin -p password123 --authenticationDatabase admin

use vercel_clone

db.users.updateOne(
  { email: "your-email@gmail.com" },
  { $set: { role: "admin" } }
)
```

### Step 3: Access Admin Panel

1. **Logout and login again** (to refresh your session)
2. **Go to:** http://localhost:3000/admin
3. **You should now see the admin dashboard!**

---

## Admin Panel URLs

Once you're an admin, you can access:

- **Admin Dashboard**: http://localhost:3000/admin/dashboard
- **User Management**: http://localhost:3000/admin/users
- **Projects Overview**: http://localhost:3000/admin/projects
- **Server Management**: http://localhost:3000/admin/servers
- **System Settings**: http://localhost:3000/admin/settings

---

## Access Control

### User Role (Default)
- ✅ Access to `/dashboard/*`
- ❌ No access to `/admin/*`

### Admin Role
- ✅ Access to `/dashboard/*`
- ✅ Access to `/admin/*`
- ✅ Can manage all users
- ✅ Can view all projects
- ✅ Can configure system settings

---

## Troubleshooting

### "Access Denied" or "Unauthorized"
1. Make sure your role is set to `admin` in the database
2. Logout and login again to refresh your session
3. Check browser console for errors

### Can't Find Your User in Database
1. Make sure you've logged in at least once
2. Check the `users` collection in MongoDB
3. Verify the email matches exactly

### Script Not Working
1. Make sure MongoDB is running: `docker ps`
2. Check `.env` file has correct `MONGODB_URI`
3. Run from the `backend` directory

---

## Quick Commands

### List All Users
```bash
cd backend
node -e "require('dotenv').config(); const mongoose = require('mongoose'); const User = require('./models/User'); mongoose.connect(process.env.MONGODB_URI).then(async () => { const users = await User.find({}, 'email displayName role'); console.log(users); process.exit(); });"
```

### Make User Admin
```bash
cd backend
node make-admin.js your-email@gmail.com
```

### Remove Admin Role
```bash
cd backend
node -e "require('dotenv').config(); const mongoose = require('mongoose'); const User = require('./models/User'); mongoose.connect(process.env.MONGODB_URI).then(async () => { await User.updateOne({email: 'user@example.com'}, {role: 'user'}); console.log('Updated'); process.exit(); });"
```

---

## Default Credentials Summary

### Application Login
- **Method**: OAuth (GitHub or Google)
- **No username/password** - uses OAuth providers

### MongoDB (Docker)
- **URL**: http://localhost:27017
- **Username**: `admin`
- **Password**: `password123`
- **Database**: `vercel_clone`

### Mongo Express (Web UI)
- **URL**: http://localhost:8081
- **Username**: `admin`
- **Password**: `password123`

---

## Security Notes

⚠️ **Important for Production:**

1. **Change default MongoDB credentials** in `docker-compose.yml`
2. **Use environment variables** for sensitive data
3. **Implement proper admin invitation system**
4. **Add audit logging** for admin actions
5. **Use 2FA** for admin accounts
6. **Restrict admin panel** to specific IP addresses

---

## Next Steps

After becoming an admin:

1. ✅ Test admin dashboard access
2. ✅ Explore user management features
3. ✅ Check system statistics
4. ✅ Configure platform settings
5. ✅ Monitor server health

---

**You're now ready to use the admin panel!** 🎉
