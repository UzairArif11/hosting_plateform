# 🚀 Complete Deployment to EC2/EC3 - Implementation Guide

## 🎯 **Current Problem**

**Build happens on EC1 (local), but container needs to run on EC3 (remote)**

```
❌ Current Flow:
EC1: Build Docker image → Image exists on EC1
EC3: Try to create container → Image doesn't exist on EC3 → FAIL
```

**✅ Solution: Build on EC3 instead of EC1**

---

## 📋 **Solution Overview**

### **New Flow:**
```
1. Clone repo on EC1 ✅
2. Install deps on EC1 ✅
3. Build project on EC1 ✅
4. Copy build files to EC3 (NEW)
5. Create Dockerfile on EC3 (NEW)
6. Build Docker image on EC3 (NEW)
7. Create container on EC3 ✅
8. App is live! ✅
```

---

## 🔧 **Implementation Steps**

### **Step 1: Add SSH/SCP Support**

Install required package:
```bash
cd backend
npm install node-ssh
```

### **Step 2: Create Remote Build Service**

Create `backend/services/remoteBuild.js`:

```javascript
const { NodeSSH } = require('node-ssh');
const path = require('path');
const logger = require('../utils/logger');

const ssh = new NodeSSH();

/**
 * Copy build files to remote server and build Docker image there
 */
async function buildOnRemoteServer(buildPath, imageName, serverHost, onLog) {
    try {
        await onLog('info', `Connecting to ${serverHost} via SSH...`);
        
        // Connect to remote server
        await ssh.connect({
            host: serverHost,
            username: 'ubuntu',  // Change if different
            privateKey: process.env.SSH_PRIVATE_KEY_PATH || '/path/to/key.pem'
        });

        await onLog('info', '✓ SSH connection established');

        // Create remote directory
        const remotePath = `/tmp/builds/${path.basename(buildPath)}`;
        await ssh.execCommand(`mkdir -p ${remotePath}`);

        await onLog('info', `Copying build files to ${serverHost}...`);

        // Copy build directory to remote server
        await ssh.putDirectory(
            path.join(buildPath, 'build'),
            `${remotePath}/build`,
            {
                recursive: true,
                concurrency: 10
            }
        );

        // Copy Dockerfile
        await ssh.putFile(
            path.join(buildPath, 'Dockerfile'),
            `${remotePath}/Dockerfile`
        );

        await onLog('info', '✓ Files copied successfully');

        // Build Docker image on remote server
        await onLog('info', `Building Docker image on ${serverHost}...`);
        
        const buildResult = await ssh.execCommand(
            `cd ${remotePath} && docker build -t ${imageName} .`,
            { cwd: remotePath }
        );

        if (buildResult.code !== 0) {
            throw new Error(`Docker build failed: ${buildResult.stderr}`);
        }

        await onLog('info', '✓ Docker image built successfully on remote server');

        // Cleanup remote build directory
        await ssh.execCommand(`rm -rf ${remotePath}`);

        ssh.dispose();

        return {
            success: true,
            imageName: imageName,
            server: serverHost
        };

    } catch (error) {
        logger.error('Remote build failed:', error);
        ssh.dispose();
        throw error;
    }
}

module.exports = {
    buildOnRemoteServer
};
```

---

### **Step 3: Update buildExecutor.js**

Modify the `deployToContainer` function in `backend/services/buildExecutor.js`:

Find this section (around line 440):
```javascript
// Build Docker image
const imageName = `${project.name}-${deployment._id}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
await onLog('info', `Building Docker image: ${imageName}`);

const buildImageCmd = `docker build -t ${imageName} ${buildPath}`;
await execAsync(buildImageCmd, {
    timeout: 10 * 60 * 1000 // 10 minutes
});
```

Replace with:
```javascript
// Build Docker image ON THE REMOTE SERVER (EC2/EC3)
const imageName = `${project.name}-${deployment._id}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
await onLog('info', `Building Docker image: ${imageName}`);

const remoteBuild = require('./remoteBuild');

// Build on the same server where container will run
await remoteBuild.buildOnRemoteServer(
    buildPath,
    imageName,
    host,  // This is the EC2/EC3 host
    onLog
);

await onLog('info', `✓ Docker image built on ${host}`);
```

---

### **Step 4: Set Up SSH Keys**

#### **On EC1 (Local Windows):**

1. Generate SSH key (if you don't have one):
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/ec_deploy_key
```

2. Copy public key to EC2 and EC3:
```bash
# For EC2
ssh-copy-id -i ~/.ssh/ec_deploy_key.pub ubuntu@140.238.229.147

# For EC3
ssh-copy-id -i ~/.ssh/ec_deploy_key.pub ubuntu@129.154.255.90
```

3. Add to `.env`:
```env
SSH_PRIVATE_KEY_PATH=C:/Users/YourUser/.ssh/ec_deploy_key
```

#### **On EC2/EC3 (Linux):**

Make sure Docker is accessible without sudo:
```bash
sudo usermod -aG docker ubuntu
newgrp docker
```

---

### **Step 5: Alternative - Use Docker Registry**

If SSH is problematic, use Docker Hub or private registry:

```javascript
// After building on EC1
await execAsync(`docker tag ${imageName} yourusername/${imageName}`);
await execAsync(`docker push yourusername/${imageName}`);

// On EC3, pull the image
await ssh.execCommand(`docker pull yourusername/${imageName}`);
```

---

## 🎯 **Simpler Solution: Just Copy Build Files**

For React apps, you don't need to build Docker images at all!

### **Modified Approach:**

```javascript
async function deployToContainer(buildPath, buildOutput, deployment, project, user, onLog) {
    // ... existing code ...

    // Instead of building Docker image, just copy build files to nginx container
    
    const { NodeSSH } = require('node-ssh');
    const ssh = new NodeSSH();

    await ssh.connect({
        host: host,  // EC2 or EC3
        username: 'ubuntu',
        privateKey: process.env.SSH_PRIVATE_KEY_PATH
    });

    // Copy build files to a directory on EC3
    const remoteBuildPath = `/var/www/${containerName}`;
    await ssh.execCommand(`sudo mkdir -p ${remoteBuildPath}`);
    
    await ssh.putDirectory(
        path.join(buildPath, 'build'),
        remoteBuildPath,
        { recursive: true }
    );

    // Create nginx container with volume mount
    await docker.runContainer('nginx:alpine', containerName, {
        host: host,
        port: port,
        memory: resourceCaps.perUserCap.ram,
        cpu: resourceCaps.perUserCap.cpu,
        volumes: [`${remoteBuildPath}:/usr/share/nginx/html:ro`],
        env: [...]
    });

    ssh.dispose();
}
```

---

## 📝 **Quick Implementation Checklist**

- [ ] Install `node-ssh`: `npm install node-ssh`
- [ ] Generate SSH keys
- [ ] Copy SSH keys to EC2/EC3
- [ ] Add `SSH_PRIVATE_KEY_PATH` to `.env`
- [ ] Test SSH connection to EC2/EC3
- [ ] Create `remoteBuild.js` service
- [ ] Update `buildExecutor.js` to use remote build
- [ ] Test deployment
- [ ] Verify app is accessible on EC2/EC3

---

## 🧪 **Test Script**

Create `backend/test-remote-build.js`:

```javascript
const { NodeSSH } = require('node-ssh');

async function testSSH() {
    const ssh = new NodeSSH();
    
    try {
        console.log('Testing SSH connection to EC3...');
        
        await ssh.connect({
            host: '129.154.255.90',
            username: 'ubuntu',
            privateKey: process.env.SSH_PRIVATE_KEY_PATH
        });

        console.log('✅ SSH connected!');

        const result = await ssh.execCommand('docker --version');
        console.log('Docker version:', result.stdout);

        const images = await ssh.execCommand('docker images');
        console.log('Docker images:', images.stdout);

        ssh.dispose();
        console.log('✅ Test successful!');
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testSSH();
```

Run: `node backend/test-remote-build.js`

---

## 🎯 **Expected Result After Implementation**

```
✅ Clone repository on EC1
✅ Install dependencies on EC1
✅ Build project on EC1
✅ Copy build files to EC3 via SSH
✅ Build Docker image on EC3 (or mount files in nginx)
✅ Create container on EC3 from local image
✅ App is accessible at http://129.154.255.90:4147
✅ Deployment truly successful!
```

---

## 🚀 **Which Approach to Use?**

### **Option 1: SSH + Remote Build (Recommended)**
- ✅ Most flexible
- ✅ Works for all frameworks
- ✅ Images stay on EC2/EC3
- ❌ Requires SSH setup

### **Option 2: Volume Mount (Easiest for React)**
- ✅ Simplest for static sites
- ✅ No Docker build needed
- ✅ Fast deployments
- ❌ Only works for static sites

### **Option 3: Docker Registry**
- ✅ Standard approach
- ✅ Works everywhere
- ❌ Requires Docker Hub account
- ❌ Slower (push/pull)

---

**I recommend Option 2 (Volume Mount) for now since you're deploying React apps!**

Let me know which approach you want and I'll implement it! 🚀
