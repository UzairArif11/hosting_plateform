require('dotenv').config();
const mongoose = require('mongoose');
const Deployment = require('./models/Deployment');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vercel_clone';

async function unlockDeployments() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to DB');

        const activeDeployments = await Deployment.find({
            status: { $in: ['queued', 'building', 'deploying'] }
        });

        console.log(`Found ${activeDeployments.length} stuck active deployments.`);

        for (const deployment of activeDeployments) {
            console.log(`⚠️  Resetting stuck deployment: ${deployment._id} (Status: ${deployment.status})`);
            deployment.status = 'failed';
            deployment.error = {
                message: 'Deployment failed due to server restart/crash',
                phase: 'deploy'
            };
            await deployment.save();
        }

        console.log('✅ All stuck deployments have been reset to failed.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

unlockDeployments();
