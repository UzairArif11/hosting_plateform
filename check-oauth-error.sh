#!/bin/bash

###############################################################################
# Check OAuth Error Logs
# 
# Helps diagnose GitHub OAuth callback 500 errors
###############################################################################

echo "🔍 Checking backend logs for OAuth errors..."
echo ""

# Check recent backend logs
echo "=== Recent Backend Error Logs ==="
pm2 logs backend --err --lines 50 | grep -i "oauth\|github\|auth\|error" | tail -20

echo ""
echo "=== Recent Backend Output Logs ==="
pm2 logs backend --out --lines 50 | grep -i "oauth\|github\|auth" | tail -20

echo ""
echo "=== Checking Environment Variables ==="
echo "API_URL: $(grep API_URL ~/hosting_plateform/backend/.env | head -1)"
echo "FRONTEND_URL: $(grep FRONTEND_URL ~/hosting_plateform/backend/.env | head -1)"
echo "GITHUB_CLIENT_ID: $(grep GITHUB_CLIENT_ID ~/hosting_plateform/backend/.env | head -1 | cut -d'=' -f2 | cut -c1-10)..."
echo "GITHUB_CLIENT_SECRET: $(grep GITHUB_CLIENT_SECRET ~/hosting_plateform/backend/.env | head -1 | cut -d'=' -f2 | cut -c1-10)..."

echo ""
echo "=== Test Backend Health ==="
curl -s http://localhost:5000/api/health | head -5

echo ""
echo "✅ Check complete. Look for errors above."

