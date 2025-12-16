# 🚨 MONGODB NOT RUNNING

## ❌ **ERROR:**
```
AggregateError at internalConnectMultiple
❌ MongoDB connection failed
```

## 🔍 **CAUSE:**
MongoDB service is not running on your machine.

---

## ✅ **FIX: START MONGODB**

### **Windows:**

#### **Option 1: Start MongoDB Service**
```bash
# Open PowerShell as Administrator
net start MongoDB
```

#### **Option 2: Start MongoDB Manually**
```bash
# Navigate to MongoDB bin directory
cd "C:\Program Files\MongoDB\Server\6.0\bin"

# Start MongoDB
mongod
```

#### **Option 3: Check if MongoDB is installed**
```bash
# Check MongoDB version
mongod --version

# If not installed, download from:
# https://www.mongodb.com/try/download/community
```

---

### **Linux/Mac:**

#### **Ubuntu/Debian:**
```bash
sudo systemctl start mongod
sudo systemctl status mongod
```

#### **Mac (Homebrew):**
```bash
brew services start mongodb-community
```

---

## 🧪 **VERIFY MONGODB IS RUNNING:**

```bash
# Try connecting with mongo shell
mongosh

# Or check if port 27017 is listening
netstat -ano | findstr :27017
```

---

## 🔄 **AFTER STARTING MONGODB:**

1. **Start MongoDB** (using one of the methods above)
2. **Restart Backend:**
   ```bash
   npm start
   ```
3. **Should see:**
   ```
   ✅ MongoDB connected successfully
   🔗 Database: vercel_clone
   ```

---

## 📝 **ALTERNATIVE: USE MONGODB ATLAS (CLOUD)**

If you don't want to run MongoDB locally:

1. Go to https://www.mongodb.com/cloud/atlas
2. Create free cluster
3. Get connection string
4. Update `.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/vercel_clone
   ```

---

## ⚠️ **IMPORTANT:**

The User model enum fix is correct, but you won't see it work until MongoDB is running!

**Start MongoDB first, then restart the backend!**
