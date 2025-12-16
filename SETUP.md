# Oracle Cloud Always Free - Vercel Clone Setup 🚀

## Architecture Overview (Mixed Shared + Dedicated)

```
VM1 (Control Plane)       VM2 (Mixed Server)       VM3 (Mixed Server)
├── Backend API           ├── Container Agent      ├── Container Agent
├── MongoDB               ├── Shared Container     ├── Shared Container  
├── Admin Panel           │   (Free Users)         │   (Free Users)
└── Orchestrator          ├── Dedicated Container  ├── Dedicated Container
                          │   (Paid User-1)        │   (Paid User-3)
                          ├── Dedicated Container  ├── Dedicated Container
                          │   (Paid User-2)        │   (Paid User-4)
                          └── Port 3001            └── Port 3001
```

**Load Balancing Strategy:**
- Free users: Distributed across shared containers on VM2 and VM3
- Paid users: Dedicated containers assigned to VM2 or VM3 based on availability

## Prerequisites

### Oracle Cloud Always Free Account
- **3 VM instances** (Always Free allows up to 4 VMs)
- **Ubuntu 22.04 LTS** (recommended OS)
- **Ampere A1 Compute** or **AMD EPYC** (both work)
- **VCN with Security Groups** configured for internal communication

### VM1 (Control Plane) - 2 OCPU, 12GB RAM
- Node.js 18+, Docker, Docker Compose
- MongoDB (containerized with existing scripts)
- GitHub OAuth app, Payoneer developer account

### VM2/VM3 (Mixed Container Hosts) - 1 OCPU each, 6GB RAM each  
- Node.js 18+, Docker
- Container Agent (handles both shared and dedicated containers)
- Network access to VM1 via private subnet

## Part 1: VM1 Setup (Control Plane - Oracle Cloud)

### 1.1 Install Dependencies
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker & Docker Compose
sudo apt update
sudo apt install docker.io docker-compose -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Reboot to apply docker group changes
sudo reboot
```

### 1.2 Clone Complete Repository
```bash
# Clone the entire project
git clone https://github.com/yourusername/vercel-clone-platform.git
cd vercel-clone-platform

# Start MongoDB using our setup
chmod +x setup-mongodb.ps1
./setup-mongodb.ps1 start

# Install backend dependencies
cd backend
npm install
cp .env.example .env
```

### 1.3 Configure Environment Variables
Edit `backend/.env` with your settings:

```env
# Basic Configuration
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin

# Container Hosts (Update with actual private IPs)
FREE_SERVER_HOST=10.0.1.100    # EC2-2 private IP
PAID_SERVER_1_HOST=10.0.1.101  # EC2-3 private IP  
PAID_SERVER_2_HOST=10.0.1.102  # EC2-4 private IP (optional)

# GitHub OAuth (https://github.com/settings/developers)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://your-domain.com:5000/api/auth/github/callback

# Payoneer Integration
PAYONEER_CLIENT_ID=your-payoneer-client-id
PAYONEER_CLIENT_SECRET=your-payoneer-client-secret
PAYONEER_WEBHOOK_SECRET=your-webhook-secret

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
SESSION_SECRET=your-super-secret-session-key-change-this-in-production
```

### 1.4 Start the Backend
```bash
# From the backend directory
npm run dev

# Or for production
npm start
```

### 1.5 Verify EC2-1 Setup
```bash
# Test backend is running
curl http://localhost:5000/health

# Test MongoDB connection  
curl http://localhost:5000/api/admin/server/test

# Check MongoDB Express (if needed)
# Visit: http://your-ec2-1-ip:8081
```

## Part 2: VM2 Setup (Mixed Container Host - Shared + Dedicated)

### 2.1 Install Dependencies
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker
sudo apt update  
sudo apt install docker.io -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
sudo reboot
```

### 2.2 Setup Container Host Agent
```bash
# Create project directory
mkdir -p /opt/container-host
cd /opt/container-host

# Download only the container host agent file
curl -o container-host-agent.js https://raw.githubusercontent.com/yourusername/vercel-clone-platform/main/container-host-agent.js

# Install required dependencies
npm init -y
npm install express dockerode
```

### 2.3 Create User Workspace Docker Image
```bash
# Create workspace image directory
mkdir -p user-workspace
cd user-workspace

# Create Dockerfile
cat << 'EOF' > Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install build tools
RUN apk add --no-cache git python3 make g++

# Create directory structure
RUN mkdir -p /app/workspace /app/projects /app/.cache /app/users
RUN adduser -D -s /bin/sh appuser
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 3000 3002

# Keep container running
CMD ["tail", "-f", "/dev/null"]
EOF

# Build the image
docker build -t user-workspace:latest .
```

### 2.4 Create Shared Container for Free Users
```bash
# Create shared container for free users on this VM
docker run -d \
  --name shared-container-vm2 \
  --restart unless-stopped \
  --cpus="1" \
  --memory="2g" \
  -p 3002:3000 \
  -v shared-vm2-data:/app/users \
  user-workspace:latest

# Verify container is running
docker ps | grep shared-container-vm2

# Note: Dedicated containers for paid users will be created dynamically
# by the container agent when users upgrade to paid plans
```

### 2.5 Start Container Host Agent
```bash
# Create systemd service for auto-start
sudo tee /etc/systemd/system/container-agent.service << 'EOF'
[Unit]
Description=Container Host Agent
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/container-host
ExecStart=/usr/bin/node container-host-agent.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable container-agent
sudo systemctl start container-agent

# Check status
sudo systemctl status container-agent
```

### 2.6 Configure Oracle Cloud Security Groups
```bash
# In Oracle Cloud Console:
# 1. Go to Networking > Virtual Cloud Networks
# 2. Select your VCN > Security Lists
# 3. Add Ingress Rule:
#    - Source: VM1 private IP (e.g., 10.0.0.2/32)
#    - Destination Port: 3001
#    - Protocol: TCP
# 4. Add Egress Rule (if needed):
#    - Destination: 0.0.0.0/0
#    - All Protocols
```

## Part 3: VM3 Setup (Mixed Container Host - Shared + Dedicated)

### 3.1 Install Dependencies (Same as EC2-2)
```bash
# Install Node.js and Docker (same commands as EC2-2 step 2.1)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt update
sudo apt install docker.io -y
sudo systemctl start docker
sudo systemctl enable docker  
sudo usermod -aG docker $USER
sudo reboot
```

### 3.2 Setup Container Host Agent (Same as EC2-2)
```bash
# Same setup as EC2-2 (steps 2.2, 2.3, 2.5, 2.6)
mkdir -p /opt/container-host
cd /opt/container-host
curl -o container-host-agent.js https://raw.githubusercontent.com/yourusername/vercel-clone-platform/main/container-host-agent.js
npm init -y
npm install express dockerode

# Build user-workspace image (same as EC2-2 step 2.3)
# Start container agent service (same as EC2-2 step 2.5)
# Configure security group (same as EC2-2 step 2.6)
```

### 3.3 Create Shared Container for VM3
```bash
# VM3 also gets a shared container for load balancing free users
docker run -d \
  --name shared-container-vm3 \
  --restart unless-stopped \
  --cpus="1" \
  --memory="2g" \
  -p 3002:3000 \
  -v shared-vm3-data:/app/users \
  user-workspace:latest

# Verify container is running
docker ps | grep shared-container-vm3

# Both VM2 and VM3 handle:
# - Shared containers for free users (load balanced)
# - Dedicated containers for paid users (assigned by orchestrator)
```

## Part 4: User Workspace Docker Image

For reference, create `user-workspace/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install build tools and common dependencies
RUN apk add --no-cache git python3 make g++ curl

# Install common build tools
RUN npm install -g npm@latest

# Create directory structure  
RUN mkdir -p /app/workspace /app/projects /app/.cache /app/builds

# Create non-root user
RUN adduser -D -s /bin/sh appuser
RUN chown -R appuser:appuser /app

# Copy workspace management scripts (optional)
# COPY workspace-manager.js /app/
# COPY package.json /app/

USER appuser

EXPOSE 3000 3002

# Keep container running for shared containers
# Dedicated containers can override this  
CMD ["tail", "-f", "/dev/null"]
```

## Part 5: Testing the Complete Setup

### 5.1 Test Container Host Communication
```bash
# From VM1, test connection to mixed container hosts
curl http://10.0.0.3:3001/health  # VM2 (mixed: shared + dedicated)
curl http://10.0.0.4:3001/health  # VM3 (mixed: shared + dedicated)

# Should return: {"status":"healthy","timestamp":"...","agent":"container-host-agent"}
```

### 5.2 Test User Registration and Container Assignment
```bash
# Register a free user via API (will be assigned to shared container on VM2 or VM3)
curl -X POST http://your-vm1-public-ip:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"free@example.com","password":"password123","plan":"free"}'

# Register a paid user (will get dedicated container on VM2 or VM3)  
curl -X POST http://your-vm1-public-ip:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"paid@example.com","password":"password123","plan":"pro"}'
```

### 5.3 Monitor Container Creation
```bash
# On VM2, check shared container users
docker exec shared-container-vm2 ls -la /app/users/

# On VM3, check shared container users  
docker exec shared-container-vm3 ls -la /app/users/

# Check dedicated containers on both VM2 and VM3
docker ps | grep user-.*-container

# View container resource usage
docker stats --no-stream
```

## Part 6: Scaling (Adding More Servers)

### 6.1 Add EC2-4, EC2-5...
```bash
# Follow the same steps as EC2-3 setup
# No code changes needed - just:
# 1. Setup new EC2 instance  
# 2. Install Node.js + Docker
# 3. Run container-host-agent.js
# 4. Update EC2-1 environment variables
```

### 6.2 Update EC2-1 Environment
```env
# Add new server hosts to backend/.env
PAID_SERVER_3_HOST=10.0.1.103  # EC2-5
PAID_SERVER_4_HOST=10.0.1.104  # EC2-6
# etc.
```

### 6.3 Restart Backend
```bash
# On EC2-1, restart backend to pick up new servers
cd /path/to/vercel-clone-platform/backend
npm restart
```

## Part 7: Monitoring & Troubleshooting

### 7.1 Check System Health
```bash
# EC2-1: Check backend logs
cd backend && npm run logs

# EC2-1: Check MongoDB
./setup-mongodb.ps1 status

# EC2-2/EC2-3+: Check container agent
sudo systemctl status container-agent
sudo journalctl -u container-agent -f
```

### 7.2 Monitor Server Resources
```bash
# Get stats from all container hosts
curl http://10.0.1.100:3001/stats  # EC2-2
curl http://10.0.1.101:3001/stats  # EC2-3

# Check container resource usage
docker stats
```

### 7.3 Common Issues

**Container agent won't start:**
```bash
# Check if ports are in use
sudo netstat -tlnp | grep 3001

# Check Docker is running
sudo systemctl status docker

# Check logs
sudo journalctl -u container-agent -n 50
```

**Users not being assigned containers:**
```bash
# Check network connectivity EC2-1 -> EC2-2/3
ping 10.0.1.100  # from EC2-1

# Check security groups allow port 3001

# Check backend environment variables
grep SERVER_HOST backend/.env
```

**MongoDB connection issues:**
```bash
# Check MongoDB status
./setup-mongodb.ps1 status

# Test connection
docker exec -it vercel-clone-mongodb mongosh -u admin -p password123
```

## Summary

This setup gives you:

✅ **EC2-1**: Complete backend with frontend, API, MongoDB, and container orchestration  
✅ **EC2-2**: Shared container host for all free users (cost-effective)  
✅ **EC2-3+**: Dedicated container hosts for paid users (scalable)  
✅ **Functional Programming**: All container logic uses pure functions  
✅ **Automatic Assignment**: Users automatically get assigned to appropriate containers  
✅ **Easy Scaling**: Just add more EC2-3+ instances as needed  

**Running Commands:**
- **EC2-1**: Full backend repository + `npm run dev`
- **EC2-2/EC2-3+**: Single file + `node container-host-agent.js` (or systemd service)

Your Oracle Cloud Always Free architecture is now ready for production! 🎉

## Available Management Scripts

### MongoDB Management (VM1)
```powershell
# Windows PowerShell (if developing locally)
.\setup-mongodb.ps1 start      # Start MongoDB + Web UI
.\setup-mongodb.ps1 status     # Check container status
.\setup-mongodb.ps1 logs       # View MongoDB logs
.\setup-mongodb.ps1 shell      # Open MongoDB shell
.\setup-mongodb.ps1 stop       # Stop containers
```

```bash
# Linux (on Oracle Cloud VM1)
docker-compose up -d mongodb mongo-express
docker-compose ps
docker-compose logs mongodb
```

### Backend Management (VM1)
```bash
# From /backend directory
npm run dev                    # Development with nodemon
npm start                      # Production start
npm run pm2:start             # Start with PM2
npm run pm2:logs              # View PM2 logs
npm test                      # Run tests
```

### Container Host Deployment (VM2/VM3)
```bash
# Automated setup script (recommended)
./deploy-container-host.sh     # Run on each VM2/VM3
# Select option 1 for mixed server (shared + dedicated)
```
