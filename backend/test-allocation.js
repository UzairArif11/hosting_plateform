// Simple container allocation test
const mongoose = require('mongoose');
const User = require('./models/User');
const containerOrchestrator = require('./services/containerOrchestrator');
require('dotenv').config();

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

        console.log('\n🔍 Testing container allocation...\n');

        const result = await containerOrchestrator.allocateContainer(user, 'free');

        console.log('\n✅ Result:', result);

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testAllocation();
