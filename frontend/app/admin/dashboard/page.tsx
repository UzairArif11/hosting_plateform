'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function AdminDashboardPage() {
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeUsers: 0,
        totalProjects: 0,
        activeDeployments: 0,
        totalRevenue: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await api.get('/api/admin/stats');
            setStats(response.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-gray-400 mt-2">Platform overview and statistics</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-400">Total Users</p>
                            <p className="text-3xl font-bold text-white mt-2">{stats.totalUsers}</p>
                        </div>
                        <div className="bg-blue-500/10 p-3 rounded-lg">
                            <span className="text-3xl">👥</span>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-400">Active Users</p>
                            <p className="text-3xl font-bold text-white mt-2">{stats.activeUsers}</p>
                        </div>
                        <div className="bg-green-500/10 p-3 rounded-lg">
                            <span className="text-3xl">✅</span>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-400">Total Projects</p>
                            <p className="text-3xl font-bold text-white mt-2">{stats.totalProjects}</p>
                        </div>
                        <div className="bg-purple-500/10 p-3 rounded-lg">
                            <span className="text-3xl">📁</span>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-400">Active Deployments</p>
                            <p className="text-3xl font-bold text-white mt-2">{stats.activeDeployments}</p>
                        </div>
                        <div className="bg-yellow-500/10 p-3 rounded-lg">
                            <span className="text-3xl">🚀</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* System Health */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4">System Health</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-800/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-400">API Server</span>
                            <span className="px-2 py-1 bg-green-500/10 text-green-500 text-xs rounded-full">Online</span>
                        </div>
                        <div className="text-sm text-gray-500">Port 5000</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-400">Database</span>
                            <span className="px-2 py-1 bg-green-500/10 text-green-500 text-xs rounded-full">Connected</span>
                        </div>
                        <div className="text-sm text-gray-500">MongoDB</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-400">Container Servers</span>
                            <span className="px-2 py-1 bg-green-500/10 text-green-500 text-xs rounded-full">Running</span>
                        </div>
                        <div className="text-sm text-gray-500">EC2, EC3</div>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
                <div className="space-y-3">
                    <div className="flex items-center justify-between py-3 border-b border-gray-800">
                        <div className="flex items-center space-x-3">
                            <div className="bg-blue-500/10 p-2 rounded-lg">
                                <span className="text-xl">👤</span>
                            </div>
                            <div>
                                <p className="text-white">New user registered</p>
                                <p className="text-sm text-gray-400">2 minutes ago</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-800">
                        <div className="flex items-center space-x-3">
                            <div className="bg-green-500/10 p-2 rounded-lg">
                                <span className="text-xl">🚀</span>
                            </div>
                            <div>
                                <p className="text-white">Deployment completed</p>
                                <p className="text-sm text-gray-400">5 minutes ago</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between py-3">
                        <div className="flex items-center space-x-3">
                            <div className="bg-purple-500/10 p-2 rounded-lg">
                                <span className="text-xl">📁</span>
                            </div>
                            <div>
                                <p className="text-white">New project created</p>
                                <p className="text-sm text-gray-400">10 minutes ago</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
