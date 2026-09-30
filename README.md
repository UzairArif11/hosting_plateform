# 🚀 Hosting Platform

A self-hosted, open-source deployment platform inspired by Vercel. Deploy web applications (Next.js, React, Node.js, static sites) to your own infrastructure with Git-based workflows, Docker containers, and automatic SSL.

## Features

- **Git-Based Deployments** — Connect GitHub repositories and deploy on push
- **Multi-Framework Support** — Next.js, React, Vue, static sites, and Node.js applications
- **Docker Container Isolation** — Each deployment runs in its own container with configurable resource limits
- **Admin Dashboard** — Manage users, servers, plans, templates, and deployments
- **User Dashboard** — Deploy projects, manage environment variables, view logs, and configure domains
- **Custom Domains** — Add custom domains with automatic Nginx configuration
- **SSL/TLS** — Automatic HTTPS via Let's Encrypt
- **SSH Tunnel Architecture** — Secure Docker access to remote servers via SSH tunnels (no exposed Docker API)
- **Multi-Server Support** — Distribute deployments across multiple Oracle Cloud / Linux servers
- **Resource Management** — CPU, RAM, and storage limits per plan, enforced at the container level
- **Subscription Plans** — Configurable pricing tiers with billing periods (monthly, quarterly, annual)
- **Payment Integration** — Support for Paddle, manual payments, and extensible payment methods
- **OAuth Login** — GitHub and Google OAuth for user authentication
- **Real-Time Updates** — WebSocket-based live deployment logs and status
- **Template System** — Pre-built templates for quick project bootstrapping
- **Team Collaboration** — Project invitations and role-based access

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend (Next.js 14, App Router, TypeScript)  │
│  Admin + User Dashboards, Tailwind CSS          │
└────────────────────┬────────────────────────────┘
                     │ REST API + WebSocket
┌────────────────────▼────────────────────────────┐
│  Backend (Node.js/Express, CommonJS)            │
│  Auth, Projects, Deployments, Billing, Admin    │
│                                                 │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────┐ │
│  │ Bull     │ │ SSH      │ │ Nginx Router    │ │
│  │ Queue    │ │ Tunnels  │ │ (node-ssh)      │ │
│  └────┬─────┘ └────┬─────┘ └────────┬────────┘ │
└───────┼────────────┼────────────────┼───────────┘
        │            │                │
┌───────▼───┐  ┌─────▼─────┐  ┌──────▼──────┐
│ Redis     │  │ Docker    │  │ Nginx       │
│ (Queue)   │  │ (Remote)  │  │ (Reverse    │
└───────────┘  └───────────┘  │  Proxy)     │
                              └─────────────┘
        ┌───────────┐
        │ MongoDB   │
        │ (Data)    │
        └───────────┘
```

## Quick Start

### Prerequisites

- Node.js >= 18
- MongoDB 7.0+
- Redis
- Docker (on deployment servers)
- Nginx (on deployment servers)

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/UzairArif11/hosting_plateform.git
cd hosting_plateform

# 2. Start MongoDB and Redis (via Docker Compose)
export MONGO_PASSWORD=your_strong_password
export REDIS_PASSWORD=your_strong_password
docker-compose up -d

# 3. Set up the backend
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI, JWT_SECRET, etc.
npm install
npm run dev

# 4. Set up the frontend (separate terminal)
cd frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:5000" > .env.local
echo "NEXT_PUBLIC_SOCKET_URL=http://localhost:5000" >> .env.local
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000` and the backend API at `http://localhost:5000`.

### Production Deployment

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed production setup instructions.

```bash
# Quick production deploy (on your server)
chmod +x deploy.sh
./deploy.sh
```

## Environment Variables

See [`backend/.env.example`](backend/.env.example) for a full reference. Key variables:

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | ✅ | Secret key for JWT token signing (no fallback — must be set) |
| `SESSION_SECRET` | ✅ | Express session secret |
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `FRONTEND_URL` | ✅ | Frontend URL for CORS and OAuth callbacks |
| `GITHUB_CLIENT_ID` | Optional | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Optional | GitHub OAuth app client secret |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth client secret |
| `SSH_USERNAME` | Optional | SSH username for remote servers (default: `ubuntu`) |

## Project Structure

```
├── backend/             # Node.js/Express API (CommonJS)
│   ├── config/          # Passport OAuth configuration
│   ├── cron/            # Scheduled tasks (subscription lifecycle)
│   ├── middleware/       # Auth, validation, admin middleware
│   ├── models/          # Mongoose models (User, Project, Deployment, Plan, etc.)
│   ├── routes/          # API route handlers
│   ├── services/        # Core services
│   │   ├── buildExecutor.js       # Git clone → build → deploy pipeline
│   │   ├── containerOrchestrator.js # Docker container management
│   │   ├── sshTunnelManager.js    # SSH tunnels for remote Docker
│   │   ├── nginxRouter.js         # Nginx config management via SSH
│   │   ├── resourceEnforcer.js    # CPU/RAM enforcement
│   │   └── buildQueue.js         # Bull queue for async builds
│   └── utils/           # Logger, database, server resolver
├── frontend/            # Next.js 14 App Router (TypeScript)
│   ├── app/             # Pages (admin/, dashboard/, login, etc.)
│   ├── components/      # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Redux store, API client, slices
├── templates/           # Deployment templates
├── docker-compose.yml   # MongoDB + Redis for local/production
└── deploy.sh            # Production deployment script
```

## Testing

```bash
# Backend tests
cd backend && npm test

# Frontend lint and type check
cd frontend && npm run lint

# Frontend production build
cd frontend && npm run build
```

## Security

- See [SECURITY.md](SECURITY.md) for vulnerability reporting
- Docker access uses SSH tunnels — the Docker API is never exposed directly
- JWT_SECRET is mandatory with no insecure fallback
- Rate limiting, Helmet.js, CORS, and httpOnly cookies are enforced
- Input validation via express-validator on all endpoints

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.
