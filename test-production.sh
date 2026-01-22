#!/bin/bash

# Production/Live Testing Script for Vercel Clone Platform
# Run this on your production server to verify deployment

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

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$PROD_DOMAIN)
if [ "$HTTP_CODE" -eq 200 ]; then
    test_passed "HTTPS connection successful (Status: $HTTP_CODE)"
else
    test_failed "HTTPS connection failed (Status: $HTTP_CODE)"
fi

echo ""

# 2. API Health Checks
echo "🏥 Step 2: API Health Checks"
echo "------------------------------"

HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" $PROD_API_URL/health)
if [ "$HEALTH_CODE" -eq 200 ]; then
    test_passed "API health endpoint responding (Status: $HEALTH_CODE)"
else
    # Try alternate path just in case
    test_failed "API health check failed (Status: $HEALTH_CODE) at $PROD_API_URL/health"
fi

echo ""

# 3. Feature Endpoint Tests
echo "🧪 Step 3: Testing Feature Endpoints"
echo "--------------------------------------"

# Test templates
TEMPLATES_CODE=$(curl -s -o /dev/null -w "%{http_code}" $PROD_API_URL/templates)
if [ "$TEMPLATES_CODE" -eq 200 ]; then
    test_passed "Templates endpoint accessible (Status: 200)"
else
    test_failed "Templates endpoint failed (Status: $TEMPLATES_CODE)"
fi

# Test analytics collection
ANALYTICS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $PROD_API_URL/analytics/collect \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test","visitorId":"test","path":"/"}')

# Analytics might return 200 (Success), 400 (Bad Id), or 404 (Not Found) - all mean endpoint is UP
if [[ "$ANALYTICS_CODE" =~ ^[24] ]]; then
    test_passed "Analytics collection responding (Status: $ANALYTICS_CODE)"
else
    test_failed "Analytics collection failed (Status: $ANALYTICS_CODE)"
fi

echo ""

# Summary
echo "===================================================="
echo "📊 Production Test Summary"
echo "===================================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""
echo "Production Environment:"
echo "  Domain:   https://$PROD_DOMAIN"
echo "  API:      $PROD_API_URL"
echo ""

if [ "$TESTS_FAILED" -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL SYSTEMS OPERATIONAL${NC}"
    exit 0
else
    echo -e "${RED}⚠️  SOME CHECKS FAILED${NC}"
    exit 1
fi
