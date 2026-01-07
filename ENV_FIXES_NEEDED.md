# ⚠️ ENV FILE CORRECTIONS NEEDED

Your current .env has some issues. Here's what to fix:

---

## 🔧 **REQUIRED CHANGES:**

### **1. Change Variable Names:**

```bash
# ❌ WRONG (your current .env)
MONGO_URI=mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin

# ✅ CORRECT (code uses this name)
MONGODB_URI=mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin
```

### **2. Add Missing Variables:**

```bash
# Add these (required!)
FRONTEND_URL=https://foodpanda.site
SESSION_SECRET=your-very-long-random-secret-at-least-32-characters-long
API_URL=https://foodpanda.site
REDIS_URL=redis://localhost:6379
```

### **3. Add SMTP Credentials:**

```bash
# Your SMTP config is incomplete
SMTP_USER=your-email@zoho.com
SMTP_PASS=your-email-password  
SMTP_FROM=noreply@foodpanda.site
```

### **4. Add OAuth Credentials:**

```bash
# Fill these in (currently empty!)
GITHUB_CLIENT_ID=get-from-github-developer-settings
GITHUB_CLIENT_SECRET=get-from-github-developer-settings

GOOGLE_CLIENT_ID=get-from-google-console
GOOGLE_CLIENT_SECRET=get-from-google-console
```

---

## ✅ **CORRECTED .ENV FILE:**

```bash
# ============================================
# Server Configuration
# ============================================
PORT=5000
NODE_ENV=production
BASE_DOMAIN=foodpanda.site
API_URL=https://foodpanda.site
FRONTEND_URL=https://foodpanda.site

# ============================================
# Security
# ============================================
JWT_SECRET=ROTATED_JWT_SECRET_REMOVED
SESSION_SECRET=create-very-long-random-string-here-min-32-chars

# ============================================
# Database Configuration
# ============================================
MONGODB_URI=mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin
REDIS_URL=redis://localhost:6379
REDIS_PORT=6379

# ============================================
# SSH Configuration
# ============================================
SSH_EC2_KEY=/home/ubuntu/.ssh/ec2_key
SSH_EC3_KEY=/home/ubuntu/.ssh/ec3_key
SSH_USERNAME=ubuntu

# ============================================
# Server IPs
# ============================================
EC1_SERVER_IP=localhost
EC2_SERVER_IP=140.238.229.147
EC2_TOTAL_CPU=4
EC2_TOTAL_RAM=24
EC2_MAX_CONTAINERS=200
EC2_SERVER_TYPE=shared_users

EC3_SERVER_IP=129.154.255.90
EC3_TOTAL_CPU=2
EC3_TOTAL_RAM=12
EC3_MAX_CONTAINERS=100
EC3_SERVER_TYPE=shared_users

# ============================================
# SMTP Configuration
# ============================================
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@zoho.com
SMTP_PASS=your-zoho-app-password
SMTP_FROM=noreply@foodpanda.site

# ============================================
# OAuth Configuration
# ============================================
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=https://foodpanda.site/api/auth/github/callback

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://foodpanda.site/api/auth/google/callback

# ============================================
# Build Configuration
# ============================================
BUILD_DIR=/tmp/builds
MAX_BUILD_TIME=900000
```

---

## 🎯 **HOW TO UPDATE:**

```bash
# On your server
cd ~/hosting_plateform/backend
nano .env
```

**Make these changes:**
1. Change `MONGO_URI` → `MONGODB_URI`
2. Add `FRONTEND_URL=https://foodpanda.site`
3. Add `SESSION_SECRET=...` (long random string)
4. Add `API_URL=https://foodpanda.site`
5. Change `REDIS_PORT=6379` → Add `REDIS_URL=redis://localhost:6379`
6. Fill in SMTP credentials (if using email)
7. Fill in OAuth credentials (if using GitHub/Google login)

**Save and restart:**
```bash
pm2 restart backend
```

---

## 🔐 **GENERATE SECURE SESSION_SECRET:**

```bash
# Generate random secret (on server)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Copy output and add to .env:
SESSION_SECRET=<paste-the-output-here>
```

---

## ⚠️ **CRITICAL FIXES:**

| Your .env | Should be | Why |
|-----------|-----------|-----|
| `MONGO_URI` | `MONGODB_URI` | Code uses MONGODB_URI |
| Missing | `FRONTEND_URL` | Required for CORS |
| Missing | `SESSION_SECRET` | Required for sessions |
| `REDIS_PORT` only | Add `REDIS_URL` | Code expects URL |

---

## ✅ **AFTER FIXING .ENV:**

```bash
pm2 restart backend
pm2 logs backend

# Check for errors
# Should see: "✅ Connected to MongoDB"
```

---

**For SSH keys upload, use Termius SFTP (drag and drop)** - much easier than SCP! 📁

**Want me to create a script that validates your .env file?** 🔍
