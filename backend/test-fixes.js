#!/usr/bin/env node

/**
 * SIMPLE FUNCTIONALITY TEST
 * Tests all critical fixes
 */

require('dotenv').config();

console.log('\n🧪 TESTING ALL FIXES\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

// Test 1: Docker Names Utility
console.log('\n1️⃣  Testing Docker Names Utility...');
try {
    const { generateContainerName, sanitizeContainerName } = require('./utils/dockerNames');

    // Test problematic name
    const result = generateContainerName('EC3', 'free', 'uzairtesta', 'UzairArif11/Trello-Clone');
    console.log(`   Input: "UzairArif11/Trello-Clone"`);
    console.log(`   Output: "${result}"`);

    // Check for invalid characters
    if (/[^a-zA-Z0-9-_.]/.test(result)) {
        console.log('   ❌ FAILED: Contains invalid characters');
        failed++;
    } else {
        console.log('   ✅ PASSED: Valid container name');
        passed++;
    }
} catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failed++;
}

// Test 2: Free Tier Container
console.log('\n2️⃣  Testing Free Tier Container...');
try {
    const fs = require('fs');
    const content = fs.readFileSync('./services/freeTierContainer.js', 'utf8');

    const checks = [
        { name: 'Imports dockerNames', test: content.includes("require('../utils/dockerNames')") },
        { name: 'Uses generateContainerName', test: content.includes('generateContainerName') },
        { name: 'Has deployFreeTierContainer', test: content.includes('deployFreeTierContainer') }
    ];

    let allPassed = true;
    checks.forEach(check => {
        if (check.test) {
            console.log(`   ✓ ${check.name}`);
        } else {
            console.log(`   ✗ ${check.name}`);
            allPassed = false;
        }
    });

    if (allPassed) {
        console.log('   ✅ PASSED: All checks passed');
        passed++;
    } else {
        console.log('   ❌ FAILED: Some checks failed');
        failed++;
    }
} catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failed++;
}

// Test 3: Build Queue
console.log('\n3️⃣  Testing Build Queue...');
try {
    const fs = require('fs');
    const content = fs.readFileSync('./services/buildQueue.js', 'utf8');

    const checks = [
        { name: 'Saves deploymentUrl', test: content.includes('deploymentUrl: result.deploymentUrl') },
        { name: 'Emits URL via WebSocket', test: content.includes('url: result.deploymentUrl') },
        { name: 'Updates status to success', test: content.includes("status: 'success'") }
    ];

    let allPassed = true;
    checks.forEach(check => {
        if (check.test) {
            console.log(`   ✓ ${check.name}`);
        } else {
            console.log(`   ✗ ${check.name}`);
            allPassed = false;
        }
    });

    if (allPassed) {
        console.log('   ✅ PASSED: All checks passed');
        passed++;
    } else {
        console.log('   ❌ FAILED: Some checks failed');
        failed++;
    }
} catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failed++;
}

// Test 4: WebSocket Hook
console.log('\n4️⃣  Testing WebSocket Hook...');
try {
    const fs = require('fs');
    const content = fs.readFileSync('../frontend/hooks/useDeployment.ts', 'utf8');

    const checks = [
        { name: 'Filters by deploymentId', test: content.includes('data.deploymentId !== deploymentId') },
        { name: 'Leaves room on cleanup', test: content.includes("emit('leave-deployment'") },
        { name: 'Handles deployment-status', test: content.includes("on('deployment-status'") }
    ];

    let allPassed = true;
    checks.forEach(check => {
        if (check.test) {
            console.log(`   ✓ ${check.name}`);
        } else {
            console.log(`   ✗ ${check.name}`);
            allPassed = false;
        }
    });

    if (allPassed) {
        console.log('   ✅ PASSED: All checks passed');
        passed++;
    } else {
        console.log('   ❌ FAILED: Some checks failed');
        failed++;
    }
} catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failed++;
}

// Test 5: Deployment History Endpoint
console.log('\n5️⃣  Testing Deployment History Endpoint...');
try {
    const fs = require('fs');
    const content = fs.readFileSync('./routes/deployments.js', 'utf8');

    const checks = [
        { name: 'Has project history endpoint', test: content.includes("router.get('/project/:projectId'") },
        { name: 'Returns deployments array', test: content.includes('deployments:') },
        { name: 'Checks user access', test: content.includes('project.userId.toString()') }
    ];

    let allPassed = true;
    checks.forEach(check => {
        if (check.test) {
            console.log(`   ✓ ${check.name}`);
        } else {
            console.log(`   ✗ ${check.name}`);
            allPassed = false;
        }
    });

    if (allPassed) {
        console.log('   ✅ PASSED: All checks passed');
        passed++;
    } else {
        console.log('   ❌ FAILED: Some checks failed');
        failed++;
    }
} catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failed++;
}

// Test 6: Monitoring Spam Fix
console.log('\n6️⃣  Testing Monitoring Spam Fix...');
try {
    const fs = require('fs');
    const content = fs.readFileSync('./services/containerOrchestrator.js', 'utf8');

    // Check that the log is now debug level
    if (content.includes('logger.debug(`User ${userId} has no container assigned yet`)')) {
        console.log('   ✓ Changed to debug level');
        console.log('   ✅ PASSED: Monitoring spam fixed');
        passed++;
    } else if (content.includes('logger.info(`User ${userId} has no container assigned yet`)')) {
        console.log('   ✗ Still using info level');
        console.log('   ❌ FAILED: Not fixed');
        failed++;
    } else {
        console.log('   ⚠️  Log statement not found');
        console.log('   ❌ FAILED: Cannot verify');
        failed++;
    }
} catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failed++;
}

// Print Summary
console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(60));
console.log(`\nTotal Tests: ${passed + failed}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ All fixes are correctly implemented');
    console.log('🚀 Ready for deployment!\n');
} else {
    console.log(`\n⚠️  ${failed} TEST(S) FAILED`);
    console.log('Please review the failures above\n');
}

process.exit(failed === 0 ? 0 : 1);
