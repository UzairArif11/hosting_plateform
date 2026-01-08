// Check MongoDB collection validators for User collection
const mongoose = require('mongoose');
require('dotenv').config();

async function checkValidators() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    const usersCollection = collections.find(c => c.name === 'users');
    if (usersCollection) {
      const collectionInfo = await db.command({ listCollections: 1, filter: { name: 'users' } });
      console.log('User Collection Info:', JSON.stringify(collectionInfo, null, 2));
      
      // Get collection options
      const options = await db.collection('users').options();
      console.log('\nCollection Options:', JSON.stringify(options, null, 2));
    }
    
    // Try to get validator
    const validator = await db.command({ collStats: 'users', scale: 1 });
    console.log('\nCollection Stats:', JSON.stringify(validator, null, 2));
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkValidators();

