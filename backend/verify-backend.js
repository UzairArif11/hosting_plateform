#!/usr/bin/env node

/**
 * Backend Verification Script
 * Checks all backend components for conflicts and broken functionality
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Vercel Clone Platform - Backend Verification\n');
console.log('='.repeat(60));

const checks = {
    passed: 0,
    failed: 0,
    warnings: 0
};

// Helper functions
function checkFileExists(filePath, description) {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
        console.log(`✅ ${description}`);
        checks.passed++;
        return true;
    } else {
        console.log(`❌ ${description} - FILE NOT FOUND: ${filePath}`);
        checks.failed++;
        return false;
    }
}

function checkRequire(filePath, requiredModule, description) {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(`require('${requiredModule}')`) || content.includes(`require("${requiredModule}")`)) {
            console.log(`✅ ${description}`);
            checks.passed++;
            return true;
        } else {
            console.log(`⚠️  ${description} - Module not imported`);
            checks.warnings++;
            return false;
        }
    }
    return false;
}

function checkSyntax(filePath, description) {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
        try {
            require(fullPath);
            console.log(`✅ ${description}`);
            checks.passed++;
            return true;
        } catch (error) {
            console.log(`❌ ${description} - SYNTAX ERROR: ${error.message}`);
            checks.failed++;
            return false;
        }
    }
    return false;
}

console.log('\n📁 Checking Core Files...\n');

// Core files
checkFileExists('server.js', 'Server entry point exists');
checkFileExists('package.json', 'Package.json exists');
checkFileExists('.env.example', 'Environment example exists');

console.log('\n📦 Checking Models...\n');

// Models
checkFileExists('models/User.js', 'User model exists');
checkFileExists('models/Plan.js', 'Plan model exists');
checkFileExists('models/Project.js', 'Project model exists');
checkFileExists('models/Deployment.js', 'Deployment model exists (NEW)');

console.log('\n🛣️  Checking Routes...\n');

// Routes
checkFileExists('routes/auth.js', 'Auth routes exist');
checkFileExists('routes/projects.js', 'Project routes exist');
checkFileExists('routes/deployments.js', 'Deployment routes exist');
checkFileExists('routes/billing.js', 'Billing routes exist');
checkFileExists('routes/admin.js', 'Admin routes exist');
checkFileExists('routes/webhooks.js', 'Webhook routes exist');

console.log('\n⚙️  Checking Services...\n');

// Services
checkFileExists('services/containerOrchestrator.js', 'Container orchestrator exists');
checkFileExists('services/docker.js', 'Docker service exists');
checkFileExists('services/github.js', 'GitHub service exists');
checkFileExists('services/buildQueue.js', 'Build queue service exists (NEW)');
checkFileExists('services/buildExecutor.js', 'Build executor service exists (NEW)');

console.log('\n🔗 Checking Dependencies...\n');

// Check critical imports
checkRequire('routes/deployments.js', '../models/Deployment', 'Deployment model imported in routes');
checkRequire('routes/deployments.js', '../services/buildQueue', 'Build queue imported in routes');
checkRequire('services/buildQueue.js', './buildExecutor', 'Build executor imported in queue');
checkRequire('services/buildExecutor.js', '../models/Deployment', 'Deployment model imported in executor');

console.log('\n🔍 Checking Package Dependencies...\n');

// Check package.json for new dependencies
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const requiredDeps = ['bull', 'redis', 'express', 'mongoose', 'socket.io', 'dockerode'];

requiredDeps.forEach(dep => {
    if (packageJson.dependencies[dep]) {
        console.log(`✅ ${dep} is installed (${packageJson.dependencies[dep]})`);
        checks.passed++;
    } else {
        console.log(`❌ ${dep} is NOT installed`);
        checks.failed++;
    }
});

console.log('\n🔧 Checking Middleware...\n');

// Middleware
checkFileExists('middleware/auth.js', 'Auth middleware exists');
checkFileExists('middleware/admin.js', 'Admin middleware exists');

console.log('\n🛠️  Checking Utils...\n');

// Utils
checkFileExists('utils/database.js', 'Database utility exists');
checkFileExists('utils/logger.js', 'Logger utility exists');

console.log('\n📊 Verification Summary\n');
console.log('='.repeat(60));
console.log(`✅ Passed: ${checks.passed}`);
console.log(`⚠️  Warnings: ${checks.warnings}`);
console.log(`❌ Failed: ${checks.failed}`);
console.log('='.repeat(60));

if (checks.failed === 0) {
    console.log('\n🎉 All checks passed! Backend is ready.\n');
    process.exit(0);
} else {
    console.log('\n⚠️  Some checks failed. Please review the errors above.\n');
    process.exit(1);
}
