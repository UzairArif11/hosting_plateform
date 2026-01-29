const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Template = require('../models/Template');
const connectDB = require('../utils/database');

// ============================================
// PRODUCTION TEMPLATES - REAL & VERIFIED
// Only templates with working GitHub repos
// ============================================

const templates = [
    {
        name: 'Smart Commerce',
        slug: 'nextjs-commerce-smart',
        displayName: 'Smart Commerce Pro',
        description: 'Dynamic e-commerce template with Lite/Pro mode support',
        longDescription: 'A complete Next.js 14 e-commerce starter that automatically adapts between Lite Mode (local SQLite) and Pro Mode (external database) based on environment variables. Perfect for free users who want to start small and scale to production.',
        category: 'ecommerce',
        tags: ['nextjs', 'react', 'ecommerce', 'smart-template', 'typescript', 'prisma'],
        githubRepo: 'uzairtesta/nextjs-commerce-smart',
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
        environmentVariables: [
            {
                key: 'DATABASE_URL',
                description: 'PostgreSQL/MySQL connection string for Pro Mode (leave empty for Lite Mode)',
                defaultValue: '',
                isRequired: false,
                isSecret: true
            }
        ],
        previewImage: 'https://images.unsplash.com/photo-1557821552-17105176677c?w=800',
        isPremium: false,
        minPlan: 'free',
        popularity: 150
    },
    {
        name: 'Smart Portfolio',
        slug: 'nextjs-portfolio-smart',
        displayName: 'Smart Developer Portfolio',
        description: 'Beautiful portfolio with Lite/Pro mode support for developers and creatives',
        longDescription: 'A stunning portfolio template featuring smooth animations, dark mode, project showcase, blog section, and contact form. Automatically adapts between Lite Mode (local SQLite) and Pro Mode (external database) based on environment variables.',
        category: 'portfolio',
        tags: ['nextjs', 'portfolio', 'smart-template', 'typescript', 'framer-motion', 'prisma'],
        githubRepo: 'uzairtesta/nextjs-portfolio-smart',
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
        environmentVariables: [
            {
                key: 'DATABASE_URL',
                description: 'PostgreSQL/MySQL connection string for Pro Mode (leave empty for Lite Mode)',
                defaultValue: '',
                isRequired: false,
                isSecret: true
            }
        ],
        previewImage: 'https://images.unsplash.com/photo-1467232004584-a241de8bcaf8?w=800',
        isPremium: false,
        minPlan: 'free',
        popularity: 145
    },
    {
        name: 'Smart Portfolio',
        slug: 'nextjs-portfolio-smart',
        displayName: 'Smart Portfolio Pro',
        description: 'Stunning portfolio with Lite/Pro mode support, glassmorphism design, and smooth animations',
        longDescription: 'A production-ready Next.js 14 portfolio template that automatically adapts between Lite Mode (local SQLite) and Pro Mode (external database). Features stunning glassmorphism design, Framer Motion animations, project showcase, blog system, and contact form. Perfect for developers and creatives who want a beautiful portfolio that scales.',
        category: 'portfolio',
        tags: ['nextjs', 'portfolio', 'smart-template', 'typescript', 'prisma', 'tailwind', 'framer-motion'],
        githubRepo: 'uzairtesta/nextjs-portfolio-smart',
        githubBranch: 'main',
        framework: 'nextjs',
        supportedModes: ['lite', 'pro'],
        buildConfig: {
            buildCommand: 'npm run build',
            outputDirectory: '.next',
            installCommand: 'npm install',
            devCommand: 'npm run dev',
            nodeVersion: '20'
        },
        environmentVariables: [
            {
                key: 'DATABASE_URL',
                description: 'PostgreSQL/MySQL connection string for Pro Mode (leave empty for Lite Mode with SQLite)',
                defaultValue: '',
                isRequired: false,
                isSecret: true
            }
        ],
        previewImage: 'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=800',
        isPremium: false,
        minPlan: 'free',
        popularity: 140
    }
];

const seed = async () => {
    try {
        console.log('Connecting to database...');
        if (typeof connectDB === 'function') {
            await connectDB();
        } else {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        console.log('Connected. Clearing existing templates...');
        await Template.deleteMany({});

        console.log('Seeding templates...');
        for (const template of templates) {
            console.log(`- Inserting: ${template.name}`);
            await Template.create(template);
        }

        console.log('✅ Templates seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error.message);
        if (error.errors) {
            console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
        }
        process.exit(1);
    }
};

seed();
