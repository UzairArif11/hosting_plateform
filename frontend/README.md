# Vercel Clone Platform - Frontend

## 🚀 Overview

The modern, responsive frontend for the Vercel Clone Platform, built with Next.js 14.
It provides a seamless experience for users to deploy projects and for administrators to manage the infrastructure.

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Icons:** Heroicons, Lucide React
- **State:** React Hooks
- **Charts:** Recharts
- **Terminal:** XTerm.js (for logs)

## ✨ Key Features

### 👤 User Dashboard
- **Project Management:** Create, deploy, and manage projects.
- **Real-time Logs:** View build and runtime logs via WebSocket/SSH.
- **Analytics:** storage, bandwidth, and CPU usage charts.
- **Billing:** Plan upgrades and payment history.

### 🛡️ Admin Panel
- **Infrastructure Overview:** Monitor EC2/EC3 servers.
- **Container Management:** View running containers, stats, and logs.
- **User Management:** Suspend, feature-flag, and manage users.
- **Plan Configuration:** Create and edit pricing plans.
- **System Alerts:** Configure SMTP email alerts for high load.

## 🏃‍♂️ Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Create `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000
   ```

3. **Run Development Server:**
   ```bash
   npm run dev
   ```

4. **Build for Production:**
   ```bash
   npm run build
   npm start
   ```

## 📂 Project Structure

```
app/
├── admin/          # Admin routes (protected)
├── dashboard/      # User dashboard
├── login/          # Authentication
├── components/     # Reusable UI components
├── services/       # API clients (socket, etc)
└── utils/          # Helpers
```

## 🎨 Theme System

The application uses a dark-mode first design with:
- **Primary:** Purple/Violet gradients
- **Background:** Deep gray/black (`bg-gray-900`)
- **Glassmorphism:** Translucent panels and modals

---

**Connected to Backend API at port 5000 by default.**
