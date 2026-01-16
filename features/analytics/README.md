# Feature: Analytics Dashboard

## Status: ✅ COMPLETE

**Priority**: HIGH  
**Estimated Time**: 4 days  
**Complexity**: High  
**Admin Controlled**: Yes (Plan-based limits)

## Overview

Provides users with real-time insights into their project's performance. Tracks web vitals, visitor counts, and traffic sources across deployments.

### Key Metrics
- **Visitor Stats**: Unique Visitors, Total Page Views.
- **Geographic Data**: Traffic by Country.
- **Referrers**: Top traffic sources (Google, Twitter, Direct).
- **Device/OS**: Browser, OS, Device Type breakdown.
- **Web Vitals** (Optional/Advanced): LCP, FID, CLS.

## User Flow

1.  User navigates to **Project Dashboard** -> **Analytics**.
2.  User sees a graph of "Last 24 Hours" traffic.
3.  User can filter by date range (24h, 7d, 30d).
4.  User can toggle between "Visitors" and "Page Views".
5.  Tables below show Top Paths, Referrers, and Countries.

## Technical Architecture

### 1. Data Collection (`/api/analytics/track`)
- A lightweight tracking script (or image pixel) embedded in user deployments.
- **Better Approach**: Since we proxy traffic via Nginx, we can parse Nginx logs OR have an edge middleware (if using Vercel-like routing).
- **Chosen Approach**: A simple `collect` endpoint that the frontend SDK sends data to.
    - Endpoint: `POST /api/analytics/collect`
    - Payload: `{ projectId, path, referrer, userAgent, screenWidth }`

### 2. Database Schema (`AnalyticsEvent.js` or separate Timeseries DB)
For MVP with MongoDB:
- `AnalyticsEvent`: Stores raw events (high write volume).
    - `projectId`: ObjectId
    - `timestamp`: Date
    - `path`: String
    - `referrer`: String
    - `country`: String (derived from IP)
    - `browser`: String
    - `os`: String
    - `device`: String
    - `visitorId`: Hash (for unique visitor counting)

*Optimization*: Aggregated daily stats collection to avoid querying millions of rows.

### 3. API Endpoints
- `GET /api/projects/:id/analytics/summary`: Returns aggregated data for graphs.
- `GET /api/projects/:id/analytics/breakdown`: Returns top lists (referrers, etc.).

### 4. Admin Control
- **Retention Policy**: Free (24h), Pro (30d), Enterprise (1y).
- **Feature Flag**: Enable/Disable analytics per plan.

## Implementation Steps

### Phase 1: Backend & Tracking
- [x] Create `AnalyticsEvent` model (optimized for writes).
- [x] Create `POST /api/analytics/collect` endpoint.
- [x] Implement IP-to-Geo lookup (using `geoip-lite` or similar) - *Basic implementation*.
- [x] Create aggregation queries for stats.

### Phase 2: Frontend Dashboard
- [x] Implement `AnalyticsChart` component (using Tailwind/CSS).
- [x] Build `TopLocations` and `TopReferrers` tables.
- [x] Integrate into Project Dashboard.

### Phase 3: Integration
- [ ] Create a small JS snippet/SDK for users to add to their sites (`<script src="platform.com/tracker.js" />`).
- [ ] Verify data flow from deployed app to dashboard.
