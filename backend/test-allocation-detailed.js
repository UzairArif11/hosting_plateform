// Test container allocation with full error details
const mongoose = require('mongoose');
const User = require('./models/User');
const containerOrchestrator = require('./services/containerOrchestrator');
const logger = require('./utils/logger');
require('dotenv').config();

// Set logger to show all levels
logger.level = 'debug';

async function testAllocation() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const user = await User.findOne({}).sort({ createdAt: -1 });
        console.log('👤 User:', user.email);
        console.log('📊 Current assignment:', {
            server: user.assignedServer,
            container: user.containerName,
            port: user.assignedPort
        });

        console.log('\n🔍 Environment:');
        console.log('EC2_SERVER_IP:', process.env.EC2_SERVER_IP);
        console.log('EC3_SERVER_IP:', process.env.EC3_SERVER_IP);

        console.log('\n🚀 Starting container allocation...\n');

        try {
            const result = await containerOrchestrator.allocateContainer(user, 'free');
            console.log('\n✅ SUCCESS! Result:', JSON.stringify(result, null, 2));
        } catch (allocError) {
            console.error('\n❌ ALLOCATION ERROR:');
            console.error('Message:', allocError.message);
            console.error('Stack:', allocError.stack);

            if (allocError.cause) {
                console.error('Cause:', allocError.cause);
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ FATAL ERROR:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testAllocation();
