// Remove validators from all collections
// Run: node remove-all-validators.js

const mongoose = require('mongoose');
require('dotenv').config();

async function removeAllValidators() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vercel_clone');
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;

        const collections = ['projects', 'deployments', 'users'];

        for (const collectionName of collections) {
            try {
                console.log(`\n🔧 Removing validator from ${collectionName}...`);

                await db.command({
                    collMod: collectionName,
                    validator: {},
                    validationLevel: 'off'
                });

                console.log(`✅ Validator removed from ${collectionName}`);
            } catch (error) {
                if (error.codeName === 'NamespaceNotFound') {
                    console.log(`⚠️  Collection ${collectionName} does not exist yet`);
                } else {
                    console.log(`❌ Error with ${collectionName}:`, error.message);
                }
            }
        }

        console.log('\n✅ All validators removed!');
        console.log('\n💡 Now try creating a deployment!');

        process.exit(0);
    } catch (error) {
        console.log('❌ Error:', error.message);
        process.exit(1);
    }
}

removeAllValidators();
