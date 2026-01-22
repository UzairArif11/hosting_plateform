'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface Deployment {
    _id: string;
    status: string;
    commitMessage: string;
    createdAt: string;
    trigger: string;
    branch: string;
}

interface DeploymentListProps {
    deployments: Deployment[];
    onRollback: () => void;
    /** When false, Rollback button is hidden. Default true for backward compatibility. */
    canRollback?: boolean;
}

export default function DeploymentList({ deployments, onRollback, canRollback = true }: DeploymentListProps) {
    const [rolling, setRolling] = useState<string | null>(null);

    const handleRollback = async (deploymentId: string) => {
        if (!confirm('Rollback to this deployment? This will create a new deployment.')) return;

        setRolling(deploymentId);
        try {
            const res = await fetch(`/api/deployments/${deploymentId}/rollback`, {
                method: 'POST'
            });

            const data = await res.json();

            if (data.success) {
                toast.success('Rollback initiated!');
                onRollback(); // Refresh list
            } else {
                toast.error(data.error || 'Rollback failed');
            }
        } catch (error) {
            toast.error('Network error');
        } finally {
            setRolling(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'success': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'building': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'queued': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    return (
        <div className="space-y-2">
            {deployments.map((deployment) => (
                <div
                    key={deployment._id}
                    className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex items-center justify-between hover:border-gray-600 transition-colors"
                >
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <span className={`px-2 py-1 rounded text-xs font-bold border uppercase ${getStatusColor(deployment.status)}`}>
                                {deployment.status}
                            </span>
                            {deployment.trigger === 'rollback' && (
                                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs font-bold rounded border border-purple-500/30">
                                    ROLLBACK
                                </span>
                            )}
                            <span className="text-sm text-gray-500">
                                {deployment.branch}
                            </span>
                        </div>
                        <div className="text-sm text-gray-300 mb-1">
                            {deployment.commitMessage || 'No commit message'}
                        </div>
                        <div className="text-xs text-gray-500">
                            {new Date(deployment.createdAt).toLocaleString()}
                        </div>
                    </div>

                    {canRollback && deployment.status === 'success' && deployment.trigger !== 'rollback' && (
                        <button
                            onClick={() => handleRollback(deployment._id)}
                            disabled={rolling === deployment._id}
                            className="ml-4 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-purple-400 border border-gray-700 hover:border-purple-500 rounded-lg text-sm transition-colors disabled:opacity-50"
                        >
                            {rolling === deployment._id ? 'Rolling back...' : '↩ Rollback'}
                        </button>
                    )}
                </div>
            ))}

            {deployments.length === 0 && (
                <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700 border-dashed">
                    <p className="text-gray-400">No deployments yet</p>
                </div>
            )}
        </div>
    );
}
