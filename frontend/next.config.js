/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    // ✅ Enable static export - NO server needed!
    output: 'export',
    trailingSlash: true,
    // Disable image optimization for static export
    images: {
        unoptimized: true
    },
    // Environment variables available at build time
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
    }
};

module.exports = nextConfig;
