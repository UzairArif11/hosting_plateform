'use client';

import { useEffect, useState } from 'react';
import { CheckCircleIcon, XCircleIcon, ClockIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

interface Deployment {
    _id: string;
    status: string;
    createdAt: string;
    completedAt?: string;
    deploymentUrl?: string;
    error?: string;
    branch?: string;
    commitMessage?: string;
}

interface DeploymentHistoryProps {
    projectId: string;
}

export default function DeploymentHistory({ projectId }: DeploymentHistoryProps) {
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDeployments();
    }, [projectId]);

    const loadDeployments = async () => {
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/deployments/project/${projectId}?limit=20`,
                { credentials: 'include' }
            );

            if (response.ok) {
                const data = await response.json();
                setDeployments(data.deployments || []);
            }
        } catch (error) {
            console.error('Failed to load deployments:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success':
                return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
            case 'failed':
                return <XCircleIcon className="w-5 h-5 text-red-500" />;
            case 'building':
            case 'deploying':
                return <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />;
            default:
                return <ClockIcon className="w-5 h-5 text-gray-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'success': return 'text-green-400';
            case 'failed': return 'text-red-400';
            case 'building':
            case 'deploying': return 'text-blue-400';
            default: return 'text-gray-400';
        }
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString();
    };

    const calculateDuration = (created: string, completed?: string) => {
        if (!completed) return null;
        const diff = new Date(completed).getTime() - new Date(created).getTime();
        const seconds = Math.floor(diff / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    if (loading) {
        return (
            <div className="bg-gray-900 rounded-lg p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-700 rounded w-1/4"></div>
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-16 bg-gray-800 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">
                    Deployment History
                </h3>
                <button
                    onClick={loadDeployments}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                    Refresh
                </button>
            </div>

            {deployments.length === 0 ? (
                <div className="text-center py-8">
                    <ClockIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No deployments yet</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {deployments.map((deployment) => (
                        <div
                            key={deployment._id}
                            className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-3 flex-1">
                                    {getStatusIcon(deployment.status)}

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2">
                                            <span className={`font-medium capitalize ${getStatusColor(deployment.status)}`}>
                                                {deployment.status}
                                            </span>
                                            {deployment.branch && (
                                                <span className="text-xs text-gray-500">
                                                    ({deployment.branch})
                                                </span>
                                            )}
                                        </div>

                                        {deployment.commitMessage && (
                                            <p className="text-sm text-gray-400 mt-1 truncate">
                                                {deployment.commitMessage}
                                            </p>
                                        )}

                                        <p className="text-xs text-gray-500 mt-1">
                                            {formatDate(deployment.createdAt)}
                                        </p>

                                        {deployment.deploymentUrl && (
                                            <a
                                                href={deployment.deploymentUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-blue-400 hover:text-blue-300 mt-2 inline-block truncate max-w-full"
                                            >
                                                {deployment.deploymentUrl}
                                            </a>
                                        )}

                                        {deployment.error && (
                                            <p className="text-sm text-red-400 mt-2">
                                                {deployment.error}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="text-right ml-4">
                                    {deployment.completedAt && (
                                        <p className="text-xs text-gray-500">
                                            {calculateDuration(deployment.createdAt, deployment.completedAt)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
