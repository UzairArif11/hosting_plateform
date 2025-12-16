// Clean up user container assignment
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function cleanupUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const user = await User.findOne({}).sort({ createdAt: -1 });
        console.log('👤 User:', user.email);
        console.log('Current assignment:', {
            server: user.assignedServer,
            container: user.containerName,
            port: user.assignedPort
        });

        // Clear container assignment
        await User.findByIdAndUpdate(user._id, {
            $unset: {
                assignedServer: 1,
                containerName: 1,
                assignedPort: 1
            }
        });

        console.log('\n✅ User container assignment cleared!');
        console.log('User can now get a fresh container allocation.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

cleanupUser();
