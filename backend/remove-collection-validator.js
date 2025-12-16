// Remove MongoDB collection validator
// Run: node remove-collection-validator.js

const mongoose = require('mongoose');
require('dotenv').config();

async function removeValidator() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vercel_clone');
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;

        console.log('🔧 Removing validator from projects collection...');

        await db.command({
            collMod: 'projects',
            validator: {},
            validationLevel: 'off'
        });

        console.log('✅ Validator removed successfully!');
        console.log('\n💡 Now try creating a project again!');

        process.exit(0);
    } catch (error) {
        console.log('❌ Error:', error.message);
        console.log(error);
        process.exit(1);
    }
}

removeValidator();
