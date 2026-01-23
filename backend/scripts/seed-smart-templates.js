
require('dotenv').config({ path: '../.env' }); // Load .env from backend root
const mongoose = require('mongoose');
const Template = require('../models/Template');

const MONGODB_URI = 'mongodb://admin:password123@localhost:27017/vercel_clone?authSource=admin';

const templates = [
    {
        name: 'ecommerce-smart',
        slug: 'ecommerce-smart',
        displayName: 'Smart E-commerce Store',
        description: 'A blazing fast e-commerce template with Zero-Config Lite Mode (JSON) and Pro Mode (Postgres).',
        category: 'ecommerce',
        framework: 'nextjs',
        githubRepo: 'platform/ecommerce-smart',
        previewImage: 'https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?auto=format&fit=crop&q=80&w=600',
        previewUrl: 'https://demo-ecommerce.vercel.app',
        isPremium: false,
        minPlan: 'free',
        supportedModes: ['lite', 'pro'],
        tags: ['ecommerce', 'smart-adapter', 'nextjs'],
        isPublished: true,
        buildConfig: {
            installCommand: 'npm install',
            buildCommand: 'npm run build',
            outputDirectory: '.next',
            nodeVersion: '18'
        },
        environmentVariables: [
            {
                key: 'DATABASE_URL',
                description: 'Connection string for Pro Mode (Postgres). Leave empty for Lite Mode.',
                isRequired: false,
                isSecret: true
            },
            {
                key: 'NEXT_PUBLIC_STORE_NAME',
                description: 'Name of your store',
                defaultValue: 'My Awesome Store',
                isRequired: false,
                isSecret: false
            }
        ]
    },
    {
        name: 'saas-ultimate',
        slug: 'saas-ultimate',
        displayName: 'Ultimate SaaS Kit',
        description: 'Enterprise-grade SaaS starter with multi-tenancy, billing, and audit logs.',
        category: 'saas',
        framework: 'nextjs',
        githubRepo: 'platform/saas-ultimate',
        previewImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=600',
        isPremium: true,
        minPlan: 'enterprise',
        supportedModes: ['pro'],
        tags: ['saas', 'enterprise', 'multi-tenant'],
        isPublished: true,
        buildConfig: {
            installCommand: 'npm install',
            buildCommand: 'npm run build',
            outputDirectory: '.next'
        }
    }
];

async function seed() {
    try {
        console.log('🔌 Connecting to MongoDB...', MONGODB_URI);
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        for (const t of templates) {
            const result = await Template.findOneAndUpdate(
                { slug: t.slug },
                { $set: t },
                { upsert: true, new: true }
            );
            console.log(`✅ Seeded: ${result.displayName} (MinPlan: ${result.minPlan})`);
        }

        console.log('🏁 Seeding complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    }
}

seed();
