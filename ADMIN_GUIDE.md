# 👨‍💼 ADMIN GUIDE - Platform Administration

## 📚 **TABLE OF CONTENTS**

1. [Admin Access](#admin-access)
2. [Server Management](#server-management)
3. [Domain Management](#domain-management)
4. [User Management](#user-management)
5. [System Monitoring](#system-monitoring)
6. [Deployment Management](#deployment-management)
7. [Resource Management](#resource-management)
8. [Security & Backups](#security--backups)
9. [Troubleshooting](#troubleshooting)
    - [MongoDB Not Running](#mongodb-not-running)
    - [Port Conflicts](#port-conflicts)
10. [Maintenance Tasks](#maintenance-tasks)

---

## 🛠️ **TROUBLESHOOTING**

### **MongoDB Not Running**

If you see `AggregateError at internalConnectMultiple` or `❌ MongoDB connection failed`:

#### **Windows:**
```powershell
# Open PowerShell as Administrator
net start MongoDB
```

#### **Linux (Ubuntu):**
```bash
sudo systemctl start mongod
sudo systemctl status mongod
```

#### **Verification:**
Try connecting with the mongo shell: `mongosh`

---



## 🔐 **ADMIN ACCESS**

### **Becoming an Admin**

**Method 1: Using Script**
```bash
cd backend
node make-admin.js <user-email>
```

**Method 2: MongoDB Direct**
```javascript
// Connect to MongoDB
use vercel_clone

// Update user role
db.users.updateOne(
    { email: "admin@example.com" },
    { $set: { role: "admin" } }
)
```

### **Verifying Admin Access**

```bash
# Check user role
node check-user.js admin@example.com
```

**Expected output:**
```
User: admin@example.com
Role: admin ✅
```

---

## 🖥️ **SERVER MANAGEMENT**

### **Adding a New Server**

#### **Step 1: Provision Server**

**Requirements:**
- Ubuntu 24.04 LTS
- Minimum 2GB RAM
- 20GB+ disk space
- Public IP address
- SSH access

#### **Step 2: Configure DNS**

Add A record for your subdomain:
```
Type: A
Name: ec4
Value: <server-ip>
TTL: 3600
```

**Result:** `ec4.foodpanda.site` → `<server-ip>`

#### **Step 3: Run Setup Script**

```bash
# Copy script to server
scp -i /path/to/key.pem setup-deployment-server.sh ubuntu@<server-ip>:~/

# SSH to server
ssh -i /path/to/key.pem ubuntu@<server-ip>

# Run setup
chmod +x setup-deployment-server.sh
sudo ./setup-deployment-server.sh

# When prompted:
Enter domain name: ec4.foodpanda.site
Enter SSL email: admin@foodpanda.site
Continue? y
```

**The script will:**
1. ✅ Update system packages
2. ✅ Install Docker
3. ✅ Install Nginx
4. ✅ Configure firewall
5. ✅ Setup SSL certificate
6. ✅ Create deployment directories
7. ✅ Install Node.js
8. ✅ Optimize system settings

#### **Step 4: Update Backend Configuration**

Add server to `.env`:
```env
# EC4 Configuration
EC4_HOST=<server-ip>
SSH_EC4_KEY=D:/work/ec4/key.pem
SSH_USERNAME=ubuntu
```

#### **Step 5: Update Domain Settings**

```bash
# Via API
curl -X PUT http://localhost:5000/api/settings/domains \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "serverDomains": {
      "EC2": "ec2.foodpanda.site",
      "EC3": "foodpanda.site",
      "EC4": "ec4.foodpanda.site"
    }
  }'
```

#### **Step 6: Verify Server**

```bash
# Run verification script
./verify-server-ready.sh
```

**Expected output:**
```
✓ Docker installed
✓ Nginx installed
✓ SSL certificate configured
✓ HTTP accessible
✓ HTTPS accessible
✓ Deployment directories created
✓ Node.js installed
✅ Server ready for deployments!
```

---

## 🌐 **DOMAIN MANAGEMENT**

### **Viewing Current Configuration**

```bash
# Via API
curl http://localhost:5000/api/settings \
  -H "Authorization: Bearer <admin-token>"
```

**Response:**
```json
{
  "baseDomain": "foodpanda.site",
  "serverDomains": {
    "EC2": "ec2.foodpanda.site",
    "EC3": "foodpanda.site",
    "EC4": "ec4.foodpanda.site"
  },
  "sslEmail": "admin@foodpanda.site",
  "protocol": "https"
}
```

### **Updating Domains - Automatic Migration (Recommended)**

**Complete migration updates:**
- ✅ Database (deployment URLs)
- ✅ Server Nginx configuration
- ✅ SSL certificates
- ✅ User notifications

```bash
curl -X PUT http://localhost:5000/api/settings/domains \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "serverDomains": {
      "EC2": "ec2.newdomain.com",
      "EC3": "newdomain.com",
      "EC4": "ec4.newdomain.com"
    },
    "updateServerConfig": true
  }'
```

**Response:**
```json
{
  "message": "Domain configuration updated successfully. Database, server configuration, and SSL certificates are being updated. Users will be notified.",
  "migrationStarted": true,
  "migrationType": "complete"
}
```

**What happens automatically:**
1. ✅ Database updated (deployment URLs)
2. ✅ SSH to each server
3. ✅ Nginx config backed up
4. ✅ Nginx server_name updated
5. ✅ Nginx tested and reloaded
6. ✅ SSL certificates updated (certbot)
7. ✅ Email sent to affected users
8. ✅ Custom domains (paid users) skipped

### **Updating Domains - Manual Migration**

**Database-only migration (requires manual server update):**

```bash
curl -X PUT http://localhost:5000/api/settings/domains \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "serverDomains": {
      "EC3": "newdomain.com"
    },
    "updateServerConfig": false
  }'
```

**Response:**
```json
{
  "message": "Domain configuration updated successfully. Database is being updated and users will be notified. Server configuration must be updated manually.",
  "migrationStarted": true,
  "migrationType": "database-only",
  "manualSteps": [
    "SSH to each server",
    "Update /etc/nginx/sites-available/default",
    "Run: sudo nginx -t",
    "Run: sudo systemctl reload nginx",
    "Run: sudo certbot --nginx -d <new-domain>"
  ]
}
```

**Then manually update server:**

```bash
# 1. SSH to server
ssh -i D:/work/ec3/uz.key ubuntu@129.154.255.90

# 2. Backup Nginx config
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup

# 3. Update server_name
sudo sed -i 's/foodpanda.site/newdomain.com/g' /etc/nginx/sites-available/default

# 4. Test and reload
sudo nginx -t && sudo systemctl reload nginx

# 5. Update SSL
sudo certbot --nginx -d newdomain.com -d www.newdomain.com
```

### **Domain Migration Process**

**Automatic Migration Flow:**
```
Admin updates domain via API
  ↓
System automatically:
1. Updates database (deployment URLs)
2. SSH to server
3. Backs up Nginx config
4. Updates Nginx server_name
5. Tests Nginx config
6. Reloads Nginx
7. Updates SSL certificate
8. Sends email to users
  ↓
Complete! New domain works immediately
```

**Manual Migration Flow:**
```
Admin updates domain via API (updateServerConfig: false)
  ↓
System updates:
1. Database (deployment URLs)
2. Sends email to users
  ↓
Admin must manually:
3. SSH to server
4. Update Nginx config
5. Reload Nginx
6. Update SSL certificate
```

**See DOMAIN_MIGRATION_COMPLETE_GUIDE.md for detailed instructions.**

---

## 👥 **USER MANAGEMENT**

### **Viewing All Users**

```javascript
// MongoDB
use vercel_clone
db.users.find({}, { email: 1, role: 1, plan: 1, createdAt: 1 })
```

### **Making a User Admin**

```bash
cd backend
node make-admin.js user@example.com
```

### **Changing User Plan**

```javascript
// MongoDB
db.users.updateOne(
    { email: "user@example.com" },
    { 
        $set: { 
            plan: "pro",
            containerType: "dedicated",
            resourceAllocation: {
                cpu: 2,
                ram: 2048,
                storage: 50
            }
        } 
    }
)
```

### **Deleting a User**

```bash
# WARNING: This will delete all user's projects and deployments
node delete-user.js user@example.com
```

### **Viewing User Activity**

```javascript
// Get user's projects
db.projects.find({ owner: ObjectId("user-id") })

// Get user's deployments
db.deployments.find({ userId: ObjectId("user-id") })
  .sort({ createdAt: -1 })
  .limit(10)
```

---

## 📊 **SYSTEM MONITORING**

### **Server Health Check**

```bash
# On each server
ssh -i /path/to/key.pem ubuntu@<server-ip>

# Check system resources
htop

# Check disk space
df -h

# Check Docker containers
docker ps

# Check Nginx status
sudo systemctl status nginx

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### **Deployment Statistics**

```javascript
// MongoDB
use vercel_clone

// Total deployments
db.deployments.count()

// Successful deployments
db.deployments.count({ status: "success" })

// Failed deployments
db.deployments.count({ status: "failed" })

// Deployments by framework
db.deployments.aggregate([
    { $group: { _id: "$framework", count: { $sum: 1 } } }
])

// Average build time
db.deployments.aggregate([
    { $match: { status: "success" } },
    { $group: { _id: null, avgBuildTime: { $avg: "$buildDuration" } } }
])
```

### **Detailed Container Monitoring**

Use these commands on the deployment servers to monitor user resource usage more granularly.

#### **Check All User Containers Storage**
```bash
# List all containers with their storage usage
docker ps --filter "name=EC3-user-" --format "{{.Names}}" | while read name; do
  storage=$(docker exec $name du -sh /app 2>/dev/null | cut -f1)
  echo "$name: $storage"
done
```

#### **Live Stats (CPU, RAM, Storage)**
```bash
# Formatted overview
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Real-time monitoring (refreshes every 2s)
watch -n 2 'docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"'
```

#### **Resource Alerts via CLI**
```bash
# Find containers over 2GB
docker ps --filter "name=EC3-user-" -q | while read id; do
  size=$(docker exec $id du -sk /app 2>/dev/null | awk '{print $1}')
  if [ $size -gt 2097152 ]; then  # 2GB in KB
    name=$(docker inspect $id --format '{{.Name}}')
    echo "⚠️ ALERT: $name using $(($size/1024))MB (>2GB)"
  fi
done

# Find containers over 90% RAM
docker stats --no-stream --format "{{.Name}}\t{{.MemPerc}}" | awk '$2 > 90 {print "⚠️ RAM ALERT:", $1, $2}'
```

---


---

## 🚀 **DEPLOYMENT MANAGEMENT**

### **Viewing All Deployments**

```javascript
// MongoDB
db.deployments.find()
  .sort({ createdAt: -1 })
  .limit(20)
```

### **Canceling a Deployment**

```javascript
// Update deployment status
db.deployments.updateOne(
    { _id: ObjectId("deployment-id") },
    { $set: { status: "cancelled" } }
)

// Stop container if running
// SSH to server and run:
docker stop <container-id>
docker rm <container-id>
```

### **Cleaning Up Failed Deployments**

```bash
# On server
cd backend
node cleanup-containers.js
```

**This will:**
1. ✅ Find orphaned containers
2. ✅ Stop and remove them
3. ✅ Clean up Docker images
4. ✅ Free up disk space

---

## 💾 **RESOURCE MANAGEMENT**

### **Setting Resource Limits**

**For Free Users:**
```javascript
// backend/services/freeTierContainer.js
const FREE_TIER_LIMITS = {
    memory: 512 * 1024 * 1024,  // 512MB
    cpu: 0.5,                    // 0.5 CPU cores
    maxContainers: 1
};
```

**For Paid Users:**
```javascript
// Update user's resource allocation
db.users.updateOne(
    { email: "user@example.com" },
    { 
        $set: { 
            resourceAllocation: {
                cpu: 4,
                ram: 4096,
                storage: 100
            }
        } 
    }
)
```

### **Monitoring Resource Usage**

```bash
# On server
docker stats --no-stream

# Output:
CONTAINER ID   CPU %   MEM USAGE / LIMIT     MEM %
abc123         0.50%   256MiB / 512MiB      50.00%
def456         1.20%   512MiB / 2048MiB     25.00%
```

### **Cleaning Up Resources**

```bash
# Remove unused Docker images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune

# Full cleanup
docker system prune -a --volumes
```

---

## 🔒 **SECURITY & BACKUPS**

### **SSL Certificate Management**

```bash
# On server
# Check certificates
sudo certbot certificates

# Renew certificates (automatic)
sudo certbot renew

# Force renewal
sudo certbot renew --force-renewal

# Test renewal
sudo certbot renew --dry-run
```

### **Database Backups**

```bash
# Backup MongoDB
mongodump --uri="mongodb://localhost:27017/vercel_clone" --out=/backup/$(date +%Y%m%d)

# Restore MongoDB
mongorestore --uri="mongodb://localhost:27017/vercel_clone" /backup/20251215
```

### **Automated Backups**

Create a cron job:
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * mongodump --uri="mongodb://localhost:27017/vercel_clone" --out=/backup/$(date +\%Y\%m\%d)

# Add weekly cleanup (keep last 7 days)
0 3 * * 0 find /backup -type d -mtime +7 -exec rm -rf {} \;
```

### **Security Audit**

```bash
# Check for security updates
sudo apt update
sudo apt list --upgradable

# Update system
sudo apt upgrade -y

# Check firewall
sudo ufw status

# Check open ports
sudo netstat -tlnp

# Check SSH configuration
sudo cat /etc/ssh/sshd_config | grep PermitRootLogin
# Should be: PermitRootLogin no
```

---

## 🔧 **TROUBLESHOOTING**

### **HTTPS Not Working**

```bash
# On server
sudo ./fix-ssl-https.sh

# Enter domain when prompted
# Then check Oracle Cloud Security List:
# Add Ingress Rule: Port 443, Source: 0.0.0.0/0
```

### **Deployment Stuck**

```bash
# Check queue
redis-cli
> KEYS bull:*
> LLEN bull:deployment:waiting

# Clear stuck jobs
> DEL bull:deployment:waiting
> DEL bull:deployment:active
```

### **Container Not Starting**

```bash
# On server
# Check container logs
docker logs <container-id>

# Check Docker daemon
sudo systemctl status docker

# Restart Docker
sudo systemctl restart docker
```

### **Nginx Configuration Error**

```bash
# On server
# Test configuration
sudo nginx -t

# View configuration
sudo cat /etc/nginx/sites-available/default

# Reload Nginx
sudo systemctl reload nginx

# Check logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🛠️ **MAINTENANCE TASKS**

### **Daily Tasks**

1. **Check System Health**
   ```bash
   # Check all servers
   ./check-servers.sh
   ```

2. **Review Failed Deployments**
   ```javascript
   db.deployments.find({ status: "failed", createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) } })
   ```

3. **Monitor Disk Space**
   ```bash
   df -h
   # Alert if > 80% full
   ```

### **Weekly Tasks**

1. **Clean Up Containers**
   ```bash
   node cleanup-containers.js
   ```

2. **Review Resource Usage**
   ```bash
   docker stats --no-stream
   ```

3. **Check SSL Certificates**
   ```bash
   sudo certbot certificates
   ```

4. **Database Backup**
   ```bash
   mongodump --out=/backup/weekly
   ```

### **Monthly Tasks**

1. **System Updates**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Security Audit**
   ```bash
   sudo apt list --upgradable
   sudo ufw status
   ```

3. **Performance Review**
   - Average build times
   - Deployment success rate
   - Resource utilization

4. **User Cleanup**
   - Remove inactive users
   - Archive old deployments

---

## 📈 **ANALYTICS & REPORTING**

### **Deployment Statistics**

```javascript
// Last 30 days
const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000);

// Total deployments
db.deployments.count({ createdAt: { $gte: thirtyDaysAgo } })

// Success rate
const total = db.deployments.count({ createdAt: { $gte: thirtyDaysAgo } });
const successful = db.deployments.count({ 
    status: "success", 
    createdAt: { $gte: thirtyDaysAgo } 
});
const successRate = (successful / total * 100).toFixed(2);

// Average build time
db.deployments.aggregate([
    { $match: { status: "success", createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: null, avgBuildTime: { $avg: "$buildDuration" } } }
])

// Most popular frameworks
db.deployments.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: "$framework", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
])
```

### **User Statistics**

```javascript
// Total users
db.users.count()

// Active users (deployed in last 30 days)
db.deployments.distinct("userId", { createdAt: { $gte: thirtyDaysAgo } }).length

// Users by plan
db.users.aggregate([
    { $group: { _id: "$plan", count: { $sum: 1 } } }
])
```

---

## ✅ **ADMIN CHECKLIST**

### **New Server Setup:**
- [ ] Provision server
- [ ] Configure DNS
- [ ] Run setup script
- [ ] Update backend .env
- [ ] Update domain settings
- [ ] Verify server ready
- [ ] Test deployment

### **Domain Change:**
- [ ] Update DNS records
- [ ] Update domain settings via API
- [ ] Verify migration completed
- [ ] Check user emails sent
- [ ] Test new URLs

### **User Management:**
- [ ] Review user activity
- [ ] Update plans as needed
- [ ] Handle support requests
- [ ] Monitor resource usage

### **System Maintenance:**
- [ ] Daily health checks
- [ ] Weekly cleanup
- [ ] Monthly updates
- [ ] Quarterly security audit

---

## 🎯 **CONCLUSION**

As an admin, you have complete control over:
- ✅ Server infrastructure
- ✅ Domain configuration
- ✅ User management
- ✅ Resource allocation
- ✅ System monitoring
- ✅ Security & backups

**Keep the platform running smoothly!** 🚀

---

## 📞 **SUPPORT**

- **Technical Documentation:** See SYSTEM_ARCHITECTURE.md
- **User Guide:** See USER_GUIDE.md
- **Emergency Contact:** [Your contact info]
