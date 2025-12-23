// Complete Database Cleanup Script
require('dotenv').config();
const mongoose = require('mongoose');

const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vercel_clone';

async function clearDatabase() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(DB_URI);
        console.log('✅ Connected to MongoDB\n');

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        console.log(`📊 Found ${collections.length} collections\n`);

        for (const collection of collections) {
            const collectionName = collection.name;
            console.log(`🗑️  Clearing collection: ${collectionName}`);

            const count = await db.collection(collectionName).countDocuments();
            console.log(`   Documents before: ${count}`);

            await db.collection(collectionName).deleteMany({});

            const afterCount = await db.collection(collectionName).countDocuments();
            console.log(`   Documents after: ${afterCount}`);
            console.log(`   ✅ Cleared ${count} documents\n`);
        }

        console.log('✅ Database cleanup complete!');
        console.log('📝 Summary:');
        console.log(`   - Collections cleared: ${collections.length}`);
        console.log(`   - All data removed`);
        console.log('   - Database structure intact\n');

        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

console.log('⚠️  WARNING: This will DELETE ALL DATA from the database!');
console.log('Database:', DB_URI);
console.log('\nStarting cleanup in 3 seconds...');
console.log('Press Ctrl+C to cancel\n');

setTimeout(() => {
    clearDatabase();
}, 3000);
