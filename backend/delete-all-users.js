// Delete all users from database
// Run: node delete-all-users.js

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

async function deleteAllUsers() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Count users
        const count = await User.countDocuments();
        console.log(`📊 Found ${count} users\n`);

        if (count === 0) {
            console.log('✅ No users to delete');
            process.exit(0);
        }

        // List users
        const users = await User.find({}, { email: 1, oracleAccountId: 1, containerType: 1 });
        console.log('Users to be deleted:');
        users.forEach(user => {
            console.log(`  - ${user.email} (${user.oracleAccountId || 'no container'})`);
        });
        console.log('');

        // Ask for confirmation
        console.log('⚠️  WARNING: This will delete ALL users!');
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

        await new Promise(resolve => setTimeout(resolve, 5000));

        // Delete all users
        const result = await User.deleteMany({});
        console.log(`✅ Deleted ${result.deletedCount} users\n`);

        console.log('✅ Cleanup complete!');
        console.log('\nNext steps:');
        console.log('1. Go to http://localhost:3000');
        console.log('2. Register new users via GitHub/Google OAuth');
        console.log('3. New users will automatically get containers assigned!');
        console.log('');

        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

deleteAllUsers();
