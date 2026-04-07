'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { fetchProject } from '@/lib/slices/projectsSlice';
import { AppDispatch } from '@/lib/store';
import api from '@/lib/api';

interface Project {
    _id: string;
    name: string;
    repository?: {
        branch?: string;
    };
    autoDeployEnabled?: boolean;
}

interface DeploymentSettingsProps {
    project: Project;
}

export default function DeploymentSettings({ project }: DeploymentSettingsProps) {
    const dispatch = useDispatch<AppDispatch>();
    const [branches, setBranches] = useState<string[]>([]);
    const [loadingBranches, setLoadingBranches] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchBranches();
    }, [project._id]);

    const fetchBranches = async () => {
        setLoadingBranches(true);
        setError(null);
        try {
            const res = await api.get(`/projects/${project._id}/branches`);

            if (res.data.success) {
                setBranches(res.data.branches || []);
            } else {
                console.warn('Failed to fetch branches:', res.data.error);
                if (res.data.error?.includes('GitHub connection required')) {
                    setError('Please reconnect GitHub to fetch branches');
                }
            }
        } catch (err: any) {
            console.error('Error fetching branches:', err);
            if (err.response?.data?.error?.includes('GitHub connection required')) {
                setError('Please reconnect GitHub to fetch branches');
            }
        } finally {
            setLoadingBranches(false);
        }
    };

    const updateSettings = async (updates: Partial<any>) => {
        setUpdating(true);
        try {
            const res = await api.put(`/projects/${project._id}`, updates);

            if (res.data.success) {
                toast.success('Deployment settings updated');
                dispatch(fetchProject(project._id));
            } else {
                toast.error(res.data.error || 'Failed to update settings');
                if (res.data.upgradeRequired) {
                    toast('This feature requires an upgrade', { icon: '💎' });
                }
            }
        } catch (err: any) {
            if (err.response?.data?.upgradeRequired) {
                toast('This feature requires an upgrade', { icon: '💎' });
            }
            toast.error(err.response?.data?.error || 'Failed to update settings');
        } finally {
            setUpdating(false);
        }
    };

    const isAutoDeployEnabled = project.autoDeployEnabled === true;
    const currentBranch = project.repository?.branch || 'main';

    return (
        <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-6">Continuous Deployment</h3>

                {error && (
                    <div className="mb-4 bg-red-900/20 border border-red-900 text-red-200 px-4 py-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {/* Auto-Deploy Toggle */}
                <div className="flex items-center justify-between py-4 border-b border-gray-800">
                    <div>
                        <h4 className="text-white font-medium">Auto-Deploy on Push</h4>
                        <p className="text-sm text-gray-400 mt-1">
                            Automatically deploy when you push commits to the production branch.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isAutoDeployEnabled}
                            onChange={(e) => updateSettings({ autoDeployEnabled: e.target.checked })}
                            disabled={updating}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                </div>

                {/* Production Branch Selector */}
                <div className="py-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Production Branch
                    </label>
                    <div className="flex gap-4">
                        <div className="relative flex-1">
                            {loadingBranches ? (
                                <div className="absolute inset-y-0 right-3 flex items-center">
                                    <div className="animate-spin h-4 w-4 border-2 border-purple-500 rounded-full border-t-transparent"></div>
                                </div>
                            ) : null}

                            {branches.length > 0 ? (
                                <select
                                    value={currentBranch}
                                    onChange={(e) => updateSettings({ 'repository.branch': e.target.value })}
                                    disabled={updating}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white appearance-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                >
                                    {branches.map(branch => (
                                        <option key={branch} value={branch}>{branch}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={currentBranch}
                                    onChange={(e) => {/* Handle manual input if branches fetch fails? For now rely on select */ }}
                                    disabled
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white opacity-60 cursor-not-allowed"
                                />
                            )}
                            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">
                                {!loadingBranches && (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                )}
                            </div>
                        </div>

                        {branches.length === 0 && !loadingBranches && (
                            <button
                                onClick={fetchBranches}
                                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-white text-sm transition-colors"
                            >
                                Refresh
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        Pushing to this branch will trigger a production deployment.
                        {branches.length > 0 && !loadingBranches && !branches.includes(currentBranch) && (
                            <span className="text-yellow-500 ml-1">
                                ⚠ Current branch '{currentBranch}' not found in repository.
                            </span>
                        )}
                    </p>
                </div>

                {/* Webhook Status */}
                <div className="py-4 border-t border-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-white font-medium">Webhook Configuration</h4>
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-green-900/30 text-green-400 border border-green-900/50">
                            Active
                        </span>
                    </div>
                    <div className="bg-black/30 rounded p-3 font-mono text-xs text-gray-400 break-all border border-gray-800">
                        https://{typeof window !== 'undefined' ? window.location.hostname : 'yourplatform.site'}/api/webhooks/github
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        Events are processed automatically. Check deployment logs for activity.
                    </p>
                </div>
            </div>
        </div>
    );
}
