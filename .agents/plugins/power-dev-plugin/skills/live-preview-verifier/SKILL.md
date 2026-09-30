---
name: live-preview-verifier
description: >-
  Activate this skill to visually verify the live site after any deployment.
  Use when the user asks to "check the site", "preview", "screenshot", "see how it looks",
  or after any deploy step. Uses Puppeteer MCP and HTTP checks to verify the live
  site at newsbuzz.site looks correct, has no JS errors, and APIs respond.
---

# Live Preview Verifier — Skill

## Purpose
After deploying code changes, visually verify the live site works before reporting success.

## Step-by-Step Verification

### 1. HTTP Status Check
```powershell
curl.exe -s -o NUL -w "%{http_code}" https://newsbuzz.site
```
Expected: `200`. If `502`/`504` → PM2 is down → restart it.

### 2. API Health Check
```powershell
curl.exe -s "https://newsbuzz.site/api/health"
curl.exe -s "https://newsbuzz.site/api/articles?limit=1"
```

### 3. Visual Screenshot via Puppeteer MCP
Use the `puppeteer` MCP tools:
```
1. puppeteer_navigate({ url: "https://newsbuzz.site" })
2. puppeteer_screenshot({ name: "live-preview-<timestamp>" })
3. puppeteer_evaluate({ script: "window.__errors || []" })
   → Check for JS console errors
```

Also screenshot key pages:
```
- https://newsbuzz.site/articles
- https://newsbuzz.site/about
- https://newsbuzz.site/privacy-policy
```

### 4. Console Error Check
```javascript
// Run via puppeteer_evaluate
document.querySelectorAll('*').length  // page rendered
document.title  // correct title
```

### 5. Mobile Viewport Check
```
puppeteer_evaluate: window.innerWidth → set viewport to 375x812
puppeteer_screenshot: mobile view
```

### 6. Report
After checks, report:
- ✅ HTTP status
- ✅ API responding
- ✅ Screenshot taken (embed in response)
- ✅ No JS errors
- ✅ Mobile view looks correct
OR flag any failures with exact error details.
