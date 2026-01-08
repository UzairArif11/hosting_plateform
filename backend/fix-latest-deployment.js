#!/usr/bin/env node

const mongoose = require('mongoose');
require('dotenv').config();

const DeploymentSchema = new mongoose.Schema({}, { strict: false, collection: 'deployments' });
const Deployment = mongoose.model('Deployment', DeploymentSchema);

async function fixDeployment() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find the latest deployment
        const deployment = await Deployment.findOne({
            _id: '695fa95925afd5fb1a99e47c'
        });

        if (!deployment) {
            console.log('❌ Deployment not found!');
            process.exit(1);
        }

        console.log('📋 Current Deployment State:');
        console.log(`   ID: ${deployment._id}`);
        console.log(`   Status: ${deployment.status}`);
        console.log(`   URL: ${deployment.deploymentUrl}`);
        console.log('');

        // Fix the deployment
        const correctUrl = 'https://foodpanda.site/fdf-695fa959-76989616/';
        const updates = {};
        let needsUpdate = false;

        if (deployment.status !== 'success') {
            console.log('⚠️  Status is not "success", fixing...');
            updates.status = 'success';
            needsUpdate = true;
        }

        if (deployment.deploymentUrl !== correctUrl) {
            console.log('⚠️  URL is incorrect, fixing...');
            updates.deploymentUrl = correctUrl;
            needsUpdate = true;
        }

        if (!deployment.completedAt) {
            console.log('⚠️  Missing completedAt, adding...');
            updates.completedAt = new Date();
            needsUpdate = true;
        }

        if (needsUpdate) {
            await Deployment.updateOne(
                { _id: deployment._id },
                { $set: updates }
            );

            console.log('\n✅ Deployment Updated:');
            console.log(`   Status: success`);
            console.log(`   URL: ${correctUrl}`);
            console.log(`   CompletedAt: ${updates.completedAt || deployment.completedAt}`);

            console.log('\n📋 NEXT STEPS:');
            console.log('   1. Refresh the deployments page in the UI');
            console.log('   2. The status should now show "Success"');
            console.log('   3. Click "Visit Deployment" button');
            console.log(`   4. URL will be: ${correctUrl}`);
            console.log('');
        } else {
            console.log('✅ Deployment is already correct!');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixDeployment();
