/**
 * Force update all failed template deployments
 * This will update templates to show failed status immediately
 */

const mongoose = require('mongoose');
const Template = require('../models/Template');
const Deployment = require('../models/Deployment');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin';

async function forceUpdateFailedTemplates() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find all templates with demo deployments
        const templatesWithDemo = await Template.find({ 
            demoDeploymentId: { $exists: true, $ne: null }
        });

        console.log(`🔍 Found ${templatesWithDemo.length} templates with demo deployments\n`);

        for (const template of templatesWithDemo) {
            const deployment = await Deployment.findById(template.demoDeploymentId);
            
            if (!deployment) {
                console.log(`⚠️  Template: ${template.displayName}`);
                console.log(`   Missing deployment - resetting status`);
                template.demoStatus = 'none';
                template.demoError = null;
                template.demoDeploymentId = null;
                template.demoProjectId = null;
                await template.save();
                console.log(`   ✅ Reset\n`);
                continue;
            }

            console.log(`📋 Template: ${template.displayName}`);
            console.log(`   Current Status: ${template.demoStatus}`);
            console.log(`   Deployment Status: ${deployment.status}`);

            // If deployment is failed but template is not
            if (deployment.status === 'failed' && template.demoStatus !== 'failed') {
                console.log(`   ⚠️  Mismatch detected - updating template to failed`);
                template.demoStatus = 'failed';
                template.demoError = deployment.error?.message || 'Deployment failed';
                template.demoProgress = 0;
                await template.save();
                console.log(`   ✅ Updated to failed\n`);
            }
            // If deployment is success but template is not
            else if (deployment.status === 'success' && template.demoStatus !== 'success') {
                console.log(`   ⚠️  Mismatch detected - updating template to success`);
                template.demoStatus = 'success';
                template.demoError = null;
                template.demoProgress = 100;
                await template.save();
                console.log(`   ✅ Updated to success\n`);
            }
            // If deployment is not in final state but template is stuck
            else if ((deployment.status === 'queued' || deployment.status === 'building' || deployment.status === 'deploying') 
                     && template.demoStatus === 'deploying') {
                const age = Date.now() - new Date(deployment.createdAt).getTime();
                const ageMinutes = Math.floor(age / 1000 / 60);
                
                if (ageMinutes > 10) {
                    console.log(`   ⚠️  Deployment timed out (${ageMinutes} minutes)`);
                    deployment.status = 'failed';
                    if (!deployment.error) deployment.error = {};
                    deployment.error.message = 'Deployment timed out';
                    await deployment.save();
                    
                    template.demoStatus = 'failed';
                    template.demoError = 'Deployment timed out';
                    template.demoProgress = 0;
                    await template.save();
                    console.log(`   ✅ Marked as failed\n`);
                } else {
                    console.log(`   ℹ️  Still deploying (${ageMinutes} minutes)\n`);
                }
            } else {
                console.log(`   ✅ Status is correct\n`);
            }
        }

        console.log('✅ All templates synchronized with deployment status!');
        console.log('\nRefresh your browser to see the changes.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

if (require.main === module) {
    forceUpdateFailedTemplates().catch(console.error);
}

module.exports = { forceUpdateFailedTemplates };
