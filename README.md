# 🚀 Vercel Clone Platform

A full-stack cloud hosting platform built with MERN stack, featuring Payoneer payment integration for Pakistani (PKR) and international payments, Docker container management on a fixed Oracle server, and smart resource allocation.

## ✨ Features

### 🎯 Core Platform Features
- **GitHub/GitLab Integration**: Deploy directly from your repositories
- **Framework Auto-Detection**: Supports React, Next.js, Vue, Angular, Express, static sites, and more
- **Real-time Build Logs**: Live deployment progress with Socket.IO
- **Custom Domains**: Add your own domains with automatic SSL
- **Environment Variables**: Secure configuration management
- **Team Collaboration**: Share projects with team members

### 💰 Billing & Payments
- **Payoneer Integration**: Support for both local Pakistani and international payments
- **Multi-Currency Support**: PKR, USD, EUR, GBP with automatic conversion
- **Pakistani Payment Methods**: NayaPay, SadaPay, HBL, Meezan Bank cards
- **International Methods**: Payoneer wallet, bank transfers, wire transfers
- **1-Month Free Trial**: Full platform access for new users
- **Flexible Plans**: From starter to enterprise levels

### ☁️ Infrastructure
- **Single Oracle Server**: Fixed server with Docker container management
- **Smart Resource Allocation**: 
  - Free users: Minimal container resources (0.5 CPU, 1GB RAM)
  - Paid users: Full or reduced container resources based on availability
- **Dynamic Container Management**: Docker containers split server resources efficiently
- **Resource Monitoring**: Real-time server utilization tracking

### 🛠️ Admin Panel
- **Dynamic Resource Management**: Adjust CPU, RAM, storage in real-time
- **User Management**: Complete user lifecycle control
- **Plan Management**: Create, edit, and assign custom plans
- **Payment Tracking**: Real-time revenue and payment analytics
- **Server Monitoring**: Oracle server usage and health monitoring

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Node.js, Express.js, Socket.IO
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: GitHub OAuth with Passport.js
- **Payments**: Payoneer API with webhook support
- **Infrastructure**: Oracle Cloud, Docker containerization
- **Deployment**: PM2, Caddy reverse proxy

### System Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js       │    │   Express.js     │    │    MongoDB      │
│   Frontend      │◄──►│   Backend        │◄──►│   Database      │
│   - Dashboard   │    │   - Auth API     │    │   - Users       │
│   - Deploy UI   │    │   - Projects     │    │   - Projects    │
│   - Admin Panel │    │   - Payments     │    │   - Plans       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        
         └────────────────────────┼────────────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │     Oracle Cloud           │
                    │  ┌─────────────────────┐   │
                    │  │ EC1 - API Server    │   │
                    │  │ - Backend APIs      │   │
                    │  │ - Admin Panel       │   │
                    │  └─────────────────────┘   │
                    │  ┌─────────────────────┐   │
                    │  │ EC2 - Mixed Server  │   │
                    │  │ - Shared containers │   │
                    │  │ - Dedicated VMs     │   │
                    │  └─────────────────────┘   │
                    │  ┌─────────────────────┐   │
                    │  │ EC3 - Mixed Server  │   │
                    │  │ - Shared containers │   │
                    │  │ - Dedicated VMs     │   │
                    │  └─────────────────────┘   │
                    └────────────────────────────┘
```

## 💳 Pricing Strategy

### Payment Flow
1. **Pakistani Customers**: Pay in PKR → Auto-convert to USD → Receive USD in Payoneer
2. **International Customers**: Pay in USD/EUR/GBP → Receive same currency in Payoneer  
3. **Admin Withdrawals**: USD/EUR/GBP → Pakistani bank account (converted to PKR)

### Plans
- **Free Trial**: 1 month, shared resources, 0.5 OCPU, 1GB RAM
- **Starter**: $9/month, 1 OCPU, 4GB RAM, 50GB storage
- **Growth**: $29/month, 2 OCPU, 12GB RAM, 100GB storage  
- **Pro**: $59/month, 3 OCPU, 20GB RAM, 200GB storage
- **Enterprise**: $199/month, 4 OCPU, 24GB RAM, 500GB storage

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Docker Desktop (for MongoDB)
- PowerShell (Windows) or Bash (Linux/macOS)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/vercel-clone-platform.git
   cd vercel-clone-platform
   ```

2. **Start MongoDB using existing setup scripts**
   
   **Windows (PowerShell - Recommended):**
   ```powershell
   .\setup-mongodb.ps1 start
   ```
   
   **Windows (Batch file):**
   ```cmd
   .\mongodb-start.bat
   ```
   
   **Any OS (Docker Compose):**
   ```bash
   docker-compose up -d mongodb mongo-express
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

4. **Setup environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your GitHub OAuth and other configurations
   ```

5. **Start the backend server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Access the application**
   - Backend API: http://localhost:5000
   - MongoDB Web UI: http://localhost:8081
   - Database: `mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin`

## 🔧 Configuration

### GitHub OAuth Setup
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create a new OAuth app with:
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:5000/api/auth/github/callback`
3. Add the Client ID and Secret to your `.env` file

### Payoneer Setup
1. Register for Payoneer developer account
2. Create API credentials for your application
3. Set up webhook endpoint: `http://your-domain.com/api/webhooks/payoneer`
4. Configure payment methods for PKR and international currencies

### Oracle Server Setup
1. Ensure Docker is installed on your Oracle server
2. Add your Oracle server IP to `.env` file
3. Configure server resources (CPU, RAM limits)

## 📁 Project Structure

```
vercel-clone-platform/
├── backend/                    # Backend API (Express.js)
│   ├── models/                 # MongoDB schemas (User, Plan, Project)
│   ├── routes/                 # API endpoints (auth, billing, admin)
│   ├── services/               # Business logic
│   │   ├── payoneer.js         # Payment processing
│   │   ├── containerOrchestrator.js # Docker container management
│   │   └── docker.js           # Docker operations
│   ├── middleware/             # Auth, validation, admin
│   ├── utils/                  # Helper functions, logger
│   └── server.js               # Entry point
├── docs/                       # Documentation
│   ├── backend-changes.md      # What changed in backend
│   └── ...
├── SETUP.md                    # Setup instructions
└── README.md                   # This file

# Coming Soon:
└── frontend/                   # Next.js dashboard (planned)
```

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **API Rate Limiting**: Prevent abuse and ensure fair usage
- **Webhook Signature Verification**: Secure webhook handling
- **Environment Variable Encryption**: Secure config storage
- **CORS Protection**: Cross-origin request security
- **Helmet.js**: Security headers and protections

## 📊 Monitoring & Analytics

- **Winston Logging**: Comprehensive application logging
- **Real-time Metrics**: CPU, RAM, storage usage tracking
- **Payment Analytics**: Revenue tracking and reporting  
- **User Activity Monitoring**: Login, deployment, and usage analytics
- **Error Tracking**: Automatic error detection and reporting

## 🛡️ Admin Features

### User Management
- View all users with filtering and search
- Edit user resources in real-time
- Suspend/resume user accounts
- Assign custom plans to specific users

### Resource Management  
- Monitor Oracle server utilization
- Dynamically allocate resources
- Scale containers up/down instantly
- Optimize resource distribution

### Payment Management
- Track all Payoneer transactions
- Monitor revenue in multiple currencies
- Process withdrawals to Pakistani banks
- Handle payment failures and retries

## 🌐 Deployment

### Production Deployment
1. **Server Setup**
   ```bash
   # Install Node.js and PM2
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   npm install -g pm2
   ```

2. **Environment Configuration**
   ```bash
   # Set production environment variables
   export NODE_ENV=production
   export MONGODB_URI=mongodb://your-production-mongodb
   export ORACLE_SERVER_IP=your-oracle-server-ip
   ```

3. **Start Backend**
   ```bash
   cd backend
   npm install --production
   pm2 start server.js --name vercel-clone-api
   pm2 startup
   pm2 save
   ```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 API Documentation

### Authentication Endpoints
- `GET /api/auth/github` - Start GitHub OAuth flow
- `GET /api/auth/github/callback` - GitHub OAuth callback
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### Project Endpoints  
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Deployment Endpoints
- `POST /api/deployments` - Create new deployment
- `GET /api/deployments/:id` - Get deployment details
- `GET /api/deployments/:id/logs` - Get deployment logs

### Payment Endpoints
- `POST /api/billing/create-session` - Create payment session
- `GET /api/billing/plans` - Get available plans
- `GET /api/billing/info` - Get user billing info

### Admin Endpoints
- `GET /api/admin/resources/status` - Get server status
- `POST /api/admin/resources/reallocate` - Update user container
- `GET /api/admin/resources/users` - View user containers
- `GET /api/admin/server/test` - Test server connection

## ⚠️ Known Issues

- Large file uploads may timeout on slower connections
- Real-time logs may disconnect on mobile browsers
- Docker container resources may need manual optimization

## 🔮 Future Roadmap

- [ ] **Frontend Dashboard**: Next.js user and admin interface
- [ ] **CI/CD Integration**: GitHub Actions, GitLab CI integration
- [ ] **Build System**: Automated framework detection and builds
- [ ] **Analytics Dashboard**: Detailed usage and performance metrics
- [ ] **Multi-server Support**: Distribute containers across servers
- [ ] **API Marketplace**: Third-party integrations

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💬 Support

- 📧 Email: support@yourplatform.com
- 💬 Discord: [Join our community](https://discord.gg/yourserver)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/vercel-clone-platform/issues)
- 📚 Docs: [Full Documentation](https://docs.yourplatform.com)

## ⭐ Acknowledgments

- [Vercel](https://vercel.com) for inspiration
- [Oracle Cloud](https://cloud.oracle.com) for free tier resources
- [Payoneer](https://payoneer.com) for payment processing
- [MongoDB](https://mongodb.com) for database infrastructure

---

**Built with ❤️ for the developer community**
