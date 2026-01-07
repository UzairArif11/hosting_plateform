#!/bin/bash

echo "🔧 Fixing frontend startup issue..."

# Kill everything on port 3000 aggressively
echo "Killing processes on port 3000..."
sudo lsof -ti:3000 | xargs sudo kill -9 2>/dev/null || true
sudo fuser -k 3000/tcp 2>/dev/null || true

# Wait for port to be free
sleep 3

# Check if port is free
if sudo lsof -i:3000 > /dev/null 2>&1; then
    echo "❌ Port 3000 still in use!"
    echo "Processes using port 3000:"
    sudo lsof -i:3000
    exit 1
fi

echo "✅ Port 3000 is free"

# Delete old PM2 frontend
pm2 stop frontend 2>/dev/null || true
pm2 delete frontend 2>/dev/null || true

# Start frontend with npm wrapper (most reliable)
cd frontend
pm2 start npm --name frontend --time -- start
cd ..

# Save PM2
pm2 save

echo ""
echo "✅ Frontend started!"
echo ""
echo "Checking status..."
sleep 3
pm2 list

echo ""
echo "Test frontend:"
curl -I http://localhost:3000/ 2>/dev/null | head -1 || echo "Frontend not responding yet (wait a few seconds)"
