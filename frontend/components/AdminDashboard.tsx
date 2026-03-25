'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface ServerStats {
    key: string;
    physical: { cpu: number; ram: number };
    maxUsers: number;
    perUserCap: { cpu: number; ram: number };
    currentUsers: number;
    allocated: { cpu: number; ram: number };
    available: { cpu: number; ram: number };
    utilization: { cpu: number; ram: number };
}

interface User {
    _id: string;
    email: string;
    displayName: string;
    plan: { name: string };
    allocatedResources?: { cpu: number; ram: number };
    containers?: any[];
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<ServerStats[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [newResources, setNewResources] = useState({ cpu: 0, ram: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const statsRes = await api.get('/admin/server-stats');
            if (statsRes.data) {
                setStats(statsRes.data.servers || []);
            }

            const usersRes = await api.get('/admin/users');
            if (usersRes.data) {
                setUsers(usersRes.data.users || []);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
            toast.error('Failed to load admin data');
        } finally {
            setLoading(false);
        }
    };

    const updateUserResources = async () => {
        if (!selectedUser) return;

        try {
            await api.put(`/admin/users/${selectedUser._id}/resources`, newResources);
            toast.success('Resources updated successfully');
            setSelectedUser(null);
            loadData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to update resources');
        }
    };

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-gray-700 rounded w-1/4"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[1, 2].map(i => (
                            <div key={i} className="h-48 bg-gray-800 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
                <p className="text-gray-400">Manage resources and monitor servers</p>
            </div>

            {/* Server Statistics */}
            <div>
                <h2 className="text-xl font-semibold text-white mb-4">Server Statistics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {stats.map((server) => (
                        <div key={server.key} className="bg-gray-900 rounded-lg p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">
                                {server.key}
                            </h3>

                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-400">CPU Usage</span>
                                        <span className="text-white font-medium">
                                            {server.utilization.cpu.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full"
                                            style={{ width: `${server.utilization.cpu}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {server.allocated.cpu.toFixed(2)} / {server.physical.cpu} CPU
                                    </p>
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-400">RAM Usage</span>
                                        <span className="text-white font-medium">
                                            {server.utilization.ram.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2">
                                        <div
                                            className="bg-green-500 h-2 rounded-full"
                                            style={{ width: `${server.utilization.ram}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {server.allocated.ram} / {server.physical.ram} MB
                                    </p>
                                </div>

                                <div className="pt-3 border-t border-gray-700">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-gray-400">Users</p>
                                            <p className="text-white font-medium">{server.currentUsers}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">Max Users</p>
                                            <p className="text-white font-medium">{server.maxUsers}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* User Management */}
            <div>
                <h2 className="text-xl font-semibold text-white mb-4">User Management</h2>
                <div className="bg-gray-900 rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                    User
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                    Plan
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                    Resources
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                    Containers
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {users.map((user) => (
                                <tr key={user._id} className="hover:bg-gray-800">
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="text-white font-medium">{user.displayName}</p>
                                            <p className="text-sm text-gray-400">{user.email}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 text-xs font-medium bg-blue-900 text-blue-300 rounded">
                                            {user.plan?.name || 'free'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm text-white">
                                            {user.allocatedResources?.cpu || 0.2} CPU
                                        </p>
                                        <p className="text-sm text-gray-400">
                                            {user.allocatedResources?.ram || 1228} MB
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm text-white">
                                            {user.containers?.length || 0}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => {
                                                setSelectedUser(user);
                                                setNewResources({
                                                    cpu: user.allocatedResources?.cpu || 0.2,
                                                    ram: user.allocatedResources?.ram || 1228
                                                });
                                            }}
                                            className="text-sm text-blue-400 hover:text-blue-300"
                                        >
                                            Manage
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Resource Management Modal */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-white mb-4">
                            Manage Resources
                        </h3>
                        <p className="text-gray-400 mb-6">
                            {selectedUser.displayName} ({selectedUser.email})
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    CPU (cores)
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={newResources.cpu}
                                    onChange={(e) => setNewResources(prev => ({
                                        ...prev,
                                        cpu: parseFloat(e.target.value)
                                    }))}
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    RAM (MB)
                                </label>
                                <input
                                    type="number"
                                    value={newResources.ram}
                                    onChange={(e) => setNewResources(prev => ({
                                        ...prev,
                                        ram: parseInt(e.target.value)
                                    }))}
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex space-x-3 mt-6">
                            <button
                                onClick={updateUserResources}
                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                                Update
                            </button>
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
