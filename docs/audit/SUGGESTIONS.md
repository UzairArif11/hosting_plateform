# 💡 Suggestions & Improvements

> **Last Updated:** April 13, 2026 13:08 PKT — Deep Review Phase 2
> Prioritized by impact and effort. Updated continuously.

---

## 🔴 Critical — Fix Immediately

### S1. `scaleContainerResources` / `recreateContainerWithDataPreservation` crash bug
**File:** `services/containerOrchestrator.js` lines 594-596, 664-666
**Issue:** `getUserContainer()` returns `null` when user/container not found, but the code checks `containerInfo.success` which doesn't exist on `null` — causes `TypeError: Cannot read properties of null`.
**Fix:** Change to:
```javascript
if (!containerInfo) {
  return { success: false, error: 'No container found for user' };
}
```

### S2. Duplicate exports in containerOrchestrator
**File:** `services/containerOrchestrator.js` line 1425/1440
**Issue:** `ORACLE_SERVERS` and `SHARED_RESOURCE_CAPS` exported twice in `module.exports`
**Fix:** Remove duplicate lines 1440-1441

### S3. JWT fallback secret in auth middleware
**File:** `middleware/auth.js` line 27
**Issue:** `jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')` — if `JWT_SECRET` is missing in production, tokens are verified against a guessable hard-coded secret.
**Fix:** Crash on startup if JWT_SECRET is not set:
```javascript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('FATAL: JWT_SECRET env var required');
```

### S4. Direct registration may pass invalid plan type
**File:** `routes/auth.js`
**Issue:** Direct registration sets `plan: plan` where `plan` is a string like `'free'`, but the User model expects an ObjectId reference.
**Fix:** Look up the Plan document first.

---

## 🟡 Medium — Fix Before Next Release

### S5. Remove debug console.log from commerce template config
**File:** `platform-templates/nextjs-commerce/next.config.js` lines 4-5, 11
**Issue:** Debug `console.log` statements left in production config file
**Fix:** Remove or gate behind `NODE_ENV !== 'production'`

### S6. Vue-restaurant has uncommitted changes
**Repo:** `platform-templates/vue-restaurant`
**Issue:** `.gitignore` and `vite.config.js` changes staged but not committed (malware cleanup + gitignore updates)
**Fix:** `git commit -m "security: remove malware, update gitignore"`

### S7. Invitation token leaked in API response
**File:** `routes/invitations.js` line 101
**Issue:** `token: existingInvite.token` sent in 400 response with comment "remove in production"
**Fix:** Remove the `token` field from the response:
```diff
- token: existingInvite.token // For dev/testing - remove in production
```

### S8. Duplicate schema fields in Project model
**File:** `models/Project.js` lines 182-189 and 243-256
**Issue:** `latestDeployment` and `productionDeployment` defined twice in schema. Mongoose silently uses last definition.
**Fix:** Remove the first pair (lines 182-193).

### S9. `scaleContainerResources` null check bug
**File:** `services/containerOrchestrator.js` lines 594-596, 664-666
**Issue:** `getUserContainer()` returns `null` when not found, but code checks `containerInfo.success` which crashes on null.
**Fix:** Change to `if (!containerInfo)` check.

### S10. Suspended users allowedPaths has dead path
**File:** `middleware/auth.js` line 170
**Issue:** `'/api/users/me'` in allowedPaths doesn't match any mounted route (actual is `/api/user/`)
**Fix:** Update to `'/api/user/'` or remove the dead entry since `/api/auth/` already covers `/api/auth/me`

---

## 🟢 Low — Nice to Have

### S8. Add request logging middleware
**Suggestion:** Add a request logging middleware that logs all API requests with timing, useful for debugging production issues.
```javascript
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});
```

### S9. Add health check for Redis + MongoDB
**File:** `server.js` `/health` endpoint
**Suggestion:** The health check only returns uptime. Add Redis and MongoDB connectivity checks:
```javascript
app.get('/health', async (req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;
  const redisOk = buildQueue.client.status === 'ready';
  res.status(mongoOk && redisOk ? 200 : 503).json({
    status: mongoOk && redisOk ? 'healthy' : 'degraded',
    mongo: mongoOk, redis: redisOk, uptime: process.uptime()
  });
});
```

### S10. Build executor size (82KB)
**File:** `services/buildExecutor.js` — 82KB is very large for a single file
**Suggestion:** Consider splitting into:
- `buildExecutor/index.js` (main orchestration)
- `buildExecutor/frameworkDetector.js`
- `buildExecutor/npmBuilder.js`
- `buildExecutor/pm2Manager.js`
- `buildExecutor/nginxConfigurator.js`

### S11. Add Prisma migration for templates on deploy
**Suggestion:** Templates use Prisma with SQLite. Currently, `prisma db push` is run during build. Consider adding explicit migration tracking for data preservation on updates.

### S12. Add rate limiting to billing endpoints
**Suggestion:** Payment session creation endpoints (`/create-session-*`) should have rate limiting to prevent abuse:
```javascript
const paymentLimiter = rateLimit({ windowMs: 60 * 1000, max: 5 });
router.post('/create-session-paddle', paymentLimiter, [...]);
```

### S13. Add webhook idempotency
**Suggestion:** Payment webhooks should check for duplicate processing by storing processed webhook IDs:
```javascript
const processedWebhooks = new Set(); // Or use Redis
if (processedWebhooks.has(webhookId)) return res.json({ received: true });
processedWebhooks.add(webhookId);
```

### S14. Template basePath inconsistency
**Issue:** Portfolio and Blog use `dotenv.config()` in next.config.js to load `.env`, while Commerce relies on process.env. This is because Next.js doesn't always load `.env` files before config evaluation.
**Suggestion:** Standardize all 3 templates to use the dotenv approach for reliability.

### S15. Add database indexes for common queries
**Suggestion:** Add indexes for frequently queried fields:
```javascript
// User model
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ subscriptionStatus: 1, planExpiresAt: 1 }); // For cron jobs

// Deployment model
deploymentSchema.index({ projectId: 1, status: 1 }); // For active deployments
```

### S16. Container assignment field naming
**Issue:** User model uses both `assignedServer` and `oracleAccountId` for the same concept. Some code checks one, some checks the other.
**Suggestion:** Deprecate `oracleAccountId` and standardize on `assignedServer` everywhere.

---

## 🔮 Future Features

### F1. Auto-scaling containers
Dynamically scale container resources based on traffic patterns.

### F2. Deployment previews for branches
Create temporary preview deployments for feature branches (PR previews).

### F3. Log aggregation dashboard
Centralized log viewer in admin panel showing build logs, container logs, and API logs.

### F4. Backup & restore for user data
Scheduled backups of user containers with one-click restore.

### F5. Multi-region support
Deploy containers to different geographic regions based on user preference.

---

*This document will be updated as the review continues.*
