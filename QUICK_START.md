# 🚀 QUICK START GUIDE

## ⚡ **GET EVERYTHING RUNNING IN 5 MINUTES**

### **Prerequisites:**
- ✅ Node.js installed
- ✅ MongoDB running
- ✅ Redis running (optional, for queue)

---

## 📋 **STEP-BY-STEP:**

### **Step 1: Start Backend** (2 minutes)

```bash
cd backend

# Install dependencies (if not done)
npm install

# Start the server
npm start

# OR use PM2 for production
pm2 start server.js --name backend
```

**Expected Output:**
```
✅ Connected to MongoDB
✅ WebSocket server initialized
✅ Server running on port 5000
```

---

### **Step 2: Start Frontend** (2 minutes)

```bash
cd frontend

# Install dependencies (if not done)
npm install

# Start development server
npm run dev

# OR build for production
npm run build
npm start
```

**Expected Output:**
```
✓ Ready on http://localhost:3000
```

---

### **Step 3: Run Tests** (1 minute)

```bash
cd backend

# Run comprehensive tests
node test-complete-system.js
```

**Expected Output:**
```
🎉 ALL TESTS PASSED!
Total Tests: 9
Passed: 9
Failed: 0
Success Rate: 100%
```

---

## 🔧 **TROUBLESHOOTING:**

### **Issue: Tests Fail with 404**

**Problem:** Backend server is not running

**Solution:**
```bash
cd backend
npm start
```

Then run tests again:
```bash
node test-complete-system.js
```

---

### **Issue: MongoDB Connection Error**

**Problem:** MongoDB is not running

**Solution:**

**Windows:**
```bash
# Start MongoDB service
net start MongoDB

# OR start manually
mongod
```

**Linux/Mac:**
```bash
sudo systemctl start mongod
# OR
brew services start mongodb-community
```

---

### **Issue: Port 5000 Already in Use**

**Problem:** Another process is using port 5000

**Solution:**

**Option 1: Kill the process**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

**Option 2: Change port**
```bash
# In backend/.env
PORT=5001
```

---

## ✅ **VERIFY EVERYTHING WORKS:**

### **1. Check Backend:**
```bash
curl http://localhost:5000/api/health
```

**Expected:** `{"status":"ok"}`

### **2. Check Frontend:**
Open browser: `http://localhost:3000`

**Expected:** See the platform UI

### **3. Check WebSocket:**
```bash
# In browser console
const socket = io('http://localhost:5000');
socket.on('connect', () => console.log('Connected!'));
```

**Expected:** `Connected!`

---

## 🎯 **WHAT TO DO NEXT:**

### **For Development:**
1. ✅ Backend running on `http://localhost:5000`
2. ✅ Frontend running on `http://localhost:3000`
3. ✅ Create a test project
4. ✅ Deploy it
5. ✅ Watch real-time updates

### **For Production:**

1. **Setup SSL:**
   ```bash
   chmod +x setup-ssl.sh
   ./setup-ssl.sh
   ```

2. **Update .env:**
   ```env
   PROTOCOL=https
   BASE_DOMAIN=foodpanda.site
   ```

3. **Deploy:**
   ```bash
   # Backend
   cd backend
   pm2 start server.js --name backend
   
   # Frontend
   cd frontend
   npm run build
   pm2 start npm --name frontend -- start
   ```

4. **Test:**
   ```bash
   node test-complete-system.js
   ```

---

## 📊 **CURRENT STATUS:**

```
Backend:   ✅ Ready
Frontend:  ✅ Ready
SSL:       ⏳ Run setup-ssl.sh
Tests:     ✅ Ready
Docs:      ✅ Complete
```

---

## 🆘 **COMMON ERRORS:**

### **Error: "Cannot find module"**
```bash
npm install
```

### **Error: "EADDRINUSE"**
```bash
# Port already in use
# Kill the process or change port
```

### **Error: "MongoDB connection failed"**
```bash
# Start MongoDB
net start MongoDB  # Windows
sudo systemctl start mongod  # Linux
```

### **Error: "401 Unauthorized" in tests**
```bash
# This is OK if you haven't created a test user yet
# The test will try to register a new user
```

---

## 🎉 **SUCCESS CHECKLIST:**

- [ ] Backend server running (port 5000)
- [ ] Frontend server running (port 3000)
- [ ] MongoDB connected
- [ ] Tests passing
- [ ] Can create projects
- [ ] Can deploy projects
- [ ] WebSocket updates working

**When all checked:** You're ready to go! 🚀

---

## 📝 **USEFUL COMMANDS:**

```bash
# Backend
cd backend
npm start                    # Start server
npm run dev                  # Start with nodemon
pm2 start server.js          # Start with PM2
pm2 logs backend             # View logs
pm2 restart backend          # Restart

# Frontend
cd frontend
npm run dev                  # Development
npm run build                # Build for production
npm start                    # Start production server

# Tests
node test-complete-system.js # Run all tests
node cleanup-containers.js --active  # Show containers

# SSL
./setup-ssl.sh               # Setup SSL (production)
```

---

## 🔗 **IMPORTANT URLS:**

- **Backend API:** http://localhost:5000
- **Frontend:** http://localhost:3000
- **API Docs:** http://localhost:5000/api/health
- **WebSocket:** ws://localhost:5000

---

**Need help?** Check the documentation:
- `100_PERCENT_COMPLETE.md` - Complete guide
- `COMPLETE_FUNCTIONALITY_DOCS.md` - All features
- `FINAL_DELIVERY.md` - Deployment guide

**Ready to deploy!** 🎊
