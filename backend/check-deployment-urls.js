#!/usr/bin/env node

const mongoose = require('mongoose');
require('dotenv').config();

const DeploymentSchema = new mongoose.Schema({}, { strict: false, collection: 'deployments' });
const Deployment = mongoose.model('Deployment', DeploymentSchema);

async function checkDeployments() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get last 3 deployments for user
        const deployments = await Deployment.find({
            projectId: '695fa49fc3adb33b581bc41e'
        })
            .sort({ createdAt: -1 })
            .limit(3)
            .select('_id status deploymentUrl createdAt');

        console.log('📋 Last 3 Deployments:\n');
        deployments.forEach((d, i) => {
            console.log(`${i + 1}. Deployment ID: ${d._id}`);
            console.log(`   Status: ${d.status}`);
            console.log(`   URL: ${d.deploymentUrl}`);
            console.log(`   Created: ${new Date(d.createdAt).toLocaleString()}`);
            console.log('');
        });

        // Find the latest successful deployment
        const latest = deployments.find(d => d.status === 'success');
        if (latest) {
            console.log('✅ Latest Successful Deployment:');
            console.log(`   ID: ${latest._id}`);
            console.log(`   URL: ${latest.deploymentUrl}`);

            if (latest.deploymentUrl && latest.deploymentUrl.includes('ec3.foodpanda.site')) {
                console.log('\n⚠️  URL contains ec3.foodpanda.site - needs correction!');
                console.log('\nTo fix, run:');
                console.log(`   mongo command to update URL`);
            } else if (latest.deploymentUrl && latest.deploymentUrl.includes('foodpanda.site')) {
                console.log('\n✅ URL is correct!');
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkDeployments();
