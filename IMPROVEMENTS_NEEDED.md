# 🎯 PLATFORM IMPROVEMENTS NEEDED

## 📋 **Issues to Fix:**

### **1. UI Issues** ⚠️
- [ ] Show all previous deployments
- [ ] Show deployment history per project
- [ ] Display live URL on project card
- [ ] Show last deployment time
- [ ] Option to delete project
- [ ] Option to change branch and redeploy
- [ ] Fix "building" status stuck on multiple projects

### **2. Build Issue** ❌
**Current Error:** `npm ci` fails when no package-lock.json

**Solution:** Fallback to `npm install` if `npm ci` fails

### **3. SSL/HTTPS** 🔐
- [ ] Add Let's Encrypt SSL certificate
- [ ] Configure Nginx for HTTPS
- [ ] Redirect HTTP → HTTPS

### **4. Project Limits** 📊
- [ ] Set max projects for free users (default: 2)
- [ ] Admin can configure limits
- [ ] Show limit in UI

### **5. Delete Project** 🗑️
- [ ] Delete from database
- [ ] Stop and remove container on EC3
- [ ] Remove from Nginx config
- [ ] Clean up Docker images

---

## 🔧 **Priority Fixes:**

### **IMMEDIATE (Fix Now):**

1. **Fix npm ci fallback**
   - Try `npm ci` first
   - If fails, use `npm install`

2. **Fix UI deployment status**
   - WebSocket updates
   - Proper state management

### **HIGH PRIORITY:**

3. **Add SSL/HTTPS**
   - Install Certbot on EC3
   - Get certificate for foodpanda.site
   - Update Nginx config

4. **Project limits**
   - Add to User model
   - Check before deployment
   - Show in UI

### **MEDIUM PRIORITY:**

5. **Delete project functionality**
   - API endpoint
   - Clean up EC3
   - Update Nginx

6. **Deployment history**
   - Show all deployments
   - Filter by project
   - Show status/URL

---

## 📝 **Implementation Plan:**

### **Step 1: Fix npm ci (NOW)**
```javascript
// In buildExecutor.js
try {
  await exec('npm ci');
} catch (error) {
  // Fallback to npm install
  await exec('npm install');
}
```

### **Step 2: Add SSL (HIGH)**
```bash
# On EC3
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d foodpanda.site
```

### **Step 3: Project Limits**
```javascript
// User model
maxProjects: { type: Number, default: 2 }

// Check before deploy
if (user.projects.length >= user.maxProjects) {
  throw new Error('Project limit reached');
}
```

### **Step 4: Delete Project**
```javascript
// API: DELETE /api/projects/:id
// 1. Stop container on EC3
// 2. Remove from Nginx
// 3. Delete from DB
// 4. Clean up images
```

---

## 🎯 **Let me fix these one by one:**

**Starting with the most critical:**
1. Fix npm ci fallback (deployment failing)
2. Add SSL for HTTPS
3. Fix UI updates
4. Add project limits
5. Add delete functionality

---

**Which should I fix first?**
