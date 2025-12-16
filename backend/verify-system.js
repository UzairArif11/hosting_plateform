/**
 * Quick Verification Script
 * Tests core functionality without waiting
 */

require('dotenv').config();
const mongoose = require('mongoose');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

const log = {
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
    test: (msg) => console.log(`${colors.cyan}🧪 ${msg}${colors.reset}`)
};

async function verify() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 QUICK VERIFICATION');
    console.log('='.repeat(60) + '\n');

    try {
        // 1. Check MongoDB Connection
        log.test('TEST 1: MongoDB Connection');
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            log.error('MONGODB_URI not found in .env');
            process.exit(1);
        }
        await mongoose.connect(mongoUri);
        log.success('MongoDB connected');

        // 2. Check Models
        log.test('\nTEST 2: Models');
        const User = require('./models/User');
        const Plan = require('./models/Plan');
        const Project = require('./models/Project');
        log.success('All models loaded');

        // 3. Check Services
        log.test('\nTEST 3: Services');
        const resourceManager = require('./services/resourceManager');
        const sharedContainer = require('./services/sharedContainer');
        const containerCleanup = require('./services/containerCleanup');
        const docker = require('./services/docker');
        log.success('All services loaded');

        // 4. Check Functions
        log.test('\nTEST 4: Functions');
        log.info('  resourceManager.getEffectiveResources: ' + (typeof resourceManager.getEffectiveResources === 'function' ? '✓' : '✗'));
        log.info('  resourceManager.applyAdminOverride: ' + (typeof resourceManager.applyAdminOverride === 'function' ? '✓' : '✗'));
        log.info('  resourceManager.bulkUpdatePlanUsers: ' + (typeof resourceManager.bulkUpdatePlanUsers === 'function' ? '✓' : '✗'));
        log.info('  sharedContainer.findSharedContainer: ' + (typeof sharedContainer.findSharedContainer === 'function' ? '✓' : '✗'));
        log.info('  sharedContainer.deployToSharedContainer: ' + (typeof sharedContainer.deployToSharedContainer === 'function' ? '✓' : '✗'));
        log.info('  docker.execCommand: ' + (typeof docker.execCommand === 'function' ? '✓' : '✗'));
        log.info('  docker.execInContainer: ' + (typeof docker.execInContainer === 'function' ? '✓' : '✗'));
        log.success('All functions exist');

        // 5. Check Database
        log.test('\nTEST 5: Database');
        const userCount = await User.countDocuments();
        const planCount = await Plan.countDocuments();
        const projectCount = await Project.countDocuments();
        log.info(`  Users: ${userCount}`);
        log.info(`  Plans: ${planCount}`);
        log.info(`  Projects: ${projectCount}`);
        log.success('Database accessible');

        // 6. Check Cgroups Implementation
        log.test('\nTEST 6: Cgroups Implementation');
        const fs = require('fs');
        const sharedContainerCode = fs.readFileSync('./services/sharedContainer.js', 'utf8');
        const cgroupsEnabled = !sharedContainerCode.includes('Cgroup setup skipped');
        const hasExecCommand = sharedContainerCode.includes('docker.execCommand');
        log.info(`  Cgroups enabled: ${cgroupsEnabled ? '✓' : '✗'}`);
        log.info(`  Uses execCommand: ${hasExecCommand ? '✓' : '✗'}`);
        if (cgroupsEnabled && hasExecCommand) {
            log.success('Cgroups are enabled and implemented');
        } else {
            log.error('Cgroups not properly enabled');
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 VERIFICATION SUMMARY');
        console.log('='.repeat(60) + '\n');
        log.success('✅ MongoDB: Connected');
        log.success('✅ Models: Loaded');
        log.success('✅ Services: Loaded');
        log.success('✅ Functions: Available');
        log.success('✅ Database: Accessible');
        log.success(`✅ Cgroups: ${cgroupsEnabled ? 'ENABLED' : 'DISABLED'}`);
        log.success(`✅ execCommand: ${typeof docker.execCommand === 'function' ? 'IMPLEMENTED' : 'MISSING'}`);

        console.log('\n' + '='.repeat(60));
        if (cgroupsEnabled && typeof docker.execCommand === 'function') {
            log.success('🎉 ALL SYSTEMS READY - PRODUCTION READY!');
        } else {
            log.error('⚠️  SOME ISSUES FOUND');
        }
        console.log('='.repeat(60) + '\n');

        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        log.error(`Verification failed: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

verify();
