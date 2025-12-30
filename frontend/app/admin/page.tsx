'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Stats {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    deletedUsers: number;
    totalProjects: number;
    totalDeployments: number;
    cleanupStats: {
        suspended: number;
        softDeleted: number;
        totalResourcesCanFree: {
            users: number;
            estimatedProjects: number;
            estimatedDeployments: number;
            estimatedContainers: number;
        };
    };
}

import api from '@/lib/api';

export default function AdminDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await api.get('/api/admin/dashboard-stats');
            if (response.data.success) {
                setStats(response.data.stats);
            }
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch admin stats:', error);
            setLoading(false);
        }
    };



    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
                    <p className="text-gray-300">Manage users, servers, and platform resources</p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        title="Total Users"
                        value={stats?.totalUsers || 0}
                        icon="👥"
                        color="blue"
                    />
                    <StatCard
                        title="Suspended Users"
                        value={stats?.suspendedUsers || 0}
                        icon="⚠️"
                        color="yellow"
                    />
                    <StatCard
                        title="Deleted Users"
                        value={stats?.deletedUsers || 0}
                        icon="🗑️"
                        color="red"
                    />
                    <StatCard
                        title="Resources to Free"
                        value={stats?.cleanupStats.totalResourcesCanFree.estimatedContainers || 0}
                        icon="📦"
                        color="green"
                        subtitle="containers"
                    />
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* User Management */}
                    <ActionCard
                        title="User Management"
                        description="Manage user accounts, plans, and permissions"
                        icon="👥"
                        actions={[
                            { label: 'View All Users', href: '/admin/users' },
                            { label: 'Suspended Users', href: '/admin/users?status=suspended' },
                            { label: 'Deleted Users', href: '/admin/users?status=deleted' }
                        ]}
                    />

                    {/* Resource Cleanup */}
                    <ActionCard
                        title="Resource Cleanup"
                        description="Free server resources by cleaning up inactive accounts"
                        icon="🗑️"
                        actions={[
                            { label: 'Cleanup Dashboard', href: '/admin/cleanup' },
                            { label: 'View Statistics', href: '/admin/cleanup' }
                        ]}
                        highlight={stats && stats.cleanupStats.totalResourcesCanFree.users > 0}
                    />

                    {/* Server Management */}
                    <ActionCard
                        title="Server Management"
                        description="Manage deployment servers and domain configuration"
                        icon="🖥️"
                        actions={[
                            { label: 'View Servers', href: '/admin/servers' },
                            { label: 'Domain Management', href: '/admin/domains' },
                            { label: 'DNS Configuration', href: '/admin/servers' }
                        ]}
                    />

                    {/* System Settings */}
                    <ActionCard
                        title="System Settings"
                        description="Configure platform settings and features"
                        icon="⚙️"
                        actions={[
                            { label: 'Platform Settings', href: '/admin/settings' },
                            { label: 'View Logs', href: '/admin/logs' }
                        ]}
                    />

                    {/* Resource Capacity */}
                    <ActionCard
                        title="Resource Capacity"
                        description="Monitor CPU, RAM, Storage and plan capacity"
                        icon="📊"
                        href="/admin/capacity"
                        color="purple"
                    />
                    {/* Plan Management */}
                    <ActionCard
                        title="Plan Management"
                        description="Configure resource limits, pricing, and sync user containers"
                        icon="💳"
                        href="/admin/plans"
                        color="indigo"
                    />
                    <ActionCard
                        title="IP Restrictions"
                        description="Manage IP-based account limits and restrictions"
                        icon="🔒"
                        href="/admin/ip-restrictions"
                        color="red"
                    />
                </div>

                {/* Cleanup Alert */}
                {stats && stats.cleanupStats.totalResourcesCanFree.users > 0 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 mb-8">
                        <div className="flex items-start">
                            <span className="text-3xl mr-4">⚠️</span>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-yellow-400 mb-2">
                                    Resources Can Be Freed
                                </h3>
                                <p className="text-gray-300 mb-4">
                                    You have {stats.cleanupStats.totalResourcesCanFree.users} inactive users that can be cleaned up,
                                    freeing {stats.cleanupStats.totalResourcesCanFree.estimatedContainers} containers.
                                </p>
                                <Link
                                    href="/admin/cleanup"
                                    className="inline-block bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-6 py-2 rounded-lg transition"
                                >
                                    Go to Cleanup Dashboard
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color, subtitle }: any) {
    const colors = {
        blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
        yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
        red: 'from-red-500/20 to-red-600/20 border-red-500/30',
        green: 'from-green-500/20 to-green-600/20 border-green-500/30'
    };

    return (
        <div className={`bg-gradient-to-br ${colors[color]} border rounded-lg p-6`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">{icon}</span>
                <span className="text-4xl font-bold text-white">{value}</span>
            </div>
            <h3 className="text-gray-300 font-medium">{title}</h3>
            {subtitle && <p className="text-gray-400 text-sm">{subtitle}</p>}
        </div>
    );
}

function ActionCard({ title, description, icon, actions, highlight, href, color }: any) {
    return (
        <div className={`bg-white/5 backdrop-blur-sm border ${highlight ? 'border-yellow-500/50' : 'border-white/10'} rounded-lg p-6`}>
            <div className="flex items-start mb-4">
                <span className="text-4xl mr-4">{icon}</span>
                <div>
                    <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
                    <p className="text-gray-400 text-sm">{description}</p>
                </div>
            </div>
            <div className="space-y-2">
                {actions && actions.map((action: any, index: number) => (
                    <Link
                        key={index}
                        href={action.href}
                        className="block w-full text-left px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition"
                    >
                        {action.label} →
                    </Link>
                ))}
                {href && (
                    <Link
                        href={href}
                        className={`block w-full text-left px-4 py-2 bg-${color || 'purple'}-500/20 hover:bg-${color || 'purple'}-500/30 border border-${color || 'purple'}-500/30 rounded-lg text-white transition`}
                    >
                        View Details →
                    </Link>
                )}
            </div>
        </div>
    );
}
