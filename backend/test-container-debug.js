// Quick test script to debug container deployment without rebuilding
const mongoose = require('mongoose');
const User = require('./models/User');
const Project = require('./models/Project');
const Deployment = require('./models/Deployment');
const containerOrchestrator = require('./services/containerOrchestrator');
const buildExecutor = require('./services/buildExecutor');
require('dotenv').config();

async function testContainerDeployment() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get the user
        const user = await User.findOne({}).sort({ createdAt: -1 });
        console.log('\n📊 User Info:');
        console.log({
            id: user._id,
            email: user.email,
            assignedServer: user.assignedServer,
            containerName: user.containerName,
            assignedPort: user.assignedPort,
            currentPlan: user.currentPlan
        });

        // Test getUserContainer
        console.log('\n🔍 Testing getUserContainer...');
        const containerInfo = await containerOrchestrator.getUserContainer(user._id);
        console.log('Container Info:', containerInfo);

        if (!containerInfo) {
            console.log('\n⚠️  No container found. Testing allocateContainer...');

            try {
                const allocated = await containerOrchestrator.allocateContainer(user, user.currentPlan || 'free');
                console.log('✅ Container allocated:', allocated);

                // Refresh user
                const updatedUser = await User.findById(user._id);
                console.log('\n📊 Updated User Info:');
                console.log({
                    assignedServer: updatedUser.assignedServer,
                    containerName: updatedUser.containerName,
                    assignedPort: updatedUser.assignedPort
                });
            } catch (allocError) {
                console.error('❌ Allocation failed:', allocError.message);
                console.error('Stack:', allocError.stack);
            }
        }

        // Get the project
        const project = await Project.findOne({ userId: user._id }).sort({ createdAt: -1 });
        if (!project) {
            console.log('\n❌ No project found');
            process.exit(1);
        }

        console.log('\n📦 Project:', project.name);

        // Check if we have an existing successful build
        const existingBuild = `\\tmp\\builds\\${project._id}`;
        const fs = require('fs').promises;

        try {
            await fs.access(existingBuild);
            console.log(`✅ Found existing build at: ${existingBuild}`);

            // Use existing build for testing
            console.log('\n🚀 Testing deployment with existing build...');

            // This would deploy the existing build
            // For now, just show what would happen
            console.log('\nTo deploy existing build, you would:');
            console.log('1. Skip clone, install, build steps');
            console.log('2. Go directly to deployToContainer()');
            console.log('3. Use build output from:', existingBuild + '\\build');

        } catch (err) {
            console.log(`⚠️  No existing build found at: ${existingBuild}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

testContainerDeployment();
