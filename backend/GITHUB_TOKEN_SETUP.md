# GitHub Token Setup for Private Template Repositories

## Quick Setup (Production Server)

### Step 1: Generate GitHub Token

1. Visit: https://github.com/settings/tokens/new
2. Configure:
   - **Name**: `Platform Template Access`
   - **Expiration**: 90 days (your choice)
   - **Scopes**: Check ☑️ **`repo`** (Full control of private repositories)
3. Click **Generate token**
4. **COPY THE TOKEN** (starts with `ghp_...`) - you can't see it again!

### Step 2: Add Token to Production Server

```bash
# SSH to production
ssh ubuntu@instance-20250713-1730

# Edit environment file
cd ~/hosting_plateform/backend
nano .env

# Add this line (replace with your actual token):
GITHUB_TOKEN=ghp_your_token_here

# Save and exit (Ctrl+X, Y, Enter)
```

### Step 3: Restart Backend

```bash
pm2 restart backend
pm2 logs backend --lines 20
```

### Step 4: Test Template Deployment

1. Login to admin panel
2. Deploy **Smart Commerce** template  
3. Check logs - should see: `✓ Repository cloned successfully`

---

## How It Works

Your backend now uses **two types of tokens**:

| Scenario | Token Used | Purpose |
|----------|------------|---------|
| User deploys their own repo | `user.githubAccessToken` | User's personal GitHub |
| Platform deploys template | `process.env.GITHUB_TOKEN` | Platform's shared templates |

**Code** (buildExecutor.js line 217):
```javascript
const githubToken = user.githubAccessToken || process.env.GITHUB_TOKEN;
```

This means:
- ✅ Users' personal projects use their OAuth token
- ✅ Template deployments use your platform token
- ✅ Private templates stay private
- ✅ No security risk

---

## Token Security Best Practices

> [!CAUTION]
> **Never commit** `.env` to Git - it's already in `.gitignore`

✅ **Do:**
- Use GitHub Personal Access Token (Classic) with `repo` scope
- Store token in `.env` file on server only
- Rotate token every 90 days
- Use read-only access if you only need to clone

❌ **Don't:**
- Share token in chat, email, or screenshots
- Commit token to Git repository
- Use OAuth tokens meant for users

---

## Troubleshooting

### Error: "No GitHub token available for repository access"
**Fix**: Add `GITHUB_TOKEN=...` to `.env` and restart backend

### Error: "Repository not found" (even with token)
**Check**:
1. Token has `repo` scope: https://github.com/settings/tokens
2. Token hasn't expired
3. Repository name is correct in seeder
4. Your GitHub account has access to the repo

### Verify Token Works
```bash
# Test clone manually (replace with your token)
git clone https://ghp_YOUR_TOKEN@github.com/UzairArif11/nextjs-commerce-smart

# If successful, token is working
```

---

**✅ Once configured, all template deployments will work with private repositories!**
