# AGENTS.md — Power Dev Plugin Rules
# Applies to ALL agents (Coworker + Code) when this plugin is active

## Identity of This Project
This is a **Vercel-clone hosting platform** (Next.js + Node.js/Express + MongoDB).
Server: Oracle Cloud Ubuntu (ubuntu@129.154.255.90). Domain: newsbuzz.site.
SSH Key: `D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key`

---

## Rule 1: Research Before Complex Code
For ANY task involving a new API, npm package, server config, or unfamiliar pattern:
1. **Search the web / fetch docs FIRST** using brave-search or fetch MCP
2. Verify the exact API signature from live docs — never assume from memory
3. Check for breaking changes vs installed version
4. Only then write code

---

## Rule 2: Full Workflow = Research → Code → Deploy → Verify
When completing a feature, the definition of done is:
- ✅ Code written and reviewed
- ✅ Local build test passes (e.g. `npm run build`)
- ✅ Deployed to server using **Git Push/Pull** (NEVER use SCP for project code)
- ✅ PM2 restarted and logs checked
- ✅ **Triple Verification Complete:**
  1. **Curl/API Test:** Verify backend data/JSON returns correctly.
  2. **Log Verification:** Tail PM2 logs to ensure background tasks run without errors.
  3. **UI Verification:** Use the `browser` subagent (via `invoke_subagent`) to perform multi-step UI verification (like logging in, waiting for elements, and verifying video playback). Direct MCP calls to `puppeteer_screenshot` often time out due to network issues, so always delegate complex UI flows to the subagent.
- ✅ Key facts stored in memory MCP

---

## Rule 3: PowerShell SSH — MANDATORY Constraints
- NEVER chain commands with `&&` or `||` in PowerShell (this applies to BOTH local commands like `git commit && git push` AND remote SSH strings).
- NEVER embed `$variable` in SSH strings
- For multi-line server scripts: write Python → SCP → SSH run it
- Each SSH/SCP is its own separate run_command call

---

## Rule 4: Memory — Always Query and Store
- At start of complex /goal: query memory graph for project facts
- After implementing something important: store in memory
  - "Backend uses CommonJS (require), not ESM"
  - "MongoDB collection: articles. DB: ainews"
  - "PM2 app names: ai-news-frontend, ai-news-backend"
- Store every bug+fix so it's not repeated

---

## Rule 5: MongoDB Safety
- Always validate ObjectId before queries
- `$` in mongosh JS inside SSH strings → ALWAYS use Python subprocess approach
- Never use `--eval` with `$` variables in PowerShell SSH

---

## Rule 6: Code Quality Gates (Run Before Every Deploy)
```powershell
# 1. Lint
npm run lint --prefix D:\work\platform\frontend

# 2. TypeScript
npx tsc --noEmit --project D:\work\platform\frontend\tsconfig.json

# 3. Build test
npm run build --prefix D:\work\platform\frontend 2>&1 | Select-String "Error" | Select -First 20
```
If any gate fails, fix it before deploying.

---

## Rule 7: Verify Live Site After Every Deploy
After every SSH deploy, ALWAYS:
1. `curl.exe -s -o NUL -w "%{http_code}" https://newsbuzz.site` → must be 200
2. `curl.exe -s "https://newsbuzz.site/api/health"` → must respond
3. Use puppeteer MCP to screenshot if visual change was made

---

## Rule 8: Coworker Uses Subagents for Speed
When Coworker faces a task with independent parts:
- Research subtask → spawn research subagent
- Code subtask → handle directly
- Both run in parallel → faster completion
Example: "While I write the API route, spawn a subagent to research 
the correct Mongoose query syntax for this aggregation"

---

## Rule 9: Autovideo Bot Database
When writing scratch scripts or performing raw queries for the Portrait Hunter / AI Seeder project on the server:
- The actual MongoDB database is `autovideo`.
- Ignore any PM2 `MONGO_URI` dumps that reference `crypto-news` — that is an unrelated schema.

---

## Project Structure Quick Reference
```
D:\work\platform\
├── frontend/          Next.js App Router (TypeScript)
├── backend/           Node.js/Express API (CommonJS)
│   └── services/      buildExecutor, nginxRouter, containerOrchestrator...
├── templates/         Platform templates for user deployments
├── .agents/           Antigravity customizations (this file lives here)
│   └── plugins/power-dev-plugin/
└── CLAUDE.md          Claude Code project context
```

---

## Servers Quick Reference
| Name | IP | Role |
|---|---|---|
| EC1/EC3 | 129.154.255.90 | Backend API + containers (SAME machine) |
| EC2 | 140.238.229.147 | Additional containers |
| Domain | newsbuzz.site | Cloudflare → nginx → PM2 |
