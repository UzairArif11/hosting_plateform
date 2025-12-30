const mongoose = require('mongoose');
const ServerCapacity = require('../models/ServerCapacity');
require('dotenv').config();

/**
 * Initialize Server Capacity Tracking
 * Run this once to set up your server resource limits
 */

const serverConfigs = [
    {
        serverName: 'EC2',
        totalResources: {
            cpu: 4,          // 4 OCPU cores
            ram: 24,         // 24 GB RAM
            storage: 200,    // 200 GB storage
            bandwidth: 5000  // 5 TB/month
        },
        reservedResources: {
            cpu: 0.5,        // System overhead
            ram: 2,          // System RAM
            storage: 20,     // System files
            bandwidth: 500   // System traffic
        },
        planLimits: [
            { planName: 'free', maxUsers: 100, currentUsers: 0, priority: 1 },
            { planName: 'pro', maxUsers: 50, currentUsers: 0, priority: 10 },
            { planName: 'enterprise', maxUsers: 20, currentUsers: 0, priority: 20 }
        ],
        overselling: {
            enabled: false,
            cpuMultiplier: 1.0,
            ramMultiplier: 1.0
        },
        warningThresholds: {
            cpu: 80,
            ram: 85,
            storage: 90
        },
        isActive: true
    },
    {
        serverName: 'EC3',
        totalResources: {
            cpu: 8,          // 8 OCPU cores
            ram: 48,         // 48 GB RAM
            storage: 500,    // 500 GB storage
            bandwidth: 10000 // 10 TB/month
        },
        reservedResources: {
            cpu: 1,
            ram: 4,
            storage: 50,
            bandwidth: 1000
        },
        planLimits: [
            { planName: 'free', maxUsers: 150, currentUsers: 0, priority: 1 },
            { planName: 'pro', maxUsers: 100, currentUsers: 0, priority: 10 },
            { planName: 'enterprise', maxUsers: 50, currentUsers: 0, priority: 20 }
        ],
        overselling: {
            enabled: false,
            cpuMultiplier: 1.0,
            ramMultiplier: 1.0
        },
        warningThresholds: {
            cpu: 75,
            ram: 80,
            storage: 85
        },
        isActive: true
    }
];

async function seedServerCapacity() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hosting-platform');
        console.log('✅ Connected\n');

        console.log('🗑️  Clearing existing capacity data...');
        await ServerCapacity.deleteMany({});
        console.log('✅ Cleared\n');

        console.log('📝 Creating server capacity tracking...');
        const created = await ServerCapacity.insertMany(serverConfigs);

        console.log('✅ Created capacity tracking for:\n');

        created.forEach(server => {
            const available = server.availableResources;
            console.log(`📊 ${server.serverName}:`);
            console.log(`   Total:     ${server.totalResources.cpu} CPU | ${server.totalResources.ram}GB RAM | ${server.totalResources.storage}GB Storage`);
            console.log(`   Reserved:  ${server.reservedResources.cpu} CPU | ${server.reservedResources.ram}GB RAM | ${server.reservedResources.storage}GB Storage`);
            console.log(`   Available: ${available.cpu} CPU | ${available.ram}GB RAM | ${available.storage}GB Storage`);
            console.log(`   Limits:    Free=${server.planLimits.find(p => p.planName === 'free')?.maxUsers} | Pro=${server.planLimits.find(p => p.planName === 'pro')?.maxUsers} | Enterprise=${server.planLimits.find(p => p.planName === 'enterprise')?.maxUsers}`);
            console.log('');
        });

        console.log('='.repeat(60));
        console.log('🎉 SERVER CAPACITY INITIALIZED');
        console.log('='.repeat(60));
        console.log('\n📈 Capacity Summary:');
        console.log('┌────────┬──────────┬──────────┬──────────┬───────────┐');
        console.log('│ Server │ CPU Free │ RAM Free │ Storage  │ Bandwidth │');
        console.log('├────────┼──────────┼──────────┼──────────┼───────────┤');

        created.forEach(s => {
            const a = s.availableResources;
            console.log(`│ ${s.serverName.padEnd(6)} │ ${String(a.cpu).padEnd(8)} │ ${String(a.ram).padEnd(8)} │ ${String(a.storage).padEnd(8)} │ ${String(a.bandwidth).padEnd(9)} │`);
        });

        console.log('└────────┴──────────┴──────────┴──────────┴───────────┘');
        console.log('\n🚀 Next Steps:');
        console.log('   1. Visit /admin/capacity to see resource dashboard');
        console.log('   2. Adjust plan limits as needed');
        console.log('   3. Enable overselling if desired\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('👋 Connection closed.\n');
        process.exit(0);
    }
}

if (require.main === module) {
    seedServerCapacity();
}

module.exports = { seedServerCapacity, serverConfigs };
