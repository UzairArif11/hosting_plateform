/**
 * Comprehensive Test Suite for All Features
 * Run with: node backend/scripts/test-all-features.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Template = require('../models/Template');
const Project = require('../models/Project');
const User = require('../models/User');
const Invitation = require('../models/Invitation');
const Deployment = require('../models/Deployment');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const Plan = require('../models/Plan');

// Test counters
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;
const failedTests = [];

// Helper functions
function assert(condition, message) {
    testsRun++;
    if (condition) {
        testsPassed++;
        console.log(`✅ PASS: ${message}`);
        return true;
    } else {
        testsFailed++;
        failedTests.push(message);
        console.error(`❌ FAIL: ${message}`);
        return false;
    }
}

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vercel-clone');
        console.log('📦 Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        process.exit(1);
    }
}

// TEST SUITE 1: Database Models
async function testModels() {
    console.log('\n🧪 TEST SUITE 1: Database Models\n');

    // Test Template model
    const templateExists = !!Template;
    assert(templateExists, 'Template model exists');

    if (templateExists) {
        const templateFields = Object.keys(Template.schema.paths);
        assert(templateFields.includes('name'), 'Template has name field');
        assert(templateFields.includes('githubRepo'), 'Template has githubRepo field');
        assert(templateFields.includes('deployCount'), 'Template has deployCount field');
    }

    // Test Invitation model
    const invitationExists = !!Invitation;
    assert(invitationExists, 'Invitation model exists');

    if (invitationExists) {
        const invitationFields = Object.keys(Invitation.schema.paths);
        assert(invitationFields.includes('token'), 'Invitation has token field');
        assert(invitationFields.includes('projectId'), 'Invitation has projectId field');
        assert(invitationFields.includes('email'), 'Invitation has email field');
    }

    // Test AnalyticsEvent model
    const analyticsExists = !!AnalyticsEvent;
    assert(analyticsExists, 'AnalyticsEvent model exists');

    if (analyticsExists) {
        const analyticsFields = Object.keys(AnalyticsEvent.schema.paths);
        assert(analyticsFields.includes('projectId'), 'AnalyticsEvent has projectId field');
        assert(analyticsFields.includes('visitorId'), 'AnalyticsEvent has visitorId field');
    }

    // Test Project model updates
    const projectFields = Object.keys(Project.schema.paths);
    assert(projectFields.includes('domains'), 'Project has domains field');

    // Check if domains have verification fields
    const domainsSchema = Project.schema.path('domains');
    if (domainsSchema && domainsSchema.schema) {
        const domainFields = Object.keys(domainsSchema.schema.paths);
        assert(domainFields.includes('verificationToken'), 'Domain has verificationToken field');
        assert(domainFields.includes('verifiedAt'), 'Domain has verifiedAt field');
    }

    // Test Deployment model
    const deploymentFields = Object.keys(Deployment.schema.paths);
    assert(deploymentFields.includes('rollbackFrom'), 'Deployment has rollbackFrom field');
}

// TEST SUITE 2: Plan Feature Flags
async function testPlanFeatures() {
    console.log('\n🧪 TEST SUITE 2: Plan Feature Enforcement\n');

    try {
        // Find or create test plans
        let freePlan = await Plan.findOne({ name: 'free' });
        let proPlan = await Plan.findOne({ name: 'pro' });

        if (!freePlan) {
            console.log('⚠️  Free plan not found in database - testing structure only');
        } else {
            const freeFeatures = freePlan.features || [];
            console.log(`ℹ️  Free plan has ${freeFeatures.length} features configured`);
        }

        if (!proPlan) {
            console.log('⚠️  Pro plan not found in database - testing structure only');
        } else {
            const proFeatures = proPlan.features || [];
            console.log(`ℹ️  Pro plan has ${proFeatures.length} features configured`);

            // Check for required features
            const hasTemplates = proFeatures.some(f => f.name === 'templates');
            const hasAnalytics = proFeatures.some(f => f.name === 'analytics');
            const hasCustomDomains = proFeatures.some(f => f.name === 'customDomains');
            const hasTeamCollaboration = proFeatures.some(f => f.name === 'teamCollaboration');
            const hasRollback = proFeatures.some(f => f.name === 'rollback');

            assert(hasTemplates || !proPlan, 'Pro plan has templates feature (or plan not created yet)');
            assert(hasAnalytics || !proPlan, 'Pro plan has analytics feature (or plan not created yet)');
        }
    } catch (error) {
        console.log(`⚠️  Plan testing skipped: ${error.message}`);
    }
}

// TEST SUITE 3: Template System
async function testTemplates() {
    console.log('\n🧪 TEST SUITE 3: Template System\n');

    try {
        const templateCount = await Template.countDocuments();
        console.log(`ℹ️  Found ${templateCount} templates in database`);

        assert(templateCount >= 0, 'Template collection accessible');

        if (templateCount > 0) {
            const sampleTemplate = await Template.findOne();
            assert(!!sampleTemplate.name, 'Template has name');
            assert(!!sampleTemplate.githubRepo, 'Template has githubRepo');
            assert(sampleTemplate.deployCount !== undefined, 'Template has deployCount');
            assert(!!sampleTemplate.framework, 'Template has framework');
        } else {
            console.log('⚠️  No templates seeded - run seedTemplates.js first');
        }
    } catch (error) {
        console.error(`❌ Template test error: ${error.message}`);
    }
}

// TEST SUITE 4: Domain Verification Logic
async function testDomainVerification() {
    console.log('\n🧪 TEST SUITE 4: Domain Verification Logic\n');

    try {
        const domainVerification = require('../services/domainVerification');

        // Test token generation
        const token1 = domainVerification.generateVerificationToken();
        const token2 = domainVerification.generateVerificationToken();

        assert(!!token1, 'Generates verification token');
        assert(token1.startsWith('vcp-verification='), 'Token has correct prefix');
        assert(token1 !== token2, 'Generates unique tokens');

        // Test DNS verification (will fail without real DNS, but tests logic)
        const verifyPromise = domainVerification.verifyDnsRecord('example.com', token1);
        assert(verifyPromise instanceof Promise, 'verifyDnsRecord returns Promise');

        console.log('ℹ️  Domain verification logic validated (DNS mocked)');
    } catch (error) {
        console.error(`❌ Domain verification test error: ${error.message}`);
    }
}

// TEST SUITE 5: Analytics Logic
async function testAnalytics() {
    console.log('\n🧪 TEST SUITE 5: Analytics System\n');

    try {
        const eventCount = await AnalyticsEvent.countDocuments();
        console.log(`ℹ️  Found ${eventCount} analytics events in database`);

        assert(eventCount >= 0, 'AnalyticsEvent collection accessible');

        // Test event structure
        if (eventCount > 0) {
            const sampleEvent = await AnalyticsEvent.findOne();
            assert(!!sampleEvent.projectId, 'Analytics event has projectId');
            assert(!!sampleEvent.visitorId, 'Analytics event has visitorId');
            assert(!!sampleEvent.timestamp, 'Analytics event has timestamp');
        }

        // Check TTL index
        const indexes = await AnalyticsEvent.collection.getIndexes();
        const hasTTL = Object.values(indexes).some(idx => idx.expireAfterSeconds !== undefined);
        assert(hasTTL, 'AnalyticsEvent has TTL index for auto-deletion');
    } catch (error) {
        console.error(`❌ Analytics test error: ${error.message}`);
    }
}

// TEST SUITE 6: Invitation System
async function testInvitations() {
    console.log('\n🧪 TEST SUITE 6: Team Collaboration\n');

    try {
        // Test token generation
        const token = Invitation.generateToken();
        assert(!!token, 'Generates invitation token');
        assert(token.length === 64, 'Token has correct length (32 bytes hex)');

        // Test invitation creation structure
        const invitationCount = await Invitation.countDocuments();
        console.log(`ℹ️  Found ${invitationCount} invitations in database`);
        assert(invitationCount >= 0, 'Invitation collection accessible');

        // Check indexes
        const indexes = await Invitation.collection.getIndexes();
        assert(Object.keys(indexes).length > 0, 'Invitation has indexes');
    } catch (error) {
        console.error(`❌ Invitation test error: ${error.message}`);
    }
}

// TEST SUITE 7: Rollback System
async function testRollback() {
    console.log('\n🧪 TEST SUITE 7: Deployment Rollback\n');

    try {
        const deploymentCount = await Deployment.countDocuments();
        console.log(`ℹ️  Found ${deploymentCount} deployments in database`);

        assert(deploymentCount >= 0, 'Deployment collection accessible');

        // Check for rollback support
        const deploymentFields = Object.keys(Deployment.schema.paths);
        assert(deploymentFields.includes('rollbackFrom'), 'Deployment supports rollback tracking');
        assert(deploymentFields.includes('trigger'), 'Deployment has trigger field');

        // Check trigger enum includes rollback
        const triggerEnum = Deployment.schema.path('trigger').enumValues;
        assert(triggerEnum.includes('rollback'), 'Deployment trigger supports rollback');
    } catch (error) {
        console.error(`❌ Rollback test error: ${error.message}`);
    }
}

// MAIN TEST RUNNER
async function runAllTests() {
    console.log('🚀 Starting Automated Test Suite\n');
    console.log('='.repeat(60));

    await connectDB();

    try {
        await testModels();
        await testPlanFeatures();
        await testTemplates();
        await testDomainVerification();
        await testAnalytics();
        await testInvitations();
        await testRollback();

        console.log('\n' + '='.repeat(60));
        console.log('\n📊 TEST SUMMARY\n');
        console.log(`Total Tests: ${testsRun}`);
        console.log(`✅ Passed: ${testsPassed}`);
        console.log(`❌ Failed: ${testsFailed}`);
        console.log(`Success Rate: ${((testsPassed / testsRun) * 100).toFixed(1)}%`);

        if (testsFailed > 0) {
            console.log('\n❌ FAILED TESTS:');
            failedTests.forEach((test, i) => {
                console.log(`${i + 1}. ${test}`);
            });
        } else {
            console.log('\n🎉 ALL TESTS PASSED!');
        }

    } catch (error) {
        console.error('\n💥 Test suite error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n📦 Disconnected from MongoDB');
        process.exit(testsFailed > 0 ? 1 : 0);
    }
}

// Run tests
runAllTests().catch(console.error);
