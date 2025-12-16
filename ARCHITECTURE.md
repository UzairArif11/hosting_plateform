# Vercel Clone Platform - Load Balanced 3-Server Architecture

## Overview

This platform uses a **Load Balanced 3-Server Oracle Cloud architecture** optimized for scalability, resource efficiency, and zero-downtime operations.

## Server Architecture

### EC1 - Main API Server (Primary)
- **Purpose**: Central API server, admin panel, frontend hosting
- **Responsibilities**:
  - All backend APIs (authentication, billing, project management)
  - Admin panel and dashboard
  - Frontend application hosting
  - MongoDB database hosting
  - User management and authentication
  - Payment processing (Payoneer integration)
- **Does NOT host**: User containers/applications
- **Location**: Primary Oracle Cloud instance

### EC2 - Mixed Server (Load Balanced)
- **Purpose**: Mixed container server for both free and paid users
- **User Types**: 
  - Free users (shared containers)
  - Paid users (dedicated containers)
  - Load balanced allocation
- **Resources**: 4 OCPU, 24GB RAM, up to 200 containers
- **Shared Pool**: 150 users max, 2 CPU, 12GB RAM
- **Dedicated Pool**: 50 users max, 2 CPU, 12GB RAM
- **Container Types**: Both shared and dedicated

### EC3 - Mixed Server (Load Balanced)  
- **Purpose**: Mixed container server for both free and paid users
- **User Types**: 
  - Free users (shared containers)
  - Paid users (dedicated containers) 
  - Load balanced allocation
- **Resources**: 8 OCPU, 48GB RAM, up to 300 containers
- **Shared Pool**: 200 users max, 3 CPU, 18GB RAM
- **Dedicated Pool**: 100 users max, 5 CPU, 30GB RAM
- **Container Types**: Both shared and dedicated

## Key Improvements

### Load Balancing Strategy
```
New User Registration:
1. Check EC2 capacity (shared pool)
2. Check EC3 capacity (shared pool)  
3. Assign to server with more available shared capacity
4. User gets shared container on assigned server

User Upgrades to Paid Plan:
1. Check current server for dedicated capacity
2. If available: Create dedicated container on SAME server
3. If not available: Check other server for dedicated capacity
4. Only migrate if necessary (rare case)
```

### Benefits Over Previous Architecture

#### ✅ Advantages of New Approach:
1. **No Cross-Server Migration**: Users upgrade in-place on same server
2. **Better Resource Utilization**: Both servers handle mixed workloads
3. **Simpler Operations**: No complex data migration needed
4. **Scalable**: Easy to add EC4, EC5 servers with same pattern
5. **Load Distribution**: Automatic load balancing across servers
6. **Data Persistence**: All data stays on same server during upgrades

#### ❌ Problems Solved:
- ~~Complex EC2→EC3 migrations~~
- ~~Data backup/restore requirements~~
- ~~Downtime during upgrades~~
- ~~Single-purpose server underutilization~~

## Container Allocation Logic

### For New Free Users:
```javascript
function assignNewUser(user) {
  const ec2Capacity = getSharedCapacity('EC2');
  const ec3Capacity = getSharedCapacity('EC3');
  
  if (ec2Capacity > ec3Capacity) {
    return createSharedContainer(user, 'EC2');
  } else {
    return createSharedContainer(user, 'EC3');
  }
}
```

### For User Upgrades:
```javascript
function upgradeUser(userId, newPlan) {
  const user = getUser(userId);
  const currentServer = user.oracleAccountId;
  
  // Try to upgrade on same server (preferred)
  if (hasDedicatedCapacity(currentServer)) {
    return upgradeOnSameServer(userId, newPlan, currentServer);
  }
  
  // Only migrate if current server is full
  const altServer = currentServer === 'EC2' ? 'EC3' : 'EC2';
  if (hasDedicatedCapacity(altServer)) {
    return migrateAndUpgrade(userId, newPlan, altServer);
  }
  
  return { error: 'No capacity available' };
}
```

## Data Persistence Strategy

### Container Types:
1. **Shared Containers**: Multiple users, minimal resources (0.25 CPU, 512MB RAM)
2. **Dedicated Containers**: Single user, plan-based resources (1-4 CPU, 4-24GB RAM)

### Storage:
- **Persistent Volumes**: `/mnt/shared-storage/users/{userId}/`
- **Data Directories**: 
  - `/app/user-data` - User files, uploads
  - `/app/config` - Application configuration  
  - `/app/databases` - SQLite, JSON databases
  - `/app/deployments` - Deployed applications

### Zero-Downtime Upgrades:
1. User has shared container on EC2
2. User upgrades to paid plan
3. Create dedicated container on EC2 (same server)
4. Remove shared container allocation
5. User data persists throughout (no migration needed)

## Admin Panel Features

### Load Balancing Monitoring:
- Real-time server utilization across EC2/EC3
- Shared vs dedicated container distribution
- Capacity planning and alerts

### Resource Management:
- View all users with container details
- Upgrade users to dedicated containers
- Monitor resource usage patterns
- Server health monitoring

### API Endpoints:
```javascript
GET  /api/admin/servers           // View all server status
GET  /api/admin/resources/status  // Combined resource utilization
POST /api/admin/users/:id/upgrade-dedicated // Upgrade user in-place
```

## Environment Configuration

```bash
# EC1 Configuration (Main API)
EC1_SERVER_IP=your-ec1-main-server-ip
EC1_SERVER_TYPE=api_main

# EC2 Configuration (Mixed Server)
EC2_SERVER_IP=your-ec2-mixed-server-ip
EC2_TOTAL_CPU=4
EC2_TOTAL_RAM=24
EC2_MAX_CONTAINERS=200
EC2_SERVER_TYPE=mixed_users

# EC3 Configuration (Mixed Server)
EC3_SERVER_IP=your-ec3-mixed-server-ip
EC3_TOTAL_CPU=8
EC3_TOTAL_RAM=48
EC3_MAX_CONTAINERS=300
EC3_SERVER_TYPE=mixed_users

# Shared storage for data persistence
SHARED_STORAGE_PATH=/mnt/shared-storage
```

## Scaling Strategy

### Adding New Servers:
1. Deploy EC4 with same mixed architecture
2. Update load balancing algorithm
3. Add to server pool
4. Automatic load distribution

### Benefits:
- **Horizontal Scaling**: Add servers as needed
- **Resource Efficiency**: Mixed workloads on all servers
- **Simple Management**: Same pattern for all container servers
- **Zero Migration**: Users stay on assigned servers

This architecture is much more practical and mirrors how real platforms like Vercel and Render operate!
