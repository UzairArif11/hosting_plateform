'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { ServerIcon, CpuChipIcon, CircleStackIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function AdminServersPage() {
    const [servers, setServers] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchServers();
        const interval = setInterval(fetchServers, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchServers = async () => {
        try {
            const response = await api.get('/api/admin/servers');
            setServers(response.data);
        } catch (error) {
            console.error('Failed to fetch servers:', error);
            toast.error('Failed to load server data');
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
                <h1 className="text-3xl font-bold text-white">Server Management</h1>
                <p className="text-gray-400 mt-2">Monitor and manage platform servers</p>
            </div>

            {/* Architecture Overview */}
            {servers?.architecture && (
                <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/20 rounded-xl p-6">
                    <h2 className="text-xl font-semibold text-white mb-2">{servers.architecture.type}</h2>
                    <p className="text-gray-300">{servers.architecture.description}</p>
                </div>
            )}

            {/* Summary Stats */}
            {servers?.summary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-400">Total Users</p>
                                <p className="text-3xl font-bold text-white mt-2">{servers.summary.totalUsers}</p>
                            </div>
                            <div className="bg-blue-500/10 p-3 rounded-lg">
                                <span className="text-3xl">👥</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-400">Shared Containers</p>
                                <p className="text-3xl font-bold text-white mt-2">{servers.summary.sharedUsers}</p>
                            </div>
                            <div className="bg-green-500/10 p-3 rounded-lg">
                                <span className="text-3xl">📦</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-400">Dedicated Containers</p>
                                <p className="text-3xl font-bold text-white mt-2">{servers.summary.dedicatedUsers}</p>
                            </div>
                            <div className="bg-purple-500/10 p-3 rounded-lg">
                                <span className="text-3xl">🎯</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Servers List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {servers?.servers?.map((server: any) => (
                    <div
                        key={server.id}
                        className={`bg-gray-900 border rounded-xl p-6 ${server.status === 'healthy'
                                ? 'border-green-500/30'
                                : 'border-red-500/30'
                            }`}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-3">
                                <div className={`p-2 rounded-lg ${server.status === 'healthy'
                                        ? 'bg-green-500/10'
                                        : 'bg-red-500/10'
                                    }`}>
                                    <ServerIcon className={`h-6 w-6 ${server.status === 'healthy'
                                            ? 'text-green-500'
                                            : 'text-red-500'
                                        }`} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">{server.id}</h3>
                                    <p className="text-sm text-gray-400">{server.name}</p>
                                </div>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${server.status === 'healthy'
                                    ? 'bg-green-500/10 text-green-500'
                                    : 'bg-red-500/10 text-red-500'
                                }`}>
                                {server.status}
                            </span>
                        </div>

                        <p className="text-sm text-gray-400 mb-4">{server.description}</p>

                        {server.utilization && (
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-400">CPU Usage</span>
                                        <span className="text-white">{server.utilization.cpuUsage || 0}%</span>
                                    </div>
                                    <div className="w-full bg-gray-800 rounded-full h-2">
                                        <div
                                            className="bg-purple-500 h-2 rounded-full transition-all"
                                            style={{ width: `${server.utilization.cpuUsage || 0}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-400">RAM Usage</span>
                                        <span className="text-white">{server.utilization.ramUsage || 0}%</span>
                                    </div>
                                    <div className="w-full bg-gray-800 rounded-full h-2">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full transition-all"
                                            style={{ width: `${server.utilization.ramUsage || 0}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-400">Disk Usage</span>
                                        <span className="text-white">{server.utilization.diskUsage || 0}%</span>
                                    </div>
                                    <div className="w-full bg-gray-800 rounded-full h-2">
                                        <div
                                            className="bg-green-500 h-2 rounded-full transition-all"
                                            style={{ width: `${server.utilization.diskUsage || 0}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-gray-800 grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <p className="text-gray-400">Total Users</p>
                                        <p className="text-white font-semibold">{server.utilization.totalUsers || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400">Containers</p>
                                        <p className="text-white font-semibold">
                                            {(server.utilization.sharedUsers || 0) + (server.utilization.dedicatedUsers || 0)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {server.error && (
                            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <p className="text-sm text-red-400">{server.error}</p>
                            </div>
                        )}

                        {server.type === 'api_main' && (
                            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                <p className="text-sm text-blue-400">
                                    <strong>Main Server:</strong> Hosts API, Admin Panel, and Frontend
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* System Information */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4">System Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-800/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                            <CpuChipIcon className="h-5 w-5 text-purple-500" />
                            <p className="text-sm text-gray-400">Total CPU Cores</p>
                        </div>
                        <p className="text-2xl font-bold text-white">12</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                            <CircleStackIcon className="h-5 w-5 text-blue-500" />
                            <p className="text-sm text-gray-400">Total RAM</p>
                        </div>
                        <p className="text-2xl font-bold text-white">72 GB</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                            <ServerIcon className="h-5 w-5 text-green-500" />
                            <p className="text-sm text-gray-400">Active Servers</p>
                        </div>
                        <p className="text-2xl font-bold text-white">
                            {servers?.servers?.filter((s: any) => s.status === 'healthy').length || 0}
                        </p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                            <span className="text-xl">🌐</span>
                            <p className="text-sm text-gray-400">Load Balancing</p>
                        </div>
                        <p className="text-lg font-semibold text-green-500">Active</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
