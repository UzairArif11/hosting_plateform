const dns = require('dns').promises;
const domainVerification = require('../services/domainVerification');
const logger = require('../utils/logger');

// Mock DNS for testing
const originalResolveTxt = dns.resolveTxt;

async function runTest() {
    console.log('🧪 Starting Domain Verification Test');

    const testDomain = 'test-example.com';
    const testToken = domainVerification.generateVerificationToken();

    console.log(`Generated Token: ${testToken}`);

    // Test 1: Verify Fails when no record exists
    console.log('\nTest 1: Verification should fail initially');
    dns.resolveTxt = async () => []; // Mock empty records

    const result1 = await domainVerification.verifyDnsRecord(testDomain, testToken);
    if (result1 === false) {
        console.log('✅ PASS: Verification failed as expected');
    } else {
        console.error('❌ FAIL: Verification succeeded unexpectedly');
    }

    // Test 2: Verify Succeeds when Check Subdomain exists
    console.log('\nTest 2: Verification should succeed with correct TXT record on subdomain');
    dns.resolveTxt = async (domain) => {
        if (domain === `_vcp-challenge.${testDomain}`) {
            return [[testToken]];
        }
        return [];
    };

    const result2 = await domainVerification.verifyDnsRecord(testDomain, testToken);
    if (result2 === true) {
        console.log('✅ PASS: Verification succeeded with subdomain TXT');
    } else {
        console.error('❌ FAIL: Verification failed despite allowed TXT');
    }

    // Test 3: Verify Succeeds on Root Domain
    console.log('\nTest 3: Verification should succeed on root domain');
    dns.resolveTxt = async (domain) => {
        if (domain === testDomain) {
            return [[testToken]];
        }
        return [];
    };

    const result3 = await domainVerification.verifyDnsRecord(testDomain, testToken);
    if (result3 === true) {
        console.log('✅ PASS: Verification succeeded with root TXT');
    } else {
        console.error('❌ FAIL: Verification failed despite root TXT');
    }

    console.log('\n✅ All Verification Tests Completed');
}

runTest().catch(console.error);
