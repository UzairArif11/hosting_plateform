# Feature: Custom Domains Management

## Status: ✅ COMPLETE

**Priority**: HIGH  
**Estimated Time**: 5 days  
**Complexity**: Medium  
**Admin Controlled**: Yes (Plan-based limits)

## Overview

Allows users to attach custom domains (e.g., `myapp.com`) to their projects. This involves:
1.  **Domain Registration**: Adding the domain to the project in the dashboard.
2.  **Ownership Verification**: Verifying the user owns the domain via DNS TXT records.
3.  **Routing**: Configuring the underlying reverse proxy (Nginx) to route traffic for this domain to the correct container.
4.  **SSL/TLS**: Automatic SSL certificate generation (via Caddy or Let's Encrypt bot - for MVP we might mock or assume external termination if using Vercel/Cloudflare, but typically we need to handle it). *For this implementation, we will focus on the verification and routing logic.*

## User Flow

1.  User goes to **Project Settings** -> **Domains**.
2.  User enters `example.com`.
3.  System generates a verification token (e.g., `vcp-verification=xyz123`).
4.  User adds a `TXT` record to their DNS provider.
5.  User adds an `A` record or `CNAME` pointing to our platform IP/domain.
6.  User clicks **Verify**.
7.  System resolves DNS.
    *   If TXT record matches: Domain is marked `verified`.
    *   System configures Nginx to route `example.com` -> Project Container.
8.  User can now access project via `example.com`.

## Technical Architecture

### 1. Backend Service (`domainVerification.js`)
*   `generateVerificationToken()`: Creates a unique token.
*   `verifyDnsRecord(domain, token)`: Uses Node.js `dns` module to resolve TXT records and check for token.
*   `checkARecord(domain)`: Verifies A record points to our server (optional but good UX).

### 2. Database Schema (`Project.js`)
Existing `domains` array needs enhancement:
```javascript
domains: [{
  domain: String,
  isCustom: Boolean,
  verificationToken: String, // New
  verified: Boolean,
  verifiedAt: Date,
  dnsConfigured: Boolean, // Checks A record
  createdAt: Date
}]
```

### 3. API Endpoints
*   `POST /api/projects/:id/domains`: Add domain (generate token).
*   `POST /api/projects/:id/domains/:domainId/verify`: Trigger verification.
*   `DELETE /api/projects/:id/domains/:domainId`: Remove domain.
*   `GET /api/projects/:id/domains`: List domains (already in project details, but maybe specialized endpoint).

### 4. Admin Control
*   **Plan Limits**: `maxDomains` per plan.
*   **Free Plan**: Maybe 0 or 1 custom domain.
*   **Pro Plan**: Unlimited.

## Implementation Steps

### Phase 1: Backend Logic
- [x] Create `domainVerification.js` service using `dns` promises.
- [x] Update `Project.js` schema locally if needed (or just ensure fields are used).
- [x] Implement `verify` endpoint in `projects.js`.
- [x] Add `Nginx` configuration update on successful verification (using `nginxRouter.js`).

### Phase 2: Frontend UI
- [x] Create `Domains` tab in Project Dashboard.
- [x] Build "Add Domain" modal/form.
- [x] Build "Verification" state UI (showing DNS instructions).
- [x] Handle success/error states.

### Phase 3: Testing
- [x] Mock DNS responses for local testing.
- [x] Verify Nginx config generation.
