'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface CleanupStats {
    suspended: number;
    softDeleted: number;
    suspendedOver7Days: number;
    pastRecoveryDeadline: number;
    totalResourcesCanFree: {
        users: number;
        estimatedProjects: number;
        estimatedDeployments: number;
        estimatedContainers: number;
    };
}

export default function ResourceCleanup() {
    const [stats, setStats] = useState<CleanupStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [showConfirm, setShowConfirm] = useState<string | null>(null);
    const [confirmText, setConfirmText] = useState('');
    const [result, setResult] = useState<any>(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error('No authentication token found');
                setLoading(false);
                return;
            }

            const res = await fetch('/api/admin/users/cleanup-stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                throw new Error('Failed to fetch cleanup stats');
            }

            const data = await res.json();
            setStats(data);
            setLoading(false);
        } catch (error: any) {
            console.error('Failed to fetch stats:', error);
            toast.error(error.message || 'Failed to load cleanup statistics');
            setLoading(false);
        }
    };

    const handleDeleteAllSuspended = async () => {
        if (confirmText !== 'DELETE ALL SUSPENDED') {
            toast.error('Please type the confirmation text exactly');
            return;
        }

        setProcessing(true);
        setShowConfirm(null);
        setConfirmText('');

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/users/delete-all-suspended', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ confirm: 'DELETE ALL SUSPENDED' })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete suspended users');
            }

            const data = await res.json();
            setResult(data);
            toast.success(`Successfully deleted ${data.results?.deleted || 0} users`);
            setProcessing(false);
            fetchStats();
        } catch (error: any) {
            toast.error(error.message || 'Error deleting suspended users');
            setProcessing(false);
        }
    };

    const handleDeleteAllSoftDeleted = async () => {
        if (confirmText !== 'DELETE ALL SOFT DELETED') {
            toast.error('Please type the confirmation text exactly');
            return;
        }

        setProcessing(true);
        setShowConfirm(null);
        setConfirmText('');

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/users/delete-all-soft-deleted', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ confirm: 'DELETE ALL SOFT DELETED' })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete soft-deleted users');
            }

            const data = await res.json();
            setResult(data);
            toast.success(`Successfully deleted ${data.results?.deleted || 0} users`);
            setProcessing(false);
            fetchStats();
        } catch (error: any) {
            toast.error(error.message || 'Error deleting soft-deleted users');
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading cleanup statistics...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">🗑️ Resource Cleanup</h1>
                    <p className="text-gray-300">Free server resources by cleaning up inactive accounts</p>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        title="Suspended Users"
                        value={stats?.suspended || 0}
                        icon="⚠️"
                        color="yellow"
                    />
                    <StatCard
                        title="Soft-Deleted Users"
                        value={stats?.softDeleted || 0}
                        icon="🗑️"
                        color="red"
                    />
                    <StatCard
                        title="Suspended > 7 Days"
                        value={stats?.suspendedOver7Days || 0}
                        icon="⏰"
                        color="orange"
                    />
                    <StatCard
                        title="Past Recovery Deadline"
                        value={stats?.pastRecoveryDeadline || 0}
                        icon="⚰️"
                        color="gray"
                    />
                </div>

                {/* Resources Can Be Freed */}
                <div className="bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-green-500/30 rounded-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-4">📊 Resources That Can Be Freed</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-green-400">
                                {stats?.totalResourcesCanFree.users || 0}
                            </div>
                            <div className="text-gray-300">Users</div>
                        </div>
                        <div className="text-center">
                            <div className="text-4xl font-bold text-blue-400">
                                {stats?.totalResourcesCanFree.estimatedProjects || 0}
                            </div>
                            <div className="text-gray-300">Projects</div>
                        </div>
                        <div className="text-center">
                            <div className="text-4xl font-bold text-purple-400">
                                {stats?.totalResourcesCanFree.estimatedDeployments || 0}
                            </div>
                            <div className="text-gray-300">Deployments</div>
                        </div>
                        <div className="text-center">
                            <div className="text-4xl font-bold text-yellow-400">
                                {stats?.totalResourcesCanFree.estimatedContainers || 0}
                            </div>
                            <div className="text-gray-300">Containers</div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Delete All Suspended */}
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
                        <div className="flex items-start mb-4">
                            <span className="text-4xl mr-4">⚠️</span>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-1">Delete All Suspended Users</h3>
                                <p className="text-gray-400 text-sm">
                                    Permanently delete {stats?.suspended || 0} suspended users and free server resources
                                </p>
                            </div>
                        </div>

                        {stats && stats.suspended > 0 ? (
                            <>
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 mb-4">
                                    <p className="text-yellow-400 text-sm">
                                        ⚠️ This will permanently delete {stats.suspended} users and cannot be undone!
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowConfirm('suspended')}
                                    disabled={processing}
                                    className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold px-6 py-3 rounded-lg transition"
                                >
                                    {processing ? 'Processing...' : 'Delete All Suspended'}
                                </button>
                            </>
                        ) : (
                            <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                                <p className="text-green-400 text-sm">
                                    ✅ No suspended users to clean up
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Delete All Soft-Deleted */}
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
                        <div className="flex items-start mb-4">
                            <span className="text-4xl mr-4">🗑️</span>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-1">Delete All Soft-Deleted Users</h3>
                                <p className="text-gray-400 text-sm">
                                    Permanently delete {stats?.softDeleted || 0} soft-deleted users (skip recovery period)
                                </p>
                            </div>
                        </div>

                        {stats && stats.softDeleted > 0 ? (
                            <>
                                <div className="bg-red-500/10 border border-red-500/30 rounded p-3 mb-4">
                                    <p className="text-red-400 text-sm">
                                        ⚠️ This will skip the 15-day recovery period! Users cannot recover their accounts!
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowConfirm('soft-deleted')}
                                    disabled={processing}
                                    className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition"
                                >
                                    {processing ? 'Processing...' : 'Delete All Soft-Deleted'}
                                </button>
                            </>
                        ) : (
                            <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                                <p className="text-green-400 text-sm">
                                    ✅ No soft-deleted users to clean up
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Result */}
                {result && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 mb-8">
                        <h3 className="text-2xl font-bold text-green-400 mb-4">✅ Cleanup Complete!</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                                <div className="text-2xl font-bold text-white">{result.results?.deleted || 0}</div>
                                <div className="text-gray-300 text-sm">Users Deleted</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">
                                    {result.results?.details?.reduce((sum: number, d: any) => sum + d.projects, 0) || 0}
                                </div>
                                <div className="text-gray-300 text-sm">Projects Removed</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">
                                    {result.results?.details?.reduce((sum: number, d: any) => sum + d.deployments, 0) || 0}
                                </div>
                                <div className="text-gray-300 text-sm">Deployments Removed</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">
                                    {result.results?.details?.reduce((sum: number, d: any) => sum + d.containers, 0) || 0}
                                </div>
                                <div className="text-gray-300 text-sm">Containers Freed</div>
                            </div>
                        </div>
                        <p className="text-green-400">
                            🎉 EC2/EC3 servers now have more space for new users!
                        </p>
                        <button
                            onClick={() => setResult(null)}
                            className="mt-4 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition"
                        >
                            Close
                        </button>
                    </div>
                )}

                {/* Refresh Button */}
                <div className="text-center">
                    <button
                        onClick={fetchStats}
                        disabled={loading}
                        className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition"
                    >
                        {loading ? 'Loading...' : '🔄 Refresh Statistics'}
                    </button>
                </div>

                {/* Confirmation Dialog */}
                {showConfirm && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-gray-900 border border-white/20 rounded-lg p-6 max-w-md w-full mx-4">
                            <h3 className="text-2xl font-bold text-white mb-4">⚠️ Confirm Bulk Deletion</h3>

                            {showConfirm === 'suspended' && (
                                <>
                                    <p className="text-gray-300 mb-4">
                                        You are about to PERMANENTLY DELETE:
                                    </p>
                                    <ul className="text-gray-300 mb-4 space-y-1">
                                        <li>• {stats?.suspended} suspended users</li>
                                        <li>• ~{stats?.totalResourcesCanFree.estimatedProjects} projects</li>
                                        <li>• ~{stats?.totalResourcesCanFree.estimatedDeployments} deployments</li>
                                        <li>• ~{stats?.totalResourcesCanFree.estimatedContainers} containers</li>
                                    </ul>
                                    <div className="bg-red-500/10 border border-red-500/30 rounded p-3 mb-4">
                                        <p className="text-red-400 text-sm">
                                            ⚠️ THIS ACTION CANNOT BE UNDONE!
                                        </p>
                                    </div>
                                    <p className="text-gray-300 mb-2">
                                        Type <strong className="text-yellow-400">DELETE ALL SUSPENDED</strong> to confirm:
                                    </p>
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={(e) => setConfirmText(e.target.value)}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white mb-4"
                                        placeholder="DELETE ALL SUSPENDED"
                                    />
                                    <div className="flex space-x-4">
                                        <button
                                            onClick={() => {
                                                setShowConfirm(null);
                                                setConfirmText('');
                                            }}
                                            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleDeleteAllSuspended}
                                            disabled={confirmText !== 'DELETE ALL SUSPENDED' || processing}
                                            className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold px-4 py-2 rounded-lg transition"
                                        >
                                            {processing ? 'Deleting...' : 'Confirm Deletion'}
                                        </button>
                                    </div>
                                </>
                            )}

                            {showConfirm === 'soft-deleted' && (
                                <>
                                    <p className="text-gray-300 mb-4">
                                        You are about to PERMANENTLY DELETE:
                                    </p>
                                    <ul className="text-gray-300 mb-4 space-y-1">
                                        <li>• {stats?.softDeleted} soft-deleted users</li>
                                        <li>• Skip 15-day recovery period</li>
                                        <li>• Users CANNOT recover their accounts</li>
                                    </ul>
                                    <div className="bg-red-500/10 border border-red-500/30 rounded p-3 mb-4">
                                        <p className="text-red-400 text-sm">
                                            ⚠️ THIS ACTION CANNOT BE UNDONE!
                                        </p>
                                    </div>
                                    <p className="text-gray-300 mb-2">
                                        Type <strong className="text-red-400">DELETE ALL SOFT DELETED</strong> to confirm:
                                    </p>
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={(e) => setConfirmText(e.target.value)}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white mb-4"
                                        placeholder="DELETE ALL SOFT DELETED"
                                    />
                                    <div className="flex space-x-4">
                                        <button
                                            onClick={() => {
                                                setShowConfirm(null);
                                                setConfirmText('');
                                            }}
                                            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleDeleteAllSoftDeleted}
                                            disabled={confirmText !== 'DELETE ALL SOFT DELETED' || processing}
                                            className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg transition"
                                        >
                                            {processing ? 'Deleting...' : 'Confirm Deletion'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color }: any) {
    const colors: any = {
        yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
        red: 'from-red-500/20 to-red-600/20 border-red-500/30',
        orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30',
        gray: 'from-gray-500/20 to-gray-600/20 border-gray-500/30'
    };

    return (
        <div className={`bg-gradient-to-br ${colors[color]} border rounded-lg p-6`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">{icon}</span>
                <span className="text-4xl font-bold text-white">{value}</span>
            </div>
            <h3 className="text-gray-300 font-medium">{title}</h3>
        </div>
    );
}
