'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store';
import { useHasFeature } from '@/lib/features';
import toast from 'react-hot-toast';

interface Deployment {
    _id: string;
    status: 'queued' | 'building' | 'deploying' | 'success' | 'failed' | 'cancelled';
    commitSha: string;
    commitMessage: string;
    commitAuthor: {
        name: string;
        email: string;
    };
    deploymentUrl?: string;
    metadata?: { ownerKey?: string };
    trigger: 'manual' | 'webhook' | 'retry' | 'rollback';
    rollbackFrom?: string;
    createdAt: string;
    buildDuration?: number;
    deployDuration?: number;
}

export default function DeploymentsPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [loading, setLoading] = useState(true);
    const [rollbackTarget, setRollbackTarget] = useState<Deployment | null>(null);
    const [isRollingBack, setIsRollingBack] = useState(false);
    const hasRollbackFeature = useHasFeature('rollback');

    useEffect(() => {
        fetchDeployments();
    }, [params.id]);

    const fetchDeployments = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/projects/${params.id}/deployments?limit=50`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to fetch deployments');
            const data = await res.json();
            setDeployments(data.deployments || []);
        } catch (error) {
            console.error('Error fetching deployments:', error);
            toast.error('Failed to load deployments');
        } finally {
            setLoading(false);
        }
    };

    const handleRollback = async () => {
        if (!rollbackTarget) return;

        setIsRollingBack(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/deployments/${rollbackTarget._id}/rollback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.upgradeRequired) {
                    toast.error(data.error || 'Rollback feature not available in your plan');
                } else {
                    throw new Error(data.error || 'Rollback failed');
                }
                return;
            }

            toast.success('Rollback initiated successfully');
            setRollbackTarget(null);
            fetchDeployments();
            router.push(`/dashboard/projects/${params.id}/deployments/${data.deployment._id}`);
        } catch (error: any) {
            console.error('Rollback error:', error);
            toast.error(error.message || 'Failed to initiate rollback');
        } finally {
            setIsRollingBack(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'success': return 'text-green-400 bg-green-900/20 border-green-500/30';
            case 'failed': return 'text-red-400 bg-red-900/20 border-red-500/30';
            case 'building':
            case 'deploying': return 'text-blue-400 bg-blue-900/20 border-blue-500/30';
            case 'queued': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30';
            case 'cancelled': return 'text-gray-400 bg-gray-900/20 border-gray-500/30';
            default: return 'text-gray-400';
        }
    };

    const getTriggerIcon = (trigger: string) => {
        switch (trigger) {
            case 'webhook':
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                );
            case 'rollback':
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                );
            default:
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                );
        }
    };

    const formatDuration = (ms?: number) => {
        if (!ms) return 'N/A';
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Deployment History</h1>
                <p className="text-gray-400">View and manage your deployments</p>
            </div>

            {deployments.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
                    <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-white mb-2">No Deployments Yet</h3>
                    <p className="text-gray-400">Deploy your project to see deployment history here</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {deployments.map((deployment) => (
                        <div
                            key={deployment._id}
                            className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${getStatusColor(deployment.status)}`}>
                                            {deployment.status}
                                        </span>

                                        <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                                            {getTriggerIcon(deployment.trigger)}
                                            <span className="capitalize">{deployment.trigger}</span>
                                        </div>

                                        {deployment.rollbackFrom && (
                                            <span className="px-2 py-1 bg-blue-900/20 border border-blue-500/30 text-blue-300 text-xs rounded">
                                                Rollback
                                            </span>
                                        )}
                                    </div>

                                    <div className="mb-3">
                                        <h3 className="text-white font-medium mb-1">
                                            {deployment.commitMessage || 'No commit message'}
                                        </h3>
                                        <div className="flex items-center gap-4 text-sm text-gray-400">
                                            <span className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                                </svg>
                                                <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">
                                                    {deployment.commitSha?.substring(0, 7) || 'N/A'}
                                                </code>
                                            </span>
                                            {deployment.commitAuthor && (
                                                <span className="flex items-center gap-1.5">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                    {deployment.commitAuthor.name}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {new Date(deployment.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                    {(deployment.buildDuration || deployment.deployDuration) && (
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            {deployment.buildDuration && (
                                                <span>Build: {formatDuration(deployment.buildDuration)}</span>
                                            )}
                                            {deployment.deployDuration && (
                                                <span>Deploy: {formatDuration(deployment.deployDuration)}</span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {deployment.deploymentUrl && (
                                        <>
                                            <a
                                                href={deployment.deploymentUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                                Visit
                                            </a>
                                            {deployment.metadata?.ownerKey && (
                                                <a
                                                    href={`${deployment.deploymentUrl.replace(/\/?$/, '')}${deployment.deploymentUrl.includes('?') ? '&' : '?'}owner=${deployment.metadata.ownerKey}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition flex items-center gap-2"
                                                    title="Open setup / admin (sample data, config)"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    Setup
                                                </a>
                                            )}
                                        </>
                                    )}

                                    {deployment.status === 'success' && (
                                        <button
                                            onClick={() => setRollbackTarget(deployment)}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                            </svg>
                                            Rollback
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Rollback Confirmation Modal */}
            {rollbackTarget && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full p-6">
                        <h3 className="text-2xl font-bold text-white mb-4">Confirm Rollback</h3>

                        <div className="mb-6">
                            <p className="text-gray-300 mb-4">
                                Are you sure you want to rollback to this deployment?
                            </p>

                            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2">
                                <p className="text-sm text-gray-400">
                                    <span className="font-semibold text-white">Commit:</span> {rollbackTarget.commitMessage}
                                </p>
                                <p className="text-sm text-gray-400">
                                    <span className="font-semibold text-white">SHA:</span>{' '}
                                    <code className="bg-gray-700 px-1.5 py-0.5 rounded text-xs">
                                        {rollbackTarget.commitSha?.substring(0, 7)}
                                    </code>
                                </p>
                                <p className="text-sm text-gray-400">
                                    <span className="font-semibold text-white">Deployed:</span>{' '}
                                    {new Date(rollbackTarget.createdAt).toLocaleString()}
                                </p>
                            </div>

                            <div className="mt-4 bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                                <p className="text-sm text-blue-300">
                                    This will create a new deployment using the code from this commit.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setRollbackTarget(null)}
                                disabled={isRollingBack}
                                className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRollback}
                                disabled={isRollingBack}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {isRollingBack ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                        Rolling back...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                        Confirm Rollback
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
