// Fix the collection-level validator for deployments to match the Mongoose schema
const mongoose = require('mongoose');
require('dotenv').config();

async function fixValidator() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin');
    console.log('✅ Connected\n');

    const db = mongoose.connection.db;
    
    console.log('Fixing deployments collection validator...');
    // Fix validator to match Mongoose schema exactly
    // Mongoose schema requires: projectId, userId, status, branch, commitSha, environment, trigger, createdAt
    // Status enum: ['queued', 'building', 'deploying', 'success', 'failed', 'cancelled']
    await db.command({
      collMod: 'deployments',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['projectId', 'userId', 'status', 'branch', 'commitSha', 'environment', 'trigger', 'createdAt'],
          properties: {
            projectId: {
              bsonType: 'objectId',
              description: 'Project ID reference (required)'
            },
            userId: {
              bsonType: 'objectId',
              description: 'User ID reference (required)'
            },
            status: {
              enum: ['queued', 'building', 'deploying', 'success', 'failed', 'cancelled'],
              description: 'Deployment status (required)'
            },
            branch: {
              bsonType: 'string',
              description: 'Git branch name (required)'
            },
            commitSha: {
              bsonType: 'string',
              description: 'Git commit SHA (required)'
            },
            commitMessage: {
              bsonType: 'string',
              description: 'Git commit message'
            },
            environment: {
              enum: ['production', 'preview'],
              description: 'Deployment environment (required)'
            },
            trigger: {
              enum: ['manual', 'webhook', 'retry', 'rollback'],
              description: 'Deployment trigger type (required)'
            },
            createdAt: {
              bsonType: 'date',
              description: 'Deployment creation date (required, added by Mongoose timestamps)'
            },
            deploymentUrl: {
              bsonType: 'string',
              description: 'Deployment URL'
            },
            containerId: {
              bsonType: 'string',
              description: 'Container ID'
            },
            containerName: {
              bsonType: 'string',
              description: 'Container name'
            },
            port: {
              bsonType: 'number',
              description: 'Container port'
            },
            serverKey: {
              enum: ['EC2', 'EC3'],
              description: 'Server key'
            },
            isPreview: {
              bsonType: 'bool',
              description: 'Whether this is a preview deployment'
            },
            buildLogs: {
              bsonType: 'array',
              description: 'Build logs array'
            },
            error: {
              bsonType: 'object',
              description: 'Error information'
            },
            duration: {
              bsonType: 'number',
              description: 'Deployment duration in milliseconds'
            }
          }
        }
      }
    });
    
    console.log('✅ Deployments collection validator fixed successfully!');
    
    // Verify it's updated
    const options = await db.collection('deployments').options();
    
    if (options.validator && options.validator.$jsonSchema) {
      console.log('\n📋 Updated Validator:');
      console.log('  Required fields:', options.validator.$jsonSchema.required);
      if (options.validator.$jsonSchema.properties.status) {
        console.log('  Status enum:', options.validator.$jsonSchema.properties.status.enum);
      }
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Done - Deployments validator now matches Mongoose schema!');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixValidator();

