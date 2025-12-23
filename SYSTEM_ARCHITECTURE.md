# 🏗️ SYSTEM ARCHITECTURE & TECHNICAL DOCUMENTATION

## 📚 **TABLE OF CONTENTS**

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Technology Stack](#technology-stack)
4. [Core Components](#core-components)
5. [Data Flow](#data-flow)
6. [Deployment Process](#deployment-process)
7. [Domain Management](#domain-management)
8. [Container Management](#container-management)
9. [Security](#security)
10. [API Reference](#api-reference)
11. [Database Schema](#database-schema)
12. [Troubleshooting](#troubleshooting)

---

## 🎯 **SYSTEM OVERVIEW**

This is a **production-ready deployment platform** similar to Vercel/Netlify that allows users to:
- Deploy web applications from GitHub repositories
- Get unique URLs for each deployment
- Manage multiple projects
- Real-time deployment status via WebSocket
- Automatic SSL/HTTPS configuration
- Multi-server deployment (EC2, EC3, EC4, EC5)

**Key Features:**
- ✅ OAuth Authentication (Google, GitHub)
- ✅ GitHub Integration
- ✅ Automatic Framework Detection
- ✅ Docker-based Deployments
- ✅ Nginx Reverse Proxy
- ✅ Free & Paid Tiers
- ✅ Real-time Updates
- ✅ Domain Management
- ✅ Resource Limits

---

## 🏛️ **ARCHITECTURE DIAGRAM**

```
┌─────────────────────────────────────────────────────────────┐
│                    USER BROWSER                              │
│  Next.js Frontend (TypeScript + TailwindCSS)                │
│  - Dashboard, Project Management, Real-time Status          │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS/WSS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 BACKEND SERVER (Local/Cloud)                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  Express.js API Server (Node.js)                        │ │
│ │  - Authentication (Passport.js)                         │ │
│ │  - Project Management                                   │ │
│ │  - Deployment Queue (Bull + Redis)                     │ │
│ │  - WebSocket Server (Socket.IO)                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  Core Services                                          │ │
│ │  • buildExecutor - Main deployment logic               │ │
│ │  • containerOrchestrator - Container allocation        │ │
│ │  • nginxRouter - Dynamic routing configuration         │ │
│ │  • github - Repository integration                     │ │
│ │  • domainMigration - URL migration service             │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  MongoDB Database                                       │ │
│ │  • Users, Projects, Deployments, Settings              │ │
│ └─────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │ SSH
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           DEPLOYMENT SERVERS (EC2, EC3, EC4, EC5)            │
│  Oracle Cloud / AWS Ubuntu 24.04                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  Nginx (Reverse Proxy)                                  │ │
│ │  • Port 80 (HTTP) → Redirects to HTTPS                 │ │
│ │  • Port 443 (HTTPS) → Routes to containers             │ │
│ │  • Dynamic location blocks per deployment              │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  Docker Engine                                          │ │
│ │  • Container 1 (port 4357) - User A's React app        │ │
│ │  • Container 2 (port 3886) - User B's Vue app          │ │
│ │  • Container 3 (port 4958) - User C's Next.js app      │ │
│ │  • Resource limits enforced per container              │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  SSL/TLS (Let's Encrypt via Certbot)                   │ │
│ │  • Automatic certificate management                    │ │
│ │  • Auto-renewal                                        │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ **TECHNOLOGY STACK**

### **Frontend:**
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** TailwindCSS
- **State Management:** React Hooks
- **HTTP Client:** Fetch API
- **Real-time:** Socket.IO Client
- **Authentication:** JWT + Cookies

### **Backend:**
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** JavaScript
- **Database:** MongoDB (Mongoose ODM)
- **Queue:** Bull (Redis-based)
- **Real-time:** Socket.IO
- **Authentication:** Passport.js (OAuth 2.0)
- **SSH:** node-ssh
- **Docker:** dockerode

### **Infrastructure:**
- **Servers:** Oracle Cloud, AWS EC2
- **OS:** Ubuntu 24.04 LTS
- **Reverse Proxy:** Nginx
- **Containerization:** Docker
- **SSL:** Let's Encrypt (Certbot)
- **Process Manager:** PM2 (optional)

---

## 🔧 **CORE COMPONENTS**

### **1. Authentication System**

**File:** `backend/middleware/auth.js`, `backend/config/passport.js`

**Features:**
- Google OAuth 2.0
- GitHub OAuth
- Email/Password (JWT)
- API Key authentication
- Role-based access control (User, Admin)

**Flow:**
```javascript
User clicks "Sign in with Google"
  ↓
Redirected to Google OAuth consent screen
  ↓
User authorizes
  ↓
Callback to /api/auth/google/callback
  ↓
Backend receives access token
  ↓
Fetches user profile from Google
  ↓
Creates/updates user in MongoDB
  ↓
Issues JWT token
  ↓
Sets HTTP-only cookie
  ↓
Redirects to dashboard
```

**Code Reference:**
```javascript
// backend/config/passport.js
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    // Find or create user
    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
        user = await User.create({
            googleId: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName,
            provider: 'google'
        });
    }
    return done(null, user);
}));
```

---

### **2. Project Management**

**File:** `backend/routes/projects.js`, `backend/models/Project.js`

**Features:**
- Create project from GitHub repository
- Auto-detect framework
- Environment variables
- Build configuration
- Deployment history

**Database Schema:**
```javascript
{
    name: String,
    slug: String (unique),
    repository: {
        url: String,
        fullName: String,  // "username/repo"
        branch: String,
        provider: 'github'
    },
    owner: ObjectId (ref: User),
    framework: String,  // react, vue, nextjs, etc.
    buildConfig: {
        buildCommand: String,
        outputDirectory: String,
        installCommand: String
    },
    environmentVariables: [{
        key: String,
        value: String,
        isSecret: Boolean
    }],
    domains: [{
        domain: String,
        isCustom: Boolean,
        isPrimary: Boolean
    }],
    stats: {
        totalDeployments: Number,
        successfulDeployments: Number,
        failedDeployments: Number
    }
}
```

---

### **3. Deployment System**

**File:** `backend/services/buildExecutor.js`

**Process Flow:**

#### **Phase 1: Queue & Initialize**
```javascript
// User clicks "Deploy Now"
POST /api/deployments
{
    projectId: "693be90ea20f5a669456e1bd",
    branch: "main"
}

// Create deployment record
const deployment = await Deployment.create({
    projectId,
    userId,
    branch,
    status: 'queued'
});

// Add to Bull queue
await buildQueue.addDeployment(deployment._id);
```

#### **Phase 2: Clone Repository**
```javascript
// Clone with user's GitHub token
const repoUrl = project.repository.url;
const repoWithAuth = repoUrl.replace(
    'https://github.com/',
    `https://${user.githubAccessToken}@github.com/`
);

const buildPath = `/tmp/builds/${deploymentId}`;
await execAsync(`git clone --depth 1 --branch ${branch} ${repoWithAuth} ${buildPath}`);
```

#### **Phase 3: Detect Framework**
```javascript
// Read package.json
const packageJson = JSON.parse(fs.readFileSync(`${buildPath}/package.json`));
const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

// Detect framework
if (deps.next) framework = 'nextjs';
else if (deps.react) framework = 'react';
else if (deps.vue) framework = 'vue';
// ... etc
```

#### **Phase 4: Install Dependencies**
```javascript
// Detect package manager
let packageManager = 'npm';
if (fs.existsSync(`${buildPath}/yarn.lock`)) packageManager = 'yarn';
else if (fs.existsSync(`${buildPath}/pnpm-lock.yaml`)) packageManager = 'pnpm';

// Install
await execAsync(packageManager === 'npm' ? 'npm ci' : `${packageManager} install`, {
    cwd: buildPath,
    timeout: 10 * 60 * 1000  // 10 minutes
});
```

#### **Phase 5: Build Project**
```javascript
// Set environment variables
const env = {
    NODE_ENV: 'production',
    CI: 'false',
    PUBLIC_URL: '.'  // IMPORTANT: Makes React assets load from relative paths
};

// Run build
await execAsync('npm run build', {
    cwd: buildPath,
    env: { ...process.env, ...env },
    timeout: 15 * 60 * 1000  // 15 minutes
});
```

#### **Phase 6: Build Docker Image**
```javascript
// Generate Dockerfile
const dockerfile = `
FROM nginx:alpine
COPY build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;

// Build on remote server (EC3)
const imageName = `${projectName}-${deploymentId}`;
await remoteBuild.buildOnRemoteServer(buildPath, imageName, host, serverKey);
```

#### **Phase 7: Run Container**
```javascript
// Allocate container
const containerInfo = await containerOrchestrator.allocateContainer(user, plan);

// Run container with resource limits
await docker.createContainer({
    Image: imageName,
    name: containerName,
    HostConfig: {
        PortBindings: { '80/tcp': [{ HostPort: port.toString() }] },
        Memory: 512 * 1024 * 1024,  // 512MB
        NanoCpus: 500000000,        // 0.5 CPU
        RestartPolicy: { Name: 'unless-stopped' }
    }
});
```

#### **Phase 8: Update Nginx**
```javascript
// Generate unique URL path
const urlPath = `${projectName}-${deploymentId.substring(0, 8)}-${timestamp}`;

// Get domain from database
const domain = await Settings.getDomainForServer(serverKey);

// Add location block to Nginx
const locationBlock = `
location /${urlPath}/ {
    proxy_pass http://localhost:${port}/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    # ... more headers
}
`;

// Reload Nginx
await ssh.execCommand('sudo systemctl reload nginx');

// Return URL
return `https://${domain}/${urlPath}/`;
```

---

### **4. Container Orchestration**

**File:** `backend/services/containerOrchestrator.js`

**Free Tier (Shared Containers):**
```javascript
// Multiple users share one container
// Each gets a unique port
{
    containerName: 'EC3-shared-user-uzairtesta-1765779416924',
    port: 4357,
    serverKey: 'EC3',
    host: '129.154.255.90',
    resourceLimits: {
        memory: 512 * 1024 * 1024,  // 512MB
        cpu: 0.5                     // 0.5 CPU cores
    }
}
```

**Paid Tier (Dedicated Containers):**
```javascript
// Each user gets their own container
{
    containerName: 'dedicated-user-john-project-abc',
    port: 3000,
    serverKey: 'EC3',
    host: '129.154.255.90',
    resourceLimits: {
        memory: 2 * 1024 * 1024 * 1024,  // 2GB
        cpu: 2                            // 2 CPU cores
    },
    customDomain: 'myapp.com'
}
```

---

### **5. Domain Management**

**File:** `backend/models/Settings.js`, `backend/services/domainMigration.js`

**Features:**
- Database-driven domain configuration
- Admin can update domains via API
- Automatic URL migration when domain changes
- Email notifications to affected users
- Skips custom domains (paid users)

**Database Schema:**
```javascript
{
    baseDomain: 'foodpanda.site',
    serverDomains: {
        EC2: 'ec2.foodpanda.site',
        EC3: 'foodpanda.site',
        EC4: 'ec4.foodpanda.site',
        EC5: 'ec5.foodpanda.site'
    },
    sslEmail: 'admin@foodpanda.site',
    protocol: 'https',
    updatedBy: ObjectId (ref: User),
    updatedAt: Date
}
```

**Migration Flow:**
```javascript
// Admin updates domain
PUT /api/settings/domains
{
    serverDomains: {
        EC3: 'new.domain.com'
    }
}

// System automatically:
1. Finds all deployments on EC3
2. Skips deployments with custom domains
3. Updates URLs: foodpanda.site → new.domain.com
4. Groups by user
5. Sends email to each user with list of updated URLs
6. Stores migration history in deployment metadata
```

---

### **6. Real-time Updates**

**File:** `backend/services/websocket.js`

**WebSocket Events:**
```javascript
// Client connects
socket.on('join-deployment', ({ deploymentId }) => {
    socket.join(`deployment-${deploymentId}`);
});

// Server emits progress
io.to(`deployment-${deploymentId}`).emit('deployment:progress', {
    deploymentId,
    progress: 45,
    phase: 'building'
});

// Server emits logs
io.to(`deployment-${deploymentId}`).emit('deployment:log', {
    deploymentId,
    level: 'info',
    message: '✓ Build completed'
});

// Server emits completion
io.to(`deployment-${deploymentId}`).emit('deployment:success', {
    deploymentId,
    url: 'https://foodpanda.site/project-abc-123/'
});
```

---

## 📊 **DATABASE SCHEMA**

### **Users Collection:**
```javascript
{
    _id: ObjectId,
    email: String (unique),
    name: String,
    provider: String,  // 'google', 'github', 'email'
    googleId: String,
    githubId: String,
    githubAccessToken: String,  // For cloning private repos
    role: String,  // 'user', 'admin'
    plan: String,  // 'free', 'pro', 'enterprise'
    containerType: String,  // 'shared', 'dedicated'
    resourceAllocation: {
        cpu: Number,
        ram: Number,
        storage: Number
    },
    createdAt: Date,
    updatedAt: Date
}
```

### **Projects Collection:**
```javascript
{
    _id: ObjectId,
    name: String,
    slug: String (unique),
    repository: {
        url: String,
        fullName: String,
        branch: String,
        provider: String
    },
    owner: ObjectId (ref: User),
    framework: String,
    buildConfig: Object,
    environmentVariables: Array,
    domains: Array,
    stats: Object,
    createdAt: Date,
    updatedAt: Date
}
```

### **Deployments Collection:**
```javascript
{
    _id: ObjectId,
    projectId: ObjectId (ref: Project),
    userId: ObjectId (ref: User),
    branch: String,
    status: String,  // 'queued', 'building', 'deploying', 'success', 'failed'
    url: String,
    commitSha: String,
    commitMessage: String,
    framework: String,
    buildDuration: Number,
    deployDuration: Number,
    containerId: String,
    port: Number,
    serverKey: String,
    metadata: Object,
    createdAt: Date,
    updatedAt: Date
}
```

---

## 🔒 **SECURITY**

### **Authentication:**
- JWT tokens with HTTP-only cookies
- OAuth 2.0 for Google/GitHub
- API keys for programmatic access
- Session management with MongoDB store

### **Authorization:**
- Role-based access control (RBAC)
- Project ownership verification
- Admin-only endpoints protected

### **Data Protection:**
- Environment variables encrypted
- GitHub tokens stored securely
- SSL/TLS for all connections
- CORS configured

### **Container Security:**
- Resource limits enforced
- Isolated networks
- Read-only file systems where possible
- Non-root users in containers

---

## 🔍 **TROUBLESHOOTING**

### **Common Issues:**

1. **HTTPS not working:**
   - Check Oracle Cloud Security List (port 443)
   - Run `fix-ssl-https.sh` on server
   - Verify SSL certificate with `sudo certbot certificates`

2. **Deployment fails:**
   - Check build logs in deployment details
   - Verify GitHub token is valid
   - Check server disk space
   - Review container logs: `docker logs <container-id>`

3. **Container not accessible:**
   - Verify Nginx configuration: `sudo nginx -t`
   - Check container is running: `docker ps`
   - Review Nginx logs: `sudo tail -f /var/log/nginx/error.log`

---

## ✅ **CONCLUSION**

This is a **production-ready deployment platform** with:
- ✅ Complete authentication system
- ✅ GitHub integration
- ✅ Automatic deployments
- ✅ Docker containerization
- ✅ Nginx reverse proxy
- ✅ Real-time updates
- ✅ Domain management
- ✅ Resource limits
- ✅ SSL/HTTPS support

**The system is ready for production use!** 🚀
