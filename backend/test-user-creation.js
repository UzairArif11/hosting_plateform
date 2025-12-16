require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function testUserCreation() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Try to create a user with Google OAuth data
        const testUser = {
            googleId: 'test-google-id-123',
            email: 'test@gmail.com',
            displayName: 'Test User',
            username: 'testuser',
            avatar: 'https://example.com/avatar.jpg',
        };

        console.log('Attempting to create user with data:', testUser);

        const user = await User.create(testUser);
        console.log('✅ User created successfully:', user._id);

        // Clean up
        await User.deleteOne({ _id: user._id });
        console.log('Test user deleted');

    } catch (error) {
        console.error('❌ Error creating user:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        if (error.errors) {
            console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
        }
    } finally {
        await mongoose.connection.close();
    }
}

testUserCreation();
