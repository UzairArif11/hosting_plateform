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
import { useEffect, useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

export default function Sidebar() {
    const pathname = usePathname();
    const dispatch = useDispatch<AppDispatch>();
    const router = useRouter();
    const { user } = useSelector((state: RootState) => state.auth);
    const [refreshing, setRefreshing] = useState(false);

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

    // Auto-refresh user data on mount to get latest plan features
    useEffect(() => {
        if (user) {
            dispatch(getCurrentUser());
        }
    }, [dispatch]); // Only on mount

    // Debug: Log user features
    useEffect(() => {
        if (user?.plan?.features) {
            console.log('🔍 Sidebar - User Plan Features:', {
                planName: user.plan.name,
                planDisplayName: user.plan.displayName,
                features: user.plan.features,
                featuresCount: user.plan.features.length,
                featuresDetail: user.plan.features.map((f: any) => ({
                    name: typeof f === 'string' ? f : f.name,
                    enabled: typeof f === 'string' ? true : f.enabled,
                    type: typeof f,
                })),
            });
        } else {
            console.warn('⚠️ Sidebar - No plan features found for user:', {
                hasUser: !!user,
                hasPlan: !!user?.plan,
                planName: user?.plan?.name,
            });
        }
    }, [user]);

    // Check features - use direct user check to avoid hook issues
    const checkFeature = (key: string): boolean => {
        if (!user?.plan?.features) return false;
        return user.plan.features.some((f: any) => {
            if (typeof f === 'string') return f === key;
            return f.name === key && f.enabled !== false;
        });
    };

    const hasTemplates = checkFeature('templates');
    const hasAnalytics = checkFeature('analytics');
    const hasAuditLogs = checkFeature('auditLogs');

    // Debug: Log feature checks
    useEffect(() => {
        if (user?.plan) {
            console.log('🔍 Sidebar - Feature Checks:', {
                planName: user.plan.name,
                templates: hasTemplates,
                analytics: hasAnalytics,
                auditLogs: hasAuditLogs,
                allFeatures: user.plan.features?.map((f: any) => ({
                    name: typeof f === 'string' ? f : f.name,
                    enabled: typeof f === 'string' ? true : f.enabled,
                })),
            });
        }
    }, [user, hasTemplates, hasAnalytics, hasAuditLogs]);

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
        { name: 'Projects', href: '/dashboard/projects', icon: FolderIcon },
        { name: 'Deployments', href: '/dashboard/deployments', icon: RocketLaunchIcon },
        // Always show Templates - FeatureGuard will handle access check
        { name: 'Templates', href: '/templates', icon: Square3Stack3DIcon, requiresFeature: 'templates' },
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
                {user?.isTrialActive && (
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
                    
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            prefetch={false}
                            className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                                isActive
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
