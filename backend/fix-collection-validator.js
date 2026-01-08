// Fix the collection-level validator to match the Mongoose schema
const mongoose = require('mongoose');
require('dotenv').config();

async function fixValidator() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin');
    console.log('✅ Connected\n');

    const db = mongoose.connection.db;
    
    console.log('Fixing collection validator...');
    // Update validator to match actual schema:
    // - email: required string ✓
    // - createdAt: required date ✓ (Mongoose adds this automatically)
    // - planType: enum ["free", "pro", "enterprise"] ✓ (this is what should be validated)
    // - plan: ObjectId or null (not enum!)
    await db.command({
      collMod: 'users',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['email', 'createdAt'],
          properties: {
            email: {
              bsonType: 'string',
              description: 'must be a string and is required'
            },
            createdAt: {
              bsonType: 'date',
              description: 'Account creation date (required)'
            },
            planType: {
              enum: ['free', 'pro', 'enterprise'],
              description: 'User subscription plan type'
            },
            plan: {
              bsonType: ['objectId', 'null'],
              description: 'Reference to Plan document (can be null for free users)'
            },
            username: {
              bsonType: 'string',
              description: 'Username'
            },
            displayName: {
              bsonType: 'string',
              description: 'User display name'
            },
            githubId: {
              bsonType: ['string', 'null'],
              description: 'GitHub user ID'
            },
            googleId: {
              bsonType: ['string', 'null'],
              description: 'Google user ID'
            },
            avatar: {
              bsonType: 'string',
              description: 'User avatar URL'
            },
            status: {
              enum: ['active', 'suspended', 'banned', 'trial'],
              description: 'User account status'
            }
          }
        }
      }
    });
    
    console.log('✅ Collection validator fixed successfully!');
    
    // Verify it's updated
    const collections = await db.listCollections({ name: 'users' }).toArray();
    const options = await db.collection('users').options();
    
    if (options.validator && options.validator.$jsonSchema) {
      console.log('\n📋 Updated Validator:');
      console.log('  Required fields:', options.validator.$jsonSchema.required);
      if (options.validator.$jsonSchema.properties.planType) {
        console.log('  planType enum:', options.validator.$jsonSchema.properties.planType.enum);
      }
      if (options.validator.$jsonSchema.properties.plan) {
        console.log('  plan type:', options.validator.$jsonSchema.properties.plan.bsonType);
      }
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Done - Validator now matches Mongoose schema!');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixValidator();

