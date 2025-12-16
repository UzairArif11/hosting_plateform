// Check MongoDB collection validators
// Run: node check-collection-validators.js

const mongoose = require('mongoose');
require('dotenv').config();

async function checkValidators() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vercel_clone');
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;

        // Get collection info
        const collections = await db.listCollections({ name: 'projects' }).toArray();

        if (collections.length === 0) {
            console.log('❌ Projects collection does not exist');
            process.exit(1);
        }

        console.log('\n📋 Projects Collection Info:');
        console.log(JSON.stringify(collections[0], null, 2));

        // Check if there's a validator
        if (collections[0].options && collections[0].options.validator) {
            console.log('\n⚠️  FOUND VALIDATOR!');
            console.log(JSON.stringify(collections[0].options.validator, null, 2));

            console.log('\n💡 To remove the validator, run:');
            console.log('db.projects.collMod("projects", { validator: {} })');
        } else {
            console.log('\n✅ No validator found on collection');
        }

        process.exit(0);
    } catch (error) {
        console.log('❌ Error:', error.message);
        process.exit(1);
    }
}

checkValidators();
