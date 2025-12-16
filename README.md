# 🚀 Vercel-Like Deployment Platform

A complete, production-ready deployment platform similar to Vercel, built with Node.js, React, and Docker. Deploy your web applications with zero configuration.

---

## ✨ **Features**

### **For Users:**
- 🚀 **One-Click Deployments** - Deploy from GitHub with a single click
- ⚡ **Real-Time Updates** - Watch your deployment progress live via WebSocket
- 🌐 **Custom Domains** - Use your own domain or get a subdomain
- 📊 **Resource Monitoring** - Track CPU, RAM, and bandwidth usage
- 🔄 **Easy Redeployments** - Redeploy with different branches
- 📈 **Deployment History** - View all past deployments

### **For Admins:**
- 👥 **User Management** - Manage all users and their resources
- 📊 **Server Statistics** - Monitor server health and capacity
- ⚙️ **Resource Control** - Adjust resources per user or project
- 🔧 **Bulk Updates** - Update all users on a plan at once
- 📈 **Analytics** - Track platform usage and performance

### **Technical Features:**
- 🐳 **Docker-Based** - Isolated containers for each deployment
- 🔒 **Secure** - HTTPS, JWT authentication, resource isolation
- 📡 **WebSocket** - Real-time deployment updates
- 🌍 **Multi-Server** - Distribute load across multiple Oracle Cloud servers
- 🆓 **Free Tier** - Limited resources for free users
- 💎 **Pro Tier** - Full resources for paid users

---

## 🏗️ **Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                        EC1 (Control)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Backend    │  │   Frontend   │  │   MongoDB    │     │
│  │  (Node.js)   │  │   (Next.js)  │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├─────────────────┬─────────────────┐
                              ▼                 ▼                 ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   EC2 (Deploy)   │  │   EC3 (Deploy)   │  │   EC4 (Deploy)   │
│                  │  │                  │  │                  │
│  User Containers │  │  User Containers │  │  User Containers │
│  ┌────┐ ┌────┐  │  │  ┌────┐ ┌────┐  │  │  ┌────┐ ┌────┐  │
│  │App1│ │App2│  │  │  │App3│ │App4│  │  │  │App5│ │App6│  │
│  └────┘ └────┘  │  │  └────┘ └────┘  │  │  └────┘ └────┘  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

## 🚀 **Quick Start**

### **Prerequisites:**
- Node.js 18+
- MongoDB
- Docker
- Oracle Cloud account (free tier)

### **1. Clone Repository**
```bash
git clone <repository-url>
cd vercel-clone-platform
```

### **2. Setup Backend**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm start
```

### **3. Setup Frontend**
```bash
cd frontend
npm install
npm run dev
```

### **4. Access Platform**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

---

## 📖 **Complete Documentation**

### **Setup Guides:**
- 📘 [Quick Start Guide](QUICK_START.md) - Get running in 5 minutes
- 🌩️ [Oracle Cloud Setup](ORACLE_CLOUD_SETUP_GUIDE.md) - Setup Oracle Cloud servers
- 🔒 [SSL Setup](setup-ssl.sh) - Automated SSL configuration
- 🆕 [New Server Setup](setup-new-server.sh) - Add EC4, EC5, etc.

### **Technical Documentation:**
- 📚 [Complete Functionality Docs](COMPLETE_FUNCTIONALITY_DOCS.md) - All features explained
- 🏗️ [System Architecture](#architecture) - How it works
- 🔧 [API Documentation](#api-endpoints) - All API endpoints
- 🧪 [Testing Guide](#testing) - How to test

### **Deployment:**
- 🚀 [Production Deployment](#production-deployment) - Deploy to production
- 🌐 [Domain Setup](#domain-setup) - Configure your domain
- 📊 [Monitoring](#monitoring) - Monitor your platform

---

## 🎯 **User Tiers**

### **Free Tier:**
```
Resources:
  - CPU: 0.2 OCPU (20% of 1 core)
  - RAM: 1.2 GB
  - Storage: 10 GB
  - Bandwidth: 100 GB/month

Features:
  - Unlimited projects
  - Real-time deployments
  - Custom domains
  - HTTPS included
```

### **Pro Tier:**
```
Resources:
  - CPU: 2 OCPU (2 full cores)
  - RAM: 4 GB
  - Storage: 50 GB
  - Bandwidth: 1 TB/month

Features:
  - Everything in Free
  - Priority support
  - Advanced analytics
  - Custom resource limits
```

---

## 🔧 **API Endpoints**

### **Authentication:**
```
POST   /api/auth/register    - Register new user
POST   /api/auth/login       - Login
GET    /api/auth/me          - Get current user
POST   /api/auth/logout      - Logout
```

### **Projects:**
```
GET    /api/projects         - List projects
POST   /api/projects         - Create project
GET    /api/projects/:id     - Get project
DELETE /api/projects/:id     - Delete project
POST   /api/projects/:id/deploy - Deploy project
```

### **Deployments:**
```
GET /api/deployments/:id/status - Get deployment status
GET /api/deployments/project/:projectId - Get project deployments
```

### **Admin:**
```
GET    /api/admin/users                    - List all users
PUT    /api/admin/users/:id/resources      - Update user resources
POST   /api/admin/users/:id/override       - Apply resource override
POST   /api/admin/plans/:id/bulk-update    - Bulk update plan
GET    /api/admin/server-stats             - Server statistics
```

---

## 🧪 **Testing**

### **Run All Tests:**
```bash
cd backend
node test-complete-system.js
```

### **Test Authentication:**
```bash
node test-auth.js
```

### **Test Specific Features:**
```bash
node test-resource-management.js
```

### **Expected Results:**
```
🎉 ALL TESTS PASSED!
Total: 9 tests
Passed: 9
Failed: 0
Success Rate: 100%
```

---

## 🌐 **Production Deployment**

### **Step 1: Setup Oracle Cloud Servers**
Follow [Oracle Cloud Setup Guide](ORACLE_CLOUD_SETUP_GUIDE.md)

### **Step 2: Configure Servers**
```bash
# Setup EC2
./setup-new-server.sh EC2 <IP> foodpanda.site

# Setup EC3
./setup-new-server.sh EC3 <IP> foodpanda.site
```

### **Step 3: Setup SSL**
```bash
./setup-ssl.sh
```

### **Step 4: Deploy Backend**
```bash
cd backend
pm2 start server.js --name backend
pm2 save
```

### **Step 5: Deploy Frontend**
```bash
cd frontend
npm run build
pm2 start npm --name frontend -- start
pm2 save
```

---

## 🛠️ **Tech Stack**

### **Backend:**
- Node.js + Express
- MongoDB + Mongoose
- Socket.IO (WebSocket)
- Docker + Dockerode
- Bull (Job Queue)
- JWT Authentication

### **Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Socket.IO Client
- Axios

### **Infrastructure:**
- Oracle Cloud (Free Tier)
- Nginx (Reverse Proxy)
- PM2 (Process Manager)
- Let's Encrypt (SSL)

---

## 📊 **Resource Management**

### **How It Works:**

1. **User Signs Up** → Assigned to server with capacity
2. **User Deploys** → Container created with resource limits
3. **Docker Enforces** → CPU and RAM limits applied
4. **Nginx Routes** → Traffic routed to correct container
5. **WebSocket Updates** → Real-time deployment progress

### **Resource Allocation:**

```javascript
Free Tier:
  Container: Small (0.2 CPU, 1.2 GB RAM)
  Enforced by: Docker limits
  
Pro Tier:
  Container: Full (2 CPU, 4 GB RAM)
  Enforced by: Docker limits
  
Admin Override:
  Temporary boost for specific users
  Auto-expires after set duration
```

---

## 🔒 **Security**

- ✅ **HTTPS Only** - All traffic encrypted
- ✅ **JWT Authentication** - Secure API access
- ✅ **Container Isolation** - Each app in own container
- ✅ **Resource Limits** - Prevent resource abuse
- ✅ **Firewall Rules** - Only necessary ports open
- ✅ **SSH Key Auth** - No password access
- ✅ **Regular Updates** - Security patches applied

---

## 📈 **Monitoring**

### **Server Statistics:**
```bash
# View server stats
curl http://localhost:5000/api/admin/server-stats
```

### **Container Status:**
```bash
# List all containers
node cleanup-containers.js --list

# Show active containers
node cleanup-containers.js --active
```

### **Logs:**
```bash
# Backend logs
pm2 logs backend

# Frontend logs
pm2 logs frontend

# Nginx logs
sudo tail -f /var/log/nginx/access.log
```

---

## 🐛 **Troubleshooting**

### **Common Issues:**

**Issue: Tests fail with 404**
```bash
# Solution: Start backend server
cd backend
npm start
```

**Issue: Can't connect to MongoDB**
```bash
# Solution: Start MongoDB
sudo systemctl start mongod
```

**Issue: Port already in use**
```bash
# Solution: Kill process or change port
lsof -ti:5000 | xargs kill -9
```

**Issue: Containers not accessible**
```bash
# Solution: Check firewall
sudo ufw status
sudo ufw allow 3000:9999/tcp
```

---

## 📝 **Scripts**

### **Setup Scripts:**
```bash
./setup-new-server.sh EC4 <IP> <domain>  # Setup new server
./setup-ssl.sh                            # Setup SSL
```

### **Test Scripts:**
```bash
node test-complete-system.js    # Full system test
node test-auth.js               # Auth test
node test-resource-management.js # Resource test
```

### **Utility Scripts:**
```bash
node cleanup-containers.js --list    # List containers
node cleanup-containers.js --active  # Show active
node cleanup-containers.js --all     # Clean all
```

---

## 🤝 **Contributing**

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📄 **License**

MIT License - See LICENSE file for details

---

## 🙏 **Acknowledgments**

- Vercel for inspiration
- Oracle Cloud for free tier
- Open source community

---

## 📞 **Support**

- 📧 Email: support@foodpanda.site
- 📚 Documentation: See docs folder
- 🐛 Issues: GitHub Issues

---

## 🎉 **Status**

```
✅ Backend:       100% Complete
✅ Frontend:      100% Complete
✅ SSL Setup:     100% Complete
✅ Tests:         100% Complete
✅ Documentation: 100% Complete

Status: PRODUCTION READY 🚀
```

---

**Built with ❤️ for developers who want their own deployment platform**
