# Feature: Environment Management

## Status: 🚧 IN PROGRESS

**Priority**: MEDIUM  
**Estimated Time**: 3 days  
**Complexity**: Medium  
**Admin Controlled**: Yes (Max environments per plan)

## Overview

Allows users to manage multiple deployment environments (Production, Staging, Preview) with different configurations, environment variables, and URLs.

## User Flow

1. User navigates to **Project** → **Settings** → **Environments**
2. Views list of environments (Production is default)
3. Clicks "Add Environment" → Enters name (e.g., "Staging")
4. Configures environment-specific variables
5. Deploys to specific environment via branch mapping or manual trigger

## Technical Architecture

### 1. Environment Configuration

Existing `Project` model supports:
- `environmentVariables` array with `environments` field
- Need to extend for branch-to-environment mapping

**New Fields**:
```javascript
environmentConfigs: [{
  name: String, // 'production', 'staging', 'preview', 'development'
  branch: String, // Branch auto-deploy for this env
  domain: String, // Custom domain or auto-generated
  protectedBranch: Boolean, // Require approval for deploys
  environmentVariables: [{ key, value, isSecret }]
}]
```

### 2. Deployment Flow

- User can deploy to specific environment
- Branch push triggers deployment to mapped environment
- Environment variables are injected at build time

### 3. Plan-Based Limits

- **Free**: Production only
- **Pro**: Production + Staging (2 environments)
- **Enterprise**: Unlimited environments

## Implementation Steps

### Phase 1: Backend
- [ ] Extend Project schema with `environmentConfigs`
- [ ] Update deployment creation to accept `targetEnvironment`
- [ ] Implement environment-specific variable injection
- [ ] Add plan-based environment limits

### Phase 2: Frontend
- [ ] Create Environments settings page
- [ ] Build "Add Environment" form
- [ ] Environment variable management UI
- [ ] Deploy to environment selector

### Phase 3: Testing
- [ ] Create multiple environments
- [ ] Deploy to different environments
- [ ] Verify variable isolation
