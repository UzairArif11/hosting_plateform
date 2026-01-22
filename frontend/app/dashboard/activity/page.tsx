'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
    ShieldCheckIcon,
    ClockIcon,
    ComputerDesktopIcon,
    MapPinIcon
} from '@heroicons/react/24/outline';

export default function AuditLogsPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        fetchLogs();
    }, [page]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/audit?page=${page}&limit=20`);
            if (res.data.success) {
                setLogs(res.data.logs);
                setTotalPages(Math.ceil(res.data.pagination.total / 20));
            }
        } catch (error) {
            console.error('Failed to fetch audit logs', error);
        } finally {
            setLoading(false);
        }
    };

    const getActionColor = (action: string) => {
        if (action.includes('delete') || action.includes('remove')) return 'text-red-400';
        if (action.includes('create') || action.includes('add')) return 'text-green-400';
        if (action.includes('update') || action.includes('change')) return 'text-yellow-400';
        return 'text-gray-400';
    };

    const getActionIcon = (action: string) => {
        if (action.includes('login') || action.includes('logout')) return '🔐';
        if (action.includes('deployment')) return '🚀';
        if (action.includes('project')) return '📁';
        if (action.includes('domain')) return '🌐';
        if (action.includes('member') || action.includes('team')) return '👥';
        return '📝';
    };

    const formatAction = (action: string) => {
        return action.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    return (
        <div className="max-w-6xl mx-auto p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ShieldCheckIcon className="h-7 w-7 text-purple-500" />
                        Audit Logs
                    </h1>
                    <p className="text-gray-400 mt-1">Track all actions performed on your account</p>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
                </div>
            ) : (
                <>
                    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-800/50 border-b border-gray-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Action</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Resource</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Details</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">IP Address</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {logs.length > 0 ? logs.map((log: any) => (
                                        <tr key={log._id} className="hover:bg-gray-700/30 transition">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">{getActionIcon(log.action)}</span>
                                                    <span className={`font-medium ${getActionColor(log.action)}`}>
                                                        {formatAction(log.action)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm">
                                                    <div className="text-gray-300">{log.resourceType}</div>
                                                    {log.resourceName && (
                                                        <div className="text-gray-500 text-xs truncate max-w-xs">{log.resourceName}</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm text-gray-400 max-w-md truncate">
                                                    {log.status === 'failure' && (
                                                        <span className="text-red-400">❌ {log.errorMessage || 'Failed'}</span>
                                                    )}
                                                    {log.status === 'success' && (
                                                        <span className="text-green-400">✅ Success</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-1 text-sm text-gray-400">
                                                    <MapPinIcon className="h-4 w-4" />
                                                    <span className="font-mono text-xs">{log.ip}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-1 text-sm text-gray-400">
                                                    <ClockIcon className="h-4 w-4" />
                                                    <span className="text-xs">
                                                        {new Date(log.createdAt).toLocaleString()}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                                                No audit logs found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition"
                            >
                                Previous
                            </button>
                            <span className="text-gray-400">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
