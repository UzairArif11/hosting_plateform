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
        } else {
            // logger.info('No stale index found');
        }
    } catch (error) {
        logger.error('Migration error (fix-indexes):', error.message);
    }
};

module.exports = runMigration;
