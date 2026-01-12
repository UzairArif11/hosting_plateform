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
    XMarkIcon,
    CheckIcon,
    ServerIcon,
    EyeIcon,
    SparklesIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Feature {
    name: string;
    description: string;
}

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
    resources: ResourceSet;
    displayResources?: ResourceSet;
    pricing: {
        usd: number;
        pkr: number;
        eur?: number;
        gbp?: number;
    };
    features?: Feature[];
    isTrial?: boolean;
    isActive: boolean;
    billingCycle?: string;
    oracleConfig?: {
        accountType: string;
    };
    activeUsers?: number;
}

export default function PlanManagement() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const res = await api.get('/admin/plans');
            setPlans(res.data.plans || []);
            setLoading(false);
        } catch (error) {
            toast.error('Failed to fetch plans');
            setLoading(false);
        }
    };

    const handleCreateNew = () => {
        setEditingPlan({
            _id: '',
            name: '',
            displayName: '',
            description: '',
            resources: { cpu: 0.5, ram: 0.5, storage: 10, bandwidth: 100, containers: 5, projects: 3 },
            displayResources: { cpu: 0.5, ram: 0.5, storage: 10, bandwidth: 100, containers: 5, projects: 3 },
            pricing: { usd: 0, pkr: 0, eur: 0, gbp: 0 },
            features: [],
            isTrial: false,
            isActive: true,
            billingCycle: 'monthly',
            oracleConfig: { accountType: 'shared' }
        } as Plan);
        setShowModal(true);
    };

    const handleEdit = (plan: Plan) => {
        setEditingPlan({
            ...plan,
            features: plan.features || [],
            pricing: {
                ...plan.pricing,
                eur: plan.pricing.eur || 0,
                gbp: plan.pricing.gbp || 0
            },
            billingCycle: plan.billingCycle || 'monthly',
            oracleConfig: plan.oracleConfig || { accountType: 'shared' }
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPlan) return;

        try {
            // Clone and clean payload
            const payload: any = {
                ...editingPlan,
                actualResources: editingPlan.resources // Compatibility
            };

            // Remove _id if it's empty (for new plans) to avoid Mongoose CastError
            if (!payload._id) {
                delete payload._id;
            }

            if (editingPlan._id) {
                await api.put(`/admin/plans/${editingPlan._id}`, payload);
                toast.success('Plan updated successfully');
            } else {
                await api.post('/admin/plans', payload);
                toast.success('Plan created successfully');
            }
            setShowModal(false);
            setEditingPlan(null);
            fetchPlans();
        } catch (error: any) {
            console.error('Plan submit error:', error);
            // Show specific backend error if available
            const msg = error.response?.data?.error || error.response?.data?.details || 'Operation failed';
            toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
        }
    };

    const handleDelete = async (planId: string, planName: string) => {
        if (!confirm(`Delete plan "${planName}"? This cannot be undone.`)) return;

        try {
            await api.delete(`/admin/plans/${planId}`);
            toast.success('Plan deleted');
            fetchPlans();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Delete failed');
        }
    };

    const addFeature = () => {
        if (!editingPlan) return;
        setEditingPlan({
            ...editingPlan,
            features: [...(editingPlan.features || []), { name: '', description: '' }]
        });
    };

    const removeFeature = (index: number) => {
        if (!editingPlan) return;
        const newFeatures = editingPlan.features?.filter((_, i) => i !== index) || [];
        setEditingPlan({ ...editingPlan, features: newFeatures });
    };

    const updateFeature = (index: number, field: 'name' | 'description', value: string) => {
        if (!editingPlan) return;
        const newFeatures = [...(editingPlan.features || [])];
        newFeatures[index][field] = value;
        setEditingPlan({ ...editingPlan, features: newFeatures });
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
                    <p className="text-gray-400 mt-2">Create and manage subscription plans with all features</p>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl transition shadow-lg"
                >
                    <PlusIcon className="h-5 w-5" />
                    <span>Create New Plan</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {plans.map((plan) => (
                    <div
                        key={plan._id}
                        className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all"
                    >
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold text-white">{plan.displayName}</h3>
                                    <p className="text-sm text-gray-500 font-mono">slug: {plan.name}</p>
                                    {plan.isTrial && (
                                        <span className="inline-block mt-2 px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded">
                                            Trial Plan
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-2xl font-bold text-purple-400">${plan.pricing.usd}</span>
                                    <span className="text-xs text-gray-400">/{plan.billingCycle || 'monthly'}</span>
                                </div>
                            </div>

                            <p className="text-gray-400 text-sm line-clamp-2">{plan.description}</p>

                            {plan.activeUsers !== undefined && (
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                    <p className="text-sm text-blue-400">
                                        <span className="font-bold">{plan.activeUsers}</span> active users
                                    </p>
                                </div>
                            )}

                            <div className="pt-4 border-t border-gray-800">
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-black/20 p-2 rounded">
                                        <p className="text-xs text-gray-500">CPU</p>
                                        <p className="text-sm font-bold text-white">{plan.resources.cpu}</p>
                                    </div>
                                    <div className="bg-black/20 p-2 rounded">
                                        <p className="text-xs text-gray-500">RAM</p>
                                        <p className="text-sm font-bold text-white">{plan.resources.ram}GB</p>
                                    </div>
                                    <div className="bg-black/20 p-2 rounded">
                                        <p className="text-xs text-gray-500">Storage</p>
                                        <p className="text-sm font-bold text-white">{plan.resources.storage}GB</p>
                                    </div>
                                </div>
                            </div>

                            {plan.features && plan.features.length > 0 && (
                                <div className="pt-2">
                                    <p className="text-xs text-gray-500 uppercase mb-2">Features</p>
                                    <ul className="space-y-1">
                                        {plan.features.slice(0, 3).map((feature, i) => (
                                            <li key={i} className="flex items-start text-sm text-gray-400">
                                                <CheckIcon className="h-4 w-4 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                                                <span>{feature.name}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-800/50 p-4 flex justify-between gap-3">
                            <button
                                onClick={() => handleEdit(plan)}
                                className="flex-1 flex items-center justify-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
                            >
                                <PencilSquareIcon className="h-4 w-4" />
                                <span>Edit</span>
                            </button>
                            <button
                                onClick={() => handleDelete(plan._id, plan.displayName)}
                                className="flex items-center justify-center space-x-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 px-4 py-2 rounded-lg transition"
                            >
                                <TrashIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && editingPlan && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold text-white">
                                    {editingPlan._id ? 'Edit Plan' : 'Create New Plan'}
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="text-gray-400 hover:text-white"
                                >
                                    <XMarkIcon className="h-6 w-6" />
                                </button>
                            </div>

                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Plan Name (Slug) *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={editingPlan.name}
                                        onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                        placeholder="e.g., free, pro, enterprise"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Display Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={editingPlan.displayName}
                                        onChange={(e) => setEditingPlan({ ...editingPlan, displayName: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                        placeholder="e.g., Professional Plan"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
                                <textarea
                                    required
                                    value={editingPlan.description}
                                    onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    rows={3}
                                    placeholder="Plan description..."
                                />
                            </div>

                            {/* Pricing */}
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-3">Pricing</h3>
                                <div className="grid grid-cols-4 gap-4">
                                    {['usd', 'pkr', 'eur', 'gbp'].map(currency => (
                                        <div key={currency}>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {currency.toUpperCase()} {currency === 'usd' || currency === 'pkr' ? '*' : ''}
                                            </label>
                                            <input
                                                type="number"
                                                required={currency === 'usd' || currency === 'pkr'}
                                                value={editingPlan.pricing[currency as keyof typeof editingPlan.pricing] || 0}
                                                onChange={(e) => setEditingPlan({
                                                    ...editingPlan,
                                                    pricing: { ...editingPlan.pricing, [currency]: parseFloat(e.target.value) || 0 }
                                                })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                                step="0.01"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Resources */}
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-3">Resources (Enforced Limits)</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-300 mb-2">CPU (OCPU) *</label>
                                        <input
                                            type="number"
                                            required
                                            value={editingPlan.resources.cpu}
                                            onChange={(e) => setEditingPlan({
                                                ...editingPlan,
                                                resources: { ...editingPlan.resources, cpu: parseFloat(e.target.value) }
                                            })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                            step="0.1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-300 mb-2">RAM (GB) *</label>
                                        <input
                                            type="number"
                                            required
                                            value={editingPlan.resources.ram}
                                            onChange={(e) => setEditingPlan({
                                                ...editingPlan,
                                                resources: { ...editingPlan.resources, ram: parseFloat(e.target.value) }
                                            })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                            step="0.1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-300 mb-2">Storage (GB) *</label>
                                        <input
                                            type="number"
                                            required
                                            value={editingPlan.resources.storage}
                                            onChange={(e) => setEditingPlan({
                                                ...editingPlan,
                                                resources: { ...editingPlan.resources, storage: parseFloat(e.target.value) }
                                            })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-300 mb-2">Bandwidth (GB/mo) *</label>
                                        <input
                                            type="number"
                                            required
                                            value={editingPlan.resources.bandwidth}
                                            onChange={(e) => setEditingPlan({
                                                ...editingPlan,
                                                resources: { ...editingPlan.resources, bandwidth: parseFloat(e.target.value) }
                                            })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-300 mb-2">Max Containers *</label>
                                        <input
                                            type="number"
                                            required
                                            value={editingPlan.resources.containers}
                                            onChange={(e) => setEditingPlan({
                                                ...editingPlan,
                                                resources: { ...editingPlan.resources, containers: parseInt(e.target.value) }
                                            })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-300 mb-2">Max Projects *</label>
                                        <input
                                            type="number"
                                            required
                                            value={editingPlan.resources.projects}
                                            onChange={(e) => setEditingPlan({
                                                ...editingPlan,
                                                resources: { ...editingPlan.resources, projects: parseInt(e.target.value) }
                                            })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Display Resources (Marketing) */}
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-3">
                                    Display Resources (What Users See)
                                    <span className="block text-xs text-gray-400 font-normal mt-1">
                                        These are shown to users in pricing pages - can be different from actual limits
                                    </span>
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-300 mb-2">Display CPU</label>
                                        <input
                                            type="number"
                                            value={editingPlan.displayResources?.cpu ?? editingPlan.resources.cpu}
                                            onChange={(e) => setEditingPlan({
                                                ...editingPlan,
                                                displayResources: {
                                                    ...(editingPlan.displayResources || editingPlan.resources),
                                                    cpu: parseFloat(e.target.value)
                                                }
                                            })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                            step="0.1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-300 mb-2">Display RAM (GB)</label>
                                        <input
                                            type="number"
                                            value={editingPlan.displayResources?.ram ?? editingPlan.resources.ram}
                                            onChange={(e) => setEditingPlan({
                                                ...editingPlan,
                                                displayResources: {
                                                    ...(editingPlan.displayResources || editingPlan.resources),
                                                    ram: parseFloat(e.target.value)
                                                }
                                            })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                            step="0.1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-300 mb-2">Display Storage (GB)</label>
                                        <input
                                            type="number"
                                            value={editingPlan.displayResources?.storage ?? editingPlan.resources.storage}
                                            onChange={(e) => setEditingPlan({
                                                ...editingPlan,
                                                displayResources: {
                                                    ...(editingPlan.displayResources || editingPlan.resources),
                                                    storage: parseFloat(e.target.value)
                                                }
                                            })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-300 mb-2">Display Bandwidth</label>
                                        <input
                                            type="number"
                                            value={editingPlan.displayResources?.bandwidth ?? editingPlan.resources.bandwidth}
                                            onChange={(e) => setEditingPlan({
                                                ...editingPlan,
                                                displayResources: {
                                                    ...(editingPlan.displayResources || editingPlan.resources),
                                                    bandwidth: parseFloat(e.target.value)
                                                }
                                            })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-300 mb-2">Display Containers</label>
                                        <input
                                            type="number"
                                            value={editingPlan.displayResources?.containers ?? editingPlan.resources.containers}
                                            onChange={(e) => setEditingPlan({
                                                ...editingPlan,
                                                displayResources: {
                                                    ...(editingPlan.displayResources || editingPlan.resources),
                                                    containers: parseInt(e.target.value)
                                                }
                                            })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-300 mb-2">Display Projects</label>
                                        <input
                                            type="number"
                                            value={editingPlan.displayResources?.projects ?? editingPlan.resources.projects}
                                            onChange={(e) => setEditingPlan({
                                                ...editingPlan,
                                                displayResources: {
                                                    ...(editingPlan.displayResources || editingPlan.resources),
                                                    projects: parseInt(e.target.value)
                                                }
                                            })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-blue-400 mt-3">
                                    💡 Example: Actual=1.5GB RAM, Display=2GB RAM (marketing overselling)
                                </p>
                            </div>

                            {/* Features */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-lg font-semibold text-white">Features</h3>
                                    <button
                                        type="button"
                                        onClick={addFeature}
                                        className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        Add Feature
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {editingPlan.features?.map((feature, index) => (
                                        <div key={index} className="flex gap-2 items-start bg-gray-800/50 p-3 rounded-lg">
                                            <div className="flex-1 grid grid-cols-2 gap-2">
                                                <input
                                                    type="text"
                                                    value={feature.name}
                                                    onChange={(e) => updateFeature(index, 'name', e.target.value)}
                                                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                                    placeholder="Feature name"
                                                />
                                                <input
                                                    type="text"
                                                    value={feature.description}
                                                    onChange={(e) => updateFeature(index, 'description', e.target.value)}
                                                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                                    placeholder="Description"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeFeature(index)}
                                                className="text-red-400 hover:text-red-300 p-2"
                                            >
                                                <XMarkIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Settings */}
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-3">Settings</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Billing Cycle *</label>
                                        <select
                                            value={editingPlan.billingCycle}
                                            onChange={(e) => setEditingPlan({ ...editingPlan, billingCycle: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                        >
                                            <option value="monthly">Monthly</option>
                                            <option value="yearly">Yearly</option>
                                            <option value="one-time">One-time</option>
                                        </select>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Note: Every user gets their own isolated Docker container with PM2, regardless of plan.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editingPlan.isTrial}
                                        onChange={(e) => setEditingPlan({ ...editingPlan, isTrial: e.target.checked })}
                                        className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-700 rounded"
                                    />
                                    <span className="text-sm text-gray-300">Trial Plan</span>
                                </label>
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editingPlan.isActive}
                                        onChange={(e) => setEditingPlan({ ...editingPlan, isActive: e.target.checked })}
                                        className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-700 rounded"
                                    />
                                    <span className="text-sm text-gray-300">Active</span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                                >
                                    {editingPlan._id ? 'Update Plan' : 'Create Plan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
