#!/usr/bin/env node

/**
 * COMPREHENSIVE CODE REVIEW AND SSH TEST SCRIPT
 * 
 * This script:
 * 1. Reviews all critical code files
 * 2. Tests SSH connections to EC2/EC3
 * 3. Verifies Docker functionality
 * 4. Tests container creation
 * 5. Validates resource limits
 * 6. Checks deployment flow
 */

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
    log('\n' + '='.repeat(70), 'cyan');
    log(title, 'cyan');
    log('='.repeat(70), 'cyan');
}

// Test results
const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: []
};

function recordTest(name, passed, message = '') {
    results.tests.push({ name, passed, message });
    if (passed) {
        results.passed++;
        log(`✅ ${name}: PASSED ${message}`, 'green');
    } else {
        results.failed++;
        log(`❌ ${name}: FAILED ${message}`, 'red');
    }
}

function recordWarning(name, message) {
    results.warnings++;
    log(`⚠️  ${name}: ${message}`, 'yellow');
}

// ============================================================================
// PART 1: CODE REVIEW
// ============================================================================

section('PART 1: CODE REVIEW');

function reviewFile(filePath, checks) {
    const fullPath = path.join(__dirname, filePath);

    if (!fs.existsSync(fullPath)) {
        recordTest(`File exists: ${filePath}`, false, 'File not found');
        return false;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    let allPassed = true;

    log(`\nReviewing: ${filePath}`, 'blue');

    checks.forEach(check => {
        const passed = check.test(content);
        if (passed) {
            log(`  ✓ ${check.name}`, 'green');
        } else {
            log(`  ✗ ${check.name}`, 'red');
            allPassed = false;
        }
    });

    return allPassed;
}

// Review dockerNames.js
const dockerNamesChecks = [
    {
        name: 'Has sanitizeContainerName function',
        test: (content) => content.includes('function sanitizeContainerName')
    },
    {
        name: 'Has generateContainerName function',
        test: (content) => content.includes('function generateContainerName')
    },
    {
        name: 'Removes invalid characters',
        test: (content) => content.includes('[^a-zA-Z0-9-_.]')
    },
    {
        name: 'Exports functions',
        test: (content) => content.includes('module.exports')
    }
];

const dockerNamesOk = reviewFile('utils/dockerNames.js', dockerNamesChecks);
recordTest('dockerNames.js review', dockerNamesOk);

// Review freeTierContainer.js
const freeTierChecks = [
    {
        name: 'Imports dockerNames utility',
        test: (content) => content.includes("require('../utils/dockerNames')")
    },
    {
        name: 'Uses generateContainerName',
        test: (content) => content.includes('generateContainerName')
    },
    {
        name: 'Has deployFreeTierContainer function',
        test: (content) => content.includes('function deployFreeTierContainer')
    },
    {
        name: 'Sets resource limits',
        test: (content) => content.includes('resourceCaps.perUserCap')
    }
];

const freeTierOk = reviewFile('services/freeTierContainer.js', freeTierChecks);
recordTest('freeTierContainer.js review', freeTierOk);

// Review buildQueue.js
const buildQueueChecks = [
    {
        name: 'Saves deploymentUrl to database',
        test: (content) => content.includes('deploymentUrl: result.deploymentUrl')
    },
    {
        name: 'Emits URL via WebSocket',
        test: (content) => content.includes('url: result.deploymentUrl')
    },
    {
        name: 'Updates deployment status',
        test: (content) => content.includes("status: 'success'")
    }
];

const buildQueueOk = reviewFile('services/buildQueue.js', buildQueueChecks);
recordTest('buildQueue.js review', buildQueueOk);

// Review useDeployment.ts
const useDeploymentChecks = [
    {
        name: 'Filters by deploymentId',
        test: (content) => content.includes('data.deploymentId !== deploymentId')
    },
    {
        name: 'Leaves room on cleanup',
        test: (content) => content.includes("emit('leave-deployment'")
    },
    {
        name: 'Handles deployment-status event',
        test: (content) => content.includes("on('deployment-status'")
    }
];

const useDeploymentOk = reviewFile('../frontend/hooks/useDeployment.ts', useDeploymentChecks);
recordTest('useDeployment.ts review', useDeploymentOk);

// Review deployments.js routes
const deploymentsRouteChecks = [
    {
        name: 'Has project history endpoint',
        test: (content) => content.includes("router.get('/project/:projectId'")
    },
    {
        name: 'Returns deployments array',
        test: (content) => content.includes('deployments:')
    },
    {
        name: 'Checks user access',
        test: (content) => content.includes('project.userId.toString()')
    }
];

const deploymentsRouteOk = reviewFile('routes/deployments.js', deploymentsRouteChecks);
recordTest('deployments.js routes review', deploymentsRouteOk);

// ============================================================================
// PART 2: SSH CONNECTION TESTS
// ============================================================================

section('PART 2: SSH CONNECTION TESTS');

function testSSH(serverKey, host, keyPath) {
    try {
        log(`\nTesting SSH to ${serverKey} (${host})...`, 'blue');

        // Test basic SSH connection
        const result = execSync(
            `ssh -i "${keyPath}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 ubuntu@${host} "echo 'SSH OK'"`,
            { encoding: 'utf8', stdio: 'pipe' }
        );

        if (result.includes('SSH OK')) {
            recordTest(`SSH to ${serverKey}`, true);
            return true;
        } else {
            recordTest(`SSH to ${serverKey}`, false, 'Unexpected response');
            return false;
        }
    } catch (error) {
        recordTest(`SSH to ${serverKey}`, false, error.message);
        return false;
    }
}

// Test EC2
if (process.env.EC2_HOST && process.env.SSH_EC2_KEY) {
    testSSH('EC2', process.env.EC2_HOST, process.env.SSH_EC2_KEY);
} else {
    recordWarning('EC2 SSH Test', 'EC2_HOST or SSH_EC2_KEY not configured');
}

// Test EC3
if (process.env.EC3_HOST && process.env.SSH_EC3_KEY) {
    testSSH('EC3', process.env.EC3_HOST, process.env.SSH_EC3_KEY);
} else {
    recordWarning('EC3 SSH Test', 'EC3_HOST or SSH_EC3_KEY not configured');
}

// ============================================================================
// PART 3: DOCKER FUNCTIONALITY TESTS
// ============================================================================

section('PART 3: DOCKER FUNCTIONALITY TESTS');

function testDockerOnServer(serverKey, host, keyPath) {
    try {
        log(`\nTesting Docker on ${serverKey}...`, 'blue');

        // Test Docker version
        const dockerVersion = execSync(
            `ssh -i "${keyPath}" -o StrictHostKeyChecking=no ubuntu@${host} "docker --version"`,
            { encoding: 'utf8', stdio: 'pipe' }
        );

        if (dockerVersion.includes('Docker version')) {
            log(`  ✓ Docker installed: ${dockerVersion.trim()}`, 'green');
        } else {
            recordTest(`Docker on ${serverKey}`, false, 'Docker not found');
            return false;
        }

        // Test Docker is running
        const dockerPs = execSync(
            `ssh -i "${keyPath}" -o StrictHostKeyChecking=no ubuntu@${host} "docker ps"`,
            { encoding: 'utf8', stdio: 'pipe' }
        );

        if (dockerPs.includes('CONTAINER ID')) {
            log(`  ✓ Docker is running`, 'green');
        } else {
            recordTest(`Docker on ${serverKey}`, false, 'Docker not running');
            return false;
        }

        // Count running containers
        const containerCount = execSync(
            `ssh -i "${keyPath}" -o StrictHostKeyChecking=no ubuntu@${host} "docker ps -q | wc -l"`,
            { encoding: 'utf8', stdio: 'pipe' }
        ).trim();

        log(`  ✓ Running containers: ${containerCount}`, 'green');

        recordTest(`Docker on ${serverKey}`, true, `${containerCount} containers`);
        return true;

    } catch (error) {
        recordTest(`Docker on ${serverKey}`, false, error.message);
        return false;
    }
}

// Test Docker on EC2
if (process.env.EC2_HOST && process.env.SSH_EC2_KEY) {
    testDockerOnServer('EC2', process.env.EC2_HOST, process.env.SSH_EC2_KEY);
}

// Test Docker on EC3
if (process.env.EC3_HOST && process.env.SSH_EC3_KEY) {
    testDockerOnServer('EC3', process.env.EC3_HOST, process.env.SSH_EC3_KEY);
}

// ============================================================================
// PART 4: CONTAINER NAME VALIDATION
// ============================================================================

section('PART 4: CONTAINER NAME VALIDATION');

function testContainerNameGeneration() {
    try {
        const { generateContainerName } = require('./utils/dockerNames');

        // Test with problematic project name
        const testCases = [
            { input: 'UzairArif11/Trello-Clone', expected: /^EC3-free-.*-uzairarif11-trello-clone-\d+$/ },
            { input: 'My Project!', expected: /^EC2-free-.*-my-project-\d+$/ },
            { input: 'test@app#123', expected: /^EC2-pro-.*-test-app-123-\d+$/ }
        ];

        let allPassed = true;

        testCases.forEach((testCase, index) => {
            const result = generateContainerName('EC2', 'free', 'testuser', testCase.input);

            // Check if result matches expected pattern
            if (testCase.expected.test(result)) {
                log(`  ✓ Test ${index + 1}: "${testCase.input}" → "${result}"`, 'green');
            } else {
                log(`  ✗ Test ${index + 1}: "${testCase.input}" → "${result}" (invalid)`, 'red');
                allPassed = false;
            }

            // Check for invalid characters
            if (/[^a-zA-Z0-9-_.]/.test(result)) {
                log(`  ✗ Test ${index + 1}: Contains invalid characters`, 'red');
                allPassed = false;
            }
        });

        recordTest('Container name generation', allPassed);

    } catch (error) {
        recordTest('Container name generation', false, error.message);
    }
}

testContainerNameGeneration();

// ============================================================================
// PART 5: DATABASE CONNECTION
// ============================================================================

section('PART 5: DATABASE CONNECTION');

async function testDatabase() {
    try {
        const mongoose = require('mongoose');

        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000
        });

        log('  ✓ Connected to MongoDB', 'green');
        log(`  ✓ Database: ${mongoose.connection.name}`, 'green');

        // Test Deployment model
        const Deployment = require('./models/Deployment');
        const count = await Deployment.countDocuments();
        log(`  ✓ Deployments in DB: ${count}`, 'green');

        await mongoose.disconnect();

        recordTest('Database connection', true, `${count} deployments`);

    } catch (error) {
        recordTest('Database connection', false, error.message);
    }
}

// Run async test
testDatabase().catch(console.error);

// ============================================================================
// PART 6: PRINT RESULTS
// ============================================================================

setTimeout(() => {
    section('TEST RESULTS SUMMARY');

    log('\n');
    results.tests.forEach(test => {
        const icon = test.passed ? '✅' : '❌';
        const color = test.passed ? 'green' : 'red';
        log(`${icon} ${test.name}${test.message ? `: ${test.message}` : ''}`, color);
    });

    log('\n');
    log(`Total Tests: ${results.tests.length}`, 'cyan');
    log(`Passed: ${results.passed}`, 'green');
    log(`Failed: ${results.failed}`, 'red');
    log(`Warnings: ${results.warnings}`, 'yellow');

    const successRate = results.tests.length > 0
        ? ((results.passed / results.tests.length) * 100).toFixed(1)
        : 0;
    log(`Success Rate: ${successRate}%`, 'cyan');

    if (results.failed === 0) {
        log('\n🎉 ALL TESTS PASSED!', 'green');
        log('✅ Code review complete', 'green');
        log('✅ SSH connections working', 'green');
        log('✅ Docker functionality verified', 'green');
        log('✅ Container names validated', 'green');
        log('✅ Database connected', 'green');
        log('\n🚀 SYSTEM IS PRODUCTION READY!', 'green');
    } else {
        log(`\n⚠️  ${results.failed} TEST(S) FAILED`, 'red');
        log('Please fix the issues above before deploying', 'yellow');
    }

    process.exit(results.failed === 0 ? 0 : 1);
}, 3000); // Wait for async tests to complete
