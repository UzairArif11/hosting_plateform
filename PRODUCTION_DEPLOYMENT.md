# 🌐 Production Deployment Guide - Oracle Cloud Always Free Tier

Complete guide to deploy the Vercel Clone Platform on Oracle Cloud's Always Free tier with 3-server architecture.

---

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Server Provisioning](#server-provisioning)
- [Server Setup](#server-setup)
- [Application Deployment](#application-deployment)
- [Domain & SSL Configuration](#domain--ssl-configuration)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Scaling & Optimization](#scaling--optimization)

---

## 🏗️ Architecture Overview

### 3-Server Setup

```
┌─────────────────────────────────────────────────────────────┐
│  EC1: Main API Server                                        │
│  IP: 129.154.255.90                                          │
│  Role: Backend API, Frontend, MongoDB, Admin Dashboard       │
│  Specs: 1 OCPU, 1GB RAM (Always Free)                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  EC2: Shared Container Server                                │
│  IP: 140.238.229.147                                         │
│  Role: User deployments (Free/Trial users)                   │
│  Specs: 4 OCPU, 24GB RAM (Always Free)                      │
│  Capacity: 200 containers                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  EC3: Dedicated Container Server                             │
│  IP: 129.154.255.90                                          │
│  Role: User deployments (Paid users)                         │
│  Specs: 2 OCPU, 12GB RAM (Always Free)                      │
│  Capacity: 100 containers                                    │
└─────────────────────────────────────────────────────────────┘
```

### Traffic Flow

```
User Request
    ↓
Domain (yourplatform.com)
    ↓
Cloudflare/DNS
    ↓
EC1 (Nginx Reverse Proxy)
    ↓
┌─────────────┬──────────────┐
│             │              │
Frontend    Backend API   MongoDB
(Next.js)   (Express)    (Database)
    ↓           ↓
    └───────────┴──────────→ EC2/EC3 (User Deployments)
```

---

## ✅ Prerequisites

### Oracle Cloud Account

1. **Create Oracle Cloud Account**
   - Visit: https://www.oracle.com/cloud/free/
   - Sign up for Always Free tier
   - Verify email and phone

2. **Verify Always Free Resources**
   - 2 AMD-based Compute VMs (1/8 OCPU, 1GB RAM each)
   - 4 Arm-based Ampere A1 cores (24GB RAM total)
   - 200GB Block Volume storage
   - 10TB outbound data transfer per month

### Required Tools

- SSH client (PuTTY for Windows, built-in for Linux/Mac)
- Domain name (optional but recommended)
- Git
- Basic Linux knowledge

---

## 🖥️ Server Provisioning

### Step 1: Create EC1 (Main API Server)

1. **Login to Oracle Cloud Console**
   - Go to: https://cloud.oracle.com/

2. **Create Compute Instance**
   - Navigate to: Compute → Instances
   - Click "Create Instance"

3. **Configure Instance**
   - **Name**: `vercel-clone-ec1-main`
   - **Placement**: Choose your region
   - **Image**: Ubuntu 22.04 (Canonical)
   - **Shape**: VM.Standard.E2.1.Micro (Always Free)
   - **Network**: Create new VCN or use existing
   - **SSH Keys**: Upload your public key or generate new

4. **Configure Networking**
   - **Public IP**: Assign
   - **Boot Volume**: 50GB (Always Free)

5. **Security List Rules** (Add Ingress Rules)
   ```
   Port 22   (SSH)
   Port 80   (HTTP)
   Port 443  (HTTPS)
   Port 5000 (Backend API - temporary, will use Nginx)
   Port 3000 (Frontend - temporary, will use Nginx)
   ```

### Step 2: Create EC2 (Shared Container Server)

1. **Create Compute Instance**
   - **Name**: `vercel-clone-ec2-shared`
   - **Shape**: VM.Standard.A1.Flex (Arm)
   - **OCPU**: 4
   - **Memory**: 24GB
   - **Image**: Ubuntu 22.04
   - **Network**: Same VCN as EC1

2. **Security List Rules**
   ```
   Port 22     (SSH)
   Port 80     (HTTP)
   Port 443    (HTTPS)
   Port 3000-4000 (Container ports)
   ```

### Step 3: Create EC3 (Dedicated Container Server)

1. **Create Compute Instance**
   - **Name**: `vercel-clone-ec3-dedicated`
   - **Shape**: VM.Standard.A1.Flex (Arm)
   - **OCPU**: 2
   - **Memory**: 12GB
   - **Image**: Ubuntu 22.04
   - **Network**: Same VCN as EC1

2. **Security List Rules**
   - Same as EC2

---

## 🔧 Server Setup

### EC1 Setup (Main Server)

#### 1. Connect to Server

```bash
ssh -i ~/.ssh/your-key.pem ubuntu@129.154.255.90
```

#### 2. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

#### 3. Install Node.js

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

#### 4. Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

#### 5. Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

#### 6. Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
pm2 startup
```

#### 7. Install Git

```bash
sudo apt install -y git
```

#### 8. Configure Firewall

```bash
# Allow necessary ports
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### EC2 & EC3 Setup (Container Servers)

Repeat the same steps as EC1, but skip Nginx installation (not needed for container servers).

---

## 🚀 Application Deployment

### Step 1: Clone Repository on EC1

```bash
cd /home/ubuntu
git clone https://github.com/yourusername/vercel-clone-platform.git
cd vercel-clone-platform
```

### Step 2: Configure Environment Variables

```bash
cd backend
nano .env
```

Add production configuration:

```env
# Environment
NODE_ENV=production
PORT=5000
LOG_LEVEL=info

# Frontend URL
FRONTEND_URL=https://yourplatform.com

# Database
MONGODB_URI=mongodb://admin:STRONG_PASSWORD_HERE@localhost:27017/vercel_clone?authSource=admin

# JWT Authentication
JWT_SECRET=GENERATE_STRONG_SECRET_HERE
SESSION_SECRET=GENERATE_STRONG_SECRET_HERE

# GitHub OAuth
GITHUB_CLIENT_ID=your-production-github-client-id
GITHUB_CLIENT_SECRET=your-production-github-client-secret
GITHUB_CALLBACK_URL=https://yourplatform.com/api/auth/github/callback
GITHUB_API_TOKEN=your-github-token

# Google OAuth
GOOGLE_CLIENT_ID=your-production-google-client-id
GOOGLE_CLIENT_SECRET=your-production-google-client-secret
GOOGLE_CALLBACK_URL=https://yourplatform.com/api/auth/google/callback

# Server IPs
EC1_SERVER_IP=129.154.255.90
EC2_SERVER_IP=140.238.229.147
EC3_SERVER_IP=129.154.255.90

# Email Configuration
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=support@yourplatform.com
SMTP_PASS=your-email-password

# Security
CORS_ORIGIN=https://yourplatform.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Step 3: Start Docker Services

```bash
cd /home/ubuntu/vercel-clone-platform
docker-compose up -d
```

### Step 4: Install Backend Dependencies

```bash
cd backend
npm install --production
```

### Step 5: Build Frontend

```bash
cd ../frontend
npm install
npm run build
```

### Step 6: Start Backend with PM2

```bash
cd /home/ubuntu/vercel-clone-platform/backend
pm2 start server.js --name vercel-backend
pm2 save
```

### Step 7: Start Frontend with PM2

```bash
cd /home/ubuntu/vercel-clone-platform/frontend
pm2 start npm --name vercel-frontend -- start
pm2 save
```

### Step 8: Verify Services

```bash
pm2 status
pm2 logs
```

---

## 🌐 Domain & SSL Configuration

### Step 1: Configure DNS

Point your domain to EC1's public IP:

```
A Record:
yourplatform.com → 129.154.255.90

CNAME Records:
www.yourplatform.com → yourplatform.com
api.yourplatform.com → yourplatform.com
```

### Step 2: Install Certbot (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Step 3: Obtain SSL Certificate

```bash
sudo certbot --nginx -d yourplatform.com -d www.yourplatform.com
```

### Step 4: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/vercel-clone
```

Add configuration:

```nginx
# Frontend
server {
    listen 80;
    listen [::]:80;
    server_name yourplatform.com www.yourplatform.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourplatform.com www.yourplatform.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourplatform.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourplatform.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket for real-time logs
    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
}
```

### Step 5: Enable Site and Restart Nginx

```bash
sudo ln -s /etc/nginx/sites-available/vercel-clone /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: Auto-Renew SSL Certificate

```bash
sudo certbot renew --dry-run
```

Certbot will automatically renew certificates before expiry.

---

## 📊 Monitoring & Maintenance

### PM2 Monitoring

```bash
# View logs
pm2 logs

# Monitor resources
pm2 monit

# Restart services
pm2 restart all

# View process info
pm2 info vercel-backend
```

### Docker Monitoring

```bash
# View running containers
docker ps

# View logs
docker logs vercel-clone-mongodb

# Monitor resources
docker stats
```

### System Monitoring

```bash
# Check disk usage
df -h

# Check memory usage
free -h

# Check CPU usage
top

# Check network
netstat -tuln
```

### Log Management

```bash
# Backend logs
pm2 logs vercel-backend --lines 100

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -u nginx -f
```

### Automated Backups

Create backup script:

```bash
nano /home/ubuntu/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup MongoDB
docker exec vercel-clone-mongodb mongodump -u admin -p password123 --authenticationDatabase admin -o /backup/$DATE

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /home/ubuntu/vercel-clone-platform

# Keep only last 7 days of backups
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

Make executable and schedule:

```bash
chmod +x /home/ubuntu/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
0 2 * * * /home/ubuntu/backup.sh
```

---

## 🚀 Scaling & Optimization

### Performance Optimization

1. **Enable Caching**
```bash
# Install Redis
docker run -d --name redis -p 6379:6379 redis:alpine
```

2. **Optimize Nginx**
```nginx
# Add to nginx.conf
worker_processes auto;
worker_connections 1024;
keepalive_timeout 65;
```

3. **Database Indexing**
```javascript
// Ensure indexes are created
db.users.createIndex({ email: 1 });
db.projects.createIndex({ userId: 1 });
db.deployments.createIndex({ projectId: 1 });
```

### Security Hardening

1. **Fail2Ban** (Prevent brute force)
```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

2. **UFW Firewall**
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

3. **SSH Key Only**
```bash
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart sshd
```

### Monitoring Tools

1. **Install Netdata** (Real-time monitoring)
```bash
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

Access at: http://your-ip:19999

2. **Install Glances** (System monitoring)
```bash
sudo apt install -y glances
glances
```

---

## 🔄 Deployment Updates

### Update Application

```bash
cd /home/ubuntu/vercel-clone-platform

# Pull latest changes
git pull origin main

# Update backend
cd backend
npm install --production
pm2 restart vercel-backend

# Update frontend
cd ../frontend
npm install
npm run build
pm2 restart vercel-frontend
```

### Zero-Downtime Deployment

```bash
# Use PM2 reload instead of restart
pm2 reload vercel-backend
pm2 reload vercel-frontend
```

---

## 📞 Support & Troubleshooting

### Common Issues

1. **Port Already in Use**
```bash
sudo lsof -i :5000
sudo kill -9 <PID>
```

2. **Nginx Configuration Error**
```bash
sudo nginx -t
sudo systemctl status nginx
```

3. **MongoDB Connection Issues**
```bash
docker logs vercel-clone-mongodb
docker restart vercel-clone-mongodb
```

4. **Out of Memory**
```bash
# Add swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 📝 Maintenance Checklist

### Daily
- [ ] Check PM2 status
- [ ] Review error logs
- [ ] Monitor disk space

### Weekly
- [ ] Review system logs
- [ ] Check backup status
- [ ] Update security patches

### Monthly
- [ ] Review and rotate logs
- [ ] Database optimization
- [ ] Performance review
- [ ] Security audit

---

## 🎯 Next Steps

1. **Set up CI/CD** with GitHub Actions
2. **Configure monitoring** with Prometheus/Grafana
3. **Implement CDN** with Cloudflare
4. **Set up alerting** for critical issues
5. **Create disaster recovery** plan

---

**Your platform is now live on Oracle Cloud! 🎉**

For support: support@yourplatform.com
