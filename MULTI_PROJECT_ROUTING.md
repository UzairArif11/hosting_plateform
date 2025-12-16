# 🌐 Multi-Project Domain Routing

## **Current Setup:**
- ✅ `foodpanda.site` → Shows latest deployed app
- ✅ `129.154.255.90` → Shows latest deployed app

## **Goal:**
- `project1.foodpanda.site` → User 1's app (port 4372)
- `project2.foodpanda.site` → User 2's app (port 4263)
- `trello.foodpanda.site` → Trello clone (port 4372)

---

## **Solution: Dynamic Nginx Configuration**

### **Step 1: Update Nginx Config**

On EC3, create `/etc/nginx/conf.d/projects.conf`:

```nginx
# Map subdomain to port
map $host $backend_port {
    default 4372;  # Default to latest
    ~^(?<project>.+)\.foodpanda\.site$ $project_port;
}

# Catch-all server for subdomains
server {
    listen 80;
    server_name *.foodpanda.site;
    
    location / {
        # Proxy to the correct port based on subdomain
        proxy_pass http://localhost:$backend_port;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Main domain
server {
    listen 80;
    server_name foodpanda.site;
    
    location / {
        proxy_pass http://localhost:4372;
        proxy_set_header Host $host;
    }
}
```

### **Step 2: Create Port Mapping Database**

We need to store which project uses which port. Options:

**Option A: Use MongoDB**
```javascript
// Store in Project model
{
  projectName: "trello-clone",
  subdomain: "trello",
  port: 4372,
  userId: "..."
}
```

**Option B: Use Redis**
```javascript
// Key: subdomain, Value: port
redis.set("trello", "4372")
redis.set("project2", "4263")
```

**Option C: Dynamic Nginx Config**
Generate Nginx config files dynamically after each deployment.

---

## **🚀 Recommended: Use Nginx + Lua**

Install OpenResty (Nginx with Lua):

```bash
# On EC3
sudo apt install -y openresty

# Configure dynamic routing
sudo tee /etc/openresty/nginx.conf > /dev/null <<'EOF'
http {
    server {
        listen 80;
        server_name *.foodpanda.site;
        
        location / {
            content_by_lua_block {
                local redis = require "resty.redis"
                local red = redis:new()
                red:connect("127.0.0.1", 6379)
                
                local host = ngx.var.host
                local subdomain = host:match("^(.+)%.foodpanda%.site$")
                
                local port = red:get("subdomain:" .. subdomain)
                if port == ngx.null then
                    port = "4372"  -- default
                end
                
                ngx.var.backend = "http://localhost:" .. port
            }
            
            proxy_pass $backend;
        }
    }
}
EOF
```

---

## **⚡ Simplest Solution: Generate Nginx Configs**

After each deployment, update Nginx config:

```javascript
// In buildExecutor.js after successful deployment
async function updateNginxConfig(projectName, port) {
    const ssh = new NodeSSH();
    await ssh.connect({ host: EC3_IP, ... });
    
    const config = `
server {
    listen 80;
    server_name ${projectName}.foodpanda.site;
    
    location / {
        proxy_pass http://localhost:${port};
        proxy_set_header Host $host;
    }
}
`;
    
    await ssh.execCommand(`echo '${config}' | sudo tee /etc/nginx/sites-available/${projectName}`);
    await ssh.execCommand(`sudo ln -sf /etc/nginx/sites-available/${projectName} /etc/nginx/sites-enabled/`);
    await ssh.execCommand(`sudo nginx -s reload`);
}
```

---

## **📋 Implementation Steps:**

1. **Store port mapping in MongoDB** ✅ (already have Project model)
2. **After deployment, update Nginx config**
3. **Reload Nginx**
4. **Subdomain works!**

---

## **🎯 For Now:**

Your app is accessible at:
- ✅ `http://foodpanda.site`
- ✅ `http://129.154.255.90`

**Want me to implement dynamic subdomain routing?** 🚀
