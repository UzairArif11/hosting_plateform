/**
 * Make User Admin Script
 * 
 * Usage:
 *   node make-admin.js <email>
 *   node make-admin.js user@example.com
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

const log = {
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
    warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`)
};

async function makeAdmin(email) {
    try {
        // Connect to MongoDB using environment variable
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            log.error('MONGODB_URI not found in environment variables');
            log.info('Make sure you have a .env file with MONGODB_URI');
            process.exit(1);
        }

        await mongoose.connect(mongoUri);
        log.success('Connected to MongoDB');

        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            log.error(`User not found: ${email}`);
            log.info('Available users:');
            const users = await User.find().select('email username role').limit(10);
            users.forEach(u => {
                console.log(`  - ${u.email} (${u.username}) - Role: ${u.role}`);
            });
            process.exit(1);
        }

        // Check if already admin
        if (user.role === 'admin') {
            log.warn(`User ${email} is already an admin!`);
            log.info('User details:');
            console.log(`  Email: ${user.email}`);
            console.log(`  Username: ${user.username}`);
            console.log(`  Role: ${user.role}`);
            console.log(`  Status: ${user.status}`);
            process.exit(0);
        }

        // Make admin
        user.role = 'admin';
        await user.save();

        log.success(`User ${email} is now an admin!`);
        log.info('User details:');
        console.log(`  Email: ${user.email}`);
        console.log(`  Username: ${user.username}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Status: ${user.status}`);
        console.log(`  Plan: ${user.plan || 'None'}`);

        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        log.error(`Error: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

// Get email from command line
const email = process.argv[2];

if (!email) {
    log.error('Please provide an email address');
    console.log('\nUsage:');
    console.log('  node make-admin.js <email>');
    console.log('\nExample:');
    console.log('  node make-admin.js user@example.com');
    process.exit(1);
}

makeAdmin(email);
