import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This middleware runs on EVERY request
export function middleware(request: NextRequest) {
    // Get the basePath from env (available at runtime)
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

    // If no basePath, do nothing
    if (!basePath) {
        return NextResponse.next();
    }

    const { pathname, search } = request.nextUrl;

    // If pathname doesn't start with basePath, redirect
    if (!pathname.startsWith(basePath)) {
        const newUrl = request.nextUrl.clone();
        newUrl.pathname = `${basePath}${pathname}`;
        return NextResponse.redirect(newUrl);
    }

    return NextResponse.next();
}

// Run middleware on all routes
export const config = {
    matcher: '/:path*',
};
