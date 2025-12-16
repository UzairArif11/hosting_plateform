# 🔐 SSH Setup - Choose Your Method

## ⚡ **Quick Fix: Use Password Authentication**

This is the easiest way to get started!

### **Step 1: Add to backend/.env**

```env
# Use password instead of SSH keys
SSH_USE_PASSWORD=true
SSH_PASSWORD=your_ec2_ec3_password
SSH_USERNAME=ubuntu
```

### **Step 2: Test Connection**

```bash
cd backend
node test-ssh-connections.js
```

Should show:
```
✅ EC2 Connection successful!
✅ EC3 Connection successful!
```

---

## 🔑 **Alternative: Fix SSH Keys**

If you want to use SSH keys instead:

### **The Issue:**
Your SSH key paths point to directories, not files:
- `D:/work/ec2` (directory)
- `D:/work/ec3` (directory)

### **Solution:**
Point to the actual key files:

```env
SSH_EC2_KEY=D:/work/ec2/id_rsa
SSH_EC3_KEY=D:/work/ec3/id_rsa
```

Or if they have different names:
```env
SSH_EC2_KEY=D:/work/ec2/ec2_key.pem
SSH_EC3_KEY=D:/work/ec3/ec3_key.pem
```

---

## 🚀 **After SSH Works:**

### **1. Initialize Servers in Database**

```bash
cd backend
node init-servers.js
```

This creates EC2 and EC3 entries in MongoDB so you can manage them dynamically.

### **2. Clean User Container**

```bash
node cleanup-user-container.js
```

### **3. Restart Backend**

```bash
npm run dev
```

### **4. Deploy!**

Go to http://localhost:3000 and deploy a project!

---

## 📊 **Dynamic Server Management**

Now servers are stored in MongoDB! You can:

- ✅ Add new servers without code changes
- ✅ Enable/disable servers
- ✅ Set priorities
- ✅ Monitor health status
- ✅ Adjust resources

To add a new server later, just insert into MongoDB:

```javascript
{
  name: "EC4-New-Server",
  key: "EC4",
  host: "1.2.3.4",
  type: "mixed_users",
  enabled: true,
  totalCPU: 8,
  totalRAM: 32,
  maxContainers: 400,
  sshKey: "D:/work/ec4/key.pem",
  priority: 10
}
```

---

## ✅ **Recommended: Use Password for Now**

The quickest way to get deploying:

1. Add `SSH_USE_PASSWORD=true` and `SSH_PASSWORD=xxx` to `.env`
2. Run `node test-ssh-connections.js`
3. Run `node init-servers.js`
4. Run `npm run dev`
5. Deploy!

Later you can switch to SSH keys if needed.
