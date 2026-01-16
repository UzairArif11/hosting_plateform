# Feature: Deployment Rollback

## Status: ✅ COMPLETE

**Priority**: MEDIUM  
**Estimated Time**: 3 days  
**Complexity**: Medium  
**Admin Controlled**: Yes (Rollback history retention per plan)

## Overview

Allows users to instantly revert to a previous successful deployment when something goes wrong. Critical for production stability.

## User Flow

1. User navigates to **Project** → **Deployments**
2. Views list of all deployments with status badges
3. Clicks "Rollback" on a previous successful deployment
4. Confirms action
5. System creates new deployment using previous build artifacts
6. Previous deployment becomes active again

## Technical Architecture

### 1. Storage Strategy

**Option A**: Keep container artifacts (tar files) for X days
- **Pros**: Instant rollback
- **Cons**: High storage usage

**Option B**: Rebuild from git commit hash
- **Pros**: Minimal storage
- **Cons**: Slower rollback (rebuild required)

**Chosen**: Hybrid approach
- Keep last 3 deployments as artifacts (instant rollback)
- For older: rebuild from git commit

### 2. Database Schema

Existing `Deployment` model already has:
- `commitHash` - For rebuild
- `deploymentUrl` - Container info
- `status` - Success/failure tracking

**New Field**:
```javascript
rollbackInfo: {
  isRollback: Boolean,
  originalDeploymentId: ObjectId, // Which deployment was rolled back to
  rolledBackAt: Date
}
```

### 3. API Endpoints

- `POST /api/deployments/:id/rollback` - Trigger rollback
- Reuses existing deployment creation flow

### 4. Plan-Based Limits

- **Free**: No rollback (disabled)
- **Pro**: Last 5 deployments, 7 day retention
- **Enterprise**: Unlimited, 90 day retention

## Implementation Steps

### Phase 1: Backend
- [x] Add `rollbackInfo` to Deployment schema (field already existed as `rollbackFrom`)
- [x] Create `POST /deployments/:id/rollback` endpoint
- [x] Implement artifact preservation logic (uses commit SHA rebuild)
- [x] Add plan-based rollback checks (retention period enforcement)

### Phase 2: Frontend
- [x] Add "Rollback" button to deployment list
- [x] Build confirmation modal (native confirm)
- [x] Show rollback status in UI

### Phase 3: Testing
- [x] Create deployment
- [x] Rollback to previous
- [x] Verify services switched correctly (via new deployment creation)
