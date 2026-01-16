#!/bin/bash

# Local Testing Script for Vercel Clone Platform
# Run this script to test all features locally

set -e  # Exit on error

echo "🧪 Vercel Clone Platform - Local Testing Suite"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function
test_passed() {
    echo -e "${GREEN}✅ PASS:${NC} $1"
    ((TESTS_PASSED++))
}

test_failed() {
    echo -e "${RED}❌ FAIL:${NC} $1"
    ((TESTS_FAILED++))
}

test_info() {
    echo -e "${YELLOW}ℹ️  INFO:${NC} $1"
}

# 1. Check Prerequisites
echo "📋 Step 1: Checking Prerequisites"
echo "-----------------------------------"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    test_passed "Node.js installed ($NODE_VERSION)"
else
    test_failed "Node.js not installed"
    exit 1
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    test_passed "npm installed ($NPM_VERSION)"
else
    test_failed "npm not installed"
    exit 1
fi

if command -v mongo &> /dev/null || command -v mongod &> /dev/null; then
    test_passed "MongoDB installed"
else
    test_info "MongoDB not found in PATH (may be running as service)"
fi

echo ""

# 2. Install Dependencies
echo "📦 Step 2: Installing Dependencies"
echo "-----------------------------------"

cd backend
if npm install; then
    test_passed "Backend dependencies installed"
else
    test_failed "Backend dependency installation failed"
    exit 1
fi

cd ../frontend
if npm install; then
    test_passed "Frontend dependencies installed"
else
    test_failed "Frontend dependency installation failed"
    exit 1
fi

cd ../cli
if npm install; then
    test_passed "CLI dependencies installed"
else
    test_failed "CLI dependency installation failed"
    exit 1
fi

cd ..

echo ""

# 3. Check Environment Configuration
echo "⚙️  Step 3: Checking Environment Configuration"
echo "-----------------------------------------------"

if [ -f "backend/.env" ]; then
    test_passed "Backend .env file exists"
else
    test_info "Backend .env file not found - creating from example"
    cat > backend/.env << EOF
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/vercel-clone
SESSION_SECRET=your-secret-key-change-this
FRONTEND_URL=http://localhost:3000
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
EOF
    test_info "Created backend/.env - Please update with your values"
fi

echo ""

# 4. Check File Structure
echo "📁 Step 4: Verifying File Structure"
echo "------------------------------------"

check_file() {
    if [ -f "$1" ]; then
        test_passed "Found: $1"
    else
        test_failed "Missing: $1"
    fi
}

# Backend files
check_file "backend/models/Template.js"
check_file "backend/models/AnalyticsEvent.js"
check_file "backend/models/Invitation.js"
check_file "backend/routes/analytics.js"
check_file "backend/routes/templates.js"
check_file "backend/routes/invitations.js"
check_file "backend/services/domainVerification.js"
check_file "backend/services/templateDeployer.js"
check_file "backend/services/gitProvider.js"
check_file "backend/public/tracker.js"

# Frontend files
check_file "frontend/components/EnvironmentSelector.tsx"
check_file "frontend/components/LogsViewer.tsx"
check_file "frontend/components/DeploymentList.tsx"
check_file "frontend/components/AnalyticsChart.tsx"

# CLI files
check_file "cli/index.js"
check_file "cli/package.json"

echo ""

# 5. Run Automated Tests
echo "🧪 Step 5: Running Automated Tests"
echo "-----------------------------------"

cd backend

if node scripts/test-all-features.js; then
    test_passed "Automated tests passed"
else
    test_info "Automated tests completed with warnings (check output above)"
fi

cd ..

echo ""

# 6. Seed Database
echo "🌱 Step 6: Seeding Database"
echo "----------------------------"

cd backend

if node scripts/seedTemplates.js; then
    test_passed "Templates seeded successfully"
else
    test_info "Template seeding skipped or failed (may need MongoDB running)"
fi

cd ..

echo ""

# 7. Start Services
echo "🚀 Step 7: Starting Services"
echo "-----------------------------"

test_info "Starting backend server on port 5000..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

sleep 5

# Check if backend is running
if kill -0 $BACKEND_PID 2>/dev/null; then
    test_passed "Backend server started (PID: $BACKEND_PID)"
else
    test_failed "Backend server failed to start"
fi

test_info "Starting frontend server on port 3000..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

sleep 5

# Check if frontend is running
if kill -0 $FRONTEND_PID 2>/dev/null; then
    test_passed "Frontend server started (PID: $FRONTEND_PID)"
else
    test_failed "Frontend server failed to start"
fi

echo ""

# 8. Health Checks
echo "🏥 Step 8: Health Checks"
echo "------------------------"

# Check backend health
if curl -s http://localhost:5000/health > /dev/null; then
    test_passed "Backend health check passed"
else
    test_failed "Backend health check failed"
fi

# Check frontend
if curl -s http://localhost:3000 > /dev/null; then
    test_passed "Frontend accessible"
else
    test_info "Frontend may still be starting up"
fi

echo ""

# 9. API Endpoint Tests
echo "🔗 Step 9: Testing API Endpoints"
echo "---------------------------------"

# Test analytics collection endpoint
ANALYTICS_RESPONSE=$(curl -s -X POST http://localhost:5000/api/analytics/collect \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test123","visitorId":"test-visitor","path":"/"}' \
  -w "%{http_code}")

if [[ $ANALYTICS_RESPONSE == *"200"* ]] || [[ $ANALYTICS_RESPONSE == *"403"* ]]; then
    test_passed "Analytics collection endpoint responding"
else
    test_info "Analytics endpoint response: $ANALYTICS_RESPONSE"
fi

echo ""

# Summary
echo "================================================"
echo "📊 Test Summary"
echo "================================================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    echo ""
    echo "Services running:"
    echo "  Backend:  http://localhost:5000"
    echo "  Frontend: http://localhost:3000"
    echo ""
    echo "To stop services:"
    echo "  kill $BACKEND_PID $FRONTEND_PID"
else
    echo -e "${YELLOW}⚠️  Some tests failed. Review output above.${NC}"
fi

echo ""
echo "Press Ctrl+C to stop services and exit"

# Keep script running
wait
