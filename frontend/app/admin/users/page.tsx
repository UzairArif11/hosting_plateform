'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { MagnifyingGlassIcon, UserIcon, ShieldCheckIcon, XCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function AdminUsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showUserModal, setShowUserModal] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await api.get('/api/admin/users?limit=100');
            setUsers(response.data.users || []);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleSuspendUser = async (userId: string) => {
        if (!confirm('Are you sure you want to suspend this user?')) return;

        try {
            await api.put(`/api/admin/users/${userId}`, { status: 'suspended' });
            toast.success('User suspended successfully');
            fetchUsers();
        } catch (error) {
            toast.error('Failed to suspend user');
        }
    };

    const handleActivateUser = async (userId: string) => {
        try {
            await api.put(`/api/admin/users/${userId}`, { status: 'active' });
            toast.success('User activated successfully');
            fetchUsers();
        } catch (error) {
            toast.error('Failed to activate user');
        }
    };

    const handleMakeAdmin = async (userId: string) => {
        if (!confirm('Are you sure you want to make this user an admin?')) return;

        try {
            await api.put(`/api/admin/users/${userId}`, { role: 'admin' });
            toast.success('User promoted to admin');
            fetchUsers();
        } catch (error) {
            toast.error('Failed to update user role');
        }
    };

    const filteredUsers = users.filter((user: any) =>
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">User Management</h1>
                    <p className="text-gray-400 mt-2">Manage all platform users</p>
                </div>
                <div className="text-sm text-gray-400">
                    Total Users: <span className="text-white font-semibold">{users.length}</span>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search users by email, username, or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
            </div>

            {/* Users Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-800/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    User
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Email
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Subscription
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                        No users found
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user: any) => (
                                    <tr key={user._id} className="hover:bg-gray-800/50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10">
                                                    {user.avatar ? (
                                                        <img className="h-10 w-10 rounded-full" src={user.avatar} alt="" />
                                                    ) : (
                                                        <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                                                            <UserIcon className="h-6 w-6 text-purple-500" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-white">{user.displayName || user.username}</div>
                                                    <div className="text-sm text-gray-400">@{user.username}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-300">{user.email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {user.role === 'admin' ? (
                                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-500/10 text-purple-500">
                                                    <ShieldCheckIcon className="h-4 w-4 mr-1" />
                                                    Admin
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-500/10 text-gray-400">
                                                    User
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'active' ? 'bg-green-500/10 text-green-500' :
                                                    user.status === 'suspended' ? 'bg-red-500/10 text-red-500' :
                                                        user.status === 'trial' ? 'bg-blue-500/10 text-blue-500' :
                                                            'bg-gray-500/10 text-gray-400'
                                                }`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-300">
                                                {user.subscriptionStatus || 'trial'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex space-x-2">
                                                {user.status === 'suspended' ? (
                                                    <button
                                                        onClick={() => handleActivateUser(user._id)}
                                                        className="text-green-400 hover:text-green-300"
                                                    >
                                                        Activate
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleSuspendUser(user._id)}
                                                        className="text-red-400 hover:text-red-300"
                                                    >
                                                        Suspend
                                                    </button>
                                                )}
                                                {user.role !== 'admin' && (
                                                    <button
                                                        onClick={() => handleMakeAdmin(user._id)}
                                                        className="text-purple-400 hover:text-purple-300"
                                                    >
                                                        Make Admin
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setSelectedUser(user);
                                                        setShowUserModal(true);
                                                    }}
                                                    className="text-blue-400 hover:text-blue-300"
                                                >
                                                    Details
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* User Details Modal */}
            {showUserModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-6">
                            <h2 className="text-2xl font-bold text-white">User Details</h2>
                            <button
                                onClick={() => setShowUserModal(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <XCircleIcon className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center space-x-4">
                                {selectedUser.avatar ? (
                                    <img className="h-20 w-20 rounded-full" src={selectedUser.avatar} alt="" />
                                ) : (
                                    <div className="h-20 w-20 rounded-full bg-purple-500/10 flex items-center justify-center">
                                        <UserIcon className="h-10 w-10 text-purple-500" />
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-xl font-semibold text-white">{selectedUser.displayName}</h3>
                                    <p className="text-gray-400">@{selectedUser.username}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-sm text-gray-400">Email</p>
                                    <p className="text-white">{selectedUser.email}</p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-sm text-gray-400">Role</p>
                                    <p className="text-white capitalize">{selectedUser.role}</p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-sm text-gray-400">Status</p>
                                    <p className="text-white capitalize">{selectedUser.status}</p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-sm text-gray-400">Subscription</p>
                                    <p className="text-white capitalize">{selectedUser.subscriptionStatus}</p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-sm text-gray-400">Created</p>
                                    <p className="text-white">{new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                                </div>
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-sm text-gray-400">Last Login</p>
                                    <p className="text-white">
                                        {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleDateString() : 'Never'}
                                    </p>
                                </div>
                            </div>

                            {selectedUser.resourceAllocation && (
                                <div className="bg-gray-800/50 rounded-lg p-4">
                                    <p className="text-sm text-gray-400 mb-2">Resource Allocation</p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-gray-400">CPU:</span>
                                            <span className="text-white ml-2">{selectedUser.resourceAllocation.cpu} cores</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">RAM:</span>
                                            <span className="text-white ml-2">{selectedUser.resourceAllocation.ram} GB</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Storage:</span>
                                            <span className="text-white ml-2">{selectedUser.resourceAllocation.storage} GB</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Bandwidth:</span>
                                            <span className="text-white ml-2">{selectedUser.resourceAllocation.bandwidth} GB</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
