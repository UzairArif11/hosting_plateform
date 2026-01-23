/**
 * Migration: Fix Project Indexes
 * 
 * Removes old userId index and ensures proper owner-based indexing
 * Fixes: E11000 duplicate key error collection: vercel_clone.projects index: name_1_userId_1
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function fixProjectIndexes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_URL);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const projectsCollection = db.collection('projects');

        // Get all indexes
        const indexes = await projectsCollection.indexes();
        console.log('📋 Current indexes:', indexes.map(idx => idx.name));

        // Drop old userId-based index if it exists
        try {
            await projectsCollection.dropIndex('name_1_userId_1');
            console.log('✅ Dropped old index: name_1_userId_1');
        } catch (err) {
            if (err.code === 27 || err.message.includes('index not found')) {
                console.log('ℹ️  Index name_1_userId_1 does not exist (already removed)');
            } else {
                throw err;
            }
        }

        // Drop any other userId-based indexes
        for (const index of indexes) {
            if (index.name.includes('userId') && index.name !== 'userId_1') {
                try {
                    await projectsCollection.dropIndex(index.name);
                    console.log(`✅ Dropped old index: ${index.name}`);
                } catch (err) {
                    console.warn(`⚠️  Could not drop index ${index.name}:`, err.message);
                }
            }
        }

        // Ensure unique compound index on name and owner (prevents duplicate project names per user)
        try {
            await projectsCollection.createIndex(
                { name: 1, owner: 1 },
                { unique: true, name: 'name_1_owner_1' }
            );
            console.log('✅ Created unique index: name_1_owner_1');
        } catch (err) {
            if (err.code === 85 || err.message.includes('already exists')) {
                console.log('ℹ️  Index name_1_owner_1 already exists');
            } else {
                throw err;
            }
        }

        // Fix any projects with null owner (shouldn't happen, but just in case)
        const nullOwnerProjects = await projectsCollection.countDocuments({ owner: null });
        if (nullOwnerProjects > 0) {
            console.log(`⚠️  Found ${nullOwnerProjects} projects with null owner`);
            console.log('⚠️  These projects need manual fixing - they cannot be automatically assigned');
        }

        // Verify final indexes
        const finalIndexes = await projectsCollection.indexes();
        console.log('\n📋 Final indexes:');
        finalIndexes.forEach(idx => {
            console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });

        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

fixProjectIndexes();
