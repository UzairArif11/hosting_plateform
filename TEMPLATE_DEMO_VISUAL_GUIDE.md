# Template Demo System - Quick Visual Guide

## 🎯 What Users See

### Template WITH Live Demo (Admin Deployed)
```
┌─────────────────────────────────────┐
│  [Preview Image]                    │
│                                     │
│  📦 FREE Badge                      │
│  🌐 Live Demo ← Clickable!          │
│                                     │
│  Next.js Blog Starter               │
│  A modern blog template...          │
│                                     │
│  [Use Template]                     │
└─────────────────────────────────────┘
```
**Click "Live Demo" →** Opens `foodpanda.site/demo-nextjs-abc123/`

---

### Template WITHOUT Demo (Preview Only)
```
┌─────────────────────────────────────┐
│  [Preview Image]                    │
│                                     │
│  📦 FREE Badge                      │
│  🖼️ Preview Only ← Not clickable    │
│                                     │
│  React Dashboard                    │
│  A sleek dashboard template...      │
│                                     │
│  [Use Template]                     │
└─────────────────────────────────────┘
```
**"Preview Only" =** Only static image, no live demo

---

## 🔄 Admin Process

### Step 1: Click "Demo" Button
```
Admin Panel → Templates
┌──────────────────────────────┐
│ Next.js Blog                 │
│ [Edit] [Demo] [Delete]       │
└──────────────────────────────┘
         ↓ Click
```

### Step 2: Deploy Modal Opens
```
┌─────────────────────────────────────┐
│  🌐 Deploy Live Demo                │
│                                     │
│  📍 Deployment URL:                 │
│  foodpanda.site/demo-nextjs-abc/    │
│                                     │
│  ℹ️ Uses same system as user        │
│     deployments (path-based)        │
│                                     │
│  [Cancel]  [Deploy Demo]            │
└─────────────────────────────────────┘
```

### Step 3: Demo Deployed
```
✅ Demo deployed successfully!

Template Card Updates:
┌──────────────────────────────┐
│ Next.js Blog                 │
│ 🟢 Live Demo Active           │
│ [Edit] [Demo] [Delete]       │
└──────────────────────────────┘
```

---

## 🌐 URL Routing Explained

### Path-Based (Current Implementation)
```
✅ CORRECT:
https://foodpanda.site/demo-nextjs-abc123/
https://foodpanda.site/demo-ecommerce-xyz456/
https://foodpanda.site/demo-blog-def789/

❌ WRONG (Subdomain - NOT used):
https://nextjs-demo.foodpanda.site
https://blog-demo.foodpanda.site
```

### How It Works
```
Nginx Config:
location /demo-nextjs-abc123/ {
    proxy_pass http://localhost:3001/;
}

Same as user deployments:
location /myproject-xyz456/ {
    proxy_pass http://localhost:3002/;
}
```

---

## 📊 Comparison Table

| Feature | Preview Only | Live Demo |
|---------|-------------|-----------|
| **What Users See** | 🖼️ Static image | 🌐 Live button |
| **Clickable?** | ❌ No | ✅ Yes |
| **Interactive?** | ❌ No | ✅ Yes |
| **URL** | None | `/demo-template-abc/` |
| **Deployed By** | Nobody | Admin |
| **Purpose** | Show design | Test functionality |

---

## ✅ Checklist

### Admin Deploys Demo:
- [ ] Login to `/admin/templates`
- [ ] Click blue "Demo" button
- [ ] Click "Deploy Demo"
- [ ] Wait for success ✅
- [ ] Card shows "Live Demo Active"

### User Sees Demo:
- [ ] Visit `/templates`
- [ ] Template has "Live Demo" button
- [ ] Click button → opens demo URL
- [ ] Can interact with website
- [ ] Click "Use Template" to deploy own copy

---

## 🎯 Key Takeaways

1. **"Preview Only"** = Image only (screenshot)
2. **"Live Demo"** = Working website (deployed by admin)
3. **Path-based URLs** = `/demo-name-id/` (like user projects)
4. **NO subdomains** = Everything on main domain
5. **Same as user deploys** = Uses existing system

---

**Simple & Clear! 🎉**
