'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { getCurrentUser } from '@/lib/slices/authSlice';
import { AppDispatch, RootState } from '@/lib/store';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const { isAuthenticated, loading, user } = useSelector((state: RootState) => state.auth);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);

    useEffect(() => {
        // Fetch current user on mount
        dispatch(getCurrentUser()).finally(() => {
            setAuthChecked(true);
        });
    }, [dispatch]);

    useEffect(() => {
        // Only redirect if auth check is complete and user is not authenticated
        if (authChecked && !loading && !isAuthenticated) {
            router.push('/login');
        }
    }, [authChecked, isAuthenticated, loading, router]);

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

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="flex h-screen bg-gray-950">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar - Desktop: always visible, Mobile: slide-in */}
            <div
                className={`
                    fixed lg:static inset-y-0 left-0 z-50
                    w-64 flex-shrink-0 transform transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                <Sidebar />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden w-full">
                {/* Top Bar */}
                <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between">
                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="lg:hidden text-gray-400 hover:text-white"
                        >
                            {sidebarOpen ? (
                                <XMarkIcon className="h-6 w-6" />
                            ) : (
                                <Bars3Icon className="h-6 w-6" />
                            )}
                        </button>

                        {/* Welcome Message */}
                        <div className="flex-1 lg:flex-none">
                            <h2 className="text-lg sm:text-xl font-semibold text-white truncate">
                                Welcome back, {user?.displayName?.split(' ')[0]}!
                            </h2>
                            <p className="text-xs sm:text-sm text-gray-400 mt-1">
                                {user?.subscriptionStatus === 'trial' ? 'Free Trial' : user?.plan?.name || 'Free Plan'}
                            </p>
                        </div>

                        {/* Resource Usage - Hidden on mobile */}
                        <div className="hidden md:flex items-center space-x-4">
                            <NotificationBell />
                            <div className="text-right">
                                <p className="text-xs text-gray-400">Storage</p>
                                <p className="text-sm font-medium text-white">
                                    {user?.resourceUsagePercentage?.storage || 0}%
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-400">Bandwidth</p>
                                <p className="text-sm font-medium text-white">
                                    {user?.resourceUsagePercentage?.bandwidth || 0}%
                                </p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto bg-gray-950 p-4 sm:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
