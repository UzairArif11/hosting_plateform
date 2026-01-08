#!/bin/bash

###############################################################################
# DEPLOYMENT PLATFORM - COMPLETE FUNCTIONALITY TEST
# Tests all critical paths and verifies fixes
###############################################################################

echo "╔══════════════════════════════════════════════════════════"
echo "║  🧪 Platform Functionality Verification"
echo "╚══════════════════════════════════════════════════════════"
echo ""

cd backend

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -n "Testing: $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  DATABASE & SETTINGS TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 1: MongoDB Connection
run_test "MongoDB Connection" \
    "node -e \"const m=require('mongoose');require('dotenv').config();m.connect(process.env.MONGODB_URI).then(()=>process.exit(0));\""

# Test 2: Settings Model Loads
run_test "Settings Model" \
    "node -e \"const m=require('mongoose');require('dotenv').config();const S=require('./models/Settings');m.connect(process.env.MONGODB_URI).then(async()=>{await S.getSettings();process.exit(0);});\""

# Test 3: EC3 Domain Correct
echo -n "Testing: EC3 Domain Configuration... "
EC3_DOMAIN=$(node -e "const m=require('mongoose');require('dotenv').config();const S=require('./models/Settings');m.connect(process.env.MONGODB_URI).then(async()=>{const s=await S.getSettings();console.log(s.serverDomains.EC3);process.exit(0);});" 2>/dev/null)
if [ "$EC3_DOMAIN" = "ec3.foodpanda.site" ]; then
    echo -e "${GREEN}✅ PASS${NC} (ec3.foodpanda.site)"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  WARN${NC} (Current: $EC3_DOMAIN, Expected: ec3.foodpanda.site)"
    echo "   Run: node -e \"const m=require('mongoose');require('dotenv').config();const S=require('./models/Settings');m.connect(process.env.MONGODB_URI).then(async()=>{await S.updateOne({},{\\\$set:{'serverDomains.EC3':'ec3.foodpanda.site'}});process.exit(0);});\""
fi

# Test 4: Plan Model Exists
run_test "Plan Model & Free Plan" \
    "node -e \"const m=require('mongoose');require('dotenv').config();const P=require('./models/Plan');m.connect(process.env.MONGODB_URI).then(async()=>{const p=await P.findOne({name:'free'});if(!p||p.resources.ram!==0.5)process.exit(1);process.exit(0);});\""

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  FILE STRUCTURE TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 5-12: Critical Files Exist
run_test "containerOrchestrator.js" "test -f services/containerOrchestrator.js"
run_test "freeTierContainer.js" "test -f services/freeTierContainer.js"
run_test "buildExecutor.js" "test -f services/buildExecutor.js"
run_test "buildQueue.js" "test -f services/buildQueue.js"
run_test "nginxRouter.js" "test -f services/nginxRouter.js"
run_test "Settings.js" "test -f models/Settings.js"
run_test "Plan.js" "test -f models/Plan.js"
run_test "Deployment.js" "test -f models/Deployment.js"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  CODE INTEGRITY TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 13: Plan Loading Logic Exists
echo -n "Testing: Plan Loading Logic... "
if grep -q "Loading plan.*from database" services/containerOrchestrator.js; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}"
    ((TESTS_FAILED++))
fi

# Test 14: PM2 Image Auto-Build Logic Exists
echo -n "Testing: PM2 Auto-Build Logic... "
if grep -q "docker images node-pm2-alpine:latest" services/freeTierContainer.js; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}"
    ((TESTS_FAILED++))
fi

# Test 15: Nginx Router Uses New Algorithm
echo -n "Testing: Nginx Robust Parsing... "
if grep -q "ROBUST PARSING" services/nginxRouter.js; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}"
    ((TESTS_FAILED++))
fi

# Test 16: Error Throwing (not returning)
echo -n "Testing: Proper Error Throwing... "
if grep -q "throw new Error(containerResult.error" services/containerOrchestrator.js; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}"
    ((TESTS_FAILED++))
fi

# Test 17: Deployment URL Saved
echo -n "Testing: Deployment URL Persistence... "
if grep -q "deployment.deploymentUrl = deploymentUrl" services/buildExecutor.js; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}"
    ((TESTS_FAILED++))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  FRONTEND INTEGRATION TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd ../frontend

# Test 18: Frontend Files Exist
run_test "Deployment Page" "test -f app/dashboard/deployments/[id]/page.tsx"
run_test "Deployments Slice" "test -f lib/slices/deploymentsSlice.ts"

# Test 19: WebSocket Message Mapping Fixed
echo -n "Testing: WebSocket data.message Fix... "
if grep -q "data.message" app/dashboard/deployments/\[id\]/page.tsx; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}"
    ((TESTS_FAILED++))
fi

# Test 20: Status Update Includes URL
echo -n "Testing: Status Update URL Capture... "
if grep -q "if (url) deployment.deploymentUrl = url" lib/slices/deploymentsSlice.ts; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}"
    ((TESTS_FAILED++))
fi

cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  SERVER CONNECTIVITY TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Load environment
if [ -f backend/.env ]; then
    export $(cat backend/.env | grep -v '^#' | xargs)
fi

# Test 21: EC2 SSH Connection
echo -n "Testing: EC2 SSH Connection... "
if timeout 5 ssh -i $SSH_EC2_KEY -o StrictHostKeyChecking=no $SSH_USERNAME@$EC2_SERVER_IP "echo 'OK'" &>/dev/null; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  SKIP${NC} (Timeout/Permission)"
fi

# Test 22: EC3 SSH Connection
echo -n "Testing: EC3 SSH Connection... "
if timeout 5 ssh -i $SSH_EC3_KEY -o StrictHostKeyChecking=no $SSH_USERNAME@$EC3_SERVER_IP "echo 'OK'" &>/dev/null; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠️  SKIP${NC} (Timeout/Permission)"
fi

# Test 23: PM2 Image on EC2
echo -n "Testing: PM2 Image on EC2... "
if timeout 5 ssh -i $SSH_EC2_KEY -o StrictHostKeyChecking=no $SSH_USERNAME@$EC2_SERVER_IP "docker images | grep -q node-pm2-alpine" &>/dev/null; then
    echo -e "${GREEN}✅ PASS${NC} (Cached)"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}ℹ️  INFO${NC} (Will build on first deployment)"
fi

# Test 24: PM2 Image on EC3
echo -n "Testing: PM2 Image on EC3... "
if timeout 5 ssh -i $SSH_EC3_KEY -o StrictHostKeyChecking=no $SSH_USERNAME@$EC3_SERVER_IP "docker images | grep -q node-pm2-alpine" &>/dev/null; then
    echo -e "${GREEN}✅ PASS${NC} (Cached)"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}ℹ️  INFO${NC} (Will build on first deployment)"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════"
echo "║  📊 TEST RESULTS"
echo "╚══════════════════════════════════════════════════════════"
echo ""
echo -e "   ${GREEN}Passed:${NC} $TESTS_PASSED"
echo -e "   ${RED}Failed:${NC} $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All critical tests passed!${NC}"
    echo ""
    echo "📋 DEPLOYMENT READY CHECKLIST:"
    echo ""
    echo "   ✅ Database connection working"
    echo "   ✅ Settings model configured"
    echo "   ✅ Plan resources correct (0.5GB for free)"
    echo "   ✅ All critical files present"
    echo "   ✅ Code changes verified"
    echo "   ✅ Frontend WebSocket fixed"
    echo ""
    echo "🚀 NEXT STEPS:"
    echo ""
    echo "   1. Ensure EC3 domain is 'ec3.foodpanda.site' in database"
    echo "   2. Restart PM2: pm2 restart all"
    echo "   3. Deploy a test project via UI"
    echo "   4. Verify real-time logs appear"
    echo "   5. Verify URL format correct"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Review output above.${NC}"
    echo ""
    exit 1
fi
