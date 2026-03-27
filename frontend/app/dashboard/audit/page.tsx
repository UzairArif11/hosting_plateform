'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface AuditLog {
    _id: string;
    userId: {
        _id: string;
        email: string;
        displayName?: string;
        username?: string;
    };
    action: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(true);
    const [filter, setFilter] = useState<string>('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 50;

    useEffect(() => {
        fetchLogs();
    }, [page, filter]);

    const fetchLogs = async () => {
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(filter && { action: filter })
            });

            const res = await api.get(`/audit?${queryParams}`);
            setLogs(res.data.logs || []);
            setTotal(res.data.pagination?.total || 0);
        } catch (error: any) {
            if (error.response?.status === 403) {
                setHasAccess(false);
            } else {
                console.error('Error fetching audit logs:', error);
                toast.error('Failed to load audit logs');
            }
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        const headers = ['Date', 'User', 'Action', 'Resource', 'IP Address'];
        const rows = logs.map(log => [
            new Date(log.createdAt).toLocaleString(),
            log.userId?.email || 'Unknown',
            log.action,
            log.resourceType ? `${log.resourceType}/${log.resourceId}` : '-',
            log.ipAddress || '-'
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const getActionIcon = (action: string) => {
        if (action.includes('create')) {
            return (
                <div className="w-8 h-8 rounded-full bg-green-900/20 border border-green-500/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </div>
            );
        } else if (action.includes('delete')) {
            return (
                <div className="w-8 h-8 rounded-full bg-red-900/20 border border-red-500/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </div>
            );
        } else if (action.includes('update')) {
            return (
                <div className="w-8 h-8 rounded-full bg-blue-900/20 border border-blue-500/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </div>
            );
        } else if (action.includes('login')) {
            return (
                <div className="w-8 h-8 rounded-full bg-purple-900/20 border border-purple-500/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                </div>
            );
        }
        return (
            <div className="w-8 h-8 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
        );
    };

    const formatAction = (action: string) => {
        return action.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    if (!hasAccess) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-2xl p-12 text-center">
                    <svg className="w-20 h-20 text-purple-400 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <h2 className="text-3xl font-bold text-white mb-4">Audit Logs Unavailable</h2>
                    <p className="text-gray-300 text-lg mb-8">
                        Audit logs are not available in your current plan.
                    </p>
                    <button
                        onClick={() => window.location.href = '/dashboard/billing'}
                        className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition"
                    >
                        Upgrade Plan
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Audit Logs</h1>
                <p className="text-gray-400">Track all account activity and changes</p>
            </div>

            {/* Filters and Actions */}
            <div className="mb-6 flex flex-wrap items-center gap-4 justify-between">
                <div className="flex items-center gap-3">
                    <select
                        value={filter}
                        onChange={(e) => {
                            setFilter(e.target.value);
                            setPage(1);
                        }}
                        className="bg-gray-900 border border-gray-800 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="">All Actions</option>
                        <option value="login">Login</option>
                        <option value="logout">Logout</option>
                        <option value="project_create">Project Created</option>
                        <option value="project_update">Project Updated</option>
                        <option value="project_delete">Project Deleted</option>
                        <option value="deployment_create">Deployment Created</option>
                        <option value="deployment_rollback">Deployment Rollback</option>
                        <option value="settings_update">Settings Updated</option>
                        <option value="collaborator_add">Collaborator Added</option>
                        <option value="collaborator_remove">Collaborator Removed</option>
                    </select>

                    {filter && (
                        <button
                            onClick={() => {
                                setFilter('');
                                setPage(1);
                            }}
                            className="text-gray-400 hover:text-white text-sm"
                        >
                            Clear filter
                        </button>
                    )}
                </div>

                <button
                    onClick={exportToCSV}
                    disabled={logs.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                </button>
            </div>

            {/* Activity Timeline */}
            {logs.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
                    <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-white mb-2">No Activity</h3>
                    <p className="text-gray-400">No audit logs found for the selected filter</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {logs.map((log, index) => (
                        <div
                            key={log._id}
                            className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition"
                        >
                            <div className="flex items-start gap-4">
                                {getActionIcon(log.action)}

                                <div className="flex-1">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h3 className="text-white font-medium mb-1">
                                                {formatAction(log.action)}
                                            </h3>
                                            <div className="flex items-center gap-3 text-sm text-gray-400">
                                                <span className="flex items-center gap-1.5">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                    {log.userId?.displayName || log.userId?.username || log.userId?.email || 'Unknown'}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </span>
                                                {log.ipAddress && (
                                                    <span className="flex items-center gap-1.5">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                                        </svg>
                                                        {log.ipAddress}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {log.resourceType && (
                                        <div className="mt-2">
                                            <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                                                {log.resourceType}
                                            </span>
                                        </div>
                                    )}

                                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                                        <details className="mt-3">
                                            <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
                                                View details
                                            </summary>
                                            <pre className="mt-2 bg-gray-800/50 border border-gray-700 rounded p-3 text-xs text-gray-300 overflow-x-auto">
                                                {JSON.stringify(log.metadata, null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {total > limit && (
                <div className="mt-8 flex items-center justify-between">
                    <p className="text-sm text-gray-400">
                        Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} logs
                    </p>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(page - 1)}
                            disabled={page === 1}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(page + 1)}
                            disabled={page * limit >= total}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
