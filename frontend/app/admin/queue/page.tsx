'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
    ClockIcon,
    CheckCircleIcon,
    ArrowPathIcon,
    QueueListIcon,
    BoltIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface QueueJob {
    id: string;
    deploymentId: string;
    projectId: string;
    userId: string;
    priority?: number;
    progress?: number;
    timestamp: string;
    attemptsMade?: number;
}

interface QueueStats {
    stats: {
        total?: number;
        completed?: number;
        failed?: number;
        waiting?: number;
        active?: number;
    };
    active: QueueJob[];
    waiting: QueueJob[];
}

export default function DeploymentQueuePage() {
    const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);

    useEffect(() => {
        fetchQueueStats();

        if (autoRefresh) {
            const interval = setInterval(fetchQueueStats, 5000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh]);

    const fetchQueueStats = async () => {
        try {
            const res = await api.get('/api/admin/deployment-queue/stats');
            setQueueStats(res.data.queue);
            setLoading(false);
        } catch (error: any) {
            if (loading) {
                toast.error('Failed to fetch queue stats');
            }
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    const totalJobs = queueStats?.stats?.total || 0;
    const activeCount = queueStats?.active?.length || 0;
    const waitingCount = queueStats?.waiting?.length || 0;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-white">Deployment Queue</h1>
                    <p className="text-gray-400 mt-2">Monitor active and waiting deployments</p>
                </div>
                <div className="flex gap-3">
                    <label className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-lg">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="w-4 h-4"
                        />
                        <span className="text-sm text-white">Auto-refresh (5s)</span>
                    </label>
                    <button
                        onClick={fetchQueueStats}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition"
                    >
                        <ArrowPathIcon className="h-4 w-4" />
                        Refresh Now
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-400">Total Jobs</p>
                            <p className="text-3xl font-bold text-white mt-1">{totalJobs}</p>
                        </div>
                        <QueueListIcon className="h-10 w-10 text-gray-600" />
                    </div>
                </div>

                <div className="bg-gray-900/50 border border-green-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-400">Active</p>
                            <p className="text-3xl font-bold text-green-400 mt-1">{activeCount}</p>
                        </div>
                        <BoltIcon className="h-10 w-10 text-green-400/50" />
                    </div>
                </div>

                <div className="bg-gray-900/50 border border-yellow-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-400">Waiting</p>
                            <p className="text-3xl font-bold text-yellow-400 mt-1">{waitingCount}</p>
                        </div>
                        <ClockIcon className="h-10 w-10 text-yellow-400/50" />
                    </div>
                </div>

                <div className="bg-gray-900/50 border border-blue-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-400">Completed</p>
                            <p className="text-3xl font-bold text-blue-400 mt-1">{queueStats?.stats?.completed || 0}</p>
                        </div>
                        <CheckCircleIcon className="h-10 w-10 text-blue-400/50" />
                    </div>
                </div>
            </div>

            {/* Active Deployments */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <BoltIcon className="h-6 w-6 text-green-400" />
                        Active Deployments
                        <span className="text-sm font-normal text-gray-400 ml-2">({activeCount})</span>
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    {activeCount > 0 ? (
                        <table className="w-full">
                            <thead className="bg-gray-800/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                        Job ID
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                        Deployment
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                        Project
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                        User
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                        Progress
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                        Attempts
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {queueStats?.active.map((job) => (
                                    <tr key={job.id} className="hover:bg-gray-800/30">
                                        <td className="px-6 py-4">
                                            <code className="text-xs text-gray-400 font-mono">{job.id.substring(0, 12)}</code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-sm text-white font-mono">
                                                {job.deploymentId.substring(0, 8)}...
                                            </code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-sm text-purple-400 font-mono">
                                                {job.projectId.substring(0, 8)}...
                                            </code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-sm text-blue-400 font-mono">
                                                {job.userId.substring(0, 8)}...
                                            </code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-green-500 transition-all"
                                                        style={{ width: `${job.progress || 0}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm text-white">{job.progress || 0}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-gray-400">{job.attemptsMade || 1}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="px-6 py-12 text-center text-gray-500">
                            No active deployments
                        </div>
                    )}
                </div>
            </div>

            {/* Waiting Deployments */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <ClockIcon className="h-6 w-6 text-yellow-400" />
                        Waiting in Queue
                        <span className="text-sm font-normal text-gray-400 ml-2">({waitingCount})</span>
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    {waitingCount > 0 ? (
                        <table className="w-full">
                            <thead className="bg-gray-800/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                        Job ID
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                        Deployment
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                        Project
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                        User
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                        Priority
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                                        Queued At
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {queueStats?.waiting.map((job) => (
                                    <tr key={job.id} className="hover:bg-gray-800/30">
                                        <td className="px-6 py-4">
                                            <code className="text-xs text-gray-400 font-mono">{job.id.substring(0, 12)}</code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-sm text-white font-mono">
                                                {job.deploymentId.substring(0, 8)}...
                                            </code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-sm text-purple-400 font-mono">
                                                {job.projectId.substring(0, 8)}...
                                            </code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-sm text-blue-400 font-mono">
                                                {job.userId.substring(0, 8)}...
                                            </code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-2 py-1 rounded-full text-xs font-semibold ${(job.priority || 10) <= 5
                                                        ? 'bg-purple-500/20 text-purple-400'
                                                        : 'bg-gray-500/20 text-gray-400'
                                                    }`}
                                            >
                                                Priority {job.priority || 10}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-gray-400">
                                                {new Date(job.timestamp).toLocaleTimeString()}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="px-6 py-12 text-center text-gray-500">
                            No deployments waiting in queue
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
