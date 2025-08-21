# 🚀 Vercel Clone Platform

A full-stack zero-cost cloud hosting platform built entirely with the MERN stack, featuring Payoneer payment integration for both Pakistani (PKR) and international payments, Oracle Cloud infrastructure, and advanced admin controls.

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
- **Oracle Cloud Integration**: Leverage free tier and paid instances
- **Smart Resource Allocation**: 
  - Free users: Shared container pool
  - Paid users: Dedicated Oracle instances
- **Auto-scaling**: Dynamic resource allocation based on usage
- **Multi-Region Support**: Deploy across different Oracle regions

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
                    │  │ Account A (Free)    │   │
                    │  │ - Shared containers │   │
                    │  │ - Trial users       │   │
                    │  └─────────────────────┘   │
                    │  ┌─────────────────────┐   │
                    │  │ Account B (Paid)    │   │
                    │  │ - Dedicated VMs     │   │
                    │  │ - Production users  │   │
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
- MongoDB 5+
- Oracle Cloud account(s)
- GitHub OAuth app
- Payoneer developer account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/vercel-clone-platform.git
   cd vercel-clone-platform
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB**
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:5
   
   # Or start your local MongoDB instance
   mongod
   ```

5. **Start the backend server**
   ```bash
   npm run dev
   ```

6. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

7. **Start the frontend**
   ```bash
   npm run dev
   ```

8. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Admin Panel: http://localhost:3000/admin

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

### Oracle Cloud Setup
1. Create two Oracle Cloud accounts for resource separation
2. Generate API keys and download configuration files
3. Set up compartments and VCNs for container deployment
4. Configure security lists and ingress rules

## 📁 Project Structure

```
vercel-clone-platform/
├── backend/
│   ├── models/          # MongoDB schemas
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic
│   ├── middleware/      # Auth, validation, etc.
│   ├── utils/          # Helper functions
│   └── server.js       # Entry point
├── frontend/
│   ├── pages/          # Next.js pages
│   ├── components/     # React components
│   ├── styles/         # CSS and styling
│   ├── utils/          # Frontend utilities
│   └── next.config.js  # Next.js configuration
├── build-worker/
│   ├── services/       # Build and deployment logic
│   ├── templates/      # Framework templates
│   └── worker.js       # Build worker process
├── infrastructure/
│   ├── scripts/        # Setup and deployment scripts
│   ├── configs/        # Server configurations
│   └── monitoring/     # Monitoring setup
└── docs/              # Documentation
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
   # Install dependencies
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   npm install -g pm2
   
   # Clone and setup project
   git clone https://github.com/yourusername/vercel-clone-platform.git
   cd vercel-clone-platform/backend
   npm install --production
   ```

2. **Environment Configuration**
   ```bash
   # Set production environment variables
   export NODE_ENV=production
   export MONGODB_URI=mongodb://your-production-mongodb
   # ... other environment variables
   ```

3. **Start Services**
   ```bash
   # Start with PM2
   pm2 start ecosystem.config.js
   pm2 startup
   pm2 save
   ```

4. **Reverse Proxy Setup**
   ```bash
   # Install and configure Caddy
   sudo caddy run --config Caddyfile
   ```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
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
- `POST /api/billing/upgrade` - Upgrade user plan

## ⚠️ Known Issues

- Large file uploads may timeout on slower connections
- Real-time logs may disconnect on mobile browsers
- Oracle API rate limits may affect rapid scaling

## 🔮 Future Roadmap

- [ ] **Database Support**: PostgreSQL, MySQL deployment options
- [ ] **CI/CD Integration**: GitHub Actions, GitLab CI integration
- [ ] **Edge Functions**: Serverless function deployment
- [ ] **Analytics Dashboard**: Detailed usage and performance metrics
- [ ] **Multi-tenant Architecture**: White-label solutions
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
