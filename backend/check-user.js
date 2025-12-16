// Check user details and status
// Run: node check-user.js your-email@gmail.com

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

async function checkUser(email) {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected\n');

        if (!email) {
            console.log('❌ Please provide email');
            console.log('Usage: node check-user.js your-email@gmail.com');
            process.exit(1);
        }

        const user = await User.findOne({ email });

        if (!user) {
            console.log(`❌ User not found: ${email}`);
            console.log('\nAvailable users:');
            const allUsers = await User.find({}, { email: 1 });
            allUsers.forEach(u => console.log(`  - ${u.email}`));
            process.exit(1);
        }

        console.log('═══════════════════════════════════════');
        console.log('👤 USER DETAILS');
        console.log('═══════════════════════════════════════');
        console.log(`Email:           ${user.email}`);
        console.log(`Username:        ${user.username || 'Not set'}`);
        console.log(`Display Name:    ${user.displayName || 'Not set'}`);
        console.log(`Role:            ${user.role}`);
        console.log('');

        console.log('═══════════════════════════════════════');
        console.log('🔑 AUTHENTICATION');
        console.log('═══════════════════════════════════════');
        console.log(`GitHub Token:    ${user.githubAccessToken ? '✅ Has token' : '❌ No token'}`);
        console.log(`Google Token:    ${user.googleAccessToken ? '✅ Has token' : '❌ No token'}`);
        console.log(`Provider:        ${user.provider || 'local'}`);
        console.log('');

        console.log('═══════════════════════════════════════');
        console.log('☁️  ORACLE CLOUD');
        console.log('═══════════════════════════════════════');
        console.log(`Server:          ${user.oracleAccountId || '❌ Not assigned'}`);
        console.log(`Container Type:  ${user.containerType || '❌ Not assigned'}`);
        console.log('');

        console.log('═══════════════════════════════════════');
        console.log('📊 RESOURCE ALLOCATION');
        console.log('═══════════════════════════════════════');
        console.log(`CPU:             ${user.resourceAllocation?.cpu || 0} OCPU`);
        console.log(`RAM:             ${user.resourceAllocation?.ram || 0} GB`);
        console.log(`Storage:         ${user.resourceAllocation?.storage || 0} GB`);
        console.log(`Bandwidth:       ${user.resourceAllocation?.bandwidth || 0} GB/month`);
        console.log(`Projects:        ${user.resourceAllocation?.projects || 0} max`);
        console.log(`Deployments:     ${user.resourceAllocation?.deployments || 0}/month`);
        console.log('');

        console.log('═══════════════════════════════════════');
        console.log('📈 CURRENT USAGE');
        console.log('═══════════════════════════════════════');
        console.log(`Projects:        ${user.currentUsage?.projects || 0} / ${user.resourceAllocation?.projects || 0}`);
        console.log(`Deployments:     ${user.currentUsage?.deployments || 0} / ${user.resourceAllocation?.deployments || 0}`);
        console.log(`Storage:         ${user.currentUsage?.storage || 0} GB / ${user.resourceAllocation?.storage || 0} GB`);
        console.log(`Bandwidth:       ${user.currentUsage?.bandwidth || 0} GB / ${user.resourceAllocation?.bandwidth || 0} GB`);
        console.log('');

        console.log('═══════════════════════════════════════');
        console.log('✅ STATUS CHECK');
        console.log('═══════════════════════════════════════');

        const issues = [];

        if (!user.githubAccessToken && !user.googleAccessToken) {
            issues.push('❌ No OAuth token (user needs to login)');
        }

        if (!user.oracleAccountId) {
            issues.push('❌ No Oracle server assigned');
        }

        if (!user.containerType) {
            issues.push('❌ No container type assigned');
        }

        if (!user.resourceAllocation?.projects) {
            issues.push('❌ No project capacity');
        }

        if (!user.resourceAllocation?.deployments) {
            issues.push('❌ No deployment capacity');
        }

        if (issues.length === 0) {
            console.log('✅ User is fully configured!');
            console.log('✅ Can create projects');
            console.log('✅ Can deploy applications');
        } else {
            console.log('⚠️  Issues found:');
            issues.forEach(issue => console.log(`   ${issue}`));
            console.log('');
            console.log('💡 Fix: Run cleanup-users.js or delete and re-register');
        }

        console.log('═══════════════════════════════════════\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Get email from command line argument
checkUser(process.argv[2]);
