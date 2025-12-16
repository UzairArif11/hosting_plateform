# ✅ AUTH MIDDLEWARE FIX

## 🔧 **ISSUE:**
```
TypeError: authorize is not a function
```

## ✅ **FIX APPLIED:**

Changed `settings.js` routes from:
```javascript
// ❌ Old (doesn't exist)
const { authenticate, authorize } = require('../middleware/auth');
router.get('/', authenticate, authorize(['admin']), ...);
```

To:
```javascript
// ✅ New (correct)
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
router.get('/', requireAuth, requireAdmin, ...);
```

## 📝 **CHANGES:**

1. ✅ Updated imports in `routes/settings.js`
2. ✅ Replaced `authenticate` with `requireAuth`
3. ✅ Replaced `authorize(['admin'])` with `requireAdmin`
4. ✅ All 3 routes fixed (GET, PUT, PUT /domains)

## 🚀 **NOW TRY:**

```bash
npm start
```

Should work now! ✅
