# Template Prisma Schema Fix 🔧

## Issue Detected in Production

**Error from logs**:
```
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: Error validating: This line is not a valid definition within a datasource.
  -->  prisma/schema.prisma:4
   | 
 3 |   provider = "sqlite"
 4 |   url      = env("DATABASE_URL") != "" ? env("DATABASE_URL") : "file:./data/portfolio.db"
 5 | }
```

**Problem**: 
- Template "Smart Portfolio" has invalid Prisma schema
- Conditional syntax not supported in Prisma
- Causes build failure

---

## Solution

### Fix Prisma Schema in Template Repository

The template repository (`uzairtesta/nextjs-portfolio`) needs to be updated:

**Current (Invalid)**:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL") != "" ? env("DATABASE_URL") : "file:./data/portfolio.db"
}
```

**Option 1: Environment Variable Only (Recommended)**:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

Then set `DATABASE_URL` via environment variable:
- For local development: `file:./data/portfolio.db`
- For production: User provides their own database URL

**Option 2: Default File Path**:
```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./data/portfolio.db"
}
```

Then users who want external DB override with `DATABASE_URL` env var.

---

## Immediate Fix (Platform Side)

### Update Template Configuration

Go to Admin → Templates → Edit "Smart Portfolio":

1. **Environment Variables Tab**:
   - Add variable: `DATABASE_URL`
   - Description: "Database URL (default: SQLite file)"
   - Default Value: `file:./data/portfolio.db`
   - Required: No (optional)
   - Secret: No

2. **Build Config Tab**:
   - Verify build command includes: `npx prisma generate`

This allows users to:
- Skip DATABASE_URL → Uses default SQLite file
- Or provide their own PostgreSQL/MySQL URL

---

## Long-Term Fix (Template Repository)

**Fix the Prisma schema** in the template repository:

```prisma
// prisma/schema.prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ... rest of schema ...
```

**Add .env.example** to template:
```bash
# Database Configuration
DATABASE_URL="file:./data/portfolio.db"
```

**Update README.md**:
```markdown
## Database Setup

This template uses Prisma with SQLite by default.

For local development:
```bash
DATABASE_URL="file:./data/portfolio.db"
npm run prisma:generate
npm run prisma:migrate
```

For production (PostgreSQL):
```bash
DATABASE_URL="postgres://user:pass@host:5432/dbname"
npm run prisma:generate
npm run prisma:migrate
```
```

---

## Prevention

### Template Validation (Future Enhancement)

Add pre-deployment validation:

1. **Check for Prisma** (`prisma/schema.prisma` exists)
2. **Validate schema**: Run `prisma validate`
3. **Warn admin** if schema has issues
4. **Suggest fixes** in UI

**File**: `backend/services/templateValidator.js` (NEW)
```javascript
async function validateTemplate(template) {
    // Clone repo
    // Check for prisma/schema.prisma
    // Run npx prisma validate
    // Return validation results
}
```

---

## Current Workaround

Until template is fixed:

1. **Admin**: Update template env vars to include `DATABASE_URL`
2. **Users**: Provide `DATABASE_URL` when deploying
3. **Or**: Use a different template that doesn't have Prisma issues

---

## Status

⚠️ **Template Repository Issue**: Prisma schema needs fixing
✅ **Platform**: Working correctly (error is from template, not platform)
✅ **Deployment Status**: Now properly shows error and allows redeploy
✅ **Admin Can**: Delete failed demo and fix template config

---

## Next Steps

1. **Fix template repository** (uzairtesta/nextjs-portfolio):
   - Update prisma/schema.prisma
   - Remove conditional syntax
   - Add .env.example

2. **Update template in admin**:
   - Add DATABASE_URL env var
   - Set default value
   - Update description

3. **Test deployment**:
   - Deploy with DATABASE_URL
   - Verify Prisma generates correctly
   - Confirm build succeeds
