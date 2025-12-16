# 🔄 REVERTING TO TRUE SHARED CONTAINER

## ✅ **YOU'RE RIGHT!**

We discussed implementing:
- **ONE shared container per server**
- **Multiple users' apps running inside it**
- **Cgroups for per-user resource isolation**

My "fix" changed this to small dedicated containers, which defeats the purpose!

---

## 🎯 **TRUE SHARED CONTAINER ARCHITECTURE:**

### **What We Need:**
```
EC3 Server
└── EC3-shared-main (ONE container)
    ├── User 1 App (isolated via cgroups)
    ├── User 2 App (isolated via cgroups)
    ├── User 3 App (isolated via cgroups)
    └── ... up to 10 users

Benefits:
✅ 88% resource savings
✅ True multi-tenancy
✅ Cgroup isolation
✅ One container, many apps
```

---

## 🔧 **HOW TO IMPLEMENT PROPERLY:**

### **1. Shared Container Setup:**
```javascript
// Create ONE nginx container with process manager
Container: EC3-shared-main
Base Image: nginx:alpine + supervisord
Purpose: Run multiple user apps as processes
Cgroups: Per-user CPU/RAM limits
```

### **2. Deploy User App:**
```javascript
// When user deploys:
1. Copy their built files into shared container
   docker cp build/ EC3-shared-main:/apps/user-123/
   
2. Start nginx process for their app
   docker exec EC3-shared-main nginx -c /apps/user-123/nginx.conf
   
3. Apply cgroup limits
   docker exec EC3-shared-main mkdir -p /sys/fs/cgroup/cpu/user-123
   docker exec EC3-shared-main echo "20000" > /sys/fs/cgroup/cpu/user-123/cpu.cfs_quota_us
   
4. Assign process to cgroup
   docker exec EC3-shared-main echo $PID > /sys/fs/cgroup/cpu/user-123/cgroup.procs
```

### **3. Port Management:**
```javascript
// Each user gets a port inside the container
User 1: localhost:3001 (inside container)
User 2: localhost:3002 (inside container)
User 3: localhost:3003 (inside container)

// Nginx on host proxies to container ports
foodpanda.site/user1-app → EC3-shared-main:3001
foodpanda.site/user2-app → EC3-shared-main:3002
```

---

## 📋 **IMPLEMENTATION PLAN:**

### **Step 1: Create Proper Shared Container**
```dockerfile
# Dockerfile for shared container
FROM nginx:alpine

# Install supervisord for process management
RUN apk add --no-cache supervisor

# Create app directories
RUN mkdir -p /apps /var/log/supervisor

# Copy supervisor config
COPY supervisord.conf /etc/supervisord.conf

# Expose port range
EXPOSE 3001-3999

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
```

### **Step 2: Deploy User App to Shared Container**
```javascript
async function deployToSharedContainer(user, project, imageName, serverKey, server) {
    // 1. Find/create shared container
    let container = await findOrCreateSharedContainer(serverKey);
    
    // 2. Extract built files from user's image
    const tempDir = `/tmp/extract-${project._id}`;
    await ssh.exec(`docker create --name temp-${project._id} ${imageName}`);
    await ssh.exec(`docker cp temp-${project._id}:/app ${tempDir}`);
    await ssh.exec(`docker rm temp-${project._id}`);
    
    // 3. Copy files into shared container
    await ssh.exec(`docker cp ${tempDir} ${container.id}:/apps/${user._id}/`);
    
    // 4. Create nginx config for this user
    const nginxConfig = generateNginxConfig(user, port);
    await ssh.exec(`docker exec ${container.id} sh -c "echo '${nginxConfig}' > /apps/${user._id}/nginx.conf"`);
    
    // 5. Start nginx process
    await ssh.exec(`docker exec ${container.id} nginx -c /apps/${user._id}/nginx.conf`);
    
    // 6. Apply cgroup limits
    await applyUserCgroupLimits(container.id, user._id, {
        cpu: 0.2,
        ram: 1228
    });
    
    // 7. Add process to cgroup
    const pid = await getNginxPid(container.id, port);
    await ssh.exec(`docker exec ${container.id} sh -c "echo ${pid} > /sys/fs/cgroup/cpu/user-${user._id}/cgroup.procs"`);
    
    return { container, port };
}
```

### **Step 3: Cgroup Isolation**
```javascript
async function applyUserCgroupLimits(containerId, userId, limits) {
    // Create cgroup directories
    await execInContainer(containerId, `mkdir -p /sys/fs/cgroup/cpu/user-${userId}`);
    await execInContainer(containerId, `mkdir -p /sys/fs/cgroup/memory/user-${userId}`);
    
    // Set CPU limit (0.2 CPU = 20% of one core)
    await execInContainer(containerId, 
        `echo ${limits.cpu * 100000} > /sys/fs/cgroup/cpu/user-${userId}/cpu.cfs_quota_us`
    );
    await execInContainer(containerId,
        `echo 100000 > /sys/fs/cgroup/cpu/user-${userId}/cpu.cfs_period_us`
    );
    
    // Set memory limit (1228 MB)
    await execInContainer(containerId,
        `echo ${limits.ram * 1024 * 1024} > /sys/fs/cgroup/memory/user-${userId}/memory.limit_in_bytes`
    );
}
```

---

## 🎯 **CHALLENGES TO SOLVE:**

### **1. Process Management**
- Need supervisord or similar to manage multiple nginx processes
- Track which process belongs to which user
- Restart processes if they crash

### **2. File Isolation**
- Each user's files in separate directory
- Prevent users from accessing each other's files
- Clean up when user deletes project

### **3. Port Management**
- Assign unique port to each user inside container
- Track port assignments
- Reuse ports when user deletes project

### **4. Cgroup Management**
- Create cgroups for each user
- Assign processes to correct cgroup
- Clean up cgroups when user leaves

---

## ⚠️ **WHY MY "FIX" WAS WRONG:**

My fix created separate containers for each user:
```
❌ User 1: Container A (0.2 CPU, 1.2 GB)
❌ User 2: Container B (0.2 CPU, 1.2 GB)
❌ User 3: Container C (0.2 CPU, 1.2 GB)

Result: 3 containers, no sharing, defeats the purpose
```

What we actually want:
```
✅ EC3-shared-main: ONE container (2 CPU, 12 GB)
   ├── User 1 process (0.2 CPU, 1.2 GB via cgroups)
   ├── User 2 process (0.2 CPU, 1.2 GB via cgroups)
   └── User 3 process (0.2 CPU, 1.2 GB via cgroups)

Result: 1 container, true sharing, 88% savings
```

---

## 🚀 **NEXT STEPS:**

1. **Revert my changes** to deployToSharedContainer
2. **Implement proper shared container** with supervisord
3. **Implement file extraction** from user's Docker image
4. **Implement process management** inside shared container
5. **Implement cgroup assignment** for processes
6. **Test with multiple users**

---

## ❓ **SHOULD I:**

1. ✅ Revert to true shared container implementation?
2. ✅ Implement supervisord-based process management?
3. ✅ Extract files from Docker images into shared container?
4. ✅ Properly assign processes to cgroups?

**Let me know and I'll implement it properly!** 🎯
