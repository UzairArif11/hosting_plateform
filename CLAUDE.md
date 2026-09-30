# CLAUDE.md — Platform Project Context for Claude Code

## Project Overview
This is a **Vercel-clone hosting platform** (Next.js + Node.js + MongoDB) deployed on Oracle Cloud Ubuntu.
- **Frontend:** Next.js (App Router, TypeScript) at `frontend/`
- **Backend:** Node.js/Express API at `backend/`
- **Database:** MongoDB (local + Oracle Cloud)
- **Server:** ubuntu@129.154.255.90 (EC1/EC3 = same machine)
- **Domain:** https://newsbuzz.site (Cloudflare CDN)
- **Process Manager:** PM2
- **SSH Key:** `D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key`

---

## Architecture (READ BEFORE EVERY TASK)

```
Build  → Platform backend server (/tmp/builds/<id>)  → npm install + npm run build (Docker)
Upload → Pre-built tarball → EC2 at /tmp/builds/<deploymentId>
Runtime → User container → PM2 runs node server.js --port PORT
```

**OOM at startup = raise container RAM (not build resources)**

Key services:
- `backend/services/buildExecutor.js` — build flow, Prisma fix
- `backend/services/nginxRouter.js` — nginx location blocks
- `backend/services/containerOrchestrator.js` — plan resources, RAM limits
- `backend/services/sshTunnelManager.js` — SSH tunnels to EC2/EC3
- `backend/services/docker.js` — Docker client via SSH tunnels

---

## PowerShell SSH Constraints (CRITICAL — ALWAYS FOLLOW)

1. **NEVER** use `&&` or `||` to chain commands in PowerShell
2. **NEVER** use `$variable` inside SSH strings (PowerShell expands `$` first)
3. For multi-step server ops: write Python script → SCP → SSH run
4. Each SSH/SCP is a **separate** `run_command` call

Safe patterns:
```powershell
# Single SSH command (safe)
ssh -i "D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key" -o StrictHostKeyChecking=no ubuntu@129.154.255.90 "pm2 list"

# SCP a file (safe)
scp -i "D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key" D:\work\platform\backend\app.js ubuntu@129.154.255.90:/home/ubuntu/ai-news/backend/app.js
```

---

## MongoDB Rules (CRITICAL)
- `$` in mongosh JS **breaks** PowerShell SSH strings
- Always pipe JS through Python subprocess: write `.js` file → SCP → ssh run mongosh
- Never use `--eval "..."` with `$` variables inside PowerShell SSH

---

## Templates
| Template | Prisma | RAM Needed | Tier |
|---|---|---|---|
| nextjs-portfolio | ✅ Yes | ~1GB+ | Paid |
| nextjs-commerce | ✅ Yes | ~1GB+ | Paid |
| nextjs-blog-smart | ❌ No | ~256MB | Free |
| nextjs-starter | ❌ No | ~150MB | Free |

---

## Known Issues & Fixes
1. **502 Bad Gateway** → Container RAM too low → increase container memory
2. **CSS not loading on subpaths** → Use subdomains OR set `basePath` during build
3. **Prisma schema invalid syntax** → buildExecutor.js auto-fixes before install
4. **Deployment URL undefined** → Ensure `deployment.save()` after routing

---

## Code Style
- TypeScript strict mode for frontend
- ES Modules (import/export) in frontend; CommonJS (require) in backend
- No `console.log` left in production code — use structured logging
- All async operations: `try/catch` with meaningful error messages
- MongoDB: always validate ObjectId before queries

---

## Testing
```powershell
# Frontend lint
npm run lint --prefix D:\work\platform\frontend

# TypeScript check
npx tsc --noEmit --project D:\work\platform\frontend\tsconfig.json

# Build check
npm run build --prefix D:\work\platform\frontend
```

---

## Do Not
- Do NOT run `npm install` in production without testing locally first
- Do NOT modify nginx config without testing with `nginx -t` first
- Do NOT commit `.env` files or API keys
- Do NOT use `process.exit()` in backend services
