const mongoose = require('mongoose');
require('dotenv').config();

async function dropPlanValidator() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hosting-platform');
        console.log('✅ Connected\n');

        const db = mongoose.connection.db;

        // Drop the old validator by modifying collection
        console.log('🔨 Removing old schema validator from plans collection...');

        try {
            await db.command({
                collMod: 'plans',
                validator: {},
                validationLevel: 'off'
            });
            console.log('✅ Validator removed\n');
        } catch (err) {
            if (err.codeName === 'NamespaceNotFound') {
                console.log('ℹ️  Plans collection doesn\'t exist yet - this is fine\n');
            } else {
                throw err;
            }
        }

        console.log('✅ Migration complete! You can now run the seeder.');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

dropPlanValidator();
