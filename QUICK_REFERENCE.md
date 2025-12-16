# 🚀 Quick Reference - Deployment Commands

## ✅ **Setup Complete!**

Everything is configured. Here's what you need to know:

---

## 🎯 **Deploy Now (3 Steps)**

```bash
# 1. Start Backend
cd backend
npm run dev

# 2. Start Frontend (new terminal)
cd frontend
npm start

# 3. Deploy from UI
# Go to http://localhost:3000
# Click project → Deploy Now
```

---

## 📊 **What Happens During Deployment**

```
Local (EC1):
  ✅ Clone repo
  ✅ Install deps
  ✅ Build project

Remote (EC3):
  ✅ SSH connect
  ✅ Copy files
  ✅ Build Docker image
  ✅ Create container
  ✅ App LIVE!
```

---

## 🔧 **Useful Commands**

### **Test SSH**
```bash
cd backend
node test-ssh-connections.js
```

### **View Servers**
```bash
node init-servers.js
```

### **Clear User Container**
```bash
node cleanup-user-container.js
```

### **Verify Config**
```bash
node verify-env.js
```

---

## 🌐 **Access Deployed App**

**Direct IP:**
```
http://129.154.255.90:PORT
```

**With Domain (after DNS setup):**
```
https://projectname.foodpanda.site
```

---

## 📝 **Environment Variables**

Your `.env` should have:
```env
SSH_EC2_KEY=D:/work/ec2/uz.key
SSH_EC3_KEY=D:/work/ec3/uz.key
SSH_USERNAME=ubuntu
BASE_DOMAIN=foodpanda.site
```

---

## 🎊 **That's It!**

You're ready to deploy! 🚀

See `READY_TO_DEPLOY.md` for detailed guide.
