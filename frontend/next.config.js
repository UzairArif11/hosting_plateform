/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    // ❌ Remove static export - we need dynamic routes!
    // output: 'export',
    
    // ✅ Keep these optimizations
    images: {
        domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com'],
    },
    
    // Environment variables
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
    }
};

module.exports = nextConfig;
