# 💻 Local Development Setup Guide

Complete guide to set up and run the Vercel Clone Platform on your local machine.

---

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Docker Services](#docker-services)
- [OAuth Configuration](#oauth-configuration)
- [Running the Application](#running-the-application)
- [Troubleshooting](#troubleshooting)

---

## ✅ Prerequisites

### Required Software

1. **Node.js** (v18.0.0 or higher)
   - Download: https://nodejs.org/
   - Verify: `node --version`

2. **npm** (v9.0.0 or higher)
   - Comes with Node.js
   - Verify: `npm --version`

3. **Docker Desktop**
   - Download: https://www.docker.com/products/docker-desktop
   - Verify: `docker --version`
   - Verify: `docker-compose --version`

4. **Git**
   - Download: https://git-scm.com/
   - Verify: `git --version`

### Recommended Tools

- **VS Code**: https://code.visualstudio.com/
- **Postman**: https://www.postman.com/ (for API testing)
- **MongoDB Compass**: https://www.mongodb.com/products/compass (optional)

---

## 🚀 Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/vercel-clone-platform.git
cd vercel-clone-platform
```

### 2. Project Structure Overview

```
vercel-clone-platform/
├── backend/          # Node.js/Express backend
├── frontend/         # Next.js frontend
├── docker-compose.yml
└── README.md
```

---

## 🔧 Backend Setup

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

### Step 2: Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
# Copy the example file
cp .env.example .env
```

Edit `backend/.env` with the following configuration:

```env
# Environment
NODE_ENV=development
PORT=5000
LOG_LEVEL=info

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# GitHub OAuth (Get from https://github.com/settings/developers)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback
GITHUB_API_TOKEN=your-github-personal-access-token

# Google OAuth (Get from https://console.cloud.google.com/)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Payoneer Payment Integration (Optional for development)
PAYONEER_API_URL=https://api.payoneer.com
PAYONEER_CLIENT_ID=your-payoneer-client-id
PAYONEER_CLIENT_SECRET=your-payoneer-client-secret
PAYONEER_WEBHOOK_SECRET=your-payoneer-webhook-secret

# Email Configuration (Optional for development)
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@domain.com
SMTP_PASS=your-email-password

# Feature Flags
ENABLE_PAYONEER_PAYMENTS=false
ENABLE_PKR_PAYMENTS=false

# Security
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

### Step 3: Verify Backend Installation

```bash
# Test if backend starts without errors
npm run dev
```

You should see:
```
✅ MongoDB connected successfully
🔗 Database: vercel_clone
🚀 Server running on port 5000
```

---

## 🎨 Frontend Setup

### Step 1: Install Dependencies

```bash
cd ../frontend
npm install
```

### Step 2: Configure Environment Variables

Create a `.env.local` file in the `frontend` directory:

```bash
# Copy the example file
cp .env.example .env.local
```

Edit `frontend/.env.local`:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:5000

# Optional: Analytics
NEXT_PUBLIC_GA_ID=your-google-analytics-id
```

### Step 3: Verify Frontend Installation

```bash
# Test if frontend starts without errors
npm run dev
```

You should see:
```
▲ Next.js 14.0.4
- Local:        http://localhost:3000
✓ Ready in 5s
```

---

## 🐳 Docker Services

### Step 1: Start Docker Services

From the project root directory:

```bash
docker-compose up -d
```

This starts:
- **MongoDB** (port 27017)
- **Mongo Express** (port 8081) - Web UI for MongoDB
- **Redis** (port 6379) - Optional, for caching

### Step 2: Verify Docker Services

```bash
# Check running containers
docker ps

# You should see:
# - vercel-clone-mongodb
# - vercel-clone-mongo-express
```

### Step 3: Access MongoDB Web UI

Open http://localhost:8081 in your browser to access Mongo Express.

### Docker Commands Reference

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart a specific service
docker-compose restart mongodb

# Remove all data (WARNING: Deletes database)
docker-compose down -v
```

---

## 🔐 OAuth Configuration

### GitHub OAuth Setup

1. **Go to GitHub Developer Settings**
   - Visit: https://github.com/settings/developers
   - Click "New OAuth App"

2. **Configure Application**
   - **Application name**: Vercel Clone Local Dev
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:5000/api/auth/github/callback`

3. **Get Credentials**
   - Copy **Client ID**
   - Generate and copy **Client Secret**
   - Add both to `backend/.env`

4. **Generate Personal Access Token** (for GitHub API)
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Select scopes: `repo`, `user:email`
   - Copy token and add to `backend/.env` as `GITHUB_API_TOKEN`

### Google OAuth Setup

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Create a new project or select existing

2. **Enable Google+ API**
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"

3. **Create OAuth Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Choose "Web application"

4. **Configure OAuth Client**
   - **Name**: Vercel Clone Local Dev
   - **Authorized JavaScript origins**: `http://localhost:3000`
   - **Authorized redirect URIs**: `http://localhost:5000/api/auth/google/callback`

5. **Get Credentials**
   - Copy **Client ID**
   - Copy **Client Secret**
   - Add both to `backend/.env`

6. **Add Test Users** (Required for development)
   - Go to "OAuth consent screen"
   - Scroll to "Test users"
   - Click "Add Users"
   - Add your Gmail address

---

## ▶️ Running the Application

### Method 1: Using Separate Terminals (Recommended)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 - Docker Services:**
```bash
docker-compose up
```

### Method 2: Using npm Scripts

You can create a `package.json` in the root directory:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "cd backend && npm run dev",
    "dev:frontend": "cd frontend && npm run dev",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down"
  }
}
```

Then run:
```bash
npm install -g concurrently
npm run docker:up
npm run dev
```

### Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Health Check**: http://localhost:5000/health
- **MongoDB Express**: http://localhost:8081

---

## 🧪 Testing the Application

### 1. Test Backend Health

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-24T12:00:00.000Z",
  "uptime": 123.456
}
```

### 2. Test Frontend

Open http://localhost:3000 in your browser. You should see the landing page.

### 3. Test OAuth Login

1. Click "Login" or "Deploy Now"
2. Try GitHub login
3. Try Google login
4. You should be redirected to the dashboard

### 4. Test API Endpoints

```bash
# Test projects endpoint (requires authentication)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:5000/api/projects
```

---

## 🐛 Troubleshooting

### Backend Issues

#### MongoDB Connection Error

**Error**: `MongoServerError: Command createIndexes requires authentication`

**Solution**:
```env
# Make sure your MONGODB_URI includes authentication
MONGODB_URI=mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin
```

#### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::5000`

**Solution**:
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :5000
kill -9 <PID>
```

#### OAuth Strategy Not Found

**Error**: `Unknown authentication strategy "google"`

**Solution**:
- Make sure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env`
- Restart the backend server

### Frontend Issues

#### Module Not Found

**Error**: `Module not found: Can't resolve '@/lib/store'`

**Solution**:
```bash
cd frontend
rm -rf .next node_modules
npm install
npm run dev
```

#### API Connection Error

**Error**: `Network Error` or `CORS Error`

**Solution**:
- Make sure backend is running on port 5000
- Check `NEXT_PUBLIC_API_URL` in `frontend/.env.local`
- Verify `CORS_ORIGIN` in `backend/.env` is set to `http://localhost:3000`

### Docker Issues

#### Docker Service Won't Start

**Error**: `Cannot connect to the Docker daemon`

**Solution**:
- Make sure Docker Desktop is running
- Restart Docker Desktop

#### MongoDB Container Keeps Restarting

**Solution**:
```bash
# Check logs
docker logs vercel-clone-mongodb

# Remove and recreate
docker-compose down -v
docker-compose up -d
```

---

## 📝 Development Workflow

### Daily Development

1. **Start Docker services**
   ```bash
   docker-compose up -d
   ```

2. **Start backend**
   ```bash
   cd backend
   npm run dev
   ```

3. **Start frontend**
   ```bash
   cd frontend
   npm run dev
   ```

4. **Make changes and test**

5. **Stop services when done**
   ```bash
   # Stop backend: Ctrl+C
   # Stop frontend: Ctrl+C
   docker-compose down
   ```

### Code Changes

- **Backend changes**: Auto-reload with nodemon
- **Frontend changes**: Auto-reload with Next.js Fast Refresh
- **Environment variable changes**: Restart the respective server

### Database Management

```bash
# Access MongoDB shell
docker exec -it vercel-clone-mongodb mongosh -u admin -p password123

# Backup database
docker exec vercel-clone-mongodb mongodump -u admin -p password123 --authenticationDatabase admin -o /backup

# Restore database
docker exec vercel-clone-mongodb mongorestore -u admin -p password123 --authenticationDatabase admin /backup
```

---

## 🎯 Next Steps

After successful local setup:

1. **Explore the Dashboard**: Create projects, deploy applications
2. **Test API Endpoints**: Use Postman or curl
3. **Read the Code**: Understand the architecture
4. **Make Changes**: Start contributing!
5. **Deploy to Production**: See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)

---

## 📞 Need Help?

- **Documentation**: Check the main [README.md](./README.md)
- **Issues**: Open an issue on GitHub
- **Community**: Join our Discord/Slack channel

---

**Happy Coding! 🚀**
