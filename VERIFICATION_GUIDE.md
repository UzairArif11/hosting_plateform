# 🧹 Cleanup & Verification Guide

## 1. Clean Your EC3 Server
Run these commands on your EC3 terminal to wipe all old containers:
```bash
# Stop all containers
docker stop $(docker ps -aq)

# Remove all containers
docker rm $(docker ps -aq)

# Deep clean (images, cache, volumes)
docker system prune -a --volumes -f
```

## 2. Test The New Flow
1. **Refresh your platform UI** (The DB is already reset).
2. Create a new Project and **Deploy**.
   - This will trigger the new "Remote Build" process.
   - It will create a new Container with the new limits.

## 3. Verify Limits on EC3
Once the deployment is active, run these commands on EC3 to prove the limits are real.

### Check Container Name
```bash
docker ps
# Note the name (e.g., EC3-user-...)
```

### 🧠 Verify Memory Limit (Bytes)
```bash
docker inspect <your-container-name> --format 'Memory: {{.HostConfig.Memory}}'
# Should equal your plan limit (e.g. 1GB = 1073741824)
```

### ⚡ Verify CPU Limit (Hard Limit)
```bash
docker inspect <your-container-name> --format 'NanoCpus: {{.HostConfig.NanoCpus}}'
# Should equal plan limit * 1e9 (e.g. 0.5 cores = 500000000)
```

### 💾 Verify Storage Limit (2GB)
1. Check Configuration:
```bash
docker inspect <your-container-name> --format 'StorageOpt: {{json .HostConfig.StorageOpt}}'
# Should show {"size":"2G"}
```
2. Check Inside Container:
```bash
docker exec -it <your-container-name> df -h /
# The "Size" column should be approx 2.0G
```

## 4. Verify Remote Build
To prove the build happened inside:
```bash
docker logs <your-container-name>
# You might see logs related to npm install/build if they were captured by PID 1, 
# but mostly you will see PM2 logs showing the app started successfully.
```
