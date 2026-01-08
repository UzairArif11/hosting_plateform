// Check MongoDB collection validators for Project collection
const mongoose = require('mongoose');
require('dotenv').config();

async function checkValidators() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin');
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Get collection info
    console.log('Checking Project collection validators...\n');
    const collections = await db.listCollections({ name: 'projects' }).toArray();
    
    if (collections.length === 0) {
      console.log('❌ Projects collection not found');
      await mongoose.disconnect();
      return;
    }
    
    const collectionInfo = collections[0];
    console.log('Collection Info:', JSON.stringify(collectionInfo, null, 2));
    
    // Get collection options
    const options = await db.collection('projects').options();
    console.log('\nCollection Options:', JSON.stringify(options, null, 2));
    
    // Check for validators
    if (options.validator) {
      console.log('\n⚠️  COLLECTION-LEVEL VALIDATOR FOUND:');
      console.log(JSON.stringify(options.validator, null, 2));
    } else {
      console.log('\n✅ No collection-level validator found');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkValidators();

