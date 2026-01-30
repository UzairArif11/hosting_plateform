/**
 * Clear all deployments and projects from database
 */
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Load environment
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function clearDeployments() {
    try {
        logger.info('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('✅ Connected to MongoDB');

        const Project = require('../models/Project');
        const Deployment = require('../models/Deployment');

        // Delete all deployments
        const deploymentsDeleted = await Deployment.deleteMany({});
        logger.info(`🗑️  Deleted ${deploymentsDeleted.deletedCount} deployments`);

        // Delete all projects
        const projectsDeleted = await Project.deleteMany({});
        logger.info(`🗑️  Deleted ${projectsDeleted.deletedCount} projects`);

        logger.info('✅ Database cleared successfully');
        process.exit(0);
    } catch (error) {
        logger.error('Error clearing database:', error);
        process.exit(1);
    }
}

clearDeployments();
