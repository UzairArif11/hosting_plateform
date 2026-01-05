# 🚨 EC3 Server Overload - Troubleshooting Guide

## Current Issue

Your logs show:
```
[warn]: [ALERT] RAM usage at 111.1% (threshold: 70%)
[warn]: [ALERT] Storage usage at 109.2% (threshold: 70%)
```

**Important:** These alerts are for the **REMOTE EC3 server** (not your local machine).

---

## Understanding the Monitoring

**Your Setup:**
- Backend running on `localhost` (Windows) ← Your dev machine
- Monitoring service connects via SSH to EC3
- Checks EC3's RAM/storage remotely
- **NOT** monitoring your local Windows machine

**Code Location:** `backend/services/resourceMonitoring.js`

---

## Immediate Actions

### 1. Check EC3 Disk Usage
```bash
# SSH to EC3
ssh ubuntu@your-ec3-ip

# Check disk usage
df -h

# See what's using space
du -sh /* | sort -hr | head -10
```

### 2. Clean Docker on EC3
```bash
# Remove unused containers
docker container prune -f

# Remove unused images
docker image prune -af

# Remove unused volumes
docker volume prune -f

# Remove build cache
docker builder prune -af

# All-in-one cleanup
docker system prune -af --volumes
```

### 3. Check Docker Logs Size
```bash
# Check log sizes
du -sh /var/lib/docker/containers/*/*-json.log | sort -hr | head -10

# Truncate large logs
find /var/lib/docker/containers/ -name "*-json.log" -exec truncate -s 0 {} \;
```

### 4. Check RAM Usage
```bash
# See what's using RAM
docker stats --no-stream

# See top processes
top -o %MEM
```

---

## Prevention

### Set Docker Log Rotation
Already done in your `setup-deployment-server.sh`:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Verify it's applied:
```bash
cat /etc/docker/daemon.json
sudo systemctl restart docker
```

### Set Up Auto-Cleanup Cron
```bash
# Run daily at 2 AM
crontab -e

# Add:
0 2 * * * docker system prune -af --volumes 2>&1 | logger -t docker-cleanup
```

---

## Admin Panel Actions

### 1. View Current Docker Stats
```bash
GET /api/admin/servers/EC3/docker-stats
```

This shows ALL containers with CPU/RAM usage.

### 2. Identify Heavy Containers
Look for containers using excessive RAM/CPU in the Docker stats response.

### 3. Update Server Capacity Limits
```bash
# Increase EC3 total resources (if you upgraded)
PUT /api/admin/servers/EC3/capacity/resources
{
  "totalResources": {
    "ram": 64,      # If you added more RAM
    "storage": 500  # If you added more storage
  }
}

# Or limit users on EC3
PUT /api/admin/servers/EC3/capacity/plan-limits
{
  "planName": "free",
  "maxUsers": 100  # Reduce from current
}
```

### 4. Check Server Capacity
```bash
GET /api/admin/servers/EC3/capacity
```

Shows:
- Total resources
- Allocated resources
- Available resources
- Warning thresholds
- Current user count per plan

---

## Root Causes & Solutions

### Cause 1: Too Many Containers
**Solution:** Limit users per server
```bash
PUT /api/admin/servers/EC3/capacity/plan-limits
{ "planName": "free", "maxUsers": 100 }
```

### Cause 2: Large Docker Logs
**Solution:** Log rotation (already configured)

### Cause 3: Unused Images/Containers
**Solution:** Regular cleanup (cron job)

### Cause 4: Build Cache Accumulation
**Solution:** Prune builder cache
```bash
docker builder prune -af
```

### Cause 5: User App Memory Leaks
**Solution:** Set container memory limits (already done)

---

## Monitoring Dashboard

Use these admin routes to create a monitoring dashboard:

**Server Overview:**
```bash
GET /api/admin/servers
# Returns EC2 and EC3 stats
```

**Detailed Docker Stats:**
```bash
GET /api/admin/servers/EC3/docker-stats
# Returns all containers with CPU/RAM
```

**Capacity Status:**
```bash
GET /api/admin/servers/EC3/capacity
# Returns resource allocation
```

**Deployment Queue:**
```bash
GET /api/admin/deployment-queue/stats
# Returns active/waiting deployments
```

---

## Long-term Solutions

### 1. Add More Servers
- Spin up EC4 with load balancing
- Update `containerOrchestrator.js` to include EC4

### 2. Implement Auto-Scaling
- Monitor usage
- Spin up new server when > 80% capacity
- Migrate users gradually

### 3. User Quotas
- Enforce disk quotas per user
- Auto-suspend users exceeding limits

### 4. Caching Layer
- Use Redis for session/cache (reduce DB load)
- CDN for static assets (reduce bandwidth)

---

## Quick Fix Script

Save this as `ec3-cleanup.sh` and run on EC3:

```bash
#!/bin/bash

echo "🧹 Starting EC3 cleanup..."

# Stop old containers (>30 days)
docker ps -a --filter "status=exited" --format "{{.ID}}" --filter "until=720h" | xargs -r docker rm

# Remove dangling images
docker image prune -f

# Remove unused volumes
docker volume prune -f

# Truncate large logs
find /var/lib/docker/containers/ -name "*-json.log" -size +50M -exec truncate -s 10M {} \;

# Clean build cache
docker builder prune -f

echo "✅ Cleanup complete!"

# Show current usage
df -h /
docker system df
```

Run:
```bash
chmod +x ec3-cleanup.sh
./ec3-cleanup.sh
```

---

## Verification

After cleanup, verify:

```bash
# Check disk space
df -h

# Check Docker space
docker system df

# Check running containers
docker ps

# Check RAM usage
free -h
```

Then in admin panel:
```bash
GET /api/admin/servers/EC3
# Should show reduced usage
```

---

*Remember: The monitoring is for REMOTE servers, not your local machine!*
