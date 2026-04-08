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
    Square3Stack3DIcon,
    ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { hasFeature } from '@/lib/features';
import { getCurrentUser } from '@/lib/slices/authSlice';
import { useEffect, useState, useMemo } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

export default function Sidebar() {
    const pathname = usePathname();
    const dispatch = useDispatch<AppDispatch>();
    const router = useRouter();
    const { user } = useSelector((state: RootState) => state.auth);
    const [refreshing, setRefreshing] = useState(false);

    // Check if account is suspended
    const isSuspended = user?.status === 'suspended' && user?.role !== 'admin';

    // Refresh user data to get latest plan features
    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await dispatch(getCurrentUser()).unwrap();
            toast.success('Plan features refreshed');
        } catch (error) {
            toast.error('Failed to refresh');
        } finally {
            setRefreshing(false);
        }
    };

    // Note: Don't auto-refresh here - DashboardLayout already calls getCurrentUser on mount
    // This prevents infinite loading loops

    // Check features - memoize results to prevent recalculation
    const hasTemplates = useMemo(() => {
        if (!user?.plan?.features) return false;
        return user.plan.features.some((f: any) => {
            if (typeof f === 'string') return f === 'templates';
            return f.name === 'templates' && f.enabled !== false;
        });
    }, [user?.plan?.features]);

    const hasAnalytics = useMemo(() => {
        if (!user?.plan?.features) return false;
        return user.plan.features.some((f: any) => {
            if (typeof f === 'string') return f === 'analytics';
            return f.name === 'analytics' && f.enabled !== false;
        });
    }, [user?.plan?.features]);

    const hasAuditLogs = useMemo(() => {
        if (!user?.plan?.features) return false;
        return user.plan.features.some((f: any) => {
            if (typeof f === 'string') return f === 'auditLogs';
            return f.name === 'auditLogs' && f.enabled !== false;
        });
    }, [user?.plan?.features]);

    // Helper function for navigation items
    const checkFeature = (key: string): boolean => {
        if (!user?.plan?.features) return false;
        return user.plan.features.some((f: any) => {
            if (typeof f === 'string') return f === key;
            return f.name === key && f.enabled !== false;
        });
    };

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
        { name: 'Projects', href: '/dashboard/projects', icon: FolderIcon },
        { name: 'Deployments', href: '/dashboard/deployments', icon: RocketLaunchIcon },
        // Always show Templates - FeatureGuard will handle access check
        { name: 'Templates', href: '/templates', icon: Square3Stack3DIcon },
        ...(hasAnalytics ? [{ name: 'Analytics', href: '/dashboard/analytics', icon: ChartBarIcon }] : []),
        ...(hasAuditLogs ? [{ name: 'Activity', href: '/dashboard/activity', icon: ClipboardDocumentListIcon }] : []),
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
                        {user?.plan && (
                            <div className="mt-0.5">
                                <p className="text-xs text-gray-500 truncate">
                                    {user.plan.displayName || user.plan.name} Plan
                                </p>
                                {user.plan.features && (
                                    <p className="text-xs text-gray-600 truncate">
                                        {user.plan.features.filter((f: any) => {
                                            if (typeof f === 'string') return true;
                                            return f.enabled !== false;
                                        }).length} features enabled
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                {/* Suspended Status */}
                {isSuspended && (
                    <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-xs font-semibold text-red-400 mb-1">
                            ⚠️ Account Suspended
                        </p>
                        <p className="text-xs text-red-300">
                            {user.suspensionReason || 'Account suspended'}
                        </p>
                        <button
                            onClick={() => router.push('/dashboard/billing')}
                            className="mt-2 w-full px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors"
                        >
                            Upgrade to Reactivate
                        </button>
                    </div>
                )}

                {/* Trial Status */}
                {!isSuspended && user?.isTrialActive && (
                    <div className="mt-3 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                        <p className="text-xs text-purple-400">
                            Trial: {user.trialDaysRemaining} days left
                        </p>
                    </div>
                )}
                {/* Refresh Button */}
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="mt-3 w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    title="Refresh plan features (if admin updated your plan)"
                >
                    <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Refreshing...' : 'Refresh Features'}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                {navigation.map((item: any) => {
                    const isActive = pathname === item.href;
                    const hasRequiredFeature = item.requiresFeature
                        ? checkFeature(item.requiresFeature)
                        : true;

                    // Disable all navigation if suspended (except Billing and Settings)
                    const allowedWhenSuspended = ['Billing', 'Settings', 'Dashboard'];
                    const isDisabled = isSuspended && !allowedWhenSuspended.includes(item.name);

                    return (
                        <Link
                            key={item.name}
                            href={isDisabled ? '#' : item.href}
                            prefetch={false}
                            onClick={(e) => {
                                if (isDisabled) {
                                    e.preventDefault();
                                    toast.error('Account suspended. Upgrade to access features.');
                                }
                            }}
                            className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${isDisabled
                                    ? 'text-gray-600 cursor-not-allowed opacity-50'
                                    : isActive
                                        ? 'bg-purple-600 text-white'
                                        : hasRequiredFeature
                                            ? 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                            : 'text-gray-600 hover:bg-gray-800 hover:text-gray-500'
                                }`}
                            title={!hasRequiredFeature ? `Requires ${item.requiresFeature} feature` : undefined}
                        >
                            <item.icon className="h-5 w-5" />
                            <span className="text-sm font-medium">{item.name}</span>
                            {!hasRequiredFeature && (
                                <span className="ml-auto text-xs text-gray-600">🔒</span>
                            )}
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
