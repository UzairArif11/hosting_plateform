const mongoose = require('mongoose');

// Use provided URI
const MONGODB_URI = 'mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin';

const verify = async () => {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('✅ Connected.');

        const connection = mongoose.connection;
        const db = connection.db;

        // 1. Check Projects Indexes
        console.log('\n--- Checking Project Indexes ---');
        const projectIndexes = await db.collection('projects').indexes();
        let hasStale = false;
        let hasCorrect = false;

        projectIndexes.forEach(idx => {
            console.log(`- Index: ${idx.name} (${JSON.stringify(idx.key)})`);
            if (idx.name === 'name_1_userId_1') hasStale = true;
            if (idx.name === 'name_1_owner_1' || (idx.key.name === 1 && idx.key.owner === 1)) hasCorrect = true;
        });

        if (hasStale) console.error('❌ STALE INDEX 'name_1_userId_1' STILL EXISTS!');
        else console.log('✅ Stale index 'name_1_userId_1' is gone.');

        if (hasCorrect) console.log('✅ Correct index 'name_1_owner_1' exists.');
        else console.warn('⚠️ Correct index name_1_owner_1 NOT found (might be auto-created on restart).');

        // 2. Check Plans
        console.log('\n--- Checking Plans ---');
        const plansCount = await db.collection('plans').countDocuments();
        console.log(`Total Plans: ${plansCount}`);
        if (plansCount > 0) console.log('✅ Plans exist.');
        else console.error('❌ Plans table is empty!');

        const trialPlan = await db.collection('plans').findOne({ isTrial: true });
        if (trialPlan) console.log(`✅ Trial plan found: ${trialPlan.name}`);
        else console.error('❌ No trial plan found.');

        // 3. Check Projects with null userId (if field existed in docs)
        // Note: 'userId' field shouldn't exist in new schema, but might in old docs.
        // We check if any have 'owner' field.
        const sampleProject = await db.collection('projects').findOne({});
        if (sampleProject) {
            if (sampleProject.owner) console.log('✅ Sample project has owner field.');
            else console.warn('⚠️ Sample project missing owner field:', sampleProject._id);
        }

    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDone.');
    }
};

verify();
