'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
    CpuChipIcon,
    Square3Stack3DIcon,
    CircleStackIcon,
    ArrowPathIcon,
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    ArrowPathRoundedSquareIcon,
    EyeIcon,
    ServerIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface ResourceSet {
    cpu: number;
    ram: number;
    storage: number;
    bandwidth: number;
    containers: number;
    projects: number;
}

interface Plan {
    _id: string;
    name: string;
    displayName: string;
    description: string;
    resources: ResourceSet;        // Actual
    displayResources: ResourceSet; // Marketing
    actualResources?: ResourceSet; // Backwards compatibility alias
    pricing: {
        usd: number;
        pkr: number;
    };
    isActive: boolean;
    isDefault: boolean;
    userCount: number;
}

export default function PlanManagement() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [isSyncing, setIsSyncing] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'actual' | 'display'>('actual');

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const res = await api.get('/api/admin/plans');
            setPlans(res.data.plans || []);
            setLoading(false);
        } catch (error) {
            toast.error('Failed to fetch plans');
            setLoading(false);
        }
    };

    const handleSync = async (planId: string) => {
        if (!confirm('This will recreate containers for ALL users on this plan to apply new ACTUAL resource limits. Continue?')) {
            return;
        }

        setIsSyncing(planId);
        try {
            const res = await api.post(`/api/admin/plans/${planId}/sync`);
            toast.success(res.data.message);
        } catch (error) {
            toast.error('Sync failed');
        } finally {
            setIsSyncing(null);
        }
    };

    const handleUpdatePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPlan) return;

        try {
            // Ensure actualResources matches resources for schema compatibility
            const payload = {
                ...editingPlan,
                actualResources: editingPlan.resources
            };

            if (editingPlan._id) {
                await api.put(`/api/admin/plans/${editingPlan._id}`, payload);
                toast.success('Plan updated successfully');
            } else {
                await api.post('/api/admin/plans', payload);
                toast.success('Plan created successfully');
            }
            setEditingPlan(null);
            fetchPlans();
        } catch (error) {
            toast.error(editingPlan._id ? 'Update failed' : 'Create failed');
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
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-white">Plan Management</h1>
                    <p className="text-gray-400 mt-2">Configure marketing (Display) and enforced (Actual) resources</p>
                </div>
                <button
                    onClick={() => setEditingPlan({
                        _id: '',
                        name: '',
                        displayName: '',
                        description: '',
                        resources: { cpu: 0.5, ram: 0.5, storage: 10, bandwidth: 100, containers: 5, projects: 3 },
                        displayResources: { cpu: 0.5, ram: 0.5, storage: 10, bandwidth: 100, containers: 5, projects: 3 },
                        pricing: { usd: 0, pkr: 0 },
                        isActive: true,
                        isDefault: false,
                        userCount: 0
                    } as Plan)}
                    className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl transition shadow-lg shadow-purple-500/20"
                >
                    <PlusIcon className="h-5 w-5" />
                    <span>Create New Plan</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {plans.map((plan) => (
                    <div
                        key={plan._id}
                        className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all group"
                    >
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold text-white">{plan.displayName}</h3>
                                    <p className="text-sm text-gray-500 font-mono">slug: {plan.name}</p>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-2xl font-bold text-purple-400">${plan.pricing.usd}</span>
                                    <span className="text-xs text-gray-400">/per month</span>
                                </div>
                            </div>

                            <p className="text-gray-400 text-sm line-clamp-2">{plan.description}</p>

                            <div className="pt-4 border-t border-gray-800 space-y-4">
                                <div>
                                    <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <ServerIcon className="h-3 w-3" /> Actual Limits (Enforced)
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-black/20 p-2 rounded">
                                            <p className="text-xs text-gray-500">CPU</p>
                                            <p className="text-sm font-bold text-white">{plan.resources.cpu} OCPU</p>
                                        </div>
                                        <div className="bg-black/20 p-2 rounded">
                                            <p className="text-xs text-gray-500">RAM</p>
                                            <p className="text-sm font-bold text-white">{plan.resources.ram} GB</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <EyeIcon className="h-3 w-3" /> Display Limits (Marketing)
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-blue-900/10 p-2 rounded">
                                            <p className="text-xs text-blue-400">Displayed CPU</p>
                                            <p className="text-sm font-bold text-blue-200">{plan.displayResources?.cpu || plan.resources.cpu} OCPU</p>
                                        </div>
                                        <div className="bg-blue-900/10 p-2 rounded">
                                            <p className="text-xs text-blue-400">Displayed RAM</p>
                                            <p className="text-sm font-bold text-blue-200">{plan.displayResources?.ram || plan.resources.ram} GB</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-800/50 p-4 flex justify-between gap-3">
                            <button
                                onClick={() => setEditingPlan(plan)}
                                className="flex-1 flex items-center justify-center space-x-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition"
                            >
                                <PencilSquareIcon className="h-4 w-4" />
                                <span>Edit</span>
                            </button>
                            <button
                                onClick={() => handleSync(plan._id)}
                                disabled={isSyncing === plan._id}
                                className={`flex-1 flex items-center justify-center space-x-2 ${isSyncing === plan._id ? 'bg-purple-900/50 text-gray-400' : 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-400'
                                    } px-4 py-2 rounded-lg border border-purple-500/30 transition shadow-inner`}
                            >
                                <ArrowPathRoundedSquareIcon className={`h-4 w-4 ${isSyncing === plan._id ? 'animate-spin' : ''}`} />
                                <span>{isSyncing === plan._id ? 'Syncing...' : 'Sync Users'}</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit Modal */}
            {editingPlan && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-2xl shadow-2xl my-8">
                        <div className="p-8 space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold text-white">Edit Plan: {editingPlan.displayName}</h2>
                                <button onClick={() => setEditingPlan(null)} className="text-gray-400 hover:text-white text-3xl">×</button>
                            </div>

                            <form onSubmit={handleUpdatePlan} className="space-y-6">
                                {/* Basic Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm text-gray-400">Plan Name (slug)</label>
                                        <input
                                            type="text"
                                            value={editingPlan.name}
                                            onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                                            disabled={!!editingPlan._id}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm text-gray-400">Display Name</label>
                                        <input
                                            type="text"
                                            value={editingPlan.displayName}
                                            onChange={(e) => setEditingPlan({ ...editingPlan, displayName: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm text-gray-400">Price (USD)</label>
                                        <input
                                            type="number"
                                            value={editingPlan.pricing.usd}
                                            onChange={(e) => setEditingPlan({ ...editingPlan, pricing: { ...editingPlan.pricing, usd: parseFloat(e.target.value) } })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-gray-800"></div>

                                {/* Resource Tabs */}
                                <div>
                                    <div className="flex space-x-1 bg-gray-800 p-1 rounded-xl mb-6">
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('actual')}
                                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'actual' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            <ServerIcon className="h-4 w-4 inline mr-2" />
                                            Actual Resources (Enforced)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('display')}
                                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'display' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            <EyeIcon className="h-4 w-4 inline mr-2" />
                                            Display Resources (Marketing)
                                        </button>
                                    </div>

                                    {activeTab === 'actual' ? (
                                        <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                                            <div className="space-y-2">
                                                <label className="text-sm text-purple-300 font-bold">Actual CPU (OCPU)</label>
                                                <input
                                                    type="number" step="0.1"
                                                    value={editingPlan.resources.cpu}
                                                    onChange={(e) => setEditingPlan({ ...editingPlan, resources: { ...editingPlan.resources, cpu: parseFloat(e.target.value) } })}
                                                    className="w-full bg-gray-800 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm text-purple-300 font-bold">Actual RAM (GB)</label>
                                                <input
                                                    type="number" step="0.1"
                                                    value={editingPlan.resources.ram}
                                                    onChange={(e) => setEditingPlan({ ...editingPlan, resources: { ...editingPlan.resources, ram: parseFloat(e.target.value) } })}
                                                    className="w-full bg-gray-800 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm text-purple-300 font-bold">Storage (GB)</label>
                                                <input
                                                    type="number"
                                                    value={editingPlan.resources.storage}
                                                    onChange={(e) => setEditingPlan({ ...editingPlan, resources: { ...editingPlan.resources, storage: parseFloat(e.target.value) } })}
                                                    className="w-full bg-gray-800 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm text-purple-300 font-bold">Max Containers</label>
                                                <input
                                                    type="number"
                                                    value={editingPlan.resources.containers}
                                                    onChange={(e) => setEditingPlan({ ...editingPlan, resources: { ...editingPlan.resources, containers: parseInt(e.target.value) } })}
                                                    className="w-full bg-gray-800 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                                            <div className="space-y-2">
                                                <label className="text-sm text-blue-300 font-bold">Display CPU Label</label>
                                                <input
                                                    type="number" step="0.1"
                                                    value={editingPlan.displayResources?.cpu || editingPlan.resources.cpu}
                                                    onChange={(e) => setEditingPlan({ ...editingPlan, displayResources: { ...(editingPlan.displayResources || editingPlan.resources), cpu: parseFloat(e.target.value) } })}
                                                    className="w-full bg-gray-800 border border-blue-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm text-blue-300 font-bold">Display RAM Label</label>
                                                <input
                                                    type="number" step="0.1"
                                                    value={editingPlan.displayResources?.ram || editingPlan.resources.ram}
                                                    onChange={(e) => setEditingPlan({ ...editingPlan, displayResources: { ...(editingPlan.displayResources || editingPlan.resources), ram: parseFloat(e.target.value) } })}
                                                    className="w-full bg-gray-800 border border-blue-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="col-span-2 text-xs text-gray-500 italic p-2 bg-blue-900/10 rounded">
                                                These values are shown to the user in the dashboard & billing but do not affect container limits.
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm text-gray-400">Description</label>
                                    <textarea
                                        rows={3}
                                        value={editingPlan.description}
                                        onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                <div className="flex gap-4 pt-4 border-t border-gray-800">
                                    <button
                                        type="button"
                                        onClick={() => setEditingPlan(null)}
                                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-6 py-4 rounded-xl font-bold transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-xl font-bold transition shadow-lg shadow-purple-500/20"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
