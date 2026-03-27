'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/lib/hooks';
import { fetchDeployments } from '@/lib/slices/deploymentsSlice';
import {
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';

export default function DeploymentsPage() {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { deployments, loading, error } = useAppSelector((state) => state.deployments);
    const { user } = useAppSelector((state) => state.auth);

    useEffect(() => {
        if (user) {
            // Fetch all deployments for the user (no projectId = all deployments)
            dispatch(fetchDeployments());
        }
    }, [dispatch, user]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success':
                return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
            case 'failed':
                return <XCircleIcon className="h-5 w-5 text-red-500" />;
            case 'building':
            case 'deploying':
                return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />;
            default:
                return <ClockIcon className="h-5 w-5 text-gray-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'success':
                return 'bg-green-500/10 text-green-400';
            case 'failed':
                return 'bg-red-500/10 text-red-400';
            case 'building':
            case 'deploying':
                return 'bg-blue-500/10 text-blue-400';
            default:
                return 'bg-gray-700 text-gray-300';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400">Error loading deployments: {error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Deployments</h1>
            </div>

            {deployments.length === 0 ? (
                <div className="bg-gray-800 rounded-lg shadow p-8 text-center">
                    <p className="text-gray-400">No deployments yet</p>
                </div>
            ) : (
                <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Project
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Branch
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Created
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {deployments.map((deployment) => (
                                <tr key={deployment._id} className="hover:bg-gray-700">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-white">
                                            {(() => {
                                                const project = deployment.projectId;
                                                if (typeof project === 'object' && project !== null && 'name' in project) {
                                                    return (project as { name: string }).name;
                                                }
                                                return 'Unknown';
                                            })()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(deployment.status)}`}>
                                            {getStatusIcon(deployment.status)}
                                            {deployment.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                        {deployment.branch}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                        {new Date(deployment.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button
                                            onClick={() => router.push(`/dashboard/deployments/${deployment._id}`)}
                                            className="text-blue-400 hover:text-blue-300"
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

