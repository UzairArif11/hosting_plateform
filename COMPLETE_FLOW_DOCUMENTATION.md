# 🚀 DEPLOYMENT PLATFORM - COMPLETE FLOW DOCUMENTATION

## 📖 **TABLE OF CONTENTS:**

1. [System Overview](#system-overview)
2. [User Flow](#user-flow)
3. [Deployment Flow](#deployment-flow)
4. [Architecture](#architecture)
5. [Domain Management](#domain-management)
6. [Container Management](#container-management)
7. [API Reference](#api-reference)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 **SYSTEM OVERVIEW:**

This is a **Vercel-like deployment platform** that allows users to:
- Connect GitHub repositories
- Deploy web applications automatically
- Get unique URLs for each deployment
- Manage multiple projects
- Real-time deployment status

**Tech Stack:**
- **Frontend:** Next.js, TypeScript, TailwindCSS
- **Backend:** Node.js, Express, MongoDB
- **Deployment:** Docker, Nginx, Oracle Cloud/AWS
- **Real-time:** WebSocket (Socket.IO)
- **Queue:** Bull (Redis)

---

## 👤 **USER FLOW:**

### **1. Sign Up / Login**

```
User visits platform
  ↓
Clicks "Sign in with Google" or "Sign in with GitHub"
  ↓
OAuth flow (redirects to Google/GitHub)
  ↓
User authorizes
  ↓
Redirected back with access token
  ↓
Backend creates/finds user in MongoDB
  ↓
JWT token issued
  ↓
User logged in ✅
```

**Files:**
- `frontend/app/auth/page.tsx` - Login page
- `backend/routes/auth.js` - Auth endpoints
- `backend/config/passport.js` - OAuth strategies

---

### **2. Connect GitHub Repository**

```
User clicks "New Project"
  ↓
Enters GitHub repo URL (e.g., https://github.com/user/repo)
  ↓
Backend validates repo
  ↓
Fetches repo details using user's GitHub token
  ↓
Creates project in MongoDB
  ↓
Project appears in dashboard ✅
```

**Files:**
- `frontend/app/dashboard/projects/new/page.tsx` - New project form
- `backend/routes/projects.js` - Project CRUD
- `backend/services/github.js` - GitHub API integration

---

### **3. Deploy Project**

```
User clicks "Deploy Now"
  ↓
Frontend sends POST /api/deployments
  ↓
Backend creates deployment record
  ↓
Adds to deployment queue (Bull)
  ↓
Returns deployment ID
  ↓
Frontend connects to WebSocket
  ↓
Receives real-time updates
  ↓
Deployment completes
  ↓
URL displayed ✅
```

**Files:**
- `frontend/app/dashboard/projects/[id]/page.tsx` - Project page with deploy button
- `backend/routes/deployments.js` - Deployment endpoints
- `backend/services/buildQueue.js` - Queue management
- `backend/services/buildExecutor.js` - Main deployment logic

---

## 🚀 **DEPLOYMENT FLOW (DETAILED):**

### **Phase 1: Queue & Initialize**

```javascript
// 1. User clicks "Deploy Now"
POST /api/deployments
Body: { projectId, branch: 'main' }

// 2. Backend creates deployment
const deployment = await Deployment.create({
  projectId,
  userId,
  branch,
  status: 'queued'
});

// 3. Add to queue
await buildQueue.addDeployment(deployment._id);

// 4. Return to frontend
return { deploymentId, status: 'queued' };
```

**Files:**
- `backend/routes/deployments.js:30-60`
- `backend/services/buildQueue.js:20-40`

---

### **Phase 2: Clone Repository**

```javascript
// Queue worker picks up job
buildQueue.process(async (job) => {
  const deploymentId = job.data.deploymentId;
  
  // 1. Clone repository
  const buildPath = await cloneRepository(deployment, project, user);
  
  // Uses: git clone --depth 1 --branch main <repo-url>
  // Location: /tmp/builds/<deploymentId>
});
```

**What Happens:**
1. Creates temp directory: `/tmp/builds/693be90ea20f5a669456e1bd`
2. Clones repo using user's GitHub token
3. Gets commit info (SHA, message, author)
4. Saves to deployment record

**Files:**
- `backend/services/buildExecutor.js:113-175`

---

### **Phase 3: Detect Framework**

```javascript
// 2. Detect framework
const framework = await detectFramework(buildPath);

// Reads package.json
const packageJson = JSON.parse(fs.readFileSync('package.json'));
const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

// Checks dependencies
if (deps.next) return 'nextjs';
if (deps.react) return 'react';
if (deps.vue) return 'vue';
// ... etc
```

**Supported Frameworks:**
- React (Create React App, Vite)
- Next.js
- Vue.js
- Nuxt.js
- Angular
- Svelte
- Static sites
- Node.js apps

**Files:**
- `backend/services/buildExecutor.js:180-229`

---

### **Phase 4: Install Dependencies**

```javascript
// 3. Install dependencies
await installDependencies(buildPath, framework);

// Detects package manager
if (exists('yarn.lock')) packageManager = 'yarn';
else if (exists('pnpm-lock.yaml')) packageManager = 'pnpm';
else packageManager = 'npm';

// Runs install
execAsync('npm ci' || 'npm install');
```

**What Happens:**
1. Detects package manager (npm/yarn/pnpm)
2. Runs install command
3. Logs output to deployment
4. Times the installation

**Files:**
- `backend/services/buildExecutor.js:234-304`

---

### **Phase 5: Build Project**

```javascript
// 4. Build project
const buildOutput = await buildProject(buildPath, framework);

// Sets environment variables
env: {
  NODE_ENV: 'production',
  CI: 'false',
  PUBLIC_URL: '.'  // ← IMPORTANT: Makes assets load from relative paths
}

// Runs build command
execAsync('npm run build');
```

**What Happens:**
1. Writes `.env` file (if project has env vars)
2. Runs `npm run build`
3. Sets `PUBLIC_URL='.'` for React apps (fixes asset paths)
4. Measures build time and size
5. Returns output directory (`build`, `dist`, `.next`, etc.)

**Files:**
- `backend/services/buildExecutor.js:309-430`

---

### **Phase 6: Allocate Container**

```javascript
// 5. Allocate container
const containerInfo = await containerOrchestrator.allocateContainer(user, plan);

// For free users:
const sharedContainer = await allocateSharedContainer(user, serverKey);

// Returns:
{
  containerName: 'EC3-shared-user-uzairtesta-1765779416924',
  port: 4357,
  serverKey: 'EC3',
  host: '129.154.255.90'
}
```

**What Happens:**

**Free Users:**
1. Checks if user has existing shared container
2. If not, creates new shared container
3. Allocates unique port (3000-5000 range)
4. Returns container details

**Paid Users:**
1. Allocates dedicated container
2. More resources (CPU, RAM)
3. Can use custom domain

**Files:**
- `backend/services/containerOrchestrator.js:100-200`
- `backend/services/sharedContainerManager.js:50-150`

---

### **Phase 7: Build Docker Image**

```javascript
// 6. Build Docker image
const imageName = 'ss-693be90ea20f5a669456e1bd';

// Creates Dockerfile
const dockerfile = generateDockerfile(framework, outputDir);

// For React:
FROM nginx:alpine
COPY build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

// Builds on REMOTE server (EC3)
await remoteBuild.buildOnRemoteServer(buildPath, imageName, host, serverKey);
```

**What Happens:**
1. Generates Dockerfile based on framework
2. Copies build files to remote server via SSH
3. Builds Docker image on EC3 (not locally!)
4. Verifies image exists
5. Cleans up remote build directory

**Files:**
- `backend/services/buildExecutor.js:489-507`
- `backend/services/remoteBuild.js:20-100`

---

### **Phase 8: Run Container**

```javascript
// 7. Run container
const containerResult = await freeTierContainer.deployFreeTierContainer(
  user, project, imageName, serverKey, server
);

// Creates container with resource limits
docker.createContainer({
  Image: imageName,
  name: containerName,
  HostConfig: {
    PortBindings: { '80/tcp': [{ HostPort: '4357' }] },
    Memory: 512 * 1024 * 1024,  // 512MB
    NanoCpus: 500000000,        // 0.5 CPU
    RestartPolicy: { Name: 'unless-stopped' }
  }
});

// Starts container
await container.start();
```

**What Happens:**
1. Creates Docker container on EC3
2. Maps port 80 (container) → 4357 (host)
3. Sets resource limits (CPU, Memory)
4. Starts container
5. Verifies container is running

**Files:**
- `backend/services/freeTierContainer.js:50-150`
- `backend/services/docker.js:100-200`

---

### **Phase 9: Update Nginx Routing**

```javascript
// 8. Update Nginx routing
const routingResult = await nginxRouter.updateNginxRouting(
  projectName, port, host, serverKey, deploymentId
);

// Generates unique URL path
const urlPath = 'ss-693be90e-79435108';

// Gets domain from database
const domain = await Settings.getDomainForServer('EC3');
// Returns: 'foodpanda.site'

// Adds location block to Nginx config
location /ss-693be90e-79435108/ {
    proxy_pass http://localhost:4357/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    # ... more headers
}

// Reloads Nginx
ssh.execCommand('sudo systemctl reload nginx');

// Returns URL
return 'https://foodpanda.site/ss-693be90e-79435108/';
```

**What Happens:**
1. Generates unique URL path (project-deployid-timestamp)
2. Gets domain from database settings
3. Reads current Nginx config via SSH
4. Adds new location block (without nesting!)
5. Uploads new config
6. Tests config (`nginx -t`)
7. Reloads Nginx
8. Returns full URL

**Files:**
- `backend/services/nginxRouter.js:11-179`

---

### **Phase 10: Complete Deployment**

```javascript
// 9. Finalize
await deployment.updateStatus('success', {
  deploymentUrl: 'https://foodpanda.site/ss-693be90e-79435108/',
  containerId: containerName,
  port: 4357,
  serverKey: 'EC3'
});

// Cleanup build directory
await fs.rm(buildPath, { recursive: true });

// Send success to frontend via WebSocket
websocket.emit('deployment:success', {
  deploymentId,
  url: 'https://foodpanda.site/ss-693be90e-79435108/'
});
```

**What Happens:**
1. Updates deployment status to 'success'
2. Saves deployment URL
3. Cleans up local build directory
4. Sends WebSocket event to frontend
5. Frontend displays "Visit Site" button

**Files:**
- `backend/services/buildExecutor.js:72-91`
- `backend/services/websocket.js:50-100`

---

## 🏗️ **ARCHITECTURE:**

### **Component Diagram:**

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                          │
│  - Dashboard (Next.js)                                       │
│  - Real-time updates (WebSocket)                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND SERVER (Local)                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Express API                                         │   │
│  │  - /api/auth (Login, OAuth)                         │   │
│  │  - /api/projects (CRUD)                             │   │
│  │  - /api/deployments (Deploy, Status)                │   │
│  │  - /api/settings (Domain config)                    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Services                                            │   │
│  │  - buildQueue (Bull + Redis)                        │   │
│  │  - buildExecutor (Main deployment logic)            │   │
│  │  - containerOrchestrator (Allocate containers)      │   │
│  │  - nginxRouter (Update Nginx config)                │   │
│  │  - github (Fetch repos)                             │   │
│  │  - websocket (Real-time updates)                    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  MongoDB                                             │   │
│  │  - Users, Projects, Deployments, Settings           │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ SSH
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              DEPLOYMENT SERVER (EC3 - Oracle Cloud)          │
│  IP: 129.154.255.90                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Nginx (Reverse Proxy)                               │   │
│  │  - Port 80 (HTTP) ✅                                 │   │
│  │  - Port 443 (HTTPS) ⚠️                               │   │
│  │  - Routes: /project-id-timestamp/ → localhost:port  │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Docker                                              │   │
│  │  - Container 1 (port 4357) - User A's app          │   │
│  │  - Container 2 (port 3886) - User B's app          │   │
│  │  - Container 3 (port 4958) - User C's app          │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  SSL (Certbot)                                       │   │
│  │  - Certificate: /etc/letsencrypt/live/foodpanda.site│   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🌐 **DOMAIN MANAGEMENT:**

### **How Domains Work:**

```
Admin updates domain in database
  ↓
Settings.serverDomains.EC3 = 'new.domain.com'
  ↓
nginxRouter reads from database
  ↓
Uses new domain for new deployments
  ↓
Domain migration service runs
  ↓
Updates all existing deployment URLs
  ↓
Sends email to affected users
  ↓
Users get notification with new URLs
```

**Files:**
- `backend/models/Settings.js` - Domain configuration
- `backend/services/nginxRouter.js` - Uses domain from DB
- `backend/services/domainMigration.js` - Migrates URLs
- `backend/routes/settings.js` - Admin API

---

## 📦 **CONTAINER MANAGEMENT:**

### **Free Tier (Shared Containers):**

```
User A deploys → Container 1 (port 4357)
User B deploys → Container 1 (port 3886)
User C deploys → Container 1 (port 4958)

All share same container, different ports
Resource limits: 512MB RAM, 0.5 CPU per user
```

### **Paid Tier (Dedicated Containers):**

```
User D (paid) deploys → Container 2 (dedicated)
More resources: 2GB RAM, 2 CPU
Custom domain: myapp.com
```

**Files:**
- `backend/services/sharedContainerManager.js`
- `backend/services/freeTierContainer.js`
- `backend/services/containerOrchestrator.js`

---

## 🔧 **TROUBLESHOOTING:**

### **HTTPS Not Working:**

```bash
# On EC3
chmod +x fix-ssl-https.sh
sudo ./fix-ssl-https.sh

# Check Oracle Cloud Security List
# Add Ingress Rule: Port 443, Source: 0.0.0.0/0
```

### **Deployment Fails:**

```bash
# Check logs
tail -f backend/logs/app.log

# Check queue
redis-cli
> KEYS bull:*

# Check containers
ssh -i D:/work/ec3/uz.key ubuntu@129.154.255.90
docker ps
```

### **Nginx Issues:**

```bash
# On EC3
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

---

## ✅ **SUMMARY:**

**Your platform is a complete deployment system that:**
1. ✅ Authenticates users (Google, GitHub)
2. ✅ Connects to GitHub repos
3. ✅ Builds projects (React, Vue, Next.js, etc.)
4. ✅ Deploys to Docker containers
5. ✅ Generates unique URLs
6. ✅ Provides real-time updates
7. ✅ Manages domains dynamically
8. ✅ Supports free and paid tiers

**Next: Fix HTTPS and you're production-ready!** 🚀
