# 🚀 Admin Quick Start Guide

## First Time Setup

### 1. Restart Backend
```bash
cd d:/work/platform/backend
# Stop current process (Ctrl+C)
npm run dev
```

### 2. Create Default Plans
Use your admin account to create plans via API:

```bash
# Create Free Plan
POST http://localhost:5000/api/admin/plans
Authorization: Bearer YOUR_ADMIN_TOKEN

{
  "name": "free",
  "displayName": "Free Tier",
  "description": "Perfect for testing and small projects",
  "pricing": {
    "usd": 0,
    "pkr": 0
  },
  "resources": {
    "cpu": 0.5,
    "ram": 0.5,
    "storage": 2,
    "bandwidth": 100,
    "containers": 1,
    "projects": 3
  },
  "isTrial": true,
  "isActive": true
}

# Create Pro Plan
POST http://localhost:5000/api/admin/plans
{
  "name": "pro",
  "displayName": "Professional",
  "description": "For serious developers",
  "pricing": {
    "usd": 29,
    "pkr": 8000
  },
  "resources": {
    "cpu": 2,
    "ram": 4,
    "storage": 50,
    "bandwidth": 500,
    "containers": 5,
    "projects": 20
  },
  "isActive": true
}
```

### 3. Verify Server Balance
```bash
GET http://localhost:5000/api/admin/servers
```

Should show EC2 and EC3 with user counts.

---

## Daily Operations

### View All Plans
```bash
GET /api/admin/plans
```

### Update Plan Resources
```bash
PUT /api/admin/plans/PLAN_ID
{
  "resources": {
    "ram": 1.0  # Increase RAM to 1GB
  }
}
```

### Check Server Load
```bash
GET /api/admin/servers
```

### View Specific Server
```bash
GET /api/admin/servers/EC3
```

---

## Monitoring

Watch backend logs for:
- ✅ `Server load: EC2=X users, EC3=Y users` - Load balancing working
- ✅ `Assigning to EC2 (lower load)` - Smart routing
- ✅ `Plan created by admin` - Your plan changes
- ⚠️ `No plan found` - Need to create default plans

---

## Quick Troubleshooting

**All users still going to EC3?**
→ Restart backend (changes not loaded)

**"Plan not found" errors?**
→ Create "free" plan via POST /api/admin/plans

**Want to change free tier RAM?**
→ PUT /api/admin/plans/:freeId with new resources

**Want to see which users on which server?**
→ GET /api/admin/servers/EC2 or /api/admin/servers/EC3
