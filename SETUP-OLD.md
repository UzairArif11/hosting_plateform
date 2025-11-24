# Multi-Server Container Orchestration Setup 🚀

## Architecture Overview

```
EC2-1 (Control Plane)     EC2-2 (Free Users)      EC2-3+ (Paid Users)
├── Frontend (React)      ├── Container Agent     ├── Container Agent
├── Backend API           ├── Shared Container    ├── Dedicated Containers
├── MongoDB               │   (All Free Users)    │   ├── User-1 Container
└── Container Manager     └── Port 3001           │   ├── User-2 Container
                                                  │   └── User-N Container
                                                  └── Port 3001
```

## Prerequisites

### EC2-1 (Control Plane)
- Node.js 18+
- Docker & Docker Compose
- MongoDB (local or Atlas)
- GitHub OAuth app
- Payoneer developer account

### EC2-2/EC2-3+ (Container Hosts)
- Node.js 18+
- Docker
- Network access to EC2-1

## 1. EC2-1 Setup (Control Plane)

### Install Dependencies:
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker
sudo apt update
sudo apt install docker.io docker-compose -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

### Setup Complete Repository:
```bash
# Clone the complete repository
git clone https://github.com/yourusername/vercel-clone-platform.git
cd vercel-clone-platform

# Start MongoDB
./setup-mongodb.ps1 start  # or ./mongodb-start.bat

# Setup backend
cd backend
npm install
cp .env.example .env
```

### Configure Environment (.env):

### Clone and install:
```bash
git clone https://github.com/yourusername/vercel-clone-platform.git
cd vercel-clone-platform/backend
npm install
```

### Configure environment:
```bash
cp .env.example .env
```

### Edit `.env` file with your settings:
```env
# Basic settings
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/vercel-clone

# GitHub OAuth (create at: https://github.com/settings/developers)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Payoneer (create at: https://payoneer.com/solutions/developers)
PAYONEER_CLIENT_ID=your-payoneer-client-id
PAYONEER_CLIENT_SECRET=your-payoneer-client-secret
PAYONEER_WEBHOOK_SECRET=your-webhook-secret

# Oracle Server (your server details)
ORACLE_SERVER_IP=123.456.789.10  # Your Oracle server public IP
ORACLE_TOTAL_CPU=4               # Your server's CPU cores
ORACLE_TOTAL_RAM=24              # Your server's RAM in GB
ORACLE_MAX_CONTAINERS=50         # Max containers to allow
```

## 3. Start Services

### Start MongoDB:
```bash
# Using Docker (recommended)
docker run -d -p 27017:27017 --name mongodb mongo:5

# Or install locally
# Follow MongoDB installation guide for your OS
```

### Start the backend:
```bash
npm run dev
```

## 4. Test Your Setup

### Test server connection:
```bash
curl http://localhost:5000/api/admin/server/test
```

Should return:
```json
{
  "success": true,
  "server": "123.456.789.10",
  "message": "Server connection successful"
}
```

### Test resource status:
```bash
curl http://localhost:5000/api/admin/resources/status
```

Should return server resources and usage.

## 5. Create Admin User

The first user to register via GitHub OAuth will be automatically set as admin.

## 6. Access Your Platform

- **API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health
- **Admin Panel**: Coming soon (frontend)

## Troubleshooting

### Can't connect to Oracle server?
1. Check if Docker is running: `sudo systemctl status docker`
2. Test connection: `curl http://your-server-ip:2376/containers/json`
3. Check firewall settings on Oracle server

### MongoDB connection issues?
1. Ensure MongoDB is running: `sudo systemctl status mongod`
2. Check connection: `mongo mongodb://localhost:27017/vercel-clone`

### GitHub OAuth not working?
1. Verify callback URL: `http://localhost:5000/api/auth/github/callback`
2. Check client ID and secret in `.env`
3. Ensure OAuth app is active on GitHub

## Next Steps

1. **Set up Payoneer** payment integration
2. **Configure webhooks** for GitHub and Payoneer
3. **Build the frontend** dashboard (Next.js)
4. **Add SSL certificates** for production
5. **Set up monitoring** and logging

## Support

- Check logs: `tail -f logs/combined.log`
- API documentation: Available in code comments
- Issues: Create GitHub issue with logs and steps to reproduce
