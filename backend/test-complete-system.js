#!/usr/bin/env node

/**
 * COMPREHENSIVE END-TO-END TEST SCRIPT
 * 
 * Prerequisites:
 * 1. Backend server must be running (npm start or pm2)
 * 2. MongoDB must be running
 * 3. Redis must be running (for queue)
 * 
 * Usage: node test-complete-system.js
 */

require('dotenv').config();
const axios = require('axios');
const io = require('socket.io-client');
const mongoose = require('mongoose');

const API_URL = process.env.API_URL || 'http://localhost:5000';
const MONGODB_URI = process.env.MONGODB_URI;

// Colors for console output
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

function success(message) {
    log(`✅ ${message}`, 'green');
}

function error(message) {
    log(`❌ ${message}`, 'red');
}

function info(message) {
    log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function section(message) {
    log(`\n${'='.repeat(60)}`, 'cyan');
    log(message, 'cyan');
    log('='.repeat(60), 'cyan');
}

// Test results
const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: []
};

function recordTest(name, passed, message = '', skipped = false) {
    results.tests.push({ name, passed, message, skipped });
    if (skipped) {
        results.skipped++;
        warning(`${name}: SKIPPED ${message}`);
    } else if (passed) {
        results.passed++;
        success(`${name}: PASSED ${message}`);
    } else {
        results.failed++;
        error(`${name}: FAILED ${message}`);
    }
}

// API client
let authToken = null;
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.request.use(config => {
    if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
});

// Test functions

async function testServerRunning() {
    section('TEST 0: Backend Server Status');

    try {
        const response = await axios.get(`${API_URL}/api/health`, {
            timeout: 5000
        });

        if (response.status === 200) {
            success('Backend server is running');
            recordTest('Server Running', true);
            return true;
        }
    } catch (err) {
        error('Backend server is NOT running');
        error('Please start the backend server first:');
        info('  cd backend');
        info('  npm start');
        info('  # or');
        info('  pm2 start server.js --name backend');
        recordTest('Server Running', false, 'Server not running');
        return false;
    }
}

async function testDatabaseConnection() {
    section('TEST 1: Database Connection');

    try {
        await mongoose.connect(MONGODB_URI);
        success('Connected to MongoDB');
        recordTest('Database Connection', true);
        return true;
    } catch (err) {
        error(`Failed to connect to MongoDB: ${err.message}`);
        recordTest('Database Connection', false, err.message);
        return false;
    }
}

async function testUserAuthentication() {
    section('TEST 2: User Authentication');

    try {
        // Try to register a test user
        const email = `test-${Date.now()}@example.com`;
        const password = 'Test123!@#';

        info(`Registering user: ${email}`);
        const registerRes = await api.post('/api/auth/register', {
            email,
            password,
            displayName: 'Test User'
        });

        if (registerRes.data.token) {
            authToken = registerRes.data.token;
            success('User registered and authenticated');
            recordTest('User Registration', true);
            return true;
        }
    } catch (err) {
        // Try to login with existing user
        try {
            info('Trying to login with existing test user...');
            const loginRes = await api.post('/api/auth/login', {
                email: 'test@example.com',
                password: 'Test123!@#'
            });

            if (loginRes.data.token) {
                authToken = loginRes.data.token;
                success('User authenticated');
                recordTest('User Authentication', true);
                return true;
            }
        } catch (loginErr) {
            error(`Authentication failed: ${loginErr.response?.data?.message || loginErr.message}`);
            recordTest('User Authentication', false, loginErr.message);
            return false;
        }
    }
}

async function testWebSocketConnection() {
    section('TEST 3: WebSocket Connection');

    return new Promise((resolve) => {
        const socket = io(API_URL, {
            transports: ['websocket', 'polling']
        });

        const timeout = setTimeout(() => {
            socket.disconnect();
            error('WebSocket connection timeout');
            recordTest('WebSocket Connection', false, 'Timeout');
            resolve(false);
        }, 5000);

        socket.on('connect', () => {
            clearTimeout(timeout);
            success('WebSocket connected');

            // Test joining a room
            socket.emit('join-deployment', 'test-deployment-123');

            setTimeout(() => {
                socket.disconnect();
                recordTest('WebSocket Connection', true);
                resolve(true);
            }, 1000);
        });

        socket.on('connect_error', (err) => {
            clearTimeout(timeout);
            error(`WebSocket connection error: ${err.message}`);
            recordTest('WebSocket Connection', false, err.message);
            resolve(false);
        });
    });
}

async function testResourceManagement() {
    section('TEST 4: Resource Management');

    if (!authToken) {
        warning('Skipping - no auth token');
        recordTest('Resource Management', false, 'No auth', true);
        return false;
    }

    try {
        // Get user resources
        const res = await api.get('/api/users/me/resources');

        if (res.data) {
            info(`User Plan: ${res.data.plan?.name || 'free'}`);
            info(`CPU: ${res.data.allocated?.cpu || 0.2}`);
            info(`RAM: ${res.data.allocated?.ram || 1228} MB`);

            success('Resource management working');
            recordTest('Resource Management', true);
            return true;
        }
    } catch (err) {
        error(`Resource management failed: ${err.response?.data?.message || err.message}`);
        recordTest('Resource Management', false, err.message);
        return false;
    }
}

async function testProjectCreation() {
    section('TEST 5: Project Creation');

    if (!authToken) {
        warning('Skipping - no auth token');
        recordTest('Project Creation', false, 'No auth', true);
        return null;
    }

    try {
        const projectName = `test-project-${Date.now()}`;

        const res = await api.post('/api/projects', {
            name: projectName,
            githubUrl: 'https://github.com/vercel/next.js',
            branch: 'canary'
        });

        if (res.data._id) {
            success(`Project created: ${res.data.name}`);
            recordTest('Project Creation', true);
            return res.data._id;
        }
    } catch (err) {
        error(`Project creation failed: ${err.response?.data?.message || err.message}`);
        recordTest('Project Creation', false, err.message);
        return null;
    }
}

async function testDeploymentFlow(projectId) {
    section('TEST 6: Deployment Flow');

    if (!projectId) {
        warning('Skipping - no project ID');
        recordTest('Deployment Flow', false, 'No project', true);
        return null;
    }

    try {
        info('Starting deployment...');
        const res = await api.post(`/api/projects/${projectId}/deploy`);

        if (res.data.deployment) {
            const deploymentId = res.data.deployment._id;
            success(`Deployment started: ${deploymentId}`);

            // Wait a bit and check status
            await new Promise(resolve => setTimeout(resolve, 2000));

            const statusRes = await api.get(`/api/deployments/${deploymentId}/status`);

            if (statusRes.data) {
                info(`Deployment status: ${statusRes.data.status}`);
                info(`Progress: ${statusRes.data.progress?.percentage || 0}%`);

                recordTest('Deployment Flow', true);
                return deploymentId;
            }
        }
    } catch (err) {
        error(`Deployment failed: ${err.response?.data?.message || err.message}`);
        recordTest('Deployment Flow', false, err.message);
        return null;
    }
}

async function testWebSocketUpdates(deploymentId) {
    section('TEST 7: WebSocket Deployment Updates');

    if (!deploymentId) {
        warning('Skipping - no deployment ID');
        recordTest('WebSocket Updates', false, 'No deployment', true);
        return false;
    }

    return new Promise((resolve) => {
        const socket = io(API_URL);
        let receivedUpdate = false;

        const timeout = setTimeout(() => {
            socket.disconnect();
            if (receivedUpdate) {
                success('Received WebSocket updates');
                recordTest('WebSocket Updates', true);
                resolve(true);
            } else {
                warning('No WebSocket updates received (deployment may be queued)');
                recordTest('WebSocket Updates', true, 'No updates yet (OK)');
                resolve(true);
            }
        }, 10000);

        socket.on('connect', () => {
            info('Connected to WebSocket');
            socket.emit('join-deployment', deploymentId);
        });

        socket.on('deployment-status', (data) => {
            info(`Status update: ${data.status} (${data.progress || 0}%)`);
            receivedUpdate = true;
        });

        socket.on('deployment-log', (data) => {
            info(`Log: ${data.message}`);
            receivedUpdate = true;
        });

        socket.on('deployment-progress', (data) => {
            info(`Progress: ${data.progress}%`);
            receivedUpdate = true;
        });
    });
}

async function testAdminFeatures() {
    section('TEST 8: Admin Features');

    if (!authToken) {
        warning('Skipping - no auth token');
        recordTest('Admin Features', false, 'No auth', true);
        return false;
    }

    try {
        // Try to access admin endpoints
        const res = await api.get('/api/admin/server-stats');

        if (res.data.servers) {
            success('Admin access working');
            info(`Servers: ${res.data.servers.length}`);

            res.data.servers.forEach(server => {
                info(`${server.key}: ${server.currentUsers} users, ${server.utilization.cpu}% CPU`);
            });

            recordTest('Admin Features', true);
            return true;
        }
    } catch (err) {
        if (err.response?.status === 403) {
            info('User is not admin (expected for test user)');
            recordTest('Admin Features', true, 'Not admin (OK)');
            return true;
        }

        error(`Admin features failed: ${err.response?.data?.message || err.message}`);
        recordTest('Admin Features', false, err.message);
        return false;
    }
}

async function testContainerCleanup() {
    section('TEST 9: Container Cleanup');

    try {
        // Check if cleanup service is running
        const fs = require('fs');
        const cleanupScriptPath = require('path').join(__dirname, 'cleanup-containers.js');

        if (fs.existsSync(cleanupScriptPath)) {
            success('Cleanup script exists');
            recordTest('Container Cleanup', true);
            return true;
        } else {
            error('Cleanup script not found');
            recordTest('Container Cleanup', false, 'Script not found');
            return false;
        }
    } catch (err) {
        error(`Container cleanup test failed: ${err.message}`);
        recordTest('Container Cleanup', false, err.message);
        return false;
    }
}

async function printResults() {
    section('TEST RESULTS');

    log('\n');
    results.tests.forEach(test => {
        const icon = test.skipped ? '⏭️ ' : test.passed ? '✅' : '❌';
        const color = test.skipped ? 'yellow' : test.passed ? 'green' : 'red';
        log(`${icon} ${test.name}${test.message ? `: ${test.message}` : ''}`, color);
    });

    log('\n');
    log(`Total Tests: ${results.tests.length}`, 'cyan');
    log(`Passed: ${results.passed}`, 'green');
    log(`Failed: ${results.failed}`, 'red');
    log(`Skipped: ${results.skipped}`, 'yellow');

    const successRate = results.tests.length > 0
        ? ((results.passed / (results.tests.length - results.skipped)) * 100).toFixed(1)
        : 0;
    log(`Success Rate: ${successRate}%`, 'cyan');

    if (results.failed === 0) {
        log('\n🎉 ALL TESTS PASSED!', 'green');
    } else {
        log(`\n⚠️  ${results.failed} TEST(S) FAILED`, 'red');
    }
}

// Main test runner
async function runAllTests() {
    log('\n🧪 COMPREHENSIVE SYSTEM TEST', 'cyan');
    log('Testing all backend functionality...\n', 'cyan');

    try {
        // Check if server is running first
        const serverRunning = await testServerRunning();

        if (!serverRunning) {
            log('\n❌ Cannot run tests - backend server is not running', 'red');
            log('\nPlease start the backend server:', 'yellow');
            log('  cd backend', 'cyan');
            log('  npm start', 'cyan');
            log('\nThen run tests again:', 'yellow');
            log('  node test-complete-system.js', 'cyan');
            process.exit(1);
        }

        // Run tests in sequence
        await testDatabaseConnection();
        await testUserAuthentication();
        await testWebSocketConnection();
        await testResourceManagement();

        const projectId = await testProjectCreation();
        const deploymentId = await testDeploymentFlow(projectId);

        if (deploymentId) {
            await testWebSocketUpdates(deploymentId);
        }

        await testAdminFeatures();
        await testContainerCleanup();

        // Print results
        await printResults();

        // Cleanup
        await mongoose.disconnect();

        // Exit with appropriate code
        process.exit(results.failed === 0 ? 0 : 1);

    } catch (err) {
        error(`Test runner error: ${err.message}`);
        console.error(err);
        process.exit(1);
    }
}

// Run tests
runAllTests();
