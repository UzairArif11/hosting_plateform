/**
 * One-time fix: Update Portfolio template's githubRepo from 'nextjs-portfolio'
 * to the correct 'uzairtesta/nextjs-portfolio' (with owner prefix).
 * 
 * Run once on the server:
 *   node backend/scripts/fix-portfolio-repo.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hosting_platform';

async function fixPortfolioRepo() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const Template = require('../models/Template');

        // Fix any template whose githubRepo is missing the username prefix
        const result = await Template.updateMany(
            {
                githubRepo: { $in: ['nextjs-portfolio', 'nextjs-commerce', 'nextjs-blog-smart'] }
            },
            [
                {
                    $set: {
                        githubRepo: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ['$githubRepo', 'nextjs-portfolio'] }, then: 'uzairtesta/nextjs-portfolio' },
                                    { case: { $eq: ['$githubRepo', 'nextjs-commerce'] }, then: 'uzairtesta/nextjs-commerce' },
                                    { case: { $eq: ['$githubRepo', 'nextjs-blog-smart'] }, then: 'uzairtesta/nextjs-blog-smart' },
                                ],
                                default: '$githubRepo'
                            }
                        }
                    }
                }
            ]
        );

        console.log(`✅ Fixed ${result.modifiedCount} template(s)`);

        // Show current state of all templates
        const templates = await Template.find({}, 'name slug githubRepo').lean();
        console.log('\nCurrent template repos:');
        templates.forEach(t => {
            console.log(`  ${t.slug}: githubRepo = "${t.githubRepo}"`);
        });

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await mongoose.disconnect();
        console.log('\nDone.');
    }
}

fixPortfolioRepo();
