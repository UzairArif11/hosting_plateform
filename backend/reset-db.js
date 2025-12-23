const mongoose = require('mongoose');
require('dotenv').config();
const Project = require('./models/Project');
const Deployment = require('./models/Deployment');
const User = require('./models/User');

async function reset() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔌 Connected to MongoDB');

    console.log('🗑️  Deleting all Projects...');
    await Project.deleteMany({});

    console.log('🗑️  Deleting all Deployments...');
    await Deployment.deleteMany({});

    console.log('🔄 Resetting User Containers...');
    // We don't delete users, just reset their container assignment so they get a new one
    await User.updateMany({}, {
        $unset: {
            containerName: "",
            assignedServer: "",
            containerId: ""
        }
    });

    console.log('✅ Database Reset Complete');
    process.exit();
}

reset();
