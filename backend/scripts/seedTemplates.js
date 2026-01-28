const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Template = require('../models/Template');
const connectDB = require('../utils/database');

const templates = [
    {
        name: 'Next.js Commerce',
        slug: 'nextjs-commerce',
        displayName: 'Next.js Commerce',
        description: 'An all-in-one starter kit for high-performance e-commerce sites.',
        longDescription: 'The all-in-one starter kit for high-performance e-commerce sites. With a few clicks, Next.js Commerce users can clone, deploy and customize their own store.',
        category: 'ecommerce',
        tags: ['nextjs', 'react', 'ecommerce', 'starter'],
        githubRepo: 'vercel/commerce',
        githubBranch: 'main',
        framework: 'nextjs',
        buildConfig: {
            buildCommand: 'pnpm build',
            outputDirectory: '.next',
            installCommand: 'pnpm install',
            devCommand: 'pnpm dev',
            nodeVersion: '20'
        },
        previewImage: 'https://assets.vercel.com/image/upload/v1662130559/nextjs/commerce/commerce-framework.png',
        isPremium: false,
        popularity: 100
    },
    {
        name: 'Next.js App Router',
        slug: 'nextjs-app-starter',
        displayName: 'Next.js App Starter',
        description: 'Modern Next.js 14 starter with App Router, TypeScript, and Tailwind CSS.',
        longDescription: 'A clean, production-ready Next.js 14 starter template featuring the App Router, TypeScript, Tailwind CSS, and best practices for modern web development.',
        category: 'starter',
        tags: ['nextjs', 'react', 'typescript', 'tailwind'],
        githubRepo: 'vercel/next.js',
        githubBranch: 'canary',
        githubPath: 'examples/blog-starter',
        framework: 'nextjs',
        buildConfig: {
            buildCommand: 'npm run build',
            outputDirectory: '.next',
            installCommand: 'npm install',
            devCommand: 'npm run dev',
            nodeVersion: '20'
        },
        previewImage: 'https://assets.vercel.com/image/upload/v1588805858/repositories/vercel/vercel.png',
        isPremium: false
    },
    {
        name: 'Vite + React',
        slug: 'vite-react',
        displayName: 'Vite + React',
        description: 'Lightning-fast React app with Vite bundler.',
        longDescription: 'A blazing fast React development experience powered by Vite. Includes hot module replacement, optimized builds, and modern tooling out of the box.',
        category: 'starter',
        tags: ['react', 'vite', 'typescript', 'starter'],
        githubRepo: 'vitejs/vite',
        githubBranch: 'main',
        githubPath: 'packages/create-vite/template-react-ts',
        framework: 'vite',
        buildConfig: {
            buildCommand: 'npm run build',
            outputDirectory: 'dist',
            installCommand: 'npm install',
            devCommand: 'npm run dev',
            nodeVersion: '20'
        },
        previewImage: 'https://vitejs.dev/logo.svg',
        isPremium: false
    },
    {
        name: 'React App',
        slug: 'create-react-app',
        displayName: 'React App',
        description: 'Classic Create React App starter template.',
        longDescription: 'The official React starter template with zero configuration. Perfect for learning React or building production-ready single-page applications.',
        category: 'starter',
        tags: ['react', 'javascript', 'spa'],
        githubRepo: 'facebook/create-react-app',
        githubBranch: 'main',
        framework: 'react',
        buildConfig: {
            buildCommand: 'npm run build',
            outputDirectory: 'build',
            installCommand: 'npm install',
            devCommand: 'npm start',
            nodeVersion: '18'
        },
        previewImage: 'https://create-react-app.dev/img/logo.svg',
        isPremium: false
    }
];

const seed = async () => {
    try {
        console.log('Connecting to database...');
        // We'll rely on the utils/database if it exports a connect function, 
        // essentially mimicking server.js connection logic.
        // If connectDB is an async function:
        if (typeof connectDB === 'function') {
            await connectDB();
        } else {
            // Fallback if it's just the mongoose connection object or similar
            // Assuming standard connection string from env if utils/database fails or is different structure
            await mongoose.connect(process.env.MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
        }

        console.log('Connected. Clearing existing templates...');
        await Template.deleteMany({});

        console.log('Seeding templates...');
        await Template.insertMany(templates);

        console.log('✅ Templates seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

seed();
