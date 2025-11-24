'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { user } = useSelector((state: RootState) => state.auth);

    useEffect(() => {
        if (user && user.role !== 'admin') {
            router.push('/dashboard');
        }
    }, [user, router]);

    if (!user || user.role !== 'admin') {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <h3 className="text-xl font-semibold text-white mb-2">Access Denied</h3>
                    <p className="text-gray-400">You don't have permission to access this page</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
