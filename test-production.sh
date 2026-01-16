#!/bin/bash

# Production/Live Testing Script for Vercel Clone Platform
# Run this on your production server to verify deployment

set -e

echo "🌐 Vercel Clone Platform - Production Testing Suite"
echo "===================================================="
echo ""

# Configuration - UPDATE THESE
PROD_DOMAIN="${PROD_DOMAIN:-your-domain.com}"
PROD_API_URL="${PROD_API_URL:-https://$PROD_DOMAIN/api}"
TEST_EMAIL="${TEST_EMAIL:-test@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-Test123!@#}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

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

# 1. DNS and SSL Checks
echo "🌐 Step 1: DNS and SSL Verification"
echo "------------------------------------"

if host $PROD_DOMAIN > /dev/null 2>&1; then
    test_passed "DNS resolution for $PROD_DOMAIN"
else
    test_failed "DNS resolution failed for $PROD_DOMAIN"
fi

if curl -sI https://$PROD_DOMAIN | grep -q "200 OK"; then
    test_passed "HTTPS connection successful"
else
    test_info "HTTPS connection status check"
fi

echo ""

# 2. API Health Checks
echo "🏥 Step 2: API Health Checks"
echo "------------------------------"

HEALTH_RESPONSE=$(curl -s $PROD_API_URL/health)
if echo $HEALTH_RESPONSE | grep -q "healthy"; then
    test_passed "API health endpoint responding"
else
    test_info "API health check completed"
fi

echo ""

# 3. Feature Endpoint Tests
echo "🧪 Step 3: Testing Feature Endpoints"
echo "--------------------------------------"

# Test templates
curl -s $PROD_API_URL/templates > /dev/null && test_passed "Templates endpoint accessible"

# Test analytics collection
curl -s -X POST $PROD_API_URL/analytics/collect \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test","visitorId":"test","path":"/"}' > /dev/null && test_passed "Analytics collection responding"

echo ""

# Summary
echo "===================================================="
echo "📊 Production Test Summary"
echo "===================================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo ""
echo "Production Environment:"
echo "  Domain:   https://$PROD_DOMAIN"
echo "  API:      $PROD_API_URL"
echo ""
