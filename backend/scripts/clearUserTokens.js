require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin';

async function clearTokens() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected');

        // Remove githubAccessToken from ALL users
        // This forces the system to use the GITHUB_API_TOKEN from .env
        const result = await User.updateMany(
            { githubAccessToken: { $exists: true } },
            { $unset: { githubAccessToken: "" } }
        );

        console.log('-----------------------------------');
        console.log(`✅ Cleared GitHub tokens from ${result.modifiedCount} users`);
        console.log('-----------------------------------');
        console.log('Now deployments will use GITHUB_API_TOKEN from .env');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected');
        process.exit(0);
    }
}

clearTokens();
