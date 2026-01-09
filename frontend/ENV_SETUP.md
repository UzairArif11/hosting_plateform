# Frontend Environment Variables Setup

## Required Environment Variables

### For Production (`https://foodpanda.site`)

Create `.env.production` or set in your deployment environment:

```bash
# Backend API URL (without /api - it's automatically appended in api.ts)
NEXT_PUBLIC_API_URL=https://foodpanda.site

# Socket.IO URL (optional - defaults to NEXT_PUBLIC_API_URL or window.location.origin)
NEXT_PUBLIC_SOCKET_URL=https://foodpanda.site
```

### For Local Development

Create `.env.local` in the `frontend/` directory:

```bash
# Backend API URL (without /api - it's automatically appended in api.ts)
NEXT_PUBLIC_API_URL=http://localhost:5000

# Socket.IO URL (optional - defaults to NEXT_PUBLIC_API_URL or window.location.origin)
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

## Important Notes

1. **Do NOT include `/api` in `NEXT_PUBLIC_API_URL`** - The code in `lib/api.ts` automatically appends `/api` to the base URL
2. **Socket.IO path is hardcoded** - All socket connections use `/api/socket.io/` path (configured in both frontend and backend)
3. **Next.js automatically exposes `NEXT_PUBLIC_*` variables** - No need to manually configure in `next.config.js` (it's there for documentation)

## How It Works

- `NEXT_PUBLIC_API_URL=https://foodpanda.site` → API calls go to `https://foodpanda.site/api/*`
- `NEXT_PUBLIC_SOCKET_URL=https://foodpanda.site` → Socket connects to `https://foodpanda.site/api/socket.io/`

## Deployment

When deploying, ensure these environment variables are set:
- In PM2: Set in `ecosystem.config.js` or as environment variables
- In Docker: Set in docker-compose.yml or .env file
- In Vercel/Netlify: Set in their dashboard under Environment Variables

