/**
 * Setup Admin User for Container Auto-Creation
 * Run locally with port-forwarded MongoDB
 */

const mongoose = require('mongoose');
const User = require('../models/User');

const MONGODB_URI = 'mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin';

async function setupAdminContainer() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB (via port forwarding)\n');

        // Find admin user
        const admin = await User.findOne({ email: 'postman111222@gmail.com' });
        
        if (!admin) {
            console.log('❌ Admin user not found!');
            return;
        }

        console.log('📋 Current Admin Status:');
        console.log('  Email:', admin.email);
        console.log('  ID:', admin._id.toString());
        console.log('  Role:', admin.role);
        console.log('  Current Container:', admin.containerName || 'None');
        console.log('  Assigned Server:', admin.assignedServer || 'None');
        console.log('');

        // Expected container name
        const expectedContainerName = `EC2-admin-${admin._id}`;
        console.log('📦 Expected Container Name:', expectedContainerName);
        console.log('');

        // Update admin to use EC2 and clear container (will auto-create)
        console.log('🔧 Updating admin user...');
        await User.updateOne(
            { _id: admin._id },
            { 
                $set: { 
                    assignedServer: 'EC2',
                    containerName: null // Clear to trigger auto-creation
                }
            }
        );

        // Verify update
        const updatedAdmin = await User.findById(admin._id);
        console.log('✅ Admin user updated!');
        console.log('  Assigned Server:', updatedAdmin.assignedServer);
        console.log('  Container Name:', updatedAdmin.containerName || 'Will auto-create');
        console.log('');
        console.log('🎉 On next deployment, container will auto-create as:', expectedContainerName);
        console.log('');
        console.log('Next steps:');
        console.log('1. Go to: https://foodpanda.site/admin/templates');
        console.log('2. Click "Redeploy" on a template');
        console.log('3. Container will auto-create and deployment will succeed!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

setupAdminContainer().catch(console.error);
