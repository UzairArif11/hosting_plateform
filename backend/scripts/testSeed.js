const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Template = require('../models/Template');

const testTemplate = {
    name: 'Smart Commerce',
    slug: 'nextjs-commerce-smart',
    displayName: 'Smart Commerce Pro',
    description: ' Dynamic e-commerce template with Lite/Pro mode support',
    longDescription: 'A complete Next.js 14 e-commerce starter that automatically adapts between Lite Mode (local SQLite) and Pro Mode (external database) based on environment variables.',
    category: 'ecommerce',
    tags: ['nextjs', 'react', 'ecommerce'],
    githubRepo: 'UzairArif11/nextjs-commerce-smart',
    githubBranch: 'main',
    framework: 'nextjs',
    supportedModes: ['lite', 'pro'],
    buildConfig: {
        buildCommand: 'npm run build',
        outputDirectory: '.next',
        installCommand: 'npm install',
        devCommand: 'npm run dev',
        nodeVersion: '18'
    },
    previewImage: 'https://images.unsplash.com/photo-1557821552-17105176677c?w=800',
    isPremium: false
};

async function test() {
    try {
        console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Found' : 'Missing');

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const newTemplate = new Template(testTemplate);
        await newTemplate.validate();
        console.log('✅ Validation passed!');

        await newTemplate.save();
        console.log('✅ Template saved!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', JSON.stringify(error, null, 2));
        process.exit(1);
    }
}

test();
