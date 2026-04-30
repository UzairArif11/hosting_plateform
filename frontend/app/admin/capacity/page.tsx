'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
    CpuChipIcon,
    ServerIcon,
    CircleStackIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    CalculatorIcon,
    PencilSquareIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface ResourceSet {
    cpu: number;
    ram: number;
    storage: number;
    bandwidth: number;
}

interface ServerCapacity {
    serverName: string;
    totalResources: ResourceSet;
    reservedResources: ResourceSet;
    allocatedResources: ResourceSet;
    availableResources: ResourceSet;
    usagePercentage: {
        cpu: string;
        ram: string;
        storage: string;
        bandwidth: string;
    };
    planLimits: {
        planName: string;
        maxUsers: number;
        currentUsers: number;
        priority: number;
    }[];
    overselling: {
        enabled: boolean;
        cpuMultiplier: number;
        ramMultiplier: number;
    };
    warningThresholds: {
        cpu: number;
        ram: number;
        storage: number;
    };
    warnings: {
        type: string;
        level: string;
        message: string;
    }[];
    currentPlanCounts: {
        _id: string;
        count: number;
    }[];
}

export default function CapacityManagementPage() {
    const [availableServers, setAvailableServers] = useState<string[]>([]);
    const [selectedServer, setSelectedServer] = useState<string>('');
    const [capacity, setCapacity] = useState<ServerCapacity | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingResources, setEditingResources] = useState(false);
    const [editingOverselling, setEditingOverselling] = useState(false);
    const [resourceForm, setResourceForm] = useState<Partial<ServerCapacity>>({});
    const [planLimitForm, setPlanLimitForm] = useState({ planName: '', maxUsers: 0, priority: 5 });

    // Fetch available servers on mount
    useEffect(() => {
        const fetchServers = async () => {
            try {
                const res = await api.get('/admin/servers');
                // Backend /admin/servers already excludes api_main nodes — pull the keys directly.
                const serverKeys = (res.data.servers || []).map((s: any) => s.serverKey);
                setAvailableServers(serverKeys);
                if (serverKeys.length > 0 && !selectedServer) {
                    setSelectedServer(serverKeys[0]);
                }
            } catch (error) {
                console.error('Failed to fetch servers', error);
            }
        };
        fetchServers();
    }, []);

    useEffect(() => {
        if (selectedServer) fetchCapacity();
    }, [selectedServer]);

    const fetchCapacity = async () => {
        try {
            const res = await api.get(`/admin/servers/${selectedServer}/capacity`);
            setCapacity(res.data.capacity);
            setResourceForm({
                totalResources: res.data.capacity.totalResources,
                reservedResources: res.data.capacity.reservedResources,
                warningThresholds: res.data.capacity.warningThresholds,
                overselling: res.data.capacity.overselling
            });
            setLoading(false);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to fetch capacity');
            setLoading(false);
        }
    };

    const handleUpdateResources = async () => {
        try {
            await api.put(`/admin/servers/${selectedServer}/capacity/resources`, {
                totalResources: resourceForm.totalResources,
                reservedResources: resourceForm.reservedResources,
                warningThresholds: resourceForm.warningThresholds,
                overselling: resourceForm.overselling
            });
            toast.success('Server resources updated');
            setEditingResources(false);
            setEditingOverselling(false);
            fetchCapacity();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to update resources');
        }
    };

    const handleUpdatePlanLimit = async () => {
        if (!planLimitForm.planName) {
            toast.error('Please enter a plan name');
            return;
        }

        try {
            await api.put(`/admin/servers/${selectedServer}/capacity/plan-limits`, {
                planName: planLimitForm.planName,
                maxUsers: planLimitForm.maxUsers,
                priority: planLimitForm.priority
            });
            toast.success(`Plan limit updated for ${planLimitForm.planName}`);
            setPlanLimitForm({ planName: '', maxUsers: 0, priority: 5 });
            fetchCapacity();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to update plan limit');
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
                    <h1 className="text-4xl font-bold text-white">Capacity Management</h1>
                    <p className="text-gray-400 mt-2">Manage server resources and plan limits</p>
                </div>
                <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
                    {availableServers.map((key: string) => (
                        <button
                            key={key}
                            onClick={() => setSelectedServer(key)}
                            className={`px-6 py-2 rounded-md text-sm font-bold transition ${selectedServer === key ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            {key}
                        </button>
                    ))}
                </div>
            </div>

            {capacity && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Resource Usage Card */}
                    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <ServerIcon className="h-6 w-6 text-purple-400" />
                                Resource Usage
                            </h2>
                            <button
                                onClick={() => setEditingResources(!editingResources)}
                                className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
                            >
                                {editingResources ? <XMarkIcon className="h-4 w-4" /> : <PencilSquareIcon className="h-4 w-4" />}
                                {editingResources ? 'Cancel' : 'Edit'}
                            </button>
                        </div>

                        {/* CPU */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">CPU</span>
                                <span className="text-white font-mono">{capacity.usagePercentage?.cpu || '0'}%</span>
                            </div>
                            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all ${parseFloat(capacity.usagePercentage?.cpu || '0') > capacity.warningThresholds.cpu
                                        ? 'bg-red-500'
                                        : 'bg-blue-500'
                                        }`}
                                    style={{ width: `${capacity.usagePercentage?.cpu || '0'}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>{capacity.allocatedResources.cpu.toFixed(2)} / {capacity.totalResources.cpu} OCPU</span>
                                <span>Available: {capacity.availableResources.cpu.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* RAM */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">RAM</span>
                                <span className="text-white font-mono">{capacity.usagePercentage?.ram || '0'}%</span>
                            </div>
                            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all ${parseFloat(capacity.usagePercentage?.ram || '0') > capacity.warningThresholds.ram
                                        ? 'bg-red-500'
                                        : 'bg-purple-500'
                                        }`}
                                    style={{ width: `${capacity.usagePercentage?.ram || '0'}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>{capacity.allocatedResources.ram.toFixed(2)} / {capacity.totalResources.ram} GB</span>
                                <span>Available: {capacity.availableResources.ram.toFixed(2)} GB</span>
                            </div>
                        </div>

                        {/* Storage */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Storage</span>
                                <span className="text-white font-mono">{capacity.usagePercentage?.storage || '0'}%</span>
                            </div>
                            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all ${parseFloat(capacity.usagePercentage?.storage || '0') > capacity.warningThresholds.storage
                                        ? 'bg-red-500'
                                        : 'bg-green-500'
                                        }`}
                                    style={{ width: `${capacity.usagePercentage?.storage || '0'}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>{capacity.allocatedResources.storage.toFixed(0)} / {capacity.totalResources.storage} GB</span>
                                <span>Available: {capacity.availableResources.storage.toFixed(0)} GB</span>
                            </div>
                        </div>

                        {capacity.warnings.length > 0 && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-2">
                                {capacity.warnings.map((warning, i) => (
                                    <div key={i} className="flex items-center gap-2 text-red-400 text-sm">
                                        <ExclamationTriangleIcon className="h-4 w-4" />
                                        <span>{warning.message}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Edit Resources Form */}
                    {editingResources && resourceForm && (
                        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 space-y-4">
                            <h2 className="text-xl font-bold text-white">Edit Server Resources</h2>

                            <div>
                                <h3 className="text-sm font-semibold text-gray-400 mb-3">Total Resources</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {['cpu', 'ram', 'storage', 'bandwidth'].map(key => (
                                        <div key={key}>
                                            <label className="block text-xs text-gray-400 mb-1 capitalize">{key}</label>
                                            <input
                                                type="number"
                                                value={resourceForm.totalResources?.[key as keyof ResourceSet] || 0}
                                                onChange={(e) => setResourceForm({
                                                    ...resourceForm,
                                                    totalResources: {
                                                        ...resourceForm.totalResources!,
                                                        [key]: parseFloat(e.target.value) || 0
                                                    }
                                                })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                                                step="0.1"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold text-gray-400 mb-3">Reserved Resources</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {['cpu', 'ram', 'storage', 'bandwidth'].map(key => (
                                        <div key={key}>
                                            <label className="block text-xs text-gray-400 mb-1 capitalize">{key}</label>
                                            <input
                                                type="number"
                                                value={resourceForm.reservedResources?.[key as keyof ResourceSet] || 0}
                                                onChange={(e) => setResourceForm({
                                                    ...resourceForm,
                                                    reservedResources: {
                                                        ...resourceForm.reservedResources!,
                                                        [key]: parseFloat(e.target.value) || 0
                                                    }
                                                })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                                                step="0.1"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold text-gray-400 mb-3">Warning Thresholds (%)</h3>
                                <div className="grid grid-cols-3 gap-3">
                                    {['cpu', 'ram', 'storage'].map(key => (
                                        <div key={key}>
                                            <label className="block text-xs text-gray-400 mb-1 capitalize">{key}</label>
                                            <input
                                                type="number"
                                                value={resourceForm.warningThresholds?.[key as keyof typeof resourceForm.warningThresholds]}
                                                onChange={(e) => setResourceForm({
                                                    ...resourceForm,
                                                    warningThresholds: {
                                                        ...resourceForm.warningThresholds!,
                                                        [key]: parseInt(e.target.value) || 0
                                                    }
                                                })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold text-gray-400 mb-3">Overselling</h3>
                                <label className="flex items-center gap-2 mb-3">
                                    <input
                                        type="checkbox"
                                        checked={resourceForm.overselling?.enabled}
                                        onChange={(e) => setResourceForm({
                                            ...resourceForm,
                                            overselling: {
                                                ...resourceForm.overselling!,
                                                enabled: e.target.checked
                                            }
                                        })}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm text-white">Enable Overselling</span>
                                </label>
                                {resourceForm.overselling?.enabled && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">CPU Multiplier</label>
                                            <input
                                                type="number"
                                                value={resourceForm.overselling.cpuMultiplier}
                                                onChange={(e) => setResourceForm({
                                                    ...resourceForm,
                                                    overselling: {
                                                        ...resourceForm.overselling!,
                                                        cpuMultiplier: parseFloat(e.target.value) || 1
                                                    }
                                                })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                                                step="0.1"
                                                min="1"
                                                max="3"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">RAM Multiplier</label>
                                            <input
                                                type="number"
                                                value={resourceForm.overselling.ramMultiplier}
                                                onChange={(e) => setResourceForm({
                                                    ...resourceForm,
                                                    overselling: {
                                                        ...resourceForm.overselling!,
                                                        ramMultiplier: parseFloat(e.target.value) || 1
                                                    }
                                                })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                                                step="0.1"
                                                min="1"
                                                max="2"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleUpdateResources}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition"
                            >
                                Save Resources
                            </button>
                        </div>
                    )}

                    {/* Plan Limits */}
                    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 space-y-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <CalculatorIcon className="h-6 w-6 text-green-400" />
                            Plan Limits
                        </h2>

                        <div className="space-y-3">
                            {capacity.planLimits.map((limit) => (
                                <div key={limit.planName} className="bg-black/20 rounded-lg p-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-white font-semibold">{limit.planName}</span>
                                        <span className="text-sm text-gray-400">Priority: {limit.priority}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Max Users:</span>
                                        <span className="text-white font-mono">
                                            {limit.maxUsers === -1 ? 'Unlimited' : limit.maxUsers}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Current:</span>
                                        <span className="text-purple-400 font-mono">{limit.currentUsers}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-4 border-t border-gray-800 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-400">Add/Update Plan Limit</h3>
                            <input
                                type="text"
                                placeholder="Plan Name (e.g., free, pro)"
                                value={planLimitForm.planName}
                                onChange={(e) => setPlanLimitForm({ ...planLimitForm, planName: e.target.value })}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white text-sm"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="number"
                                    placeholder="Max Users"
                                    value={planLimitForm.maxUsers}
                                    onChange={(e) => setPlanLimitForm({ ...planLimitForm, maxUsers: parseInt(e.target.value) || 0 })}
                                    className="bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white text-sm"
                                />
                                <input
                                    type="number"
                                    placeholder="Priority (1-10)"
                                    value={planLimitForm.priority}
                                    onChange={(e) => setPlanLimitForm({ ...planLimitForm, priority: parseInt(e.target.value) || 5 })}
                                    className="bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white text-sm"
                                />
                            </div>
                            <button
                                onClick={handleUpdatePlanLimit}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg transition"
                            >
                                Update Plan Limit
                            </button>
                        </div>
                    </div>

                    {/* Current Plan Distribution */}
                    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 space-y-4">
                        <h2 className="text-xl font-bold text-white">Current Distribution</h2>
                        <div className="space-y-3">
                            {capacity.currentPlanCounts.map((planCount) => (
                                <div key={planCount._id || 'unknown'} className="flex justify-between items-center bg-black/20 rounded-lg p-3">
                                    <span className="text-white">{planCount._id || 'No Plan'}</span>
                                    <span className="text-purple-400 font-bold">{planCount.count} users</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
