// Check MongoDB collection validators for User collection
const mongoose = require('mongoose');
require('dotenv').config();

async function checkValidators() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin');
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Get collection info
    console.log('Checking User collection validators...\n');
    const collections = await db.listCollections({ name: 'users' }).toArray();
    
    if (collections.length === 0) {
      console.log('❌ Users collection not found');
      await mongoose.disconnect();
      return;
    }
    
    const collectionInfo = collections[0];
    console.log('Collection Info:', JSON.stringify(collectionInfo, null, 2));
    
    // Get collection options
    const options = await db.collection('users').options();
    console.log('\nCollection Options:', JSON.stringify(options, null, 2));
    
    // Check for validators
    if (options.validator) {
      console.log('\n⚠️  COLLECTION-LEVEL VALIDATOR FOUND:');
      console.log(JSON.stringify(options.validator, null, 2));
    } else {
      console.log('\n✅ No collection-level validator found');
    }
    
    // Get collection stats
    const stats = await db.command({ collStats: 'users' });
    console.log('\nCollection Stats:', JSON.stringify(stats, null, 2));
    
    // Try to find a sample user to see structure
    const sampleUser = await db.collection('users').findOne({});
    if (sampleUser) {
      console.log('\n📄 Sample User Structure:');
      console.log('Fields:', Object.keys(sampleUser));
      console.log('\nSample User (first 1000 chars):');
      console.log(JSON.stringify(sampleUser, null, 2).substring(0, 1000));
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkValidators();

