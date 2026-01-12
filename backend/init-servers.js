// Initialize servers in database from environment variables
require('dotenv').config();
const mongoose = require('mongoose');
const Server = require('./models/Server');

async function initializeServers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Define servers from environment
        const servers = [
            {
                name: 'EC1-API-Main',
                key: 'EC1',
                host: process.env.EC1_SERVER_IP || 'localhost',
                type: 'api_main',
                enabled: true,
                totalCPU: 4,
                totalRAM: 16,
                maxContainers: 0,  // No user containers on EC1
                priority: 1
            },
            {
                name: 'EC2-Mixed-Server',
                key: 'EC2',
                host: process.env.EC2_SERVER_IP || '140.238.229.147',
                type: 'mixed_users',
                enabled: true,
                totalCPU: parseFloat(process.env.EC2_TOTAL_CPU) || 4,
                totalRAM: parseInt(process.env.EC2_TOTAL_RAM) || 24,
                maxContainers: parseInt(process.env.EC2_MAX_CONTAINERS) || 200,
                sharedPool: {
                    maxUsers: 150,
                    cpuLimit: 2,
                    ramLimit: 12
                },
                dedicatedPool: {
                    maxUsers: 50,
                    cpuLimit: 2,
                    ramLimit: 12
                },
                sshKey: process.env.SSH_EC2_KEY,
                region: 'oracle-cloud',
                priority: 10
            },
            {
                name: 'EC3-Mixed-Server',
                key: 'EC3',
                host: process.env.EC3_SERVER_IP || '129.154.255.90',
                type: 'mixed_users',
                enabled: true,
                totalCPU: parseFloat(process.env.EC3_TOTAL_CPU) || 8,
                totalRAM: parseInt(process.env.EC3_TOTAL_RAM) || 48,
                maxContainers: parseInt(process.env.EC3_MAX_CONTAINERS) || 300,
                sharedPool: {
                    maxUsers: 200,
                    cpuLimit: 3,
                    ramLimit: 18
                },
                dedicatedPool: {
                    maxUsers: 100,
                    cpuLimit: 5,
                    ramLimit: 30
                },
                sshKey: process.env.SSH_EC3_KEY,
                region: 'oracle-cloud',
                priority: 10
            }
        ];

        console.log('📊 Initializing servers...\n');

        for (const serverData of servers) {
            const existing = await Server.findOne({ key: serverData.key });

            if (existing) {
                // Update existing
                await Server.findOneAndUpdate(
                    { key: serverData.key },
                    { $set: serverData },
                    { new: true }
                );
                console.log(`✅ Updated: ${serverData.name} (${serverData.key})`);
            } else {
                // Create new
                await Server.create(serverData);
                console.log(`✅ Created: ${serverData.name} (${serverData.key})`);
            }
        }

        console.log('\n✅ Server initialization complete!');
        console.log('\nServers in database:');

        const allServers = await Server.find({ enabled: true }).sort({ priority: 1 });
        allServers.forEach(server => {
            console.log(`  - ${server.name} (${server.key}): ${server.host}`);
            console.log(`    CPU: ${server.totalCPU}, RAM: ${server.totalRAM}GB, Max Containers: ${server.maxContainers}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

initializeServers();
