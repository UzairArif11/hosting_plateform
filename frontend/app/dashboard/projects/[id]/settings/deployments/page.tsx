'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Branch {
    name: string;
    commit: {
        sha: string;
        url: string;
    };
}

export default function DeploymentSettings({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [project, setProject] = useState<any>(null);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [autoDeployEnabled, setAutoDeployEnabled] = useState(false);
    const [productionBranch, setProductionBranch] = useState('main');

    useEffect(() => {
        fetchProjectAndBranches();
    }, [params.id]);

    const fetchProjectAndBranches = async () => {
        try {
            const res = await api.get(`/projects/${params.id}`);
            setProject(res.data.project);
            setAutoDeployEnabled(res.data.project?.autoDeployEnabled || false);
            setProductionBranch(res.data.project?.repository?.branch || 'main');

            // Fetch branches from GitHub
            try {
                const branchesRes = await api.get(`/projects/${params.id}/branches`);
                setBranches(branchesRes.data.branches || []);
            } catch { /* branches fetch may fail if no repo connected */ }

            setLoading(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load project settings');
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put(`/projects/${params.id}`, {
                autoDeployEnabled,
                repository: {
                    ...project.repository,
                    branch: productionBranch
                }
            });
            toast.success('Deployment settings updated successfully');
            fetchProjectAndBranches();
        } catch (error: any) {
            console.error('Error saving settings:', error);
            toast.error(error.response?.data?.error || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Deployment Settings</h1>
                <p className="text-gray-400">Configure automatic deployment behavior</p>
            </div>

            <div className="space-y-6">
                {/* Auto-Deploy Toggle */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-2">
                                Auto-Deploy
                            </h3>
                            <p className="text-gray-400 text-sm mb-4">
                                Automatically deploy when you push to your production branch
                            </p>

                            {autoDeployEnabled && (
                                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-green-300 text-sm font-medium">
                                            Active - Deployments will trigger automatically on push to <code className="bg-green-900/40 px-1.5 py-0.5 rounded">{productionBranch}</code>
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setAutoDeployEnabled(!autoDeployEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoDeployEnabled ? 'bg-purple-600' : 'bg-gray-700'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoDeployEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Production Branch Selector */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">
                        Production Branch
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                        Select which branch triggers automatic deployments
                    </p>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">
                            Branch
                        </label>
                        <select
                            value={productionBranch}
                            onChange={(e) => setProductionBranch(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                            {branches.length > 0 ? (
                                branches.map((branch) => (
                                    <option key={branch.name} value={branch.name}>
                                        {branch.name}
                                    </option>
                                ))
                            ) : (
                                <>
                                    <option value="main">main</option>
                                    <option value="master">master</option>
                                    <option value="production">production</option>
                                    <option value="develop">develop</option>
                                </>
                            )}
                        </select>

                        <p className="text-xs text-gray-500 mt-2">
                            Pushes to other branches will not trigger automatic deployments
                        </p>
                    </div>
                </div>

                {/* Deploy Hooks (Future) */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 opacity-50">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-white">
                            Deploy Hooks
                        </h3>
                        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">
                            Coming Soon
                        </span>
                    </div>
                    <p className="text-gray-400 text-sm">
                        Manually trigger deployments via webhook URL
                    </p>
                </div>

                {/* Save Button */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                    <button
                        onClick={() => router.push(`/dashboard/projects/${params.id}`)}
                        className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
