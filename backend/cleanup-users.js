// Clean up old users and reassign containers
// Run: node cleanup-users.js

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const { assignUserToServer } = require('./services/containerOrchestrator');

async function cleanupAndReassign() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get all users
        const users = await User.find({});
        console.log(`📊 Found ${users.length} users\n`);

        for (const user of users) {
            console.log(`\n👤 User: ${user.email}`);
            console.log(`   Current server: ${user.oracleAccountId || 'None'}`);
            console.log(`   Container type: ${user.containerType || 'None'}`);

            // Check if user has container assignment
            if (!user.oracleAccountId || !user.containerType) {
                console.log('   ⚠️  No container assigned, assigning now...');

                // Assign user to server
                const result = await assignUserToServer(user._id, 'free-trial');

                if (result.success) {
                    console.log(`   ✅ Assigned to ${result.serverId} (${result.containerType})`);
                } else {
                    console.log(`   ❌ Failed: ${result.error}`);
                }
            } else {
                console.log('   ✅ Already has container');
            }
        }

        console.log('\n\n📊 Final Summary:');
        console.log('─────────────────────────────────────');

        const updatedUsers = await User.find({});
        let ec2Count = 0;
        let ec3Count = 0;
        let noContainer = 0;

        for (const user of updatedUsers) {
            if (user.oracleAccountId === 'EC2') ec2Count++;
            else if (user.oracleAccountId === 'EC3') ec3Count++;
            else noContainer++;
        }

        console.log(`Total users: ${updatedUsers.length}`);
        console.log(`EC2 users: ${ec2Count}`);
        console.log(`EC3 users: ${ec3Count}`);
        console.log(`No container: ${noContainer}`);
        console.log('─────────────────────────────────────\n');

        console.log('✅ Cleanup complete!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

cleanupAndReassign();
