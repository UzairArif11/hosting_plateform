// Remove the collection-level validator that's causing issues
const mongoose = require('mongoose');
require('dotenv').config();

async function removeValidator() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin');
    console.log('✅ Connected\n');

    const db = mongoose.connection.db;
    
    console.log('Removing collection validator...');
    await db.command({
      collMod: 'users',
      validator: {} // Empty validator removes it
    });
    
    console.log('✅ Collection validator removed successfully!');
    
    // Verify it's removed
    const collections = await db.listCollections({ name: 'users' }).toArray();
    const collectionInfo = collections[0];
    const options = await db.collection('users').options();
    
    if (options.validator && Object.keys(options.validator).length > 0) {
      console.log('⚠️  Validator still exists:', JSON.stringify(options.validator, null, 2));
    } else {
      console.log('✅ Verified: No collection validator found');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

removeValidator();
