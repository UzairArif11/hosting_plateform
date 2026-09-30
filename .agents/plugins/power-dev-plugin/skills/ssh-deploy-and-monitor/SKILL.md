---
name: ssh-deploy-and-monitor
description: >-
  Full SSH deployment skill for the Oracle Cloud Ubuntu server (ubuntu@129.154.255.90).
  Activate when the user says: "deploy", "push to server", "update server", "restart PM2",
  "check logs", "run on server", or "live preview". Covers the complete deploy cycle:
  git push → SCP files → SSH restart PM2 → tail logs → verify live site.
  Also covers: running remote commands, checking PM2 status, fetching server logs,
  and triggering health checks on newsbuzz.site.
---

# SSH Deploy & Monitor — Skill

## Server Details
```
HOST: ubuntu@129.154.255.90
KEY:  D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key
DOMAIN: https://newsbuzz.site
LOCAL PROJECT: D:\work\platform
SERVER PROJECT: /home/ubuntu/ai-news (frontend) + /home/ubuntu/backend (API)
PM2 APP: ai-news-frontend, ai-news-backend (check with: pm2 list)
```

## ⚠️ PowerShell SSH Rules (ALWAYS FOLLOW)
1. **NEVER** chain commands with `&&` or `||` in PowerShell `run_command`
2. **NEVER** use `$variable` inside SSH strings — PowerShell expands `$` before sending
3. For multi-step server ops: write a Python `.py` script → SCP → SSH run it
4. Each SSH/SCP = its own separate `run_command` call

---

## Workflow A — Full Deploy (Code Changed Locally)

### Step 1: Commit & Push
```powershell
# Separate commands — never chain with &&
git -C D:\work\platform add -A
git -C D:\work\platform commit -m "feat: <description>"
git -C D:\work\platform push origin main
```

### Step 2: SCP Critical Files (if git pull is slow)
Write a Python SCP script to `C:\Users\INTERWARE\.gemini\antigravity\brain\<conv-id>\scratch\deploy.py`:
```python
import subprocess
KEY = r'D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key'
HOST = 'ubuntu@129.154.255.90'
files = [
    (r'D:\work\platform\frontend\src\app\page.tsx', '/home/ubuntu/ai-news/src/app/page.tsx'),
]
for local, remote in files:
    subprocess.run(['scp', '-i', KEY, '-o', 'StrictHostKeyChecking=no', local, f'{HOST}:{remote}'], check=True)
print('SCP done')
```
Then: `python C:\...\deploy.py`

### Step 3: Git Pull on Server
Write a Python script that SSH-pulls:
```python
import subprocess
KEY = r'D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key'
HOST = 'ubuntu@129.154.255.90'
cmd = 'cd /home/ubuntu/ai-news && git pull origin main'
subprocess.run(['ssh', '-i', KEY, '-o', 'StrictHostKeyChecking=no', HOST, cmd], check=True)
```

### Step 4: Restart PM2
```powershell
ssh -i "D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key" -o StrictHostKeyChecking=no ubuntu@129.154.255.90 "pm2 restart ai-news-frontend"
```

---

## Workflow B — Live Log Monitoring

### Tail PM2 Logs (last 100 lines, no-stream)
Write and SCP a Python script:
```python
import subprocess
KEY = r'D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key'
HOST = 'ubuntu@129.154.255.90'
result = subprocess.run(
    ['ssh', '-i', KEY, '-o', 'StrictHostKeyChecking=no', HOST,
     'pm2 logs ai-news-frontend --lines 100 --nostream 2>/dev/null'],
    capture_output=True, text=True
)
print(result.stdout)
print(result.stderr)
```

### Check PM2 Status
```powershell
ssh -i "D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key" -o StrictHostKeyChecking=no ubuntu@129.154.255.90 "pm2 list"
```

### Check Nginx Error Logs
Write Python script:
```python
cmd = 'sudo tail -50 /var/log/nginx/error.log'
```

---

## Workflow C — Live Site Preview / Health Check

### HTTP Health Check
```powershell
curl.exe -s -o NUL -w "%{http_code}" https://newsbuzz.site
curl.exe -s https://newsbuzz.site/api/health
```

### Use Browser MCP (puppeteer) for Visual Preview
```
Use puppeteer MCP tool to:
1. Navigate to https://newsbuzz.site
2. Take a screenshot
3. Check for console errors
4. Report what you see
```

### Check API Endpoints
```powershell
curl.exe -s "https://newsbuzz.site/api/articles?limit=3"
```

---

## Workflow D — Run Tests on Server

Write a Python script:
```python
import subprocess
KEY = r'D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key'
HOST = 'ubuntu@129.154.255.90'
cmd = 'cd /home/ubuntu/ai-news && npm test -- --passWithNoTests 2>&1 | tail -40'
result = subprocess.run(['ssh', '-i', KEY, '-o', 'StrictHostKeyChecking=no', HOST, cmd],
                        capture_output=True, text=True)
print(result.stdout)
```

---

## Workflow E — MongoDB Check on Server

Write Python script using `subprocess` to call mongosh:
```python
import subprocess
KEY = r'D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key'
HOST = 'ubuntu@129.154.255.90'
# Write a JS file first, SCP it, then run it
js = 'db = db.getSiblingDB("ainews"); print(db.articles.countDocuments({}));'
with open('/tmp/check.js', 'w') as f:
    f.write(js)
# SCP js file
subprocess.run(['scp', '-i', KEY, '-o', 'StrictHostKeyChecking=no', '/tmp/check.js',
                f'{HOST}:/tmp/check.js'])
# Run mongosh
result = subprocess.run(['ssh', '-i', KEY, '-o', 'StrictHostKeyChecking=no', HOST,
                         'mongosh ainews /tmp/check.js'],
                        capture_output=True, text=True)
print(result.stdout)
```

---

## Quick Reference — Safe SSH Commands (PowerShell)
These one-liners are safe (no `$` or `&&`):
```powershell
# PM2 status
ssh -i "D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key" -o StrictHostKeyChecking=no ubuntu@129.154.255.90 "pm2 list"

# Restart app
ssh -i "D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key" -o StrictHostKeyChecking=no ubuntu@129.154.255.90 "pm2 restart ai-news-frontend"

# Disk usage
ssh -i "D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key" -o StrictHostKeyChecking=no ubuntu@129.154.255.90 "df -h"

# Node version
ssh -i "D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key" -o StrictHostKeyChecking=no ubuntu@129.154.255.90 "node --version"
```
