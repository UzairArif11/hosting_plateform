# 🚀 Vercel Clone Platform

A full-stack deployment platform similar to Vercel, built with Node.js, React, and Docker. Deploy your web applications with automatic builds, custom domains, and real-time deployment logs.

![Platform Status](https://img.shields.io/badge/status-production%20ready-brightgreen)
![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Local Development](#-local-development)
- [Production Deployment](#-production-deployment)
- [API Documentation](#-api-documentation)
- [Contributing](#-contributing)

---

## ✨ Features

### 🔐 Authentication & Authorization
- **OAuth Integration**: Login with GitHub and Google
- **JWT-based Authentication**: Secure token-based auth
- **Role-based Access Control**: User, Admin, Super Admin roles
- **API Key Management**: Generate and manage API keys

### 🚀 Deployment System
- **Automatic Builds**: Deploy from GitHub repositories
- **Real-time Logs**: Live build and deployment logs via WebSocket
- **Multiple Frameworks**: Support for Next.js, React, Vue, and more
- **Environment Variables**: Secure environment variable management
- **Custom Domains**: Connect your own domains
- **SSL Certificates**: Automatic HTTPS with Let's Encrypt

### 💳 Billing & Subscriptions
- **Multiple Plans**: Free, Pro, and Enterprise tiers
- **Payoneer Integration**: Secure payment processing
- **Usage Tracking**: Monitor deployments, bandwidth, and build minutes
- **Trial Period**: 14-day free trial for new users

### 📊 Admin Dashboard
- **User Management**: View and manage all users
- **Deployment Monitoring**: Track all deployments across the platform
- **System Analytics**: Platform-wide statistics and metrics
- **Resource Management**: Manage server resources and containers

### 🎨 User Dashboard
- **Project Management**: Create and manage multiple projects
- **Deployment History**: View all past deployments
- **Analytics**: Traffic and performance metrics
- **Team Collaboration**: Invite team members to projects
- **Settings**: Customize project settings and configurations

---

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│                    http://localhost:3000                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (Express.js)                  │
│                    http://localhost:5000                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Auth API   │  │ Projects API │  │  Admin API   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────┬────────────────┬────────────────┬──────────────┘
             │                │                │
             ▼                ▼                ▼
┌────────────────┐  ┌─────────────────┐  ┌──────────────┐
│   MongoDB      │  │  Docker Engine  │  │    Redis     │
│   (Database)   │  │  (Containers)   │  │   (Cache)    │
└────────────────┘  └─────────────────┘  └──────────────┘
```

### 3-Server Oracle Cloud Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  EC1: Main API Server (Backend, Admin, Frontend)            │
│  IP: 129.154.255.90                                          │
│  - Express.js Backend                                        │
│  - Next.js Frontend                                          │
│  - MongoDB Database                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  EC2: Shared Container Server (Free/Trial Users)            │
│  IP: 140.238.229.147                                         │
│  - 4 CPU Cores                                               │
│  - 24GB RAM                                                  │
│  - Max 200 Containers                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  EC3: Dedicated Container Server (Paid Users)               │
│  IP: 129.154.255.90                                          │
│  - 2 CPU Cores                                               │
│  - 12GB RAM                                                  │
│  - Max 100 Containers                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14 (React 18)
- **Styling**: Tailwind CSS
- **State Management**: Redux Toolkit
- **HTTP Client**: Axios
- **Real-time**: Socket.IO Client
- **UI Components**: Custom components with Tailwind

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: Passport.js (GitHub, Google OAuth)
- **Real-time**: Socket.IO
- **Containerization**: Docker
- **Cache**: Redis
- **Payment**: Payoneer API

### DevOps
- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Nginx (Production)
- **SSL**: Let's Encrypt
- **Monitoring**: Custom logging system
- **CI/CD**: GitHub Actions (Optional)

---

## 📁 Project Structure

```
vercel-clone-platform/
├── backend/                    # Backend API
│   ├── config/                # Configuration files
│   │   └── passport.js        # OAuth strategies
│   ├── middleware/            # Express middleware
│   │   ├── auth.js           # Authentication middleware
│   │   ├── admin.js          # Admin authorization
│   │   └── errorHandler.js   # Error handling
│   ├── models/               # Mongoose models
│   │   ├── User.js           # User model
│   │   ├── Project.js        # Project model
│   │   ├── Deployment.js     # Deployment model
│   │   └── Plan.js           # Subscription plan model
│   ├── routes/               # API routes
│   │   ├── auth.js           # Authentication routes
│   │   ├── projects.js       # Project management
│   │   ├── deployments.js    # Deployment routes
│   │   ├── billing.js        # Billing & payments
│   │   ├── admin.js          # Admin routes
│   │   └── webhooks.js       # Webhook handlers
│   ├── services/             # Business logic
│   │   ├── containerOrchestrator.js  # Docker management
│   │   ├── deploymentService.js      # Deployment logic
│   │   ├── githubService.js          # GitHub integration
│   │   ├── buildService.js           # Build process
│   │   ├── paymentService.js         # Payment processing
│   │   └── notificationService.js    # Notifications
│   ├── utils/                # Utility functions
│   │   ├── database.js       # Database connection
│   │   └── logger.js         # Logging utility
│   ├── .env                  # Environment variables
│   ├── server.js             # Main server file
│   └── package.json          # Dependencies
│
├── frontend/                  # Frontend application
│   ├── app/                  # Next.js app directory
│   │   ├── page.tsx          # Landing page
│   │   ├── login/            # Login page
│   │   └── dashboard/        # Dashboard pages
│   │       ├── page.tsx      # Main dashboard
│   │       ├── projects/     # Projects management
│   │       ├── deployments/  # Deployment details
│   │       ├── billing/      # Billing & plans
│   │       ├── settings/     # User settings
│   │       └── admin/        # Admin dashboard
│   ├── components/           # React components
│   │   ├── Sidebar.tsx       # Dashboard sidebar
│   │   └── Providers.tsx     # Redux provider
│   ├── lib/                  # Utilities
│   │   ├── store.ts          # Redux store
│   │   ├── api.ts            # API client
│   │   └── slices/           # Redux slices
│   ├── public/               # Static assets
│   ├── .env.local            # Frontend environment variables
│   └── package.json          # Dependencies
│
├── docker-compose.yml         # Docker services
├── .gitignore                # Git ignore rules
└── README.md                 # This file
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Docker**: v20.0.0 or higher
- **Docker Compose**: v2.0.0 or higher
- **Git**: Latest version

### Quick Start (5 minutes)

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/vercel-clone-platform.git
cd vercel-clone-platform
```

2. **Start Docker services**
```bash
docker-compose up -d
```

3. **Install backend dependencies**
```bash
cd backend
npm install
```

4. **Configure backend environment**
```bash
# Copy and edit .env file
cp .env.example .env
```

5. **Install frontend dependencies**
```bash
cd ../frontend
npm install
```

6. **Start development servers**

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

7. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- MongoDB Express: http://localhost:8081

---

## 💻 Local Development

See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for detailed local development instructions.

### Quick Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Restart backend
cd backend && npm run dev

# Restart frontend
cd frontend && npm run dev
```

---

## 🌐 Production Deployment

See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for detailed production deployment instructions on Oracle Cloud.

### Quick Overview

1. **Provision Oracle Cloud Servers** (3 servers)
2. **Install Docker & Dependencies**
3. **Configure Environment Variables**
4. **Deploy Backend & Frontend**
5. **Set up Nginx Reverse Proxy**
6. **Configure SSL Certificates**
7. **Set up Monitoring & Logging**

---

## 📚 API Documentation

### Authentication Endpoints

```http
POST   /api/auth/github          # GitHub OAuth login
POST   /api/auth/google          # Google OAuth login
GET    /api/auth/logout          # Logout user
GET    /api/auth/me              # Get current user
```

### Project Endpoints

```http
GET    /api/projects             # List all projects
POST   /api/projects             # Create new project
GET    /api/projects/:id         # Get project details
PUT    /api/projects/:id         # Update project
DELETE /api/projects/:id         # Delete project
```

### Deployment Endpoints

```http
GET    /api/deployments          # List deployments
POST   /api/deployments          # Create deployment
GET    /api/deployments/:id      # Get deployment details
GET    /api/deployments/:id/logs # Get deployment logs
```

### Admin Endpoints

```http
GET    /api/admin/users          # List all users
GET    /api/admin/stats          # Platform statistics
PUT    /api/admin/users/:id      # Update user
DELETE /api/admin/users/:id      # Delete user
```

---

## 🔧 Environment Variables

### Backend (.env)

```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin

# Authentication
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Authors

- **Your Name** - Initial work

---

## 🙏 Acknowledgments

- Inspired by Vercel
- Built with modern web technologies
- Community contributions

---

## 📞 Support

For support, email support@yourplatform.com or join our Slack channel.

---

**Made with ❤️ by Your Team**
