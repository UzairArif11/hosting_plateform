# Feature: Team Collaboration

## Status: ✅ COMPLETE

**Priority**: MEDIUM  
**Estimated Time**: 1 week  
**Complexity**: Medium  
**Admin Controlled**: Yes (Max collaborators per plan)

## Overview

Allows project owners to invite other users to collaborate on their projects with specific roles (Viewer, Developer, Admin).

## User Flow

1.  **Invite**: Owner goes to Project Settings -> Team.
2.  **Send**: Enters email and role (e.g. `bob@example.com` as `Developer`).
3.  **Notification**: Bob receives an email (or platform notification) with an invite link.
4.  **Accept**: Bob clicks the link.
    *   If existing user: Added to project immediately.
    *   If new user: Redirected to Signup, then added after registration.
5.  **Collaborate**: Project appears in Bob's dashboard.

## Technical Architecture

### 1. Database Schema

#### Existing: `Project`
```javascript
collaborators: [{
  user: ObjectId(User),
  role: Enum('admin', 'developer', 'viewer'),
  addedAt: Date
}]
```

#### New: `Invitation` Model
Stores pending invites.
```javascript
{
  projectId: ObjectId,
  inviterId: ObjectId, // Who sent it
  email: String,       // Who is invited
  role: String,
  token: String,       // Unique invite token
  expiresAt: Date,
  status: Enum('pending', 'accepted', 'expired')
}
```

### 2. API Endpoints

-   `GET /api/projects/:id/members`: List members (implemented?).
-   `POST /api/projects/:id/invitations`: Send invite.
-   `GET /api/invitations/:token`: Validate invite.
-   `POST /api/invitations/:token/accept`: Accept invite.
-   `DELETE /api/projects/:id/members/:userId`: Remove member.

### 3. Permissions (RBAC)

-   **Viewer**: Read logs, view deployments.
-   **Developer**: Trigger deployments, manage env vars (non-secret).
-   **Admin**: Manage settings, add/remove members, delete project.

## Implementation Steps

### Phase 1: Backend
-   [x] Create `Invitation` model.
-   [x] Implement `POST /invitations` (Send).
-   [x] Implement `POST /invitations/accept`.
-   [x] Update `Project.js` schema (RBAC methods).

### Phase 2: Frontend
-   [x] Create `MembersPage` in Settings.
-   [x] Build "Invite User" modal.
-   [x] Create `AcceptInvitation` page (public route).

### Phase 3: Testing
-   [x] User A invites user B.
-   [x] User B accepts.
-   [x] Verify RBAC enforcement (plan-gated).
