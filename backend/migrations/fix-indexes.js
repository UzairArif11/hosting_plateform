const mongoose = require('mongoose');
const logger = require('../utils/logger');

const runMigration = async () => {
    try {
        const Project = require('../models/Project');
        const collection = Project.collection;

        // Check for indexes
        const indexes = await collection.indexes();
        const staleIndexName = 'name_1_userId_1';

        const staleIndexExists = indexes.some(idx => idx.name === staleIndexName);

        if (staleIndexExists) {
            logger.info(`Found stale index '${staleIndexName}'. Dropping it...`);
            await collection.dropIndex(staleIndexName);
            logger.info('✅ Stale index dropped successfully');
        }
    } catch (error) {
        logger.error('Migration error (fix-indexes):', error.message);
    }

    // Remove MongoDB collection-level validators that cache old enum values
    // Without this, MongoDB rejects writes even when Mongoose schema is updated
    try {
        const db = mongoose.connection.db;

        // Remove validator on users collection (status enum was missing 'deleted')
        await db.command({ collMod: 'users', validator: {}, validationLevel: 'off' });
        logger.info('✅ Removed MongoDB validator on users collection');

        // Remove validator on projects collection (status enum was missing 'deleted')
        await db.command({ collMod: 'projects', validator: {}, validationLevel: 'off' });
        logger.info('✅ Removed MongoDB validator on projects collection');
    } catch (error) {
        // Non-fatal — collection may not have a validator
        if (error.codeName !== 'NamespaceNotFound') {
            logger.warn('Migration (remove-validators):', error.message);
        }
    }
};

module.exports = runMigration;

