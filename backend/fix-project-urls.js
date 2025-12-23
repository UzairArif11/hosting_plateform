const mongoose = require('mongoose');
require('dotenv').config();

// Define minimal schemas to avoid import issues
const projectSchema = new mongoose.Schema({
    deploymentUrl: String, // Ensure this exists in your Project model now
    latestDeployment: { type: mongoose.Schema.Types.ObjectId, ref: 'Deployment' },
    status: String
}, { strict: false }); // strict false to allow other fields

const deploymentSchema = new mongoose.Schema({
    deploymentUrl: String,
    status: String
}, { strict: false });

const Project = mongoose.model('Project', projectSchema);
const Deployment = mongoose.model('Deployment', deploymentSchema);

async function fixProjectUrls() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const projects = await Project.find({});
        console.log(`Found ${projects.length} projects to check.`);

        let updatedCount = 0;

        for (const project of projects) {
            if (!project.latestDeployment) {
                console.log(`Skipping project ${project._id} (no latest deployment)`);
                continue;
            }

            const deployment = await Deployment.findById(project.latestDeployment);
            if (deployment && deployment.deploymentUrl) {
                console.log(`Project ${project._id}: Found URL ${deployment.deploymentUrl}`);

                // Update the project
                project.deploymentUrl = deployment.deploymentUrl;
                await project.save();
                console.log(`✅ Updated Project ${project._id} with URL`);
                updatedCount++;
            } else {
                console.log(`Project ${project._id}: No URL found in deployment ${project.latestDeployment}`);
            }
        }

        console.log(`\n🎉 Finished! Updated ${updatedCount} projects.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixProjectUrls();
