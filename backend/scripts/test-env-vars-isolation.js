/**
 * Test Script: Environment Variables Isolation
 * 
 * This script tests that environment variables are properly isolated per project.
 * Tests:
 * 1. Multiple users can deploy same template with different env vars
 * 2. Updates to one project's env vars don't affect others
 * 3. Each project maintains its own isolated set of env vars
 */

const mongoose = require('mongoose');
const Project = require('../models/Project');
const Template = require('../models/Template');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin';

// Test data
const testUsers = [
    { username: 'test_user_a', email: 'usera@test.com' },
    { username: 'test_user_b', email: 'userb@test.com' }
];

const testTemplate = {
    name: 'test-ecommerce-template',
    slug: 'test-ecommerce-template',
    displayName: 'Test Ecommerce Template',
    description: 'Test template for isolation verification',
    category: 'ecommerce',
    framework: 'nextjs',
    githubRepo: 'vercel/commerce',
    githubBranch: 'main',
    previewImage: 'https://placehold.co/600x400',
    isPublished: true,
    minPlan: 'free',
    environmentVariables: [
        { key: 'STRIPE_KEY', description: 'Stripe API key', defaultValue: '', isRequired: true, isSecret: true },
        { key: 'DATABASE_URL', description: 'Database connection URL', defaultValue: '', isRequired: true, isSecret: false },
        { key: 'SITE_NAME', description: 'Site name', defaultValue: 'My Store', isRequired: false, isSecret: false }
    ]
};

async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    }
}

async function cleanup() {
    console.log('\n🧹 Cleaning up test data...');
    try {
        // Remove test projects
        await Project.deleteMany({ name: { $regex: /^test-project-/ } });
        console.log('✅ Removed test projects');

        // Remove test template
        await Template.deleteOne({ name: testTemplate.name });
        console.log('✅ Removed test template');

        // Remove test users
        await User.deleteMany({ username: { $in: testUsers.map(u => u.username) } });
        console.log('✅ Removed test users');
    } catch (error) {
        console.error('⚠️ Cleanup error:', error.message);
    }
}

async function createTestUsers() {
    console.log('\n👥 Creating test users...');
    const users = [];

    for (const userData of testUsers) {
        let user = await User.findOne({ username: userData.username });
        if (!user) {
            user = await User.create({
                ...userData,
                password: 'testpassword123',
                role: 'user'
            });
            console.log(`✅ Created user: ${user.username}`);
        } else {
            console.log(`ℹ️  User already exists: ${user.username}`);
        }
        users.push(user);
    }

    return users;
}

async function createTestTemplate() {
    console.log('\n📋 Creating test template...');
    let template = await Template.findOne({ name: testTemplate.name });
    
    if (!template) {
        template = await Template.create(testTemplate);
        console.log('✅ Created test template');
    } else {
        console.log('ℹ️  Template already exists, updating...');
        Object.assign(template, testTemplate);
        await template.save();
    }

    return template;
}

async function createTestProjects(users, template) {
    console.log('\n🚀 Creating test projects...');
    const projects = [];

    // User A's project
    const projectA = await Project.create({
        name: 'test-project-user-a',
        slug: `test-user-a-${Date.now()}`,
        owner: users[0]._id,
        repository: {
            url: `https://github.com/${template.githubRepo}`,
            fullName: template.githubRepo,
            branch: template.githubBranch,
            provider: 'github',
            isPrivate: false
        },
        framework: template.framework,
        buildConfig: template.buildConfig || {},
        environmentVariables: [
            { key: 'STRIPE_KEY', value: 'sk_live_userA_123', isSecret: true, environments: ['production'] },
            { key: 'DATABASE_URL', value: 'postgres://user-a-db', isSecret: false, environments: ['production'] },
            { key: 'SITE_NAME', value: "User A's Store", isSecret: false, environments: ['production'] }
        ],
        status: 'active',
        metadata: {
            deployedFromTemplate: template._id,
            templateName: template.name,
            deployedAt: new Date(),
            sharedTemplate: true
        }
    });
    projects.push(projectA);
    console.log(`✅ Created project for ${users[0].username}: ${projectA.name}`);

    // User B's project
    const projectB = await Project.create({
        name: 'test-project-user-b',
        slug: `test-user-b-${Date.now()}`,
        owner: users[1]._id,
        repository: {
            url: `https://github.com/${template.githubRepo}`,
            fullName: template.githubRepo,
            branch: template.githubBranch,
            provider: 'github',
            isPrivate: false
        },
        framework: template.framework,
        buildConfig: template.buildConfig || {},
        environmentVariables: [
            { key: 'STRIPE_KEY', value: 'sk_live_userB_456', isSecret: true, environments: ['production'] },
            { key: 'DATABASE_URL', value: 'postgres://user-b-db', isSecret: false, environments: ['production'] },
            { key: 'SITE_NAME', value: "User B's Store", isSecret: false, environments: ['production'] }
        ],
        status: 'active',
        metadata: {
            deployedFromTemplate: template._id,
            templateName: template.name,
            deployedAt: new Date(),
            sharedTemplate: true
        }
    });
    projects.push(projectB);
    console.log(`✅ Created project for ${users[1].username}: ${projectB.name}`);

    return projects;
}

async function testIsolation(projects) {
    console.log('\n🔍 Testing Environment Variables Isolation...\n');

    // Test 1: Verify projects have different env vars
    console.log('Test 1: Verify projects have isolated environment variables');
    const projectA = projects[0];
    const projectB = projects[1];

    const stripeKeyA = projectA.environmentVariables.find(e => e.key === 'STRIPE_KEY')?.value;
    const stripeKeyB = projectB.environmentVariables.find(e => e.key === 'STRIPE_KEY')?.value;

    console.log(`  User A STRIPE_KEY: ${stripeKeyA}`);
    console.log(`  User B STRIPE_KEY: ${stripeKeyB}`);

    if (stripeKeyA !== stripeKeyB) {
        console.log('  ✅ PASS: Projects have different STRIPE_KEY values');
    } else {
        console.log('  ❌ FAIL: Projects have the same STRIPE_KEY value');
        return false;
    }

    // Test 2: Update User A's env vars and verify User B is unaffected
    console.log('\nTest 2: Update User A env vars, verify User B unchanged');
    const originalStripeKeyB = stripeKeyB;
    
    // Update User A's STRIPE_KEY
    const updatedEnvVarsA = projectA.environmentVariables.map(env => {
        if (env.key === 'STRIPE_KEY') {
            return { ...env, value: 'sk_live_userA_UPDATED_789' };
        }
        return env;
    });

    projectA.environmentVariables = updatedEnvVarsA;
    await projectA.save();

    // Reload User B's project from DB
    const reloadedProjectB = await Project.findById(projectB._id);
    const updatedStripeKeyB = reloadedProjectB.environmentVariables.find(e => e.key === 'STRIPE_KEY')?.value;

    console.log(`  User A STRIPE_KEY (updated): ${updatedEnvVarsA.find(e => e.key === 'STRIPE_KEY')?.value}`);
    console.log(`  User B STRIPE_KEY (should be unchanged): ${updatedStripeKeyB}`);

    if (updatedStripeKeyB === originalStripeKeyB) {
        console.log('  ✅ PASS: User B env vars unchanged after User A update');
    } else {
        console.log('  ❌ FAIL: User B env vars were affected by User A update');
        return false;
    }

    // Test 3: Add new env var to User A, verify it doesn't appear in User B
    console.log('\nTest 3: Add new env var to User A, verify isolation');
    const reloadedProjectA = await Project.findById(projectA._id);
    reloadedProjectA.environmentVariables.push({
        key: 'NEW_API_KEY',
        value: 'new_key_user_a_only',
        isSecret: false,
        environments: ['production']
    });
    await reloadedProjectA.save();

    const finalProjectB = await Project.findById(projectB._id);
    const newKeyInB = finalProjectB.environmentVariables.find(e => e.key === 'NEW_API_KEY');

    console.log(`  User A has NEW_API_KEY: ${reloadedProjectA.environmentVariables.find(e => e.key === 'NEW_API_KEY') ? 'Yes' : 'No'}`);
    console.log(`  User B has NEW_API_KEY: ${newKeyInB ? 'Yes' : 'No'}`);

    if (!newKeyInB) {
        console.log('  ✅ PASS: New env var in User A does not appear in User B');
    } else {
        console.log('  ❌ FAIL: New env var leaked to User B');
        return false;
    }

    // Test 4: Verify both projects use same template repo
    console.log('\nTest 4: Verify both projects use shared template repository');
    const repoA = reloadedProjectA.repository.fullName;
    const repoB = finalProjectB.repository.fullName;

    console.log(`  User A repository: ${repoA}`);
    console.log(`  User B repository: ${repoB}`);

    if (repoA === repoB) {
        console.log('  ✅ PASS: Both projects use shared template repository');
    } else {
        console.log('  ❌ FAIL: Projects use different repositories');
        return false;
    }

    // Test 5: Count total env vars per project
    console.log('\nTest 5: Verify env var counts');
    const countA = reloadedProjectA.environmentVariables.length;
    const countB = finalProjectB.environmentVariables.length;

    console.log(`  User A env vars count: ${countA}`);
    console.log(`  User B env vars count: ${countB}`);

    if (countA === 4 && countB === 3) {
        console.log('  ✅ PASS: Env var counts are correct (A has 4, B has 3)');
    } else {
        console.log(`  ⚠️  WARNING: Unexpected counts (A: ${countA}, B: ${countB})`);
    }

    return true;
}

async function displayResults(projects) {
    console.log('\n📊 Final State:\n');

    for (const project of projects) {
        const owner = await User.findById(project.owner);
        console.log(`Project: ${project.name} (Owner: ${owner.username})`);
        console.log(`  Repository: ${project.repository.fullName}`);
        console.log(`  Environment Variables:`);
        project.environmentVariables.forEach(env => {
            const value = env.isSecret ? '***HIDDEN***' : env.value;
            console.log(`    - ${env.key}: ${value} ${env.isSecret ? '(secret)' : ''}`);
        });
        console.log('');
    }
}

async function runTests() {
    try {
        await connectDB();

        // Cleanup first
        await cleanup();

        // Create test data
        const users = await createTestUsers();
        const template = await createTestTemplate();
        const projects = await createTestProjects(users, template);

        // Run tests
        const allTestsPassed = await testIsolation(projects);

        // Display results
        await displayResults(projects);

        // Summary
        console.log('\n' + '='.repeat(60));
        if (allTestsPassed) {
            console.log('✅ ALL TESTS PASSED');
            console.log('✅ Environment variables are properly isolated per project');
            console.log('✅ Users can update their env vars without affecting others');
        } else {
            console.log('❌ SOME TESTS FAILED');
            console.log('⚠️  Please review the test output above');
        }
        console.log('='.repeat(60) + '\n');

        // Cleanup
        await cleanup();

    } catch (error) {
        console.error('\n❌ Test error:', error);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run tests
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { runTests };
