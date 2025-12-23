const mongoose = require('mongoose');
require('dotenv').config();

const projectSchema = new mongoose.Schema({
    name: String,
    deploymentUrl: String,
    latestDeployment: { type: mongoose.Schema.Types.ObjectId, ref: 'Deployment' },
}, { strict: false });

const Project = mongoose.model('Project', projectSchema);
const Deployment = require('./models/Deployment'); // Use actual model to be safe

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    // Find the project mentioned in the logs (user showed "tt-69495930...")
    // We'll just list all projects with their URLs
    const projects = await Project.find({}).sort({ updatedAt: -1 }).limit(5);

    for (const p of projects) {
        console.log('------------------------------------------------');
        console.log(`Project: ${p.name} (_id: ${p._id})`);
        console.log(`Deployment URL (on Project):`, p.deploymentUrl);
        console.log(`Latest Deployment ID:`, p.latestDeployment);

        if (p.latestDeployment) {
            const d = await mongoose.model('Deployment').findById(p.latestDeployment);
            console.log(`Latest Deployment URL (on Deployment):`, d ? d.url : 'Not Found');
            console.log(`Latest Deployment Status:`, d ? d.status : 'N/A');
        }
    }

    process.exit();
}

check();
