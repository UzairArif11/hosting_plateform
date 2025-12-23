# 🚀 Platform - Quick Reference

**Version:** 2.0 | **Last Updated:** 2025-12-18

---

## 📖 **READ THIS FIRST**

**Main Documentation:** `PLATFORM_ARCHITECTURE.md`

This file contains **EVERYTHING** you need to know about the platform architecture.

---

## ⚡ **QUICK FACTS**

### **Container Architecture:**
- ✅ **ONE container per user** (not per project)
- ✅ **Resources from plan** (Free: 1GB/0.5CPU, Pro: 8GB/2CPU)
- ✅ **Projects = PM2 processes** inside container
- ✅ **Resources shared dynamically**

### **IP Restrictions:**
- ✅ **Limit: 3 free accounts per IP**
- ✅ **4th+ account can signup but can't create projects**
- ✅ **Paid accounts exempt**
- ✅ **Tracks ALL accounts** (including deleted)

### **Routing:**
- ✅ **Port-based** (not container-based)
- ✅ **Each project gets unique port**
- ✅ **Nginx proxies to port**

---

## 🔧 **KEY FILES**

### **Services:**
```
backend/services/
├── containerOrchestrator.js    # Container allocation
├── freeTierContainer.js        # Project deployment
├── buildExecutor.js            # Build pipeline
├── ipRestrictions.js           # IP restrictions
└── nginxRouter.js              # Domain routing
```

### **Routes:**
```
backend/routes/
├── auth.js                     # Signup (IP tracking)
├── projects.js                 # Project creation (IP check)
└── ipRestrictions.js           # Admin IP management
```

### **Models:**
```
backend/models/
├── User.js                     # signupIP, containerName
├── Project.js                  # port, containerName
├── Settings.js                 # ipRestrictions config
└── Plan.js                     # resources, maxProjects
```

---

## 📊 **FLOW DIAGRAMS**

### **User Signup:**
```
1. User signs up → Check email
2. Create account → Track IP
3. Allocate container → Save to user
4. ✅ User can login
```

### **Project Creation:**
```
1. User creates project → Check IP restrictions
2. If allowed → Build project
3. Get user's container → Deploy as PM2 process
4. Configure Nginx → Add location block
5. ✅ Project accessible
```

### **IP Restriction:**
```
1. Count free accounts from IP
2. If > 3 → Block project creation
3. Show upgrade message
4. Paid accounts → Always allowed
```

---

## 🎯 **EXAMPLES**

### **User Container:**
```
Container: EC2-user-john-1234567890
Resources: 1GB RAM, 0.5 CPU

Process 1: My Blog → Port 3001
Process 2: My Shop → Port 3002
Process 3: My App → Port 3003

All share 1GB RAM, 0.5 CPU
```

### **Nginx Routing:**
```nginx
location /myblog-abc123/ {
    proxy_pass http://localhost:3001/;
}

location /myshop-def456/ {
    proxy_pass http://localhost:3002/;
}
```

---

## ⚙️ **ADMIN CONTROLS**

### **Plans:**
- Set max projects
- Set resources (CPU, RAM, Storage)
- Set price

### **IP Restrictions:**
- Enable/disable
- Set max free accounts per IP
- Block deleted emails
- Exempt paid accounts

---

## 🔍 **DEBUGGING**

### **Check User Container:**
```javascript
const user = await User.findById(userId);
console.log('Container:', user.containerName);
console.log('Server:', user.assignedServer);
console.log('Resources:', user.resourceAllocation);
```

### **Check IP Restrictions:**
```javascript
const ipRestrictions = require('./services/ipRestrictions');
const check = await ipRestrictions.canUseFreeResources(ipAddress, userId);
console.log('Allowed:', check.allowed);
console.log('Reason:', check.reason);
```

### **List Projects in Container:**
```javascript
const freeTierContainer = require('./services/freeTierContainer');
const projects = await freeTierContainer.listProjectsInUserContainer(containerName, host);
console.log('Projects:', projects);
```

---

## 📚 **DOCUMENTATION**

- **Architecture:** `PLATFORM_ARCHITECTURE.md` (Read This First)
- **User Guide:** `USER_GUIDE.md`
- **Admin Guide:** `ADMIN_GUIDE.md`
- **Quick Start:** `QUICK_START_GUIDE.md`
- **Testing:** `TESTING_GUIDE.md`
- **Specific Guides:**
  - `DOMAIN_MIGRATION_COMPLETE_GUIDE.md`
  - `ADMIN_PANEL_SERVER_DNS_GUIDE.md`

---

## ✅ **CHECKLIST FOR NEW DEVELOPERS**

- [ ] Read `PLATFORM_ARCHITECTURE.md`
- [ ] Understand container architecture (ONE per user)
- [ ] Understand IP restrictions (3 free accounts per IP)
- [ ] Understand routing (port-based)
- [ ] Review key files (containerOrchestrator, freeTierContainer, ipRestrictions)
- [ ] Test locally
- [ ] Review admin controls

---

**EVERYTHING YOU NEED IS IN `PLATFORM_ARCHITECTURE.md`!** 📖✨


cleans previous config and containers 

rm cleanup-server.sh
vim cleanup-server.sh
chmod +x cleanup-server.sh
./cleanup-server.sh  
╔══════════════════════════════════════════════════════════

clean setup of config 


rm setup-deployment-server.sh
vim setup-deployment-server.sh
chmod +x setup-deployment-server.sh
./setup-deployment-server.sh  
╔══════════════════════════════════════════════════════════

# Create and run fix script
vim fix-ssl-now.sh
# Paste the content
chmod +x fix-ssl-now.sh
sudo ./fix-ssl-now.sh
══════════════════════════════════════════════



node reset-db.js
node make-admin.js user@example.com