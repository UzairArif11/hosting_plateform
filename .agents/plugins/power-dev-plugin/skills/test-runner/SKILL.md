---
name: test-runner
description: >-
  Activate to run tests locally or on the server. Use when the user says
  "run tests", "check if tests pass", "test the backend", "verify API", 
  or after implementing a new feature. Covers: local Jest/npm test, 
  remote server tests via SSH, and API endpoint verification with curl.
---

# Test Runner — Skill

## Local Tests (Windows / D:\work\platform)

### Frontend Tests (Next.js)
```powershell
# Run from project root
npm run test --prefix D:\work\platform\frontend
# OR
npm test --prefix D:\work\platform\frontend -- --passWithNoTests --watchAll=false
```

### Backend Tests (Node.js)
```powershell
npm test --prefix D:\work\platform\backend -- --passWithNoTests
```

### Lint Check
```powershell
npm run lint --prefix D:\work\platform\frontend
```

### Type Check (TypeScript)
```powershell
npm run type-check --prefix D:\work\platform\frontend
# OR
npx tsc --noEmit --project D:\work\platform\frontend\tsconfig.json
```

---

## Remote Tests on Server via SSH

Write a Python script (never chain &&):
```python
import subprocess, os

KEY = r'D:\sshAqeel\uz\ssh-key-2025-07-13 (3).key'
HOST = 'ubuntu@129.154.255.90'
scratch = r'C:\Users\INTERWARE\.gemini\antigravity\brain\<conv-id>\scratch'

script = """#!/bin/bash
cd /home/ubuntu/ai-news
echo "=== Frontend Tests ==="
npm test -- --passWithNoTests --watchAll=false 2>&1 | tail -20
echo "=== Backend Tests ==="
cd /home/ubuntu/ai-news/backend
npm test -- --passWithNoTests 2>&1 | tail -20
"""

script_path = os.path.join(scratch, 'run_tests.sh')
with open(script_path, 'w', newline='\n') as f:
    f.write(script)

subprocess.run(['scp', '-i', KEY, '-o', 'StrictHostKeyChecking=no',
                script_path, f'{HOST}:/tmp/run_tests.sh'])

result = subprocess.run(
    ['ssh', '-i', KEY, '-o', 'StrictHostKeyChecking=no', HOST,
     'bash /tmp/run_tests.sh'],
    capture_output=True, text=True
)
print(result.stdout[-3000:])  # last 3000 chars
print(result.stderr[-500:])
```

---

## API Endpoint Smoke Tests

```powershell
# Test articles API
curl.exe -s "https://newsbuzz.site/api/articles?limit=3" | python -m json.tool

# Test health
curl.exe -s "https://newsbuzz.site/api/health"

# Test auth endpoint
curl.exe -s -X POST "https://newsbuzz.site/api/auth/test"
```

---

## Build Test (Catch Next.js Build Errors Locally)
```powershell
npm run build --prefix D:\work\platform\frontend 2>&1 | Select-String -Pattern "Error|error|failed" | Select-Object -First 30
```

## Report Format
After running, always output:
```
## Test Results
- Frontend unit tests: PASS / FAIL (N tests)
- Backend unit tests: PASS / FAIL
- Lint: PASS / FAIL (N warnings)
- TypeScript: PASS / FAIL
- Build: PASS / FAIL
- API smoke tests: PASS / FAIL
```
