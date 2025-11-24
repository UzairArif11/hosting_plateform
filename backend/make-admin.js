require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function makeUserAdmin() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get the email from command line argument
        const email = process.argv[2];

        if (!email) {
            console.log('❌ Please provide an email address');
            console.log('Usage: node make-admin.js your-email@gmail.com');
            process.exit(1);
        }

        // Find user by email
        const user = await User.findOne({ email: email });

        if (!user) {
            console.log(`❌ User not found with email: ${email}`);
            console.log('\nAvailable users:');
            const allUsers = await User.find({}, 'email displayName role');
            allUsers.forEach(u => {
                console.log(`  - ${u.email} (${u.displayName}) - Role: ${u.role}`);
            });
            process.exit(1);
        }

        // Update user role to admin
        user.role = 'admin';
        await user.save();

        console.log('✅ User updated successfully!');
        console.log(`\nUser Details:`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Name: ${user.displayName}`);
        console.log(`  Role: ${user.role}`);
        console.log(`\nYou can now access the admin panel at:`);
        console.log(`  http://localhost:3000/admin`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

makeUserAdmin();
