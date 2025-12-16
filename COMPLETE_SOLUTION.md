# ✅ COMPLETE SOLUTION - SERVER CLEANUP & SETUP

## 🎯 **WHAT'S BEEN CREATED:**

### **1. Cleanup Script** (`cleanup-server.sh`)
- Removes all containers and images
- Resets Nginx configuration
- Cleans Docker system
- Removes deployment scripts
- Prepares server for fresh setup

### **2. Setup Script** (`setup-deployment-server.sh`)
- Complete automated setup for EC4/EC5
- Installs Docker, Nginx, Node.js
- Configures firewall
- Sets up SSL (Certbot)
- Creates deployment directories
- Optimizes system for deployments

### **3. Fixed nginxRouter.js**
- Handles multiple Nginx server blocks
- Adds location to ALL server blocks with the domain
- Works with both HTTP and HTTPS
- Supports EC2, EC3, EC4, EC5

### **4. Complete Documentation**
- `SERVER_SETUP_GUIDE.md` - Full usage guide
- Step-by-step instructions
- Backend configuration changes
- Troubleshooting tips

---

## 🚀 **HOW TO USE:**

### **STEP 1: Clean EC3 (Optional)**

```bash
# Copy cleanup script
scp -i D:/work/ec3/uz.key cleanup-server.sh ubuntu@129.154.255.90:~/

# Run cleanup
ssh -i D:/work/ec3/uz.key ubuntu@129.154.255.90
chmod +x cleanup-server.sh
sudo ./cleanup-server.sh
# Type 'YES' to confirm
```

**Result:** EC3 is completely clean

---

### **STEP 2: Setup EC4 or EC5**

```bash
# Copy setup script to new server
scp -i D:/work/ec4/key.pem setup-deployment-server.sh ubuntu@<EC4_IP>:~/

# Run setup
ssh -i D:/work/ec4/key.pem ubuntu@<EC4_IP>
chmod +x setup-deployment-server.sh
sudo ./setup-deployment-server.sh

# Follow prompts:
# - Confirm setup (y)
# - Setup SSL? (y if domain is ready, n if not)
```

**Result:** EC4 is ready for deployments

---

### **STEP 3: Update Backend Code**

#### **A. Update containerOrchestrator.js**

Add EC4/EC5 to ORACLE_SERVERS:

```javascript
const ORACLE_SERVERS = {
  EC2: { host: process.env.EC2_HOST, sshKey: process.env.SSH_EC2_KEY, maxContainers: 10 },
  EC3: { host: process.env.EC3_HOST, sshKey: process.env.SSH_EC3_KEY, maxContainers: 10 },
  EC4: { host: process.env.EC4_HOST, sshKey: process.env.SSH_EC4_KEY, maxContainers: 10 },
  EC5: { host: process.env.EC5_HOST, sshKey: process.env.SSH_EC5_KEY, maxContainers: 10 }
};
```

#### **B. Update .env file**

```env
EC4_HOST=<EC4_IP>
SSH_EC4_KEY=D:/work/ec4/key.pem

EC5_HOST=<EC5_IP>
SSH_EC5_KEY=D:/work/ec5/key.pem
```

#### **C. Replace nginxRouter.js**

The fixed version has already been created at:
`backend/services/nginxRouter.js`

It now:
- Supports EC4/EC5
- Handles multiple server blocks
- Adds location to correct server blocks

#### **D. Update User.js model**

```javascript
oracleAccountId: {
  type: String,
  enum: ['EC1', 'EC2', 'EC3', 'EC4', 'EC5', null],
  default: null
}
```

---

### **STEP 4: Restart Backend**

```bash
# If using PM2
pm2 restart backend

# If using npm
# Stop current process (Ctrl+C)
npm start
```

---

### **STEP 5: Test Deployment**

1. **Go to user panel**
2. **Create a new project**
3. **Deploy the project**
4. **Check logs** - should assign to EC4 or EC5
5. **Verify URL works**

---

## 📊 **WHAT WILL HAPPEN:**

### **On Deployment:**

1. **User clicks deploy** in panel
2. **Backend receives request**
3. **Backend chooses server** (EC2/EC3/EC4/EC5 based on load)
4. **Backend SSHs to server**
5. **Backend creates Docker container**
6. **Backend updates Nginx config** (adds location block)
7. **Nginx reloads** with new routing
8. **URL is generated** and returned
9. **User can access** deployed app

### **Nginx Configuration:**

After deployment, Nginx config will look like:

```nginx
server {
    listen 80;
    server_name foodpanda.site www.foodpanda.site;
    
    # Deployment 1
    location /projectname-abc12345-67890123/ {
        proxy_pass http://localhost:3000/;
        # ... proxy headers
    }
    
    # Deployment 2
    location /anotherpro-def67890-12345678/ {
        proxy_pass http://localhost:3001/;
        # ... proxy headers
    }
    
    # More deployments...
}

server {
    listen 443 ssl;
    server_name foodpanda.site www.foodpanda.site;
    
    # Same location blocks here
    # (nginxRouter adds to ALL server blocks with the domain)
}
```

---

## ✅ **VERIFICATION CHECKLIST:**

### **After Cleanup:**
- [ ] No containers running (`docker ps`)
- [ ] No images (`docker images`)
- [ ] Nginx shows default page
- [ ] No deployment scripts in home directory

### **After Setup:**
- [ ] Docker installed (`docker --version`)
- [ ] Nginx installed (`nginx -v`)
- [ ] Firewall configured (`sudo ufw status`)
- [ ] Health check works (`curl http://<SERVER_IP>`)
- [ ] SSL ready (`certbot --version`)

### **After Backend Update:**
- [ ] EC4/EC5 in ORACLE_SERVERS
- [ ] Environment variables set
- [ ] nginxRouter.js replaced
- [ ] User model updated
- [ ] Backend restarted

### **After Test Deployment:**
- [ ] Container created on EC4/EC5
- [ ] Nginx location block added
- [ ] URL accessible
- [ ] App loads correctly

---

## 🎯 **FILES CREATED:**

```
✅ cleanup-server.sh              - Clean server completely
✅ setup-deployment-server.sh     - Setup EC4/EC5 from scratch
✅ SERVER_SETUP_GUIDE.md          - Complete usage guide
✅ backend/services/nginxRouter.js - Fixed Nginx router
```

---

## 💡 **KEY IMPROVEMENTS:**

### **Old nginxRouter.js:**
- ❌ Only updated one server block
- ❌ Didn't check which block has the domain
- ❌ Didn't handle HTTPS separately
- ❌ Only supported EC2/EC3

### **New nginxRouter.js:**
- ✅ Updates ALL server blocks with the domain
- ✅ Handles both HTTP and HTTPS
- ✅ Supports EC2/EC3/EC4/EC5
- ✅ Properly detects server blocks
- ✅ Works with SSL/non-SSL setups

---

## 🚨 **IMPORTANT NOTES:**

1. **SSL Setup:**
   - If domain is not pointing to server yet, skip SSL during setup
   - Run `sudo certbot --nginx -d foodpanda.site -d www.foodpanda.site` later

2. **Firewall:**
   - Ports 3000-5000 are opened for containers
   - Adjust if you need different port range

3. **Server Selection:**
   - Backend chooses server based on load
   - You can modify `chooseBestServerForUser()` logic

4. **Cleanup:**
   - Cleanup script is DESTRUCTIVE
   - Only use when you want to completely reset a server

---

## 📞 **SUPPORT:**

If issues occur:

1. **Check server logs:**
   ```bash
   sudo journalctl -xe
   sudo tail -f /var/log/nginx/error.log
   docker logs <container_name>
   ```

2. **Check backend logs:**
   ```bash
   pm2 logs backend
   ```

3. **Verify SSH connection:**
   ```bash
   ssh -i <key> ubuntu@<server_ip> "echo 'SSH works'"
   ```

4. **Test Nginx config:**
   ```bash
   sudo nginx -t
   ```

---

## 🎉 **SUMMARY:**

**You now have:**
- ✅ Script to clean any server
- ✅ Script to setup new servers (EC4/EC5)
- ✅ Fixed nginxRouter that works correctly
- ✅ Complete documentation
- ✅ Ready for production deployments

**Next steps:**
1. Clean EC3 (optional)
2. Setup EC4/EC5
3. Update backend code
4. Test deployment
5. Scale to more servers as needed!

---

**Everything is ready for automatic deployments from the user panel!** 🚀
