# Contributing

Thank you for your interest in contributing to the hosting platform!

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a feature branch: `git checkout -b feat/your-feature`
4. Make your changes
5. Test locally (see below)
6. Commit with a descriptive message
7. Push to your fork and open a Pull Request

## Development Setup

### Prerequisites

- Node.js >= 18
- MongoDB (local or Docker)
- Redis (local or Docker)
- npm >= 9

### Local Development

```bash
# Backend
cd backend
cp .env.example .env   # Edit .env with your local values
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
cp .env.example .env.local   # Set NEXT_PUBLIC_API_URL=http://localhost:5000
npm install
npm run dev
```

### Using Docker Compose

```bash
# Start MongoDB and Redis
docker-compose up -d

# Then start backend and frontend as above
```

## Code Guidelines

- **Backend:** CommonJS (`require`/`module.exports`), Express.js patterns
- **Frontend:** TypeScript, Next.js App Router, Tailwind CSS
- **Commits:** Use conventional commit prefixes (`feat:`, `fix:`, `docs:`, `test:`, `ci:`, `security:`)

## Testing

```bash
# Backend tests
cd backend && npm test

# Frontend lint
cd frontend && npm run lint

# Frontend build
cd frontend && npm run build
```

## Security

- Never commit `.env` files or secrets
- See [SECURITY.md](SECURITY.md) for vulnerability reporting
- All PRs are reviewed for security implications

## Pull Request Process

1. Ensure your PR passes CI checks (lint, typecheck, build)
2. Update documentation if your change affects the API or setup
3. One approval is required before merging
4. Squash-merge is preferred for feature branches
