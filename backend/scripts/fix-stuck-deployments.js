/**
 * Fix Stuck Template Deployments
 * Run this to manually mark stuck deployments as failed
 */

const mongoose = require('mongoose');
const Template = require('../models/Template');
const Deployment = require('../models/Deployment');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin';

async function fixStuckDeployments() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find all templates stuck in 'deploying' state
        const stuckTemplates = await Template.find({ demoStatus: 'deploying' });

        console.log(`\n🔍 Found ${stuckTemplates.length} templates stuck in deploying state\n`);

        for (const template of stuckTemplates) {
            console.log(`📋 Template: ${template.displayName || template.name}`);
            console.log(`   ID: ${template._id}`);
            console.log(`   Status: ${template.demoStatus}`);
            console.log(`   Progress: ${template.demoProgress}%`);

            if (template.demoDeploymentId) {
                const deployment = await Deployment.findById(template.demoDeploymentId);
                
                if (deployment) {
                    console.log(`   Deployment: ${deployment._id}`);
                    console.log(`   Deployment Status: ${deployment.status}`);
                    console.log(`   Created: ${deployment.createdAt}`);

                    const age = Date.now() - new Date(deployment.createdAt).getTime();
                    const ageMinutes = Math.floor(age / 1000 / 60);
                    console.log(`   Age: ${ageMinutes} minutes`);

                    // Mark as failed if older than 10 minutes or already failed in DB
                    if (ageMinutes > 10 || deployment.status === 'failed') {
                        console.log(`   ⚠️  Marking as failed...`);
                        
                        // Update deployment
                        deployment.status = 'failed';
                        deployment.error = deployment.error || {
                            message: 'Deployment timed out or failed',
                            phase: 'timeout'
                        };
                        await deployment.save();

                        // Update template
                        template.demoStatus = 'failed';
                        template.demoError = deployment.error.message || 'Deployment failed';
                        template.demoProgress = 0;
                        await template.save();

                        console.log(`   ✅ Marked as failed\n`);
                    } else {
                        console.log(`   ℹ️  Still within timeout window (< 10 minutes)\n`);
                    }
                } else {
                    console.log(`   ⚠️  Deployment record not found!`);
                    console.log(`   🔧 Resetting template status...`);
                    
                    template.demoStatus = 'failed';
                    template.demoError = 'Deployment record not found';
                    template.demoProgress = 0;
                    await template.save();
                    
                    console.log(`   ✅ Template reset\n`);
                }
            } else {
                console.log(`   ⚠️  No deployment ID!`);
                console.log(`   🔧 Resetting template status...`);
                
                template.demoStatus = 'none';
                template.demoError = null;
                template.demoProgress = 0;
                await template.save();
                
                console.log(`   ✅ Template reset\n`);
            }
        }

        console.log('✅ All stuck deployments fixed!');
        console.log('\nRefresh your admin panel to see the changes.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

if (require.main === module) {
    fixStuckDeployments().catch(console.error);
}

module.exports = { fixStuckDeployments };
