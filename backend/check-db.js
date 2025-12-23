// Quick Database Check Script
const mongoose = require('mongoose');
const Project = require('./models/Project');
const User = require('./models/User');

const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vercel_clone';

async function checkDatabase() {
    try {
        await mongoose.connect(DB_URI);
        console.log('✅ Connected to MongoDB');

        // Count projects
        const projectCount = await Project.countDocuments();
        console.log(`📊 Total Projects in DB: ${projectCount}`);

        // List all projects
        const projects = await Project.find().populate('owner', 'username email');
        console.log('\n📁 Projects:');
        projects.forEach((p, i) => {
            console.log(`${i + 1}. ${p.name} (Owner: ${p.owner?.username || p.owner?.email || 'Unknown'})`);
            console.log(`   ID: ${p._id}`);
            console.log(`   Status: ${p.status}`);
            console.log(`   Created: ${p.createdAt}`);
        });

        // Count users
        const userCount = await User.countDocuments();
        console.log(`\n👥 Total Users in DB: ${userCount}`);

        // List users
        const users = await User.find().select('username email githubId');
        console.log('\n👤 Users:');
        users.forEach((u, i) => {
            console.log(`${i + 1}. ${u.username || u.email} (ID: ${u._id})`);
            console.log(`   GitHub ID: ${u.githubId || 'None'}`);
        });

        await mongoose.disconnect();
        console.log('\n✅ Database check complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkDatabase();
