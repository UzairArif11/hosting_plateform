# Production Deployment Checklist

## First Time Deployment

When deploying for the **FIRST TIME**, run these steps:

### 1. Initial Setup
```bash
cd /path/to/platform

# Install all dependencies
cd backend && npm install
cd ../frontend && npm install
cd ../cli && npm install
cd ..

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with production values
```

### 2. Seed Database (FIRST TIME ONLY)
```bash
# Seed templates
node backend/scripts/seedTemplates.js

# Verify seeding
mongo vercel-clone --eval "db.templates.count()"
```

### 3. Deploy
```bash
chmod +x deploy.sh
./deploy.sh
```

### 4. Test
```bash
chmod +x test-production.sh
export PROD_DOMAIN=your-domain.com
./test-production.sh
```

---

## Subsequent Deployments

For **UPDATES** (after first deployment):

### 1. Deploy New Code
```bash
cd /path/to/platform
./deploy.sh  # This handles everything
```

**What deploy.sh does**:
- ✅ Pulls latest code
- ✅ Installs new dependencies (if package.json changed)
- ✅ Builds frontend
- ✅ Checks if templates need seeding (skips if exist)
- ✅ Restarts services
- ✅ Runs health checks

### 2. Test Deployment
```bash
PROD_DOMAIN=your-domain.com ./test-production.sh
```

---

## When to Re-run Seeders

**Re-run seeders ONLY if**:
- Adding new templates
- Template data corrupted
- Database reset

```bash
# Force re-seed (will create duplicates if not careful)
node backend/scripts/seedTemplates.js
```

---

## Your Workflow

### Regular Deployment (Most Common)
```bash
cd d:/work/platform
./deploy.sh               # Deploy
./test-production.sh      # Verify
```

### First Time Only
```bash
cd d:/work/platform
node backend/scripts/seedTemplates.js  # Seed database
chmod +x deploy.sh
./deploy.sh                             # Deploy
./test-production.sh                    # Verify
```

---

## ⚠️ Important Notes

1. **Seeders**: Only run once or when adding new templates
2. **Environment Variables**: Must be configured before first deployment
3. **Database**: Must be running (MongoDB)
4. **Ports**: 5000 (backend), 3000 (frontend) must be available
5. **Logs**: Check `logs/backend.log` and `logs/frontend.log` if issues

---

## Quick Answer to Your Question

**If it's your FIRST deployment on live server**:
```bash
# First time setup
cd d:/work/platform
node backend/scripts/seedTemplates.js  # ← Run this ONCE
./deploy.sh
./test-production.sh
```

**If you've already deployed once (subsequent updates)**:
```bash
# Just deploy
cd d:/work/platform
./deploy.sh                # ← This is enough
./test-production.sh       # ← Verify it worked
```

The `deploy.sh` script I created automatically checks if templates exist and only seeds if needed!
