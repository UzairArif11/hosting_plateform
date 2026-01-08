// Fix the collection-level validator for projects to match the Mongoose schema
const mongoose = require('mongoose');
require('dotenv').config();

async function fixValidator() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin');
    console.log('✅ Connected\n');

    const db = mongoose.connection.db;
    
    console.log('Fixing projects collection validator...');
    // Remove or fix validator to match Mongoose schema
    // Projects schema requires: name, slug, repository, owner, framework, createdAt
    await db.command({
      collMod: 'projects',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['name', 'slug', 'owner', 'framework', 'createdAt'],
          properties: {
            name: {
              bsonType: 'string',
              description: 'Project name (required)'
            },
            slug: {
              bsonType: 'string',
              description: 'Project slug (required, unique)'
            },
            owner: {
              bsonType: 'objectId',
              description: 'Project owner (required)'
            },
            framework: {
              enum: [
                'nextjs', 'react', 'vue', 'nuxt', 'svelte', 'angular',
                'express', 'fastify', 'nestjs', 'koa',
                'static', 'gatsby', 'hugo', 'jekyll',
                'laravel', 'symfony', 'django', 'flask',
                'custom'
              ],
              description: 'Project framework'
            },
            createdAt: {
              bsonType: 'date',
              description: 'Project creation date (required)'
            },
            repository: {
              bsonType: 'object',
              description: 'Repository information',
              properties: {
                url: { bsonType: 'string' },
                fullName: { bsonType: 'string' },
                branch: { bsonType: 'string' },
                provider: { enum: ['github', 'gitlab'] },
                isPrivate: { bsonType: 'bool' }
              }
            },
            status: {
              enum: ['active', 'inactive', 'suspended'],
              description: 'Project status'
            }
          }
        }
      }
    });
    
    console.log('✅ Projects collection validator fixed successfully!');
    
    // Verify it's updated
    const options = await db.collection('projects').options();
    
    if (options.validator && options.validator.$jsonSchema) {
      console.log('\n📋 Updated Validator:');
      console.log('  Required fields:', options.validator.$jsonSchema.required);
      if (options.validator.$jsonSchema.properties.framework) {
        console.log('  Framework enum:', options.validator.$jsonSchema.properties.framework.enum?.length, 'options');
      }
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Done - Projects validator now matches Mongoose schema!');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixValidator();

