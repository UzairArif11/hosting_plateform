require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Template = require('../models/Template');
const connectDB = require('../utils/database');

const templates = [
    {
        name: 'Next.js Commerce',
        slug: 'nextjs-commerce', // Matches the folder/ID usually
        displayName: 'Next.js Commerce',
        description: 'An all-in-one starter kit for high-performance e-commerce sites.',
        longDescription: 'The all-in-one starter kit for high-performance e-commerce sites. With a few clicks, Next.js Commerce users can clone, deploy and customize their own store.',
        category: 'ecommerce',
        tags: ['nextjs', 'react', 'ecommerce', 'starter'],
        githubRepo: 'vercel/commerce', // Using real repo for demo purposes
        githubBranch: 'main',
        framework: 'nextjs',
        buildConfig: {
            buildCommand: 'next build',
            outputDirectory: '.next',
            installCommand: 'npm install',
            devCommand: 'next dev'
        },
        previewImage: 'https://assets.vercel.com/image/upload/v1662130559/nextjs/commerce/commerce-framework.png',
        previewUrl: 'https://demo.vercel.store',
        isPremium: false,
        popularity: 100
    },
    {
        name: 'Next.js Blog Starter',
        slug: 'nextjs-blog',
        displayName: 'Next.js Blog',
        description: 'A dedicated blog starter with markdown support.',
        category: 'blog',
        tags: ['nextjs', 'blog', 'markdown'],
        githubRepo: 'vercel/next.js', // We'd point to specific example folder usually, but for clone logic we need a root repo.
        // For this demo, let's use a cleaner specific repo if possible, or just the main one.
        // Let's use a specific starter repo
        githubRepo: 'vercel/next-learn', // Just as placeholder
        githubBranch: 'main',
        framework: 'nextjs',
        buildConfig: {
            buildCommand: 'npm run build',
            outputDirectory: '.next',
            installCommand: 'npm install',
            devCommand: 'npm run dev'
        },
        previewImage: 'https://assets.vercel.com/image/upload/v1588805858/repositories/next-learn/next-learn.png',
        isPremium: false
    },
    {
        name: 'Vue.js Starter',
        slug: 'vue-starter',
        displayName: 'Vue.js App',
        description: 'A simple Vue 3 starter project with Vite.',
        category: 'starting',
        tags: ['vue', 'vite', 'starter'],
        githubRepo: 'vuejs/create-vue', // Placeholder
        githubBranch: 'main',
        framework: 'vue',
        buildConfig: {
            buildCommand: 'npm run build',
            outputDirectory: 'dist',
            installCommand: 'npm install',
            devCommand: 'npm run dev'
        },
        previewImage: 'https://vuejs.org/images/logo.png', // Placeholder
        isPremium: false
    },
    {
        name: 'React Dashboard',
        slug: 'react-dashboard',
        displayName: 'Admin Dashboard',
        description: 'A comprehensive React admin dashboard template.',
        category: 'dashboard',
        tags: ['react', 'dashboard', 'admin'],
        githubRepo: 'facebook/create-react-app', // Placeholder
        githubBranch: 'main',
        framework: 'react',
        previewImage: 'https://reactjs.org/logo-og.png',
        isPremium: true // Testing premium flag
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
