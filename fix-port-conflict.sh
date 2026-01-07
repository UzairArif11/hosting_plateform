#!/bin/bash

###############################################################################
# FIX PORT CONFLICTS - Kill zombie processes and use safe ports
###############################################################################

echo "🔧 Fixing port conflicts..."

# Kill zombie Next.js process on port 3000 (www-data user)
echo "Killing zombie process on port 3000..."
sudo pkill -f "next-server" || true
sudo pkill -f "next start" || true
sleep 2

echo "✅ Port 3000 cleared"

# Clean PM2
pm2 kill
sleep 2

# Start backend on port 5000
echo "Starting backend on port 5000..."
cd backend
pm2 start server.js --name backend
cd ..

# Start frontend on port 3001 (avoiding port 3000 conflicts)
echo "Starting frontend on port 3001..."
cd frontend
PORT=3001 pm2 start npm --name frontend -- start -- --port 3001
cd ..

pm2 save

echo ""
echo "✅ Services started on safe ports!"
echo ""
echo "Backend:  Port 5000 ✅"
echo "Frontend: Port 3001 ✅ (changed from 3000)"
echo ""
pm2 list

echo ""
echo "⚠️  IMPORTANT: Update Nginx to use port 3001"
echo "Run: sudo nano /etc/nginx/sites-available/default"
echo "Change: proxy_pass http://127.0.0.1:3000"
echo "To:     proxy_pass http://127.0.0.1:3001"

