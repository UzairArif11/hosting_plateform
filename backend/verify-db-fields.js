require('dotenv').config();
const mongoose = require('mongoose');
const Project = require('./models/Project');
const Deployment = require('./models/Deployment');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vercel_clone';

async function verifyProjectData() {
    try {
        await mongoose.connect(MONGODB_URI);
        const projects = await Project.find().populate('latestDeployment');

        console.log('--- PROJECT DATA VERIFICATION ---');
        projects.forEach(p => {
            console.log(`Project: ${p.name}`);
            console.log(`  _id: ${p._id}`);
            console.log(`  deploymentCount: ${p.deploymentCount} (Type: ${typeof p.deploymentCount})`);
            console.log(`  latestDeployment: ${p.latestDeployment ? p.latestDeployment._id : 'null'}`);
            console.log(`  stats:`, p.stats);
        });

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

verifyProjectData();
