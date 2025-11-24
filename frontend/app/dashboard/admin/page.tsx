'use client';

import { useState } from 'react';
import {
    UsersIcon,
    ServerIcon,
    CreditCardIcon,
    ChartBarIcon,
    CpuChipIcon,
} from '@heroicons/react/24/outline';

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('overview');

    // Mock data - in production, fetch from API
    const stats = {
        totalUsers: 1247,
        activeProjects: 3891,
        totalDeployments: 12453,
        revenue: 45670,
    };

    const servers = [
        {
            name: 'EC1 - Main API Server',
            ip: 'localhost',
            status: 'online',
            cpu: 45,
            ram: 62,
            disk: 38,
            uptime: '99.9%',
        },
        {
            name: 'EC2 - Mixed Server',
            ip: 'your-ec2-ip',
            status: 'online',
            cpu: 72,
            ram: 85,
            disk: 54,
            uptime: '99.8%',
            freeUsers: 45,
            paidUsers: 12,
        },
        {
            name: 'EC3 - Mixed Server',
            ip: 'your-ec3-ip',
            status: 'online',
            cpu: 68,
            ram: 78,
            disk: 61,
            uptime: '99.7%',
            freeUsers: 38,
            paidUsers: 18,
        },
    ];

    const recentUsers = [
        { name: 'John Doe', email: 'john@example.com', plan: 'Pro', joined: '2 hours ago' },
        { name: 'Jane Smith', email: 'jane@example.com', plan: 'Starter', joined: '5 hours ago' },
        { name: 'Bob Wilson', email: 'bob@example.com', plan: 'Free', joined: '1 day ago' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-gray-400 mt-1">Platform overview and management</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <UsersIcon className="h-8 w-8" />
                        <span className="text-sm bg-white/20 px-2 py-1 rounded">+12%</span>
                    </div>
                    <p className="text-3xl font-bold mb-1">{stats.totalUsers.toLocaleString()}</p>
                    <p className="text-blue-100 text-sm">Total Users</p>
                </div>

                <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <ServerIcon className="h-8 w-8" />
                        <span className="text-sm bg-white/20 px-2 py-1 rounded">+8%</span>
                    </div>
                    <p className="text-3xl font-bold mb-1">{stats.activeProjects.toLocaleString()}</p>
                    <p className="text-purple-100 text-sm">Active Projects</p>
                </div>

                <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <ChartBarIcon className="h-8 w-8" />
                        <span className="text-sm bg-white/20 px-2 py-1 rounded">+24%</span>
                    </div>
                    <p className="text-3xl font-bold mb-1">{stats.totalDeployments.toLocaleString()}</p>
                    <p className="text-green-100 text-sm">Total Deployments</p>
                </div>

                <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <CreditCardIcon className="h-8 w-8" />
                        <span className="text-sm bg-white/20 px-2 py-1 rounded">+18%</span>
                    </div>
                    <p className="text-3xl font-bold mb-1">${stats.revenue.toLocaleString()}</p>
                    <p className="text-yellow-100 text-sm">Monthly Revenue</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-800">
                <div className="flex space-x-8">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`pb-4 px-1 border-b-2 transition-colors ${activeTab === 'overview'
                                ? 'border-purple-500 text-white'
                                : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('servers')}
                        className={`pb-4 px-1 border-b-2 transition-colors ${activeTab === 'servers'
                                ? 'border-purple-500 text-white'
                                : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        Servers
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`pb-4 px-1 border-b-2 transition-colors ${activeTab === 'users'
                                ? 'border-purple-500 text-white'
                                : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        Users
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Users */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Recent Users</h3>
                        <div className="space-y-4">
                            {recentUsers.map((user, index) => (
                                <div key={index} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                                    <div>
                                        <p className="text-white font-medium">{user.name}</p>
                                        <p className="text-gray-400 text-sm">{user.email}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="px-2 py-1 bg-purple-500/10 text-purple-500 rounded text-sm">
                                            {user.plan}
                                        </span>
                                        <p className="text-gray-400 text-xs mt-1">{user.joined}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* System Health */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">System Health</h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-gray-400">API Response Time</span>
                                    <span className="text-green-500">45ms</span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2">
                                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-gray-400">Database Performance</span>
                                    <span className="text-green-500">98%</span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2">
                                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '98%' }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-gray-400">Build Queue</span>
                                    <span className="text-yellow-500">12 jobs</span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2">
                                    <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '45%' }}></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-gray-400">Error Rate</span>
                                    <span className="text-green-500">0.02%</span>
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2">
                                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '2%' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'servers' && (
                <div className="space-y-6">
                    {servers.map((server, index) => (
                        <div key={index} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-xl font-semibold text-white">{server.name}</h3>
                                    <p className="text-gray-400 text-sm">{server.ip}</p>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <span className="flex items-center space-x-2">
                                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                        <span className="text-green-500 text-sm font-medium">Online</span>
                                    </span>
                                    <span className="text-gray-400 text-sm">Uptime: {server.uptime}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-gray-400 text-sm">CPU Usage</span>
                                        <span className="text-white font-medium">{server.cpu}%</span>
                                    </div>
                                    <div className="w-full bg-gray-800 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${server.cpu > 80 ? 'bg-red-500' : server.cpu > 60 ? 'bg-yellow-500' : 'bg-green-500'
                                                }`}
                                            style={{ width: `${server.cpu}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-gray-400 text-sm">RAM Usage</span>
                                        <span className="text-white font-medium">{server.ram}%</span>
                                    </div>
                                    <div className="w-full bg-gray-800 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${server.ram > 80 ? 'bg-red-500' : server.ram > 60 ? 'bg-yellow-500' : 'bg-green-500'
                                                }`}
                                            style={{ width: `${server.ram}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-gray-400 text-sm">Disk Usage</span>
                                        <span className="text-white font-medium">{server.disk}%</span>
                                    </div>
                                    <div className="w-full bg-gray-800 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${server.disk > 80 ? 'bg-red-500' : server.disk > 60 ? 'bg-yellow-500' : 'bg-green-500'
                                                }`}
                                            style={{ width: `${server.disk}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            {(server.freeUsers !== undefined || server.paidUsers !== undefined) && (
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
                                    <div className="bg-gray-800 rounded-lg p-4">
                                        <p className="text-gray-400 text-sm mb-1">Free Users</p>
                                        <p className="text-2xl font-bold text-white">{server.freeUsers}</p>
                                    </div>
                                    <div className="bg-gray-800 rounded-lg p-4">
                                        <p className="text-gray-400 text-sm mb-1">Paid Users</p>
                                        <p className="text-2xl font-bold text-white">{server.paidUsers}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'users' && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">User Management</h3>
                    <div className="text-center py-12">
                        <UsersIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400">User management interface coming soon</p>
                    </div>
                </div>
            )}
        </div>
    );
}
