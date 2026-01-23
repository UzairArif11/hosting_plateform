'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface PreviewDeployment {
    _id: string;
    branch: string;
    commitSHA: string;
    commitMessage: string;
    status: string;
    deploymentUrl?: string;
    createdAt: string;
    metadata?: {
        prNumber?: number;
        prTitle?: string;
        prUrl?: string;
    };
}

export default function PreviewsPage({ params }: { params: { id: string } }) {
    const [project, setProject] = useState<any>(null);
    const [previews, setPreviews] = useState<PreviewDeployment[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasFeature, setHasFeature] = useState(true);

    useEffect(() => {
        fetchPreviews();
    }, [params.id]);

    const fetchPreviews = async () => {
        try {
            const token = localStorage.getItem('token');

            // Fetch project
            const projectRes = await fetch(`/api/projects/${params.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!projectRes.ok) throw new Error('Failed to fetch project');
            const projectData = await projectRes.json();
            setProject(projectData);

            // Fetch preview deployments
            const res = await fetch(`/api/projects/${params.id}/deployments?preview=true`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.status === 403) {
                setHasFeature(false);
                setLoading(false);
                return;
            }

            if (!res.ok) throw new Error('Failed to fetch previews');

            const data = await res.json();
            setPreviews(data.deployments || []);
        } catch (error) {
            console.error('Error fetching previews:', error);
            toast.error('Failed to load preview deployments');
        } finally {
            setLoading(false);
        }
    };

    const handleCleanup = async (deploymentId: string) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/deployments/${deploymentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to cleanup preview');

            toast.success('Preview deployment cleaned up');
            fetchPreviews();
        } catch (error) {
            console.error('Cleanup error:', error);
            toast.error('Failed to cleanup preview');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'success': return 'bg-green-900/20 border-green-500/30 text-green-300';
            case 'building': return 'bg-blue-900/20 border-blue-500/30 text-blue-300';
            case 'failed': return 'bg-red-900/20 border-red-500/30 text-red-300';
            default: return 'bg-gray-800 border-gray-600 text-gray-300';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    if (!hasFeature) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-2xl p-12 text-center">
                    <svg className="w-20 h-20 text-purple-400 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h2 className="text-3xl font-bold text-white mb-4">Preview Deployments Unavailable</h2>
                    <p className="text-gray-300 text-lg mb-8">
                        Preview deployments are not available in your current plan.
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
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Preview Deployments</h1>
                <p className="text-gray-400">Automatic deployments for Pull Requests</p>
            </div>

            {/* Setup Instructions */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6 mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">🔧 Setup GitHub Webhook</h3>
                <p className="text-gray-300 text-sm mb-4">
                    To enable automatic preview deployments, add this webhook to your GitHub repository:
                </p>
                <div className="bg-gray-900 rounded-lg p-4 mb-4">
                    <p className="text-xs text-gray-400 mb-2">Payload URL:</p>
                    <code className="text-purple-400 font-mono text-sm">
                        {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/github
                    </code>
                </div>
                <div className="space-y-2 text-sm text-gray-300">
                    <p>• Content type: <code className="text-purple-400">application/json</code></p>
                    <p>• Events: <code className="text-purple-400">Pull requests</code></p>
                    <p>• Active: <code className="text-purple-400">✓</code></p>
                </div>
            </div>

            {/* Active Previews */}
            {previews.length > 0 ? (
                <div>
                    <h2 className="text-lg font-semibold text-white mb-4">Active Preview Deployments</h2>
                    <div className="space-y-4">
                        {previews.map((preview) => (
                            <div
                                key={preview._id}
                                className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-white font-medium text-lg">
                                                {preview.metadata?.prTitle || preview.commitMessage}
                                            </h3>
                                            {preview.metadata?.prNumber && (
                                                <span className="px-2 py-1 bg-purple-900/20 border border-purple-500/30 text-purple-300 text-xs rounded">
                                                    PR #{preview.metadata.prNumber}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-gray-400 text-sm mb-1">
                                            Branch: <code className="text-purple-400">{preview.branch}</code>
                                        </p>
                                        <p className="text-gray-400 text-sm">
                                            Commit: <code className="text-purple-400">{preview.commitSHA.substring(0, 7)}</code>
                                        </p>
                                    </div>
                                    <span className={`px-3 py-1.5 border rounded-lg text-sm font-medium ${getStatusColor(preview.status)}`}>
                                        {preview.status}
                                    </span>
                                </div>

                                {preview.deploymentUrl && preview.status === 'success' && (
                                    <div className="bg-gradient-to-r from-green-900/10 to-blue-900/10 border border-green-500/20 rounded-lg p-3 mb-4">
                                        <p className="text-sm text-gray-300 mb-2">🔗 Preview URL:</p>
                                        <a
                                            href={preview.deploymentUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:text-blue-300 font-mono text-sm break-all"
                                        >
                                            {preview.deploymentUrl}
                                        </a>
                                    </div>
                                )}

                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-500">
                                        Created {new Date(preview.createdAt).toLocaleString()}
                                    </p>
                                    <div className="flex gap-2">
                                        {preview.metadata?.prUrl && (
                                            <a
                                                href={preview.metadata.prUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition"
                                            >
                                                View PR
                                            </a>
                                        )}
                                        {preview.status === 'success' && (
                                            <button
                                                onClick={() => handleCleanup(preview._id)}
                                                className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/30 border border-red-500/30 text-red-300 text-sm rounded-lg transition"
                                            >
                                                Cleanup
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
                    <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-white mb-2">No Preview Deployments</h3>
                    <p className="text-gray-400">
                        Preview deployments will appear here when you open Pull Requests
                    </p>
                </div>
            )}
        </div>
    );
}
