require('dotenv').config();
const mongoose = require('mongoose');
const Project = require('./models/Project');
const Deployment = require('./models/Deployment');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vercel_clone';

async function fixProjectStats() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected');

        const projects = await Project.find();
        console.log(`📊 Found ${projects.length} projects to fix`);

        for (const project of projects) {
            console.log(`\n🔧 Fixing project: ${project.name} (${project._id})`);

            // 1. Count total deployments
            const totalDeployments = await Deployment.countDocuments({ projectId: project._id });

            // 2. Count successful/failed
            const successfulDeployments = await Deployment.countDocuments({ projectId: project._id, status: 'success' });
            const failedDeployments = await Deployment.countDocuments({ projectId: project._id, status: 'failed' });

            // 3. Find latest successful deployment
            const latestDeployment = await Deployment.findOne({ projectId: project._id, status: 'success' })
                .sort({ createdAt: -1 });

            // 4. Update Project
            project.deploymentCount = totalDeployments;
            project.stats = {
                totalDeployments,
                successfulDeployments,
                failedDeployments,
                totalBuilds: totalDeployments // Assuming 1 build per deployment roughly
            };

            if (latestDeployment) {
                project.latestDeployment = latestDeployment._id;
                console.log(`   ✅ Set latestDeployment: ${latestDeployment._id}`);
            } else {
                console.log(`   ℹ️ No successful deployments found`);
            }

            await project.save();
            console.log(`   ✅ Updated stats: ${totalDeployments} total, ${successfulDeployments} success`);
        }

        console.log('\n✅ All projects fixed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixProjectStats();
