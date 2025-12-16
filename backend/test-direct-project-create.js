// Quick test to create a project directly
// Run: node test-direct-project-create.js

const mongoose = require('mongoose');
const Project = require('./models/Project');
const User = require('./models/User');
require('dotenv').config();

async function testCreateProject() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vercel_clone');
        console.log('✅ Connected to MongoDB');

        // Find a user (use your email)
        const user = await User.findOne({}).sort({ createdAt: -1 });
        if (!user) {
            console.log('❌ No user found! Please login first.');
            process.exit(1);
        }

        console.log('✅ Found user:', user.email);
        console.log('   GitHub token:', user.githubAccessToken ? 'Yes' : 'No');

        // Create a simple project
        const slug = 'test-project-' + Date.now();

        const projectData = {
            name: 'Test Project',
            slug: slug,
            repository: {
                url: 'https://github.com/UzairArif11/Trello-Clone',
                fullName: 'UzairArif11/Trello-Clone',
                branch: 'main',
                provider: 'github',
                isPrivate: false
            },
            owner: user._id,
            framework: 'nextjs',
            buildConfig: {},
            environmentVariables: [],
            domains: [{
                domain: `${slug}.vcp.dev`,
                isCustom: false,
                isPrimary: true,
                verified: true
            }]
        };

        console.log('\n📄 Creating project with data:');
        console.log(JSON.stringify(projectData, null, 2));

        const project = new Project(projectData);

        console.log('\n💾 Saving project...');
        await project.save();

        console.log('✅ Project created successfully!');
        console.log('   Project ID:', project._id);
        console.log('   Project Name:', project.name);
        console.log('   Slug:', project.slug);

        process.exit(0);
    } catch (error) {
        console.log('\n❌ ERROR:');
        console.log('Name:', error.name);
        console.log('Message:', error.message);

        if (error.errors) {
            console.log('\nValidation Errors:');
            Object.keys(error.errors).forEach(key => {
                console.log(`  - ${key}:`, error.errors[key].message);
            });
        }

        if (error.errInfo) {
            console.log('\nError Info:', JSON.stringify(error.errInfo, null, 2));
        }

        console.log('\nFull error:', error);
        process.exit(1);
    }
}

testCreateProject();
