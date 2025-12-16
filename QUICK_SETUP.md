# 🚀 Quick Setup - Run These Commands

## 1. Add to backend/.env

```env
SSH_EC2_KEY=F:/sshA/ec2
SSH_EC3_KEY=F:/sshA/ec3
SSH_USERNAME=ubuntu
BASE_DOMAIN=foodpanda.site
```

## 2. Test SSH (IMPORTANT - Run this first!)

```bash
cd backend
node test-ssh-connections.js
```

## 3. Restart Backend

```bash
cd backend
npm run dev
```

## 4. Deploy a Project

Go to http://localhost:3000 and click "Deploy Now"

---

## ✅ What Changed:

**Before:**
- ❌ Built Docker image on EC1 (local)
- ❌ Image didn't exist on EC3
- ❌ Deployment "successful" but app not working

**Now:**
- ✅ Builds Docker image on EC3 via SSH
- ✅ Image exists on EC3
- ✅ Container runs on EC3
- ✅ App is ACTUALLY deployed and accessible!

---

## 📝 Next Steps (After First Successful Deployment):

1. Set up domain DNS (see PRODUCTION_SETUP.md)
2. Install Caddy reverse proxy
3. Configure routing service
4. Access apps at: `projectname.foodpanda.site`

---

**Ready to test? Add the env variables and run the SSH test!** 🚀
