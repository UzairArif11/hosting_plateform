'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { getCurrentUser } from '@/lib/slices/authSlice';
import { AppDispatch, RootState } from '@/lib/store';

import NotificationBell from '@/components/NotificationBell';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const dispatch = useDispatch<AppDispatch>();
    const { isAuthenticated, loading, user } = useSelector((state: RootState) => state.auth);
    const [authChecked, setAuthChecked] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        dispatch(getCurrentUser()).finally(() => {
            setAuthChecked(true);
        });
    }, [dispatch]);

    useEffect(() => {
        if (authChecked && !loading && !isAuthenticated) {
            router.push('/login');
        } else if (authChecked && !loading && isAuthenticated && user?.role !== 'admin') {
            router.push('/dashboard');
        }
    }, [authChecked, isAuthenticated, loading, user, router]);

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated || user?.role !== 'admin') {
        return null;
    }

    const navLinks = [
        { href: '/admin/dashboard', label: '📊 Dashboard' },
        { href: '/admin/users', label: '👥 Users' },
        { href: '/admin/projects', label: '📁 Projects' },
        { href: '/admin/servers', label: '🖥️ Servers' },
        { href: '/admin/plans', label: '💳 Plans' },
        { href: '/admin/templates', label: '📑 Templates' },
        { href: '/admin/capacity', label: '📊 Capacity' },
        { href: '/admin/servers-new', label: '🐳 Docker Stats' },
        { href: '/admin/queue', label: '⏱️ Queue' },
        { href: '/admin/cleanup', label: '🧹 Cleanup' },
        { href: '/admin/settings', label: '⚙️ Settings' },
        { href: '/admin/payments', label: '💰 Payments' },
    ];

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Mobile Header — only on small screens */}
            <div className="lg:hidden sticky top-0 z-50 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                    >
                        {sidebarOpen ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        )}
                    </button>
                    <h1 className="text-lg font-bold text-white">Admin Panel</h1>
                </div>
                <div className="flex items-center gap-3">
                    <NotificationBell />
                    <span className="text-xs text-gray-500">{user?.displayName}</span>
                </div>
            </div>

            <div className="flex relative">
                {/* Mobile Overlay */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/60 z-40 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <aside className={`
                    fixed lg:sticky top-0 left-0 z-50 lg:z-auto
                    w-64 min-h-screen bg-gray-900 border-r border-gray-800
                    transform transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                    lg:translate-x-0 lg:block
                    overflow-y-auto
                `}>
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-white mb-1">Admin Panel</h1>
                                <p className="text-sm text-gray-400">Platform Management</p>
                            </div>
                            <div className="hidden lg:block">
                                <NotificationBell />
                            </div>
                            {/* Close button — mobile only */}
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <nav className="px-4 space-y-1">
                        {navLinks.map((link) => {
                            const isActive = pathname === link.href;
                            return (
                                <a
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                            ? 'bg-purple-600 text-white'
                                            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                        }`}
                                >
                                    {link.label}
                                </a>
                            );
                        })}
                        <div className="border-t border-gray-800 my-4"></div>
                        <a href="/dashboard" className="block px-4 py-2.5 text-gray-300 hover:bg-gray-800 rounded-lg text-sm font-medium">
                            ← Back to User Panel
                        </a>
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
