# 🚀 COMPLETE DEPLOYMENT GUIDE

## Quick Start - One Command Deployment

After cloning the project, you can deploy everything with a single command:

```bash
./deploy-complete.sh
```

This script automatically sets up and runs **EVERYTHING** you need!

---

## 🎯 What the Script Does (Step by Step)

### **Step 1: System Environment Check** ✅
- Detects your operating system (Ubuntu/Debian preferred)
- **Auto-installs Node.js** (v18) if not present
- **Auto-installs Docker** if not present
- **Auto-installs Docker Compose** (plugin or standalone)
- **Auto-installs PM2** globally if not present
- Verifies all installations

### **Step 2: Starting Infrastructure (Databases)** 🗄️
Runs `docker-compose up -d` which starts:

#### **MongoDB (Database)**
- **Container:** `vercel-clone-mongodb`
- **Port:** `27017`
- **Version:** MongoDB 7.0
- **Credentials:**
  - Username: `admin`
  - Password: `password123`
- **Connection String:** 
  ```
  mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin
  ```
- **Data Persistence:** Volumes for data and config

#### **Mongo Express (MongoDB Web UI)** 🌐
- **Container:** `vercel-clone-mongo-express`
- **Port:** `8081`
- **Access:** http://localhost:8081
- **Credentials:**
  - Username: `admin`
  - Password: `password123`
- **Features:**
  - View all databases
  - Browse collections
  - Edit documents
  - Run queries
  - Export/Import data
  - View indexes

#### **Redis (Job Queue)** ⚡
- **Container:** `vercel-clone-redis`
- **Port:** `6379`
- **Version:** Redis Alpine
- **Purpose:** Build queue management
- **Data Persistence:** Volume for Redis data

### **Step 3: Preparing Backend** 🔧
- Navigates to `backend/` directory
- Creates `.env` file from `.env.example` if missing
- Runs `npm install` to install all dependencies
- Backend is ready but not started yet

### **Step 4: Preparing Frontend** 🎨
- Navigates to `frontend/` directory
- Creates `.env` file (with default API URL) if missing
- Runs `npm install` to install all dependencies
- **Runs `npm run build`** to create production build
- This step takes a few minutes (optimizes and builds all pages)

### **Step 5: Starting Services with PM2** 🚀

#### **Backend Service**
- Stops any existing backend process
- Starts backend with: `pm2 start server.js --name backend --time`
- **Port:** `5000`
- **Accessible at:** http://localhost:5000/api

#### **Frontend Service**
- Stops any existing frontend process
- Starts frontend with: `pm2 start npm --name frontend --time -- start`
- **Port:** `3000`
- **Accessible at:** http://localhost:3000

- Runs `pm2 save` to persist processes across reboots

### **Step 6: Final Verification** ✅
- Waits 5 seconds for services to stabilize
- Checks backend health at: `http://localhost:5000/api/health`
- Displays success message with all access URLs

---

## 🌐 Access URLs (After Deployment)

| Service | URL | Port | Description |
|---------|-----|------|-------------|
| **Frontend** | http://localhost:3000 | 3000 | Main web application |
| **Backend API** | http://localhost:5000 | 5000 | REST API endpoints |
| **MongoDB UI** | http://localhost:8081 | 8081 | Database admin interface |
| **MongoDB** | localhost:27017 | 27017 | Direct database connection |
| **Redis** | localhost:6379 | 6379 | Job queue (no UI) |

### MongoDB UI Credentials
- **URL:** http://localhost:8081
- **Username:** `admin`
- **Password:** `password123`

---

## 📊 MongoDB UI Features (Mongo Express)

When you access http://localhost:8081, you can:

### 1. **View Databases** 
- See all databases including `vercel_clone`
- View database statistics

### 2. **Browse Collections**
Click on `vercel_clone` database to see collections:
- `users` - User accounts
- `projects` - User projects
- `deployments` - Deployment history
- `plans` - Subscription plans
- `servers` - Server configurations
- `settings` - Platform settings
- And more...

### 3. **View Documents**
- See all documents in any collection
- Beautiful JSON formatting
- Search and filter capabilities

### 4. **Edit Data**
- Click on any document to edit
- Add new documents
- Delete documents
- Modify fields

### 5. **Run Queries**
- Execute MongoDB queries
- Test aggregation pipelines
- Export query results

### 6. **Manage Indexes**
- View existing indexes
- Create new indexes
- Drop unused indexes

### 7. **Import/Export**
- Export collections to JSON
- Import data from JSON files
- Backup specific collections

---

## 🎮 PM2 Commands (Managing Services)

### View Status
```bash
pm2 status
```
Shows all running processes (backend, frontend)

### View Logs
```bash
# All logs
pm2 logs

# Backend only
pm2 logs backend

# Frontend only
pm2 logs frontend
```

### Restart Services
```bash
# Restart all
pm2 restart all

# Restart backend only
pm2 restart backend

# Restart frontend only
pm2 restart frontend
```

### Stop Services
```bash
# Stop all
pm2 stop all

# Stop specific
pm2 stop backend
pm2 stop frontend
```

### Monitor Resources
```bash
pm2 monit
```
Real-time CPU and memory monitoring

---

## 🔍 Verify Everything is Running

### 1. Check Docker Containers
```bash
docker ps
```
Should show:
- `vercel-clone-mongodb` (healthy)
- `vercel-clone-mongo-express` (up)
- `vercel-clone-redis` (up)

### 2. Check PM2 Processes
```bash
pm2 status
```
Should show:
- `backend` (online)
- `frontend` (online)

### 3. Test Endpoints
```bash
# Backend health
curl http://localhost:5000/api/health

# Frontend (should return HTML)
curl http://localhost:3000
```

### 4. Access Web Interfaces
- Frontend: http://localhost:3000
- MongoDB UI: http://localhost:8081

---

## 📁 What Gets Created/Modified

### Files Created
```
backend/.env          # Backend environment variables
frontend/.env         # Frontend environment variables
```

### Docker Volumes Created
```
mongodb_data          # MongoDB database files
mongodb_config        # MongoDB configuration
redis_data            # Redis data files
```

### PM2 Processes
```
backend              # Node.js API server
frontend             # Next.js web server
```

---

## 🛠️ Configuration Files

### Backend .env (Example)
```bash
# Database
MONGODB_URI=mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin
REDIS_URL=redis://localhost:6379

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Session
SESSION_SECRET=your-secret-key-here

# OAuth (Configure these)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Servers (For container orchestration)
EC2_SERVER_IP=your-ec2-server-ip
EC3_SERVER_IP=your-ec3-server-ip
```

### Frontend .env (Example)
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## 🔧 Troubleshooting

### Issue: "Docker permission denied"
**Solution:**
```bash
# Add yourself to docker group
sudo usermod -aG docker $USER

# Apply changes
newgrp docker

# Or logout and login again
```

### Issue: "Port already in use"
**Solution:**
```bash
# Check what's using the port
sudo lsof -i :3000  # Frontend
sudo lsof -i :5000  # Backend
sudo lsof -i :27017 # MongoDB
sudo lsof -i :8081  # Mongo Express

# Kill the process or change ports in .env
```

### Issue: "MongoDB connection failed"
**Solution:**
```bash
# Check if MongoDB container is running
docker ps | grep mongodb

# Check MongoDB logs
docker logs vercel-clone-mongodb

# Restart MongoDB
docker restart vercel-clone-mongodb
```

### Issue: "Frontend build failed"
**Solution:**
```bash
cd frontend
rm -rf node_modules .next
npm install
npm run build
```

### Issue: "Backend won't start"
**Solution:**
```bash
cd backend
pm2 logs backend  # Check error logs
pm2 restart backend
```

---

## 🎯 Quick Commands Reference

### Full Stack Commands
```bash
# Deploy everything
./deploy-complete.sh

# Stop everything
pm2 stop all
docker-compose down

# Restart everything
pm2 restart all
docker-compose restart

# View all logs
pm2 logs
docker-compose logs -f
```

### Database Commands
```bash
# Start databases only
docker-compose up -d

# Stop databases
docker-compose down

# Reset databases (CAUTION: Deletes all data)
docker-compose down -v
docker-compose up -d

# Access MongoDB shell
docker exec -it vercel-clone-mongodb mongosh -u admin -p password123 --authenticationDatabase admin vercel_clone

# Backup database
docker exec vercel-clone-mongodb mongodump --uri="mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin" --out=/tmp/backup

# View MongoDB logs
docker logs vercel-clone-mongodb
```

### Development Commands
```bash
# Backend development (with auto-restart)
cd backend
npm run dev

# Frontend development (with hot reload)
cd frontend
npm run dev

# View PM2 monitoring
pm2 monit

# Save PM2 processes (persist after reboot)
pm2 save

# Setup PM2 startup script
pm2 startup
```

---

## 🎨 MongoDB UI Screenshots Guide

### Main Dashboard
When you open http://localhost:8081:
1. You'll see a list of databases
2. Click on `vercel_clone` database
3. You'll see all collections (users, projects, etc.)

### Viewing Users
1. Click on `users` collection
2. You'll see all registered users
3. Each user shows:
   - Email, username, displayName
   - Plan type (free/pro/enterprise)
   - Resource allocation
   - Container info
   - OAuth provider
   - Signup IP
   - Status

### Viewing Projects
1. Click on `projects` collection
2. See all deployed projects
3. Each project shows:
   - Project name and slug
   - Repository URL
   - Deployment status
   - Container and port info
   - Build logs
   - Environment variables

### Running Queries
1. Click on any collection
2. Look for "Query" or "Filter" section
3. Example queries:
   ```javascript
   // Find free users
   { "planType": "free" }
   
   // Find active projects
   { "status": "running" }
   
   // Find users from specific IP
   { "signupIP": "192.168.1.1" }
   ```

---

## 🚀 What Runs Where

### On Your Local Machine (Host)
- **PM2** managing:
  - Backend API (Node.js/Express) on port 5000
  - Frontend Web App (Next.js) on port 3000

### In Docker Containers
- **MongoDB** on port 27017 (persistent data)
- **Mongo Express** on port 8081 (web UI)
- **Redis** on port 6379 (job queue)

### Network Flow
```
Browser (You)
    ↓
Frontend (localhost:3000) ← Next.js on PM2
    ↓ API calls
Backend (localhost:5000) ← Express on PM2
    ↓ Database queries
MongoDB (localhost:27017) ← Docker container
    ↓ Job queue
Redis (localhost:6379) ← Docker container
```

---

## 📋 First-Time Setup Checklist

After running `./deploy-complete.sh`:

- [ ] All 3 Docker containers running (`docker ps`)
- [ ] Both PM2 processes online (`pm2 status`)
- [ ] Frontend accessible at http://localhost:3000
- [ ] Backend API responding at http://localhost:5000/api/health
- [ ] MongoDB UI accessible at http://localhost:8081
- [ ] Configure OAuth credentials in `backend/.env`
- [ ] Create admin user (run `node backend/make-admin.js your@email.com`)
- [ ] Seed default plans (run `node backend/seeders/planSeeder.js`)
- [ ] Test user signup and login
- [ ] Test project creation

---

## 🎉 Success Indicators

After deployment completes, you should see:

```
╔════════════════════════════════════════════════════════════╗
║              DEPLOYMENT SUCCESSFUL!                        ║
╚════════════════════════════════════════════════════════════╝
✓ Platform is live!
Frontend: http://your-ip:3000
Backend:  http://your-ip:5000
DB UI:    http://your-ip:8081 (admin/password123)

Logs:   pm2 logs
Status: pm2 status
```

---

## 🔐 Security Notes

### Default Credentials (CHANGE IN PRODUCTION!)
```
MongoDB:
  Username: admin
  Password: password123

Mongo Express:
  Username: admin
  Password: password123
```

### Production Security Checklist
- [ ] Change MongoDB passwords
- [ ] Change session secret
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS/SSL
- [ ] Set secure cookie flags
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Set up backup strategy
- [ ] Configure monitoring
- [ ] Disable Mongo Express in production (or secure it)

---

## 📞 Support

If deployment fails:
1. Check logs: `pm2 logs`
2. Check Docker: `docker ps` and `docker logs <container-name>`
3. Verify ports are not in use: `sudo lsof -i :3000 :5000 :8081 :27017`
4. Check the troubleshooting section above
5. Review `PROJECT_REVIEW_BUILD_TEST.md` for known issues

---

## ✨ Summary

**One command does it all:**
```bash
./deploy-complete.sh
```

**Gets you:**
- ✅ MongoDB database (with web UI at port 8081)
- ✅ Redis job queue
- ✅ Backend API (port 5000)
- ✅ Frontend web app (port 3000)
- ✅ Everything managed by PM2
- ✅ Auto-restart on reboot (after `pm2 save`)
- ✅ Full development environment ready!

**MongoDB UI Access:**
- URL: http://localhost:8081
- Username: admin
- Password: password123
- Full database management interface
- View/edit all data visually

That's it! You're ready to develop! 🚀

