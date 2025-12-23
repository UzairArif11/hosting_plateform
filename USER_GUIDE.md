# 👤 USER GUIDE - How to Use the Deployment Platform

## 📚 **TABLE OF CONTENTS**

1. [Getting Started](#getting-started)
2. [Creating Your First Project](#creating-your-first-project)
3. [Deploying Your Application](#deploying-your-application)
4. [Managing Deployments](#managing-deployments)
5. [Environment Variables](#environment-variables)
6. [Custom Domains](#custom-domains)
7. [Monitoring & Logs](#monitoring--logs)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)
10. [FAQs](#faqs)

---

## 🚀 **GETTING STARTED**

### **Step 1: Sign Up / Login**

1. Go to the platform homepage
2. Click **"Sign in with Google"** or **"Sign in with GitHub"**
3. Authorize the application
4. You'll be redirected to your dashboard

**What you need:**
- A Google or GitHub account
- A GitHub repository with your web application

---

### **Step 2: Connect GitHub (if using GitHub login)**

If you signed in with Google, you'll need to connect your GitHub account:

1. Go to **Settings** → **Integrations**
2. Click **"Connect GitHub"**
3. Authorize the application to access your repositories
4. You can now deploy from your GitHub repos!

---

## 📁 **CREATING YOUR FIRST PROJECT**

### **Step 1: Click "New Project"**

From your dashboard, click the **"New Project"** button.

### **Step 2: Enter Repository Details**

Fill in the project information:

**Repository URL:**
```
https://github.com/yourusername/your-repo
```

**Project Name:**
```
My Awesome App
```

**Branch (optional):**
```
main  (default)
```

### **Step 3: Framework Detection**

The platform will automatically detect your framework:
- ✅ React (Create React App, Vite)
- ✅ Next.js
- ✅ Vue.js
- ✅ Nuxt.js
- ✅ Angular
- ✅ Svelte
- ✅ Static HTML/CSS/JS

### **Step 4: Build Configuration (optional)**

You can customize build settings:

**Build Command:**
```
npm run build
```

**Output Directory:**
```
build  (for React)
dist   (for Vue/Vite)
.next  (for Next.js)
```

**Install Command:**
```
npm install
```

### **Step 5: Create Project**

Click **"Create Project"** and your project will be created!

---

## 🚀 **DEPLOYING YOUR APPLICATION**

### **Step 1: Go to Project Page**

Click on your project from the dashboard.

### **Step 2: Click "Deploy Now"**

Click the **"Deploy Now"** button to start a deployment.

### **Step 3: Watch Real-time Progress**

You'll see real-time updates:

```
🚀 Starting deployment...
📦 Cloning repository...
✓ Repository cloned successfully
🔍 Detecting framework...
✓ Detected framework: react
📥 Installing dependencies...
✓ Dependencies installed in 45.2s
🔨 Building project...
✓ Build completed in 120.5s
🚢 Deploying to container...
✓ Container deployed
🌐 Deployment URL: https://foodpanda.site/myapp-abc123-456789/
✅ Deployment successful!
```

### **Step 4: Visit Your Site**

Once deployment is complete, click **"Visit Site"** to see your live application!

**Your URL format:**
```
https://foodpanda.site/projectname-deployid-timestamp/
```

**Example:**
```
https://foodpanda.site/myapp-693be90e-79435108/
```

---

## 📊 **MANAGING DEPLOYMENTS**

### **Viewing Deployment History**

On your project page, you'll see all past deployments:

```
┌─────────────────────────────────────────────────────────┐
│  Deployment #5                                          │
│  Status: Success ✅                                     │
│  Branch: main                                           │
│  Commit: "Fix navigation bug"                           │
│  Duration: 3m 45s                                       │
│  URL: https://foodpanda.site/myapp-abc-123/           │
│  [Visit Site] [View Logs]                              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Deployment #4                                          │
│  Status: Failed ❌                                      │
│  Branch: main                                           │
│  Error: Build failed - missing dependencies            │
│  Duration: 1m 20s                                       │
│  [View Logs]                                            │
└─────────────────────────────────────────────────────────┘
```

### **Viewing Deployment Logs**

Click **"View Logs"** to see detailed build and deployment logs:

```
[2025-12-15 11:13:42] 🚀 Starting deployment...
[2025-12-15 11:13:42] 📦 Cloning repository...
[2025-12-15 11:13:44] ✓ Repository cloned successfully
[2025-12-15 11:13:44] 🔍 Detecting framework...
[2025-12-15 11:13:44] ✓ Detected framework: react
[2025-12-15 11:13:44] 📥 Installing dependencies...
[2025-12-15 11:14:45] ✓ Dependencies installed in 60.94s
[2025-12-15 11:14:45] 🔨 Building project...
[2025-12-15 11:16:56] ✓ Build completed in 130.61s
[2025-12-15 11:16:56] 🚢 Deploying to container...
[2025-12-15 11:17:21] ✅ Deployment successful!
```

### **Redeploying**

To redeploy:
1. Go to your project page
2. Click **"Deploy Now"** again
3. A new deployment will be created

**Note:** Each deployment gets a unique URL. Previous deployments remain accessible.

---

## 🔐 **ENVIRONMENT VARIABLES**

### **Adding Environment Variables**

1. Go to your project page
2. Click **"Settings"** tab
3. Scroll to **"Environment Variables"**
4. Click **"Add Variable"**

**Example:**
```
Key: API_KEY
Value: sk_live_abc123xyz789
Secret: ✓ (check this to hide the value)
```

### **Using Environment Variables**

In your application code:

**React:**
```javascript
// Access via process.env
const apiKey = process.env.REACT_APP_API_KEY;
```

**Next.js:**
```javascript
// Access via process.env
const apiKey = process.env.NEXT_PUBLIC_API_KEY;
```

**Note:** Environment variables are injected during build time.

---

## 🌐 **CUSTOM DOMAINS** (Paid Plans)

### **Adding a Custom Domain**

1. Go to your project page
2. Click **"Domains"** tab
3. Click **"Add Custom Domain"**
4. Enter your domain: `myapp.com`
5. Follow DNS configuration instructions

### **DNS Configuration**

Add these DNS records:

**A Record:**
```
Type: A
Name: @
Value: <server-ip>
TTL: 3600
```

**CNAME Record (for www):**
```
Type: CNAME
Name: www
Value: myapp.com
TTL: 3600
```

### **SSL Certificate**

SSL certificates are automatically provisioned via Let's Encrypt.

**Verification:**
```
✓ Domain verified
✓ SSL certificate issued
✓ HTTPS enabled
```

---

## 📈 **MONITORING & LOGS**

### **Deployment Status**

Real-time deployment status is shown on the project page:

```
Current Deployment:
┌─────────────────────────────────────────────────────────┐
│  Status: Building 🔨                                    │
│  Progress: 65%                                          │
│  Phase: Building project...                            │
│  Elapsed: 2m 15s                                        │
└─────────────────────────────────────────────────────────┘
```

### **Build Logs**

View detailed build logs in real-time:

```
[11:14:45] Installing dependencies...
[11:14:46] npm WARN deprecated stable@0.1.8
[11:15:45] added 1711 packages in 60s
[11:15:45] ✓ Dependencies installed
[11:15:45] Building project...
[11:16:56] File sizes after gzip:
[11:16:56]   229.11 kB  build/static/js/main.js
[11:16:56]   1.77 kB    build/static/js/787.chunk.js
[11:16:56] ✓ Build completed
```

### **Container Logs**

View runtime logs from your deployed application:

```
[11:17:21] Container started
[11:17:22] Server listening on port 80
[11:17:25] GET / 200 45ms
[11:17:26] GET /static/css/main.css 200 12ms
```

---

## 🔧 **TROUBLESHOOTING**

### **Deployment Failed**

**Common causes:**

1. **Build errors:**
   - Check build logs for error messages
   - Verify all dependencies are in `package.json`
   - Test build locally: `npm run build`

2. **Missing environment variables:**
   - Add required env vars in project settings
   - Prefix with `REACT_APP_` for React
   - Prefix with `NEXT_PUBLIC_` for Next.js

3. **GitHub access issues:**
   - Reconnect GitHub in settings
   - Verify repository is accessible
   - Check if repository is private (needs GitHub token)

### **Site Not Loading**

**Check:**

1. **Deployment status:**
   - Is deployment successful? ✅
   - Is container running?

2. **URL correct:**
   - Copy URL from deployment details
   - Try both HTTP and HTTPS

3. **Browser cache:**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Try incognito/private mode

### **Assets Not Loading (404 errors)**

**Solution:**

For React apps, add to `package.json`:
```json
{
  "homepage": "."
}
```

This makes assets load from relative paths.

---

## ✅ **BEST PRACTICES**

### **1. Use Environment Variables**

Never commit secrets to your repository:

```javascript
// ❌ Bad
const apiKey = 'sk_live_abc123xyz789';

// ✅ Good
const apiKey = process.env.REACT_APP_API_KEY;
```

### **2. Test Locally First**

Before deploying, test your build locally:

```bash
npm run build
npm install -g serve
serve -s build
```

### **3. Use Specific Versions**

In `package.json`, use specific versions:

```json
{
  "dependencies": {
    "react": "18.2.0",  // ✅ Specific version
    "react-dom": "^18.2.0"  // ⚠️ Caret allows minor updates
  }
}
```

### **4. Optimize Build Size**

- Remove unused dependencies
- Use code splitting
- Optimize images
- Enable gzip compression

### **5. Monitor Deployments**

- Check deployment logs regularly
- Monitor build times
- Review error messages

---

## ❓ **FAQs**

### **Q: How long does a deployment take?**

**A:** Typically 3-5 minutes:
- Clone: 5-10 seconds
- Install: 30-60 seconds
- Build: 1-3 minutes
- Deploy: 20-30 seconds

### **Q: Can I deploy private repositories?**

**A:** Yes! If you signed in with GitHub, your GitHub token is used to clone private repos.

### **Q: How many deployments can I have?**

**A:** 
- **Free plan:** Unlimited deployments, but only latest is kept running
- **Paid plans:** Multiple concurrent deployments

### **Q: Can I rollback to a previous deployment?**

**A:** Each deployment has a unique URL, so previous deployments remain accessible. Simply use the old URL.

### **Q: What happens if my build fails?**

**A:** The deployment is marked as failed, and you can view the error logs. Your previous successful deployment remains running.

### **Q: Can I use my own domain?**

**A:** Yes, on paid plans! Add your custom domain in project settings and configure DNS.

### **Q: Is HTTPS enabled by default?**

**A:** Yes! All deployments use HTTPS with automatic SSL certificates.

### **Q: How do I delete a project?**

**A:** Go to project settings → Danger Zone → Delete Project. This will stop all deployments and remove the project.

### **Q: Can I deploy multiple branches?**

**A:** Yes! Create separate deployments for different branches. Each gets a unique URL.

### **Q: What frameworks are supported?**

**A:** React, Vue, Next.js, Nuxt.js, Angular, Svelte, and static sites.

---

## 🎉 **YOU'RE READY!**

You now know how to:
- ✅ Create projects
- ✅ Deploy applications
- ✅ Manage deployments
- ✅ Configure environment variables
- ✅ Monitor and troubleshoot

**Happy deploying!** 🚀

---

## 📞 **NEED HELP?**

- **Documentation:** See SYSTEM_ARCHITECTURE.md for technical details
- **Admin Guide:** See ADMIN_GUIDE.md for admin features
- **Support:** Contact your platform administrator
