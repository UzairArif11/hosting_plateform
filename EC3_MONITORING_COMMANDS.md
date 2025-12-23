# 📊 EC3 STORAGE MONITORING COMMANDS

## 🔍 Quick Commands

### 1. Check All User Containers Storage
```bash
# List all containers with their storage usage
docker ps --filter "name=EC3-user-" --format "{{.Names}}" | while read name; do
  storage=$(docker exec $name du -sh /app 2>/dev/null | cut -f1)
  echo "$name: $storage"
done
```

### 2. Check Specific Container
```bash
# Replace with actual container name
docker exec EC3-user-69491ecca5fda0f50c83b31b du -sh /app
```

### 3. Detailed Breakdown
```bash
# See what's using space inside container
docker exec EC3-user-69491ecca5fda0f50c83b31b du -sh /app/* | sort -hr
```

### 4. All Containers with Live Stats
```bash
# CPU, RAM, Storage overview
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

### 5. Complete Resource Report
```bash
# Full monitoring script
for container in $(docker ps --filter "name=EC3-user-" --format "{{.Names}}"); do
  echo "=== $container ==="
  echo -n "Storage: "
  docker exec $container du -sh /app 2>/dev/null || echo "Error"
  echo -n "RAM: "
  docker stats --no-stream $container --format "{{.MemUsage}}"
  echo -n "CPU: "
  docker stats --no-stream $container --format "{{.CPUPerc}}"
  echo ""
done
```

## 📋 One-Line Monitoring Commands

```bash
# Quick overview of all containers
docker ps --filter "name=EC3-user-" --format "table {{.Names}}\t{{.Status}}\t{{.RunningFor}}"

# Storage only (sorted by size)
docker ps --filter "name=EC3-user-" -q | xargs -I {} sh -c 'echo -n "{}: "; docker exec {} du -sh /app 2>/dev/null' | sort -k2 -hr

# Live resource monitoring (refreshes every 2s)
watch -n 2 'docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"'
```

## 🚨 Alert Commands

```bash
# Find containers over 2GB
docker ps --filter "name=EC3-user-" -q | while read id; do
  size=$(docker exec $id du -sk /app 2>/dev/null | awk '{print $1}')
  if [ $size -gt 2097152 ]; then  # 2GB in KB
    name=$(docker inspect $id --format '{{.Name}}')
    echo "⚠️ ALERT: $name using $(($size/1024))MB (>2GB)"
  fi
done

# Find containers over 90% RAM
docker stats --no-stream --format "{{.Name}}\t{{.MemPerc}}" | awk '$2 > 90 {print "⚠️ RAM ALERT:", $1, $2}'
```

Save these as aliases in `~/.bashrc`:
```bash
alias check-storage='docker ps --filter "name=EC3-user-" -q | xargs -I {} sh -c "echo -n \"{}: \"; docker exec {} du -sh /app 2>/dev/null"'
alias check-violations='docker ps --filter "name=EC3-user-" -q | while read id; do size=$(docker exec $id du -sk /app 2>/dev/null | awk "{print \$1}"); if [ $size -gt 2097152 ]; then name=$(docker inspect $id --format "{{.Name}}"); echo "⚠️ $name: $(($size/1024))MB"; fi; done'
```
