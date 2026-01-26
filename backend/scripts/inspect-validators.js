const mongoose = require('mongoose');

// Use provided URI
const MONGODB_URI = 'mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin';

const inspect = async () => {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('✅ Connected.');

        const db = mongoose.connection.db;

        console.log('\n--- Checking Deployments Collection Info ---');
        const collections = await db.listCollections({ name: 'deployments' }).toArray();

        if (collections.length === 0) {
            console.log('❌ Deployments collection not found');
            return;
        }

        const colInfo = collections[0];
        console.log('Validator:', JSON.stringify(colInfo.options?.validator, null, 2));
        console.log('Validation Level:', colInfo.options?.validationLevel);
        console.log('Validation Action:', colInfo.options?.validationAction);

    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDone.');
    }
};

inspect();
