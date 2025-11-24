# Vercel Clone Platform - Backend

## 🚀 Overview

A comprehensive hosting platform backend built with Node.js, featuring **zero-downtime container resource management** with complete data and deployment preservation during plan upgrades.

## 🏗️ Architecture

### 3-Server Oracle Cloud Infrastructure

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│       EC1       │  │       EC2       │  │       EC3       │
│   Main API      │  │  Mixed Server   │  │  Mixed Server   │
│   Backend       │  │  Load Balanced  │  │  Load Balanced  │
│   Admin Panel   │  │                 │  │                 │
│   Frontend      │  │ Shared + Dedicated │ Shared + Dedicated │
└─────────────────┘  └─────────────────┘  └─────────────────┘
        │                      │                      │
        │              ┌───────┴───────┐              │
        │              │               │              │
        └──────────────┼───────────────┼──────────────┘
                       │               │
                    Shared         Dedicated
                 Containers       Containers
```

## 📋 Container Allocation System

### 🆓 Free Users (Trial Plan)
- **Container Type**: **Shared**
- **Server Assignment**: EC2 or EC3 (load balanced)
- **Resources**: Limited shared resources
- **Data**: Fully preserved during upgrades

### 💰 Paid Users (Pro/Premium Plans)
- **Container Type**: **Dedicated**
- **Server Assignment**: EC2 or EC3 (load balanced)
- **Resources**: Dedicated CPU, RAM, Storage
- **Data**: **100% preserved** during plan changes

## 🔄 Plan Upgrade Process

### 1. Account Creation
```
New User Registration
         ↓
   Get Trial Plan (Free)
         ↓
   Allocate Shared Container
   (EC2 or EC3 - load balanced)
         ↓
   User can deploy projects
```

### 2. Free Trial → Paid Plan Upgrade
```
User pays for Pro/Premium Plan
         ↓
   Keep same server (EC2 or EC3)
         ↓
   Upgrade: Shared → Dedicated Container
         ↓
   🔒 DATA PRESERVATION PROCESS:
   
   Step 1: Create backup volume
   Step 2: Backup all user data
   Step 3: Create dedicated container
   Step 4: Restore data to new container
   Step 5: Update resource allocation
   
         ↓
   User now has dedicated resources
   ✅ All projects, deployments, configs intact
```

### 3. Pro → Premium Plan Upgrade
```
User upgrades from Pro to Premium
         ↓
   Stay on same server & container
         ↓
   📈 RESOURCE SCALING PROCESS:
   
   Method 1 (Preferred): In-place scaling
   - Docker update command
   - Instant resource increase
   - Zero downtime
   
   Method 2 (Fallback): Container recreation
   - Backup → Recreate → Restore
   - Complete data preservation
   
         ↓
   Higher resources allocated
   ✅ No container deletion/recreation
   ✅ All data remains intact
```

## 🛡️ Data Preservation Guarantees

### What Stays the Same:
- ✅ **All project files and code**
- ✅ **Deployment history and configurations**
- ✅ **Environment variables and secrets**
- ✅ **Domain configurations**
- ✅ **Build configurations**
- ✅ **Deployment scripts remain unchanged**
- ✅ **Database connections and configurations**
- ✅ **User preferences and settings**

### What Changes:
- ⚡ **CPU allocation increases**
- 🧠 **RAM allocation increases** 
- 💾 **Storage allocation increases**
- 🌐 **Bandwidth allocation increases**
- 🏷️ **Container type** (shared → dedicated)
- 📊 **Resource limits in database**

## 🔧 API Endpoints

### User Management
```bash
# Get current user info
GET /api/auth/me

# Scale user resources (Admin only)
POST /api/admin/users/:userId/scale-resources
{
  "resources": {
    "cpu": 2.0,
    "ram": 8,
    "storage": 100,
    "bandwidth": 2048
  }
}

# Upgrade user plan (Admin only)
POST /api/admin/users/:userId/upgrade-plan
{
  "planId": "64f123abc456def789012345"
}

# Get user container info (Admin only)
GET /api/admin/users/:userId/container
```

### Billing & Plans
```bash
# Get available plans
GET /api/billing/plans?currency=usd

# Create payment session
POST /api/billing/create-session
{
  "planId": "64f123abc456def789012345",
  "currency": "USD",
  "returnUrl": "https://yoursite.com/success",
  "cancelUrl": "https://yoursite.com/cancel"
}

# Get billing info
GET /api/billing/info
```

## 🏃‍♂️ Quick Start

### 1. Environment Setup
```bash
cp .env.example .env
# Update environment variables
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Production Deployment
```bash
npm start
# or
npm run pm2:start
```

## 📊 Resource Allocation Plans

### Trial Plan (Free)
```javascript
{
  name: "free-trial",
  containerType: "shared",
  resources: {
    cpu: 0.5,      // OCPU
    ram: 1,        // GB
    storage: 10,   // GB
    bandwidth: 100 // GB/month
  }
}
```

### Starter Plan ($9/month)
```javascript
{
  name: "starter",
  containerType: "dedicated",
  resources: {
    cpu: 1,        // OCPU
    ram: 4,        // GB
    storage: 50,   // GB
    bandwidth: 1024 // GB/month
  }
}
```

### Growth Plan ($29/month)
```javascript
{
  name: "growth",
  containerType: "dedicated",
  resources: {
    cpu: 2,        // OCPU
    ram: 12,       // GB
    storage: 100,  // GB
    bandwidth: 2048 // GB/month
  }
}
```

### Pro Plan ($59/month)
```javascript
{
  name: "pro",
  containerType: "dedicated",
  resources: {
    cpu: 3,        // OCPU
    ram: 20,       // GB
    storage: 200,  // GB
    bandwidth: 4096 // GB/month
  }
}
```

## 🐳 Container Lifecycle

### Container Naming Convention
```bash
# Shared containers
EC2-shared-user-username-timestamp
EC3-shared-user-username-timestamp

# Dedicated containers
EC2-dedicated-user-username-2cpu-8ram-timestamp
EC3-dedicated-user-username-3cpu-20ram-timestamp
```

### Data Preservation Process

#### Method 1: In-Place Resource Scaling (Preferred)
```javascript
// Uses Docker's native update command
await docker.updateContainerResources(containerName, {
  memory: newRam * 1024 * 1024, // Convert GB to bytes
  cpu: newCpu * 1024            // Convert to CPU shares
});

// ✅ Zero downtime
// ✅ Instant resource update
// ✅ No data movement
```

#### Method 2: Container Recreation with Backup (Fallback)
```javascript
// Step 1: Create backup
await docker.createDataVolume(backupVolumeName);
await docker.backupContainerData(oldContainer, backupVolume);

// Step 2: Create new container with backup mounted
await docker.runContainerWithVolumes(image, newContainer, {
  volumes: [`${backupVolume}:/app/data`],
  memory: newRam * 1024,
  cpu: newCpu
});

// Step 3: Restore data
await docker.restoreContainerData(newContainer, backupVolume);

// Step 4: Health check and cleanup
const isHealthy = await docker.getContainerStatus(newContainer);
if (isHealthy) {
  await docker.removeContainer(oldContainer);
  await docker.removeDataVolume(backupVolume);
}
```

## 🔐 Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (user/admin)
- API key support for programmatic access
- Session management with MongoDB

### Container Security
- User isolation between containers
- Resource limits enforced
- Secure volume mounting
- No cross-user data access

### Data Protection
- Encrypted backups during transitions
- Secure temporary volume cleanup
- User data isolation
- Audit logging for all operations

## 📈 Monitoring & Logging

### Container Operations
- Resource scaling events
- Data backup/restore operations
- Plan upgrade transactions
- Container health monitoring

### System Metrics
- Server utilization (EC2/EC3)
- Container capacity tracking
- Resource allocation monitoring
- Performance metrics

### Error Handling
- Automatic rollback on failures
- Comprehensive error logging
- Real-time alerts for issues
- Health check monitoring

## 🚀 Deployment Scripts

### Container Deployment Scripts **REMAIN THE SAME**
Your existing deployment scripts continue to work without any changes:

```bash
# These scripts are unchanged
./deploy-to-container.sh
./build-and-deploy.sh
./update-project.sh

# Container scaling happens transparently
# No impact on deployment workflows
```

### PM2 Process Management
```bash
# Start application
npm run pm2:start

# Monitor processes  
npm run pm2:logs

# Restart application
npm run pm2:restart

# Stop application
npm run pm2:stop
```

## 🔧 Configuration

### Environment Variables
```bash
# Server Configuration
EC1_SERVER_IP=your-main-api-server
EC2_SERVER_IP=your-mixed-server-1
EC3_SERVER_IP=your-mixed-server-2

# Resource Limits
EC2_TOTAL_CPU=4
EC2_TOTAL_RAM=24
EC2_MAX_CONTAINERS=200

EC3_TOTAL_CPU=8
EC3_TOTAL_RAM=48
EC3_MAX_CONTAINERS=300

# Database
MONGODB_URI=mongodb://localhost:27017/vercel-clone

# Payment Integration
PAYONEER_CLIENT_ID=your-payoneer-client-id
PAYONEER_CLIENT_SECRET=your-payoneer-secret

# GitHub Integration
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-secret
```

## 🛠️ Development

### Project Structure
```
backend/
├── models/           # Database models
├── routes/           # API routes
├── services/         # Business logic
│   ├── containerOrchestrator.js  # Container management
│   ├── docker.js                 # Docker operations
│   ├── payoneer.js              # Payment processing
│   └── github.js                # GitHub integration
├── middleware/       # Authentication & validation
├── utils/           # Utilities & helpers
└── server.js        # Application entry point
```

### Key Features
- **Zero-downtime upgrades** with data preservation
- **Load-balanced container allocation** across EC2/EC3
- **Seamless resource scaling** without service interruption
- **Comprehensive error handling** with automatic rollback
- **Real-time monitoring** and logging
- **Production-ready reliability** with extensive testing

## 📚 Additional Resources

### API Documentation
- Comprehensive API endpoints
- Request/response examples  
- Authentication requirements
- Error code references

### Container Management
- Resource allocation strategies
- Data preservation techniques
- Scaling methodologies
- Monitoring approaches

### Deployment Guides
- Production deployment steps
- Environment configuration
- Security best practices
- Performance optimization

---

## 🎯 Key Benefits

### For Users
- **Zero data loss** during plan upgrades
- **Seamless experience** with no downtime
- **Consistent performance** with dedicated resources
- **Preserved deployments** and configurations

### For Administrators
- **Complete control** over resource allocation
- **Safe upgrade operations** with automatic rollback
- **Comprehensive monitoring** and logging
- **Flexible resource management** without service disruption

### For System
- **Production reliability** with extensive error handling
- **Optimal resource utilization** through load balancing
- **Future-proof architecture** for additional features
- **Complete backward compatibility** with existing systems

---

**🚀 Ready for production deployment with complete data preservation guarantees!**
