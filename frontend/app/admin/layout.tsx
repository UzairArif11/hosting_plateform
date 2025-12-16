'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { getCurrentUser } from '@/lib/slices/authSlice';
import { AppDispatch, RootState } from '@/lib/store';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const { isAuthenticated, loading, user } = useSelector((state: RootState) => state.auth);
    const [authChecked, setAuthChecked] = useState(false);

    useEffect(() => {
        // Fetch current user on mount
        dispatch(getCurrentUser()).finally(() => {
            setAuthChecked(true);
        });
    }, [dispatch]);

    useEffect(() => {
        // Only redirect if auth check is complete
        if (authChecked && !loading && !isAuthenticated) {
            router.push('/login');
        } else if (authChecked && !loading && isAuthenticated && user?.role !== 'admin') {
            router.push('/dashboard');
        }
    }, [authChecked, isAuthenticated, loading, user, router]);

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

    return (
        <div className="min-h-screen bg-gray-950">
            <div className="flex">
                {/* Sidebar */}
                <aside className="w-64 bg-gray-900 border-r border-gray-800 min-h-screen">
                    <div className="p-6">
                        <h1 className="text-2xl font-bold text-white mb-2">Admin Panel</h1>
                        <p className="text-sm text-gray-400">Platform Management</p>
                    </div>
                    <nav className="px-4 space-y-2">
                        <a href="/admin/dashboard" className="block px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg">
                            📊 Dashboard
                        </a>
                        <a href="/admin/users" className="block px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg">
                            👥 Users
                        </a>
                        <a href="/admin/projects" className="block px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg">
                            📁 Projects
                        </a>
                        <a href="/admin/servers" className="block px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg">
                            🖥️ Servers
                        </a>
                        <a href="/admin/settings" className="block px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg">
                            ⚙️ Settings
                        </a>
                        <div className="border-t border-gray-800 my-4"></div>
                        <a href="/dashboard" className="block px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg">
                            ← Back to User Panel
                        </a>
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
