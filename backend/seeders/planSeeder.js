const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const User = require('../models/User');
require('dotenv').config();

const initialPlans = [
    {
        name: 'free',
        displayName: 'Free Tier',
        description: 'Perfect for hobby projects and testing. Get started with basic resources at no cost.',
        pricing: {
            usd: 0,
            pkr: 0,
            eur: 0,
            gbp: 0
        },
        billingCycle: 'monthly',
        resources: {
            cpu: 0.5,
            ram: 0.5,
            storage: 10,
            bandwidth: 100,
            containers: 5,
            projects: 3
        },
        displayResources: {
            cpu: 0.5,
            ram: 0.5,
            storage: 10,
            bandwidth: 100,
            projects: 3
        },
        actualResources: {
            cpu: 0.5,
            ram: 0.5,
            storage: 10,
            bandwidth: 100,
            projects: 3
        },
        oracleConfig: {
            accountType: 'shared',
            instanceShape: 'VM.Standard.A1.Flex',
            dedicatedAccount: false
        },
        features: [
            { name: 'Shared Hosting', description: 'Resources shared with other free users', enabled: true },
            { name: 'Standard Support', description: 'Community forum access', enabled: true },
            { name: 'Custom Domains', description: 'Connect your own domain', enabled: true },
            { name: 'SSL Certificates', description: 'Automatic HTTPS', enabled: true },
            { name: 'Git Integration', description: 'Deploy from GitHub/GitLab', enabled: true }
        ],
        limits: {
            deploymentsPerDay: 10,
            buildsPerDay: 10,
            domainsPerProject: 1,
            environmentVariables: 20,
            logRetentionDays: 7
        },
        isActive: true,
        isDefault: true,
        isTrial: false,
        sortOrder: 1
    },
    {
        name: 'pro',
        displayName: 'Pro',
        description: 'For professional developers and small teams. Dedicated resources with priority support.',
        pricing: {
            usd: 29,
            pkr: 8099,
            eur: 27,
            gbp: 23
        },
        billingCycle: 'monthly',
        resources: {
            cpu: 2,
            ram: 4,
            storage: 100,
            bandwidth: 1000,
            containers: 20,
            projects: 15
        },
        displayResources: {
            cpu: 2,
            ram: 4,
            storage: 100,
            bandwidth: 1000,
            projects: 15
        },
        actualResources: {
            cpu: 2,
            ram: 4,
            storage: 100,
            bandwidth: 1000,
            projects: 15
        },
        oracleConfig: {
            accountType: 'dedicated',
            instanceShape: 'VM.Standard.A1.Flex',
            dedicatedAccount: false
        },
        features: [
            { name: 'Dedicated Hosting', description: 'Your own dedicated resources', enabled: true },
            { name: 'Priority Support', description: '24/7 email support with 4h response', enabled: true },
            { name: 'Auto-scaling', description: 'Automatic resource scaling', enabled: true },
            { name: 'Custom Domains', description: 'Unlimited custom domains', enabled: true },
            { name: 'SSL Certificates', description: 'Wildcard SSL included', enabled: true },
            { name: 'Team Collaboration', description: 'Up to 5 team members', enabled: true },
            { name: 'Advanced Analytics', description: 'Real-time traffic analytics', enabled: true },
            { name: 'Database Backups', description: 'Daily automated backups', enabled: true }
        ],
        limits: {
            deploymentsPerDay: 50,
            buildsPerDay: 50,
            domainsPerProject: 5,
            environmentVariables: 100,
            logRetentionDays: 30
        },
        isActive: true,
        isDefault: false,
        isTrial: false,
        sortOrder: 2
    },
    {
        name: 'enterprise',
        displayName: 'Enterprise',
        description: 'For large-scale applications and enterprises. Maximum resources with dedicated support.',
        pricing: {
            usd: 99,
            pkr: 27599,
            eur: 92,
            gbp: 79
        },
        billingCycle: 'monthly',
        resources: {
            cpu: 8,
            ram: 16,
            storage: 500,
            bandwidth: 5000,
            containers: 100,
            projects: 50
        },
        displayResources: {
            cpu: 8,
            ram: 16,
            storage: 500,
            bandwidth: 5000,
            projects: 50
        },
        actualResources: {
            cpu: 8,
            ram: 16,
            storage: 500,
            bandwidth: 5000,
            projects: 50
        },
        oracleConfig: {
            accountType: 'dedicated',
            instanceShape: 'VM.Standard.A1.Flex',
            dedicatedAccount: true
        },
        features: [
            { name: 'Dedicated Hosting', description: 'Isolated high-performance resources', enabled: true },
            { name: 'Premium Support', description: '24/7 phone + chat support', enabled: true },
            { name: 'Auto-scaling', description: 'Advanced auto-scaling', enabled: true },
            { name: 'Custom Domains', description: 'Unlimited with DNS management', enabled: true },
            { name: 'SSL Certificates', description: 'Enterprise SSL', enabled: true },
            { name: 'Team Collaboration', description: 'Unlimited team members', enabled: true },
            { name: 'Advanced Analytics', description: 'Custom dashboards + API', enabled: true },
            { name: 'Database Backups', description: 'Hourly backups', enabled: true },
            { name: 'Load Balancing', description: 'Automatic load distribution', enabled: true },
            { name: 'CDN Integration', description: 'Global content delivery', enabled: true },
            { name: 'Security Scanning', description: 'Automated vulnerability scanning', enabled: true },
            { name: 'Compliance Reports', description: 'SOC2, GDPR compliance', enabled: true }
        ],
        limits: {
            deploymentsPerDay: 500,
            buildsPerDay: 500,
            domainsPerProject: 20,
            environmentVariables: 500,
            logRetentionDays: 90
        },
        isActive: true,
        isDefault: false,
        isTrial: false,
        sortOrder: 3
    }
];

async function seedPlans() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hosting-platform');
        console.log('✅ Connected to MongoDB\n');

        console.log('🗑️  Clearing existing plans...');
        const deleteResult = await Plan.deleteMany({});
        console.log(`✅ Deleted ${deleteResult.deletedCount} existing plans\n`);

        console.log('📝 Inserting new plans...');
        const createdPlans = await Plan.insertMany(initialPlans);
        console.log(`✅ Created ${createdPlans.length} plans:\n`);

        createdPlans.forEach(plan => {
            console.log(`   💳 ${plan.displayName} - $${plan.pricing.usd}/month`);
            console.log(`      CPU: ${plan.resources.cpu} | RAM: ${plan.resources.ram}GB | Storage: ${plan.resources.storage}GB\n`);
        });

        console.log('👥 Updating users with plan references...');

        const freePlan = createdPlans.find(p => p.name === 'free');
        const proPlan = createdPlans.find(p => p.name === 'pro');

        if (freePlan) {
            const freeUpdate = await User.updateMany(
                { $or: [{ planType: 'free' }, { plan: null }] },
                { $set: { plan: freePlan._id, planType: 'free' } }
            );
            console.log(`   ✅ Updated ${freeUpdate.modifiedCount} free users`);
        }

        if (proPlan) {
            const proUpdate = await User.updateMany(
                { planType: 'pro' },
                { $set: { plan: proPlan._id } }
            );
            console.log(`   ✅ Updated ${proUpdate.modifiedCount} pro users`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎉 DATABASE SEEDING COMPLETE!');
        console.log('='.repeat(60));

        console.log('\n📊 Plan Summary:');
        console.log('┌─────────────────┬───────────┬──────┬──────┬──────────┐');
        console.log('│ Plan            │ Price     │ CPU  │ RAM  │ Storage  │');
        console.log('├─────────────────┼───────────┼──────┼──────┼──────────┤');

        createdPlans.forEach(plan => {
            const planName = plan.displayName.padEnd(15);
            const price = `$${plan.pricing.usd}`.padEnd(9);
            const cpu = String(plan.resources.cpu).padEnd(4);
            const ram = `${plan.resources.ram}GB`.padEnd(4);
            const storage = `${plan.resources.storage}GB`.padEnd(8);
            console.log(`│ ${planName} │ ${price} │ ${cpu} │ ${ram} │ ${storage} │`);
        });

        console.log('└─────────────────┴───────────┴──────┴──────┴──────────┘');

        console.log('\n🚀 Next Steps:');
        console.log('   1. Visit http://localhost:3000/admin/plans');
        console.log('   2. Click 💳 Plans in the sidebar');
        console.log('   3. Edit plans, update resources & pricing');
        console.log('   4. Click "Sync Users" to apply changes\n');

        console.log('✅ Your platform is now production-ready!\n');

    } catch (error) {
        console.error('\n❌ Error seeding database:');
        if (error.writeErrors && error.writeErrors.length > 0) {
            console.error('\nValidation Error Details:');
            error.writeErrors.forEach((err, index) => {
                console.error(`\nDocument ${index + 1}:`);
                console.error(JSON.stringify(err.err, null, 2));
            });
        } else {
            console.error(error.message);
            console.error(error);
        }
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('👋 Connection closed.\n');
        process.exit(0);
    }
}

if (require.main === module) {
    seedPlans();
}

module.exports = { seedPlans, initialPlans };
