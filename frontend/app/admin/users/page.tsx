'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';

interface User {
    _id: string;
    email: string;
    displayName: string;
    plan: string;
    status: string;
    containerType: string;
    assignedServer?: string;
    containerName?: string;
    createdAt: string;
    suspendedAt?: string;
    suspensionReason?: string;
    deletedAt?: string;
    recoveryDeadline?: string;
}

export default function UserManagement() {
    const searchParams = useSearchParams();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState({
        status: searchParams?.get('status') || 'all',
        plan: 'all',
        search: ''
    });
    const [showConfirmDialog, setShowConfirmDialog] = useState<any>(null);
    const [migratingUser, setMigratingUser] = useState<string | null>(null);
    // Dynamic server list — loaded from DB-backed API (no hardcoded EC2/EC3)
    const [availableServers, setAvailableServers] = useState<string[]>([]);

    useEffect(() => {
        fetchUsers();
        fetchAvailableServers();
    }, [filter]);

    const fetchAvailableServers = async () => {
        try {
            const res = await api.get('/settings/servers');
            const serverKeys = Object.keys(res.data?.servers || {}).filter(
                (key) => res.data.servers[key].status === 'active'
            );
            setAvailableServers(serverKeys);
        } catch {
            // Fallback — show no migrate options rather than crash
            setAvailableServers([]);
        }
    };

    const fetchUsers = async () => {
        try {
            const params = new URLSearchParams();

            if (filter.status !== 'all') params.append('status', filter.status);
            if (filter.plan !== 'all') params.append('plan', filter.plan);
            if (filter.search) params.append('search', filter.search);

            const res = await api.get(`/admin/users?${params}`);

            setUsers(res.data.users || []);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            setLoading(false);
        }
    };

    const handleSelectAll = () => {
        if (selectedUsers.size === users.length) {
            setSelectedUsers(new Set());
        } else {
            setSelectedUsers(new Set(users.map(u => u._id)));
        }
    };

    const handleSelectUser = (userId: string) => {
        const newSelected = new Set(selectedUsers);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedUsers(newSelected);
    };

    const handleSuspendUser = async (userId: string, reason: string) => {
        try {
            await api.put(`/admin/users/${userId}/suspend`, { reason });
            toast.success('User suspended successfully');
            fetchUsers();
        } catch (error) {
            toast.error('Error suspending user');
        }
    };

    const handleUnsuspendUser = async (userId: string) => {
        try {
            await api.put(`/admin/users/${userId}/unsuspend`);
            toast.success('User unsuspended successfully');
            fetchUsers();
        } catch (error) {
            toast.error('Error unsuspending user');
        }
    };

    const handleDeleteUser = async (userId: string) => {
        try {
            await api.delete(`/admin/users/${userId}`, {
                data: { confirm: 'DELETE' }
            });
            toast.success('User deleted successfully (15-day recovery period)');
            fetchUsers();
        } catch (error) {
            toast.error('Error deleting user');
        }
    };

    const handleRecoverUser = async (userId: string) => {
        try {
            await api.put(`/admin/users/${userId}/recover`);
            toast.success('User recovered successfully. Container restarting.');
            fetchUsers();
        } catch (error: any) {
            const msg = error.response?.data?.error || 'Error recovering user';
            toast.error(msg);
        }
    };

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; email: string } | null>(null);

    const handlePermanentDelete = (userId: string, email: string) => {
        setDeleteTarget({ id: userId, email });
        setDeleteModalOpen(true);
    };

    const confirmPermanentDelete = async () => {
        if (!deleteTarget) return;
        setDeleteModalOpen(false);
        try {
            const res = await api.delete(`/admin/users/${deleteTarget.id}/permanent`);
            const cleanup = res.data.cleanup || {};
            toast.success(`Permanently deleted. Removed: ${cleanup.projects || 0} projects, ${cleanup.deployments || 0} deployments, ${cleanup.containers || 0} containers`);
            fetchUsers();
        } catch (error: any) {
            const msg = error.response?.data?.error || 'Error permanently deleting user';
            toast.error(msg);
        } finally {
            setDeleteTarget(null);
        }
    };

    const handleChangePlan = async (userId: string, plan: string) => {
        try {
            const res = await api.put(`/admin/users/${userId}/plan`, {
                plan,
                containerType: plan === 'free' ? 'shared' : 'dedicated',
                upgradeContainers: true
            });
            toast.success(res.data?.message || `User plan updated to ${plan}`);
            fetchUsers();
        } catch (error: any) {
            const msg = error.response?.data?.error || 'Error updating plan';
            toast.error(msg);
        }
    };

    const handleBulkDelete = async (userIds: string[]) => {
        let deleted = 0;
        let failed = 0;
        for (const userId of userIds) {
            try {
                await api.delete(`/admin/users/${userId}`, {
                    data: { confirm: 'DELETE' }
                });
                deleted++;
            } catch (error) {
                failed++;
            }
        }
        toast.success(`Deleted ${deleted} user(s)${failed > 0 ? `, ${failed} failed` : ''}`);
        setSelectedUsers(new Set());
        fetchUsers();
    };

    const handleBulkChangePlan = async (plan: string) => {
        if (!confirm(`Change plan to ${plan} for ${selectedUsers.size} user(s)?`)) return;
        let updated = 0;
        let failed = 0;
        for (const userId of Array.from(selectedUsers)) {
            try {
                await api.put(`/admin/users/${userId}/plan`, {
                    plan,
                    containerType: plan === 'free' ? 'shared' : 'dedicated',
                    upgradeContainers: true
                });
                updated++;
            } catch (error) {
                failed++;
            }
        }
        toast.success(`Updated ${updated} user(s) to ${plan}${failed > 0 ? `, ${failed} failed` : ''}`);
        setSelectedUsers(new Set());
        fetchUsers();
    };

    const handleMigrateUser = async (userId: string, targetServer: string) => {
        if (!confirm(`Migrate user to ${targetServer}? This will move their container and data.`)) return;
        setMigratingUser(userId);
        try {
            const res = await api.post(`/admin/users/${userId}/migrate`, { targetServer });
            if (res.data.success) {
                toast.success(res.data.message);
                fetchUsers();
            } else {
                toast.error(res.data.error || 'Migration failed');
            }
        } catch (error: any) {
            const msg = error.response?.data?.error || 'Migration failed';
            toast.error(msg);
        } finally {
            setMigratingUser(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading users...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">User Management</h1>
                    <p className="text-gray-300">Manage user accounts, plans, and permissions</p>
                </div>

                {/* Filters */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-gray-300 mb-2">Status</label>
                            <select
                                value={filter.status}
                                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                            >
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                                <option value="deleted">Deleted</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-300 mb-2">Plan</label>
                            <select
                                value={filter.plan}
                                onChange={(e) => setFilter({ ...filter, plan: e.target.value })}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                            >
                                <option value="all">All Plans</option>
                                <option value="free">Free</option>
                                <option value="pro">Pro</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-300 mb-2">Search</label>
                            <input
                                type="text"
                                value={filter.search}
                                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                                placeholder="Search by email..."
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400"
                            />
                        </div>
                    </div>
                </div>

                {/* Bulk Actions */}
                {selectedUsers.size > 0 && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                        <div className="flex items-center justify-between">
                            <span className="text-white">
                                {selectedUsers.size} user(s) selected
                            </span>
                            <div className="flex items-center space-x-2">
                                <select
                                    onChange={(e) => {
                                        if (e.target.value) handleBulkChangePlan(e.target.value);
                                        e.target.value = '';
                                    }}
                                    className="text-sm bg-purple-500/20 text-purple-400 px-3 py-2 rounded-lg border border-purple-500/30"
                                >
                                    <option value="">Change Plan</option>
                                    <option value="free">Free</option>
                                    <option value="pro">Pro</option>
                                    <option value="enterprise">Enterprise</option>
                                </select>
                                <button
                                    onClick={() => setShowConfirmDialog({ type: 'bulk-delete', users: Array.from(selectedUsers) })}
                                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
                                >
                                    Delete Selected
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Users List */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex items-center">
                        <input
                            type="checkbox"
                            checked={selectedUsers.size === users.length && users.length > 0}
                            onChange={handleSelectAll}
                            className="mr-4"
                        />
                        <span className="text-white font-semibold">
                            {users.length} user(s) found
                        </span>
                    </div>

                    <div className="divide-y divide-white/10">
                        {users.map((user) => (
                            <UserRow
                                key={user._id}
                                user={user}
                                selected={selectedUsers.has(user._id)}
                                onSelect={() => handleSelectUser(user._id)}
                                onSuspend={(reason: string) => handleSuspendUser(user._id, reason)}
                                onUnsuspend={() => handleUnsuspendUser(user._id)}
                                onDelete={() => handleDeleteUser(user._id)}
                                onRecover={() => handleRecoverUser(user._id)}
                                onPermanentDelete={() => handlePermanentDelete(user._id, user.email)}
                                onChangePlan={(plan: string) => handleChangePlan(user._id, plan)}
                                onMigrate={(targetServer: string) => handleMigrateUser(user._id, targetServer)}
                                isMigrating={migratingUser === user._id}
                                availableServers={availableServers}
                                onToggleProtection={async (isProtected: boolean) => {
                                    try {
                                        await api.put(`/admin/users/${user._id}/protection`, { isProtected });
                                        fetchUsers();
                                        toast.success(isProtected ? 'User marked as PROTECTED' : 'User protection removed');
                                    } catch (err) {
                                        toast.error('Failed to update protection');
                                    }
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Confirmation Dialog */}
                {showConfirmDialog && (
                    <ConfirmDialog
                        dialog={showConfirmDialog}
                        onConfirm={() => {
                            handleBulkDelete(showConfirmDialog.users);
                            setShowConfirmDialog(null);
                        }}
                        onCancel={() => setShowConfirmDialog(null)}
                    />
                )}

                {/* Permanent Delete Modal */}
                <ConfirmDeleteModal
                    isOpen={deleteModalOpen}
                    email={deleteTarget?.email || ''}
                    onConfirm={confirmPermanentDelete}
                    onCancel={() => { setDeleteModalOpen(false); setDeleteTarget(null); }}
                />
            </div>
        </div>
    );
}

function UserRow({ user, selected, onSelect, onSuspend, onUnsuspend, onDelete, onRecover, onPermanentDelete, onChangePlan, onMigrate, isMigrating, availableServers, onToggleProtection }: any) {
    const [showActions, setShowActions] = useState(false);
    const [isProtecting, setIsProtecting] = useState(false);

    const handleToggleProtection = async () => {
        setIsProtecting(true);
        try {
            await onToggleProtection(!user.isProtected);
        } finally {
            setIsProtecting(false);
        }
    };

    const getStatusBadge = () => {
        const badges = {
            active: 'bg-green-500/20 text-green-400 border-green-500/30',
            suspended: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            deleted: 'bg-red-500/20 text-red-400 border-red-500/30'
        };
        return badges[user.status as keyof typeof badges] || badges.active;
    };

    const getServerBadge = () => {
        if (!user.assignedServer) return null;
        // Cosmetic colors for known servers; any new server key gets the generic grey fallback
        const colors: Record<string, string> = {
            EC2: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
            EC3: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
            EC4: 'bg-green-500/20 text-green-400 border-green-500/30',
            EC5: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
        };
        return colors[user.assignedServer] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    };

    return (
        <div className="p-4 hover:bg-white/5 transition">
            <div className="flex items-start">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={onSelect}
                    className="mt-1 mr-4"
                />

                <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h3 className="text-white font-semibold">{user.email}</h3>
                            <p className="text-gray-400 text-sm">{user.displayName}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge()}`}>
                                {user.status}
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                {user.plan || 'free'}
                            </span>
                            {user.assignedServer && (
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getServerBadge()}`}>
                                    🖥️ {user.assignedServer}
                                </span>
                            )}
                            {user.isProtected && (
                                <span className="px-3 py-1 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1 shadow-lg shadow-blue-500/10">
                                    🛡️ PROTECTED
                                </span>
                            )}
                        </div>
                    </div>

                    {user.status === 'suspended' && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 mb-2">
                            <p className="text-yellow-400 text-sm">
                                <strong>Suspended:</strong> {user.suspensionReason}
                            </p>
                            <p className="text-gray-400 text-xs">
                                {new Date(user.suspendedAt!).toLocaleDateString()}
                            </p>
                        </div>
                    )}

                    {user.status === 'deleted' && user.recoveryDeadline && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded p-2 mb-2">
                            <p className="text-red-400 text-sm">
                                <strong>Deleted:</strong> Recovery deadline {new Date(user.recoveryDeadline).toLocaleDateString()}
                            </p>
                        </div>
                    )}

                    <div className="flex items-center space-x-2 mt-2">
                        {user.status === 'active' && (
                            <>
                                <button
                                    onClick={() => {
                                        const reason = prompt('Enter suspension reason:');
                                        if (reason) onSuspend(reason);
                                    }}
                                    className="text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-3 py-1 rounded border border-yellow-500/30 transition"
                                >
                                    Suspend
                                </button>
                                <select
                                    onChange={(e) => {
                                        if (e.target.value && confirm(`Change plan to ${e.target.value}?`)) {
                                            onChangePlan(e.target.value);
                                        }
                                        e.target.value = '';
                                    }}
                                    className="text-xs bg-purple-500/20 text-purple-400 px-3 py-1 rounded border border-purple-500/30"
                                >
                                    <option value="">Change Plan</option>
                                    <option value="free">Free</option>
                                    <option value="pro">Pro</option>
                                    <option value="enterprise">Enterprise</option>
                                </select>
                                <button
                                    onClick={handleToggleProtection}
                                    disabled={isProtecting}
                                    className={`text-xs px-3 py-1 rounded border transition font-bold ${user.isProtected
                                            ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/10'
                                            : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30'
                                        }`}
                                >
                                    {isProtecting ? '...' : user.isProtected ? 'UNPROTECT' : 'PROTECT'}
                                </button>
                                {/* Migrate Button — options loaded dynamically from DB */}
                                {user.assignedServer && availableServers.length > 1 && (
                                    <select
                                        onChange={(e) => {
                                            if (e.target.value) onMigrate(e.target.value);
                                            e.target.value = '';
                                        }}
                                        disabled={isMigrating}
                                        className={`text-xs bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded border border-cyan-500/30 ${isMigrating ? 'opacity-50 cursor-wait' : ''}`}
                                    >
                                        <option value="">{isMigrating ? '⏳ Migrating...' : '🚀 Migrate to...'}</option>
                                        {availableServers
                                            .filter((key: string) => key !== user.assignedServer)
                                            .map((key: string) => (
                                                <option key={key} value={key}>{key}</option>
                                            ))
                                        }
                                    </select>
                                )}
                                <button
                                    onClick={() => {
                                        if (confirm('Delete this user? (15-day recovery period)')) {
                                            onDelete();
                                        }
                                    }}
                                    className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1 rounded border border-red-500/30 transition"
                                >
                                    Delete
                                </button>
                            </>
                        )}

                        {user.status === 'suspended' && (
                            <>
                                <button
                                    onClick={() => {
                                        if (confirm('Unsuspend this user?')) {
                                            onUnsuspend();
                                        }
                                    }}
                                    className="text-xs bg-green-500/20 hover:bg-green-500/30 text-green-400 px-3 py-1 rounded border border-green-500/30 transition"
                                >
                                    Unsuspend
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm('Delete this user? (15-day recovery period)')) {
                                            onDelete();
                                        }
                                    }}
                                    className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1 rounded border border-red-500/30 transition"
                                >
                                    Delete
                                </button>
                            </>
                        )}

                        {user.status === 'deleted' && (
                            <>
                                <button
                                    onClick={() => {
                                        if (confirm('Recover this user account? Container will restart.')) {
                                            onRecover();
                                        }
                                    }}
                                    className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 py-1 rounded border border-blue-500/30 transition"
                                >
                                    Recover Account
                                </button>
                                <button
                                    onClick={onPermanentDelete}
                                    className="text-xs bg-red-700/30 hover:bg-red-700/50 text-red-300 px-3 py-1 rounded border border-red-600/40 transition font-bold"
                                >
                                    🗑️ Permanent Delete
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ConfirmDialog({ dialog, onConfirm, onCancel }: any) {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-white/20 rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-xl font-bold text-white mb-4">Confirm Action</h3>
                <p className="text-gray-300 mb-6">
                    Are you sure you want to delete {dialog.users.length} user(s)?
                </p>
                <div className="flex space-x-4">
                    <button
                        onClick={onCancel}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
                    >
                        Confirm Delete
                    </button>
                </div>
            </div>
        </div>
    );
}
