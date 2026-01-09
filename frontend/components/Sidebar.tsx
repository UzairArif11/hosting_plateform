'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '@/lib/store';
import { logout } from '@/lib/slices/authSlice';
import {
    HomeIcon,
    FolderIcon,
    RocketLaunchIcon,
    Cog6ToothIcon,
    CreditCardIcon,
    ArrowRightOnRectangleIcon,
    ChartBarIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function Sidebar() {
    const pathname = usePathname();
    const dispatch = useDispatch<AppDispatch>();
    const router = useRouter();
    const { user } = useSelector((state: RootState) => state.auth);

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
        { name: 'Projects', href: '/dashboard/projects', icon: FolderIcon },
        { name: 'Deployments', href: '/dashboard/deployments', icon: RocketLaunchIcon },
        { name: 'Analytics', href: '/dashboard/analytics', icon: ChartBarIcon },
        { name: 'Billing', href: '/dashboard/billing', icon: CreditCardIcon },
        { name: 'Settings', href: '/dashboard/settings', icon: Cog6ToothIcon },
    ];

    const handleLogout = async () => {
        try {
            await dispatch(logout()).unwrap();
            toast.success('Logged out successfully');
            router.push('/');
        } catch (error) {
            toast.error('Failed to logout');
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
            {/* Logo */}
            <div className="flex items-center space-x-2 px-6 py-4 border-b border-gray-800">
                <RocketLaunchIcon className="h-8 w-8 text-purple-500" />
                <span className="text-xl font-bold text-white">Vercel Clone</span>
            </div>

            {/* User Info */}
            <div className="px-6 py-4 border-b border-gray-800">
                <div className="flex items-center space-x-3">
                    <img
                        src={user?.avatar || '/default-avatar.png'}
                        alt={user?.displayName}
                        className="h-10 w-10 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                            {user?.displayName}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                    </div>
                </div>
                {user?.isTrialActive && (
                    <div className="mt-3 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                        <p className="text-xs text-purple-400">
                            Trial: {user.trialDaysRemaining} days left
                        </p>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            prefetch={false}
                            className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${isActive
                                ? 'bg-purple-600 text-white'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                }`}
                        >
                            <item.icon className="h-5 w-5" />
                            <span className="text-sm font-medium">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Logout */}
            <div className="px-4 py-4 border-t border-gray-800">
                <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 px-3 py-2 w-full rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                >
                    <ArrowRightOnRectangleIcon className="h-5 w-5" />
                    <span className="text-sm font-medium">Logout</span>
                </button>
            </div>
        </div>
    );
}
