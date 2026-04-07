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

    // Environment variables (Next.js automatically exposes NEXT_PUBLIC_* vars)
    // These are just for documentation - set them in .env.local or .env.production
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
        NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
    },
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://localhost:5000/api/:path*',
            },
            {
                source: '/uploads/:path*',
                destination: 'http://localhost:5000/uploads/:path*',
            },
        ];
    },
    // Allow Server Actions from specific origins (fix for "Missing origin header" behind proxy)
    experimental: {
        serverActions: {
            allowedOrigins: ['foodpanda.site', 'www.foodpanda.site', 'localhost:3000'],
        },
    },
};

module.exports = nextConfig;
