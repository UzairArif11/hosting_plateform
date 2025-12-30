'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
    CpuChipIcon,
    ServerIcon,
    CircleStackIcon,
    BoltIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    CalculatorIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface ServerCapacity {
    serverName: string;
    resources: {
        total: ResourceSet;
        allocated: ResourceSet;
        available: ResourceSet;
        reserved: ResourceSet;
    };
    usage: ResourceSet;
    warnings: Warning[];
    planLimits: PlanLimit[];
    lastUpdated: string;
}

interface ResourceSet {
    cpu: number;
    ram: number;
    storage: number;
    bandwidth: number;
}

interface Warning {
    type: string;
    level: 'warning' | 'critical';
    message: string;
}

interface PlanLimit {
    planName: string;
    maxUsers: number;
    currentUsers: number;
    priority: number;
}

interface Plan {
    name: string;
    displayName: string;
    resources: ResourceSet;
}

export default function CapacityPage() {
    const [servers, setServers] = useState<ServerCapacity[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedServer, setSelectedServer] = useState<string | null>(null);
    const [simulatedLimits, setSimulatedLimits] = useState<Record<string, number>>({});
    const [projection, setProjection] = useState<ResourceSet | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [capacityRes, plansRes] = await Promise.all([
                api.get('/api/admin/capacity'),
                api.get('/api/admin/plans')
            ]);
            setServers(capacityRes.data.servers);
            setPlans(plansRes.data.plans);

            if (capacityRes.data.servers.length > 0) {
                setSelectedServer(capacityRes.data.servers[0].serverName);
                initializeSimulatedLimits(capacityRes.data.servers[0]);
            }

            setLoading(false);
        } catch (error) {
            toast.error('Failed to load capacity data');
            setLoading(false);
        }
    };

    const initializeSimulatedLimits = (server: ServerCapacity) => {
        const limits: Record<string, number> = {};
        server.planLimits.forEach(l => {
            limits[l.planName] = l.maxUsers;
        });
        setSimulatedLimits(limits);
    };

    const handleServerChange = (serverName: string) => {
        setSelectedServer(serverName);
        const server = servers.find(s => s.serverName === serverName);
        if (server) {
            initializeSimulatedLimits(server);
        }
    };

    const calculateProjection = () => {
        if (!selectedServer) return null;
        const server = servers.find(s => s.serverName === selectedServer);
        if (!server) return null;

        let cpuUsed = server.reservedResources.cpu;
        let ramUsed = server.reservedResources.ram;
        let storageUsed = server.reservedResources.storage;

        Object.entries(simulatedLimits).forEach(([planName, limit]) => {
            const plan = plans.find(p => p.name === planName);
            if (plan && limit > 0) {
                cpuUsed += plan.resources.cpu * limit;
                ramUsed += plan.resources.ram * limit;
                storageUsed += plan.resources.storage * limit;
            }
        });

        return {
            cpu: server.resources.total.cpu - cpuUsed,
            ram: server.resources.total.ram - ramUsed,
            storage: server.resources.total.storage - storageUsed,
            bandwidth: 0
        };
    };

    const saveLimits = async () => {
        if (!selectedServer) return;

        try {
            const limits = Object.entries(simulatedLimits).map(([planName, maxUsers]) => ({
                planName,
                maxUsers
            }));

            await api.put(`/api/admin/capacity/${selectedServer}/limits`, { limits });
            toast.success('Capacity limits updated');
            fetchData();
        } catch (error) {
            toast.error('Failed to update limits');
        }
    };

    const simulatedProjection = calculateProjection();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    const currentServer = servers.find(s => s.serverName === selectedServer);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-white">Capacity Planning</h1>
                    <p className="text-gray-400 mt-2">Monitor server load and set safe plan limits to prevent overselling.</p>
                </div>

                <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
                    {servers.map(server => (
                        <button
                            key={server.serverName}
                            onClick={() => handleServerChange(server.serverName)}
                            className={`px-6 py-2 rounded-md text-sm font-bold transition ${selectedServer === server.serverName
                                    ? 'bg-purple-600 text-white'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            {server.serverName}
                        </button>
                    ))}
                </div>
            </div>

            {currentServer && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Live Stats Card */}
                    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 space-y-8">
                        <div className="flex items-center space-x-3 mb-6">
                            <ServerIcon className="h-6 w-6 text-blue-400" />
                            <h2 className="text-xl font-bold text-white">Live Server Status</h2>
                        </div>

                        {/* CPU */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">CPU Usage</span>
                                <span className="text-white font-mono">{currentServer.usage.cpu}%</span>
                            </div>
                            <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${Number(currentServer.usage.cpu) > 80 ? 'bg-red-500' : 'bg-blue-500'
                                        }`}
                                    style={{ width: `${currentServer.usage.cpu}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>{currentServer.resources.allocated.cpu.toFixed(1)} Used</span>
                                <span>{currentServer.resources.total.cpu} Total OCPU</span>
                            </div>
                        </div>

                        {/* RAM */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">RAM Usage</span>
                                <span className="text-white font-mono">{currentServer.usage.ram}%</span>
                            </div>
                            <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${Number(currentServer.usage.ram) > 85 ? 'bg-red-500' : 'bg-purple-500'
                                        }`}
                                    style={{ width: `${currentServer.usage.ram}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>{currentServer.resources.allocated.ram.toFixed(1)} GB Used</span>
                                <span>{currentServer.resources.total.ram} GB Total</span>
                            </div>
                        </div>

                        {/* Storage */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Storage Usage</span>
                                <span className="text-white font-mono">{currentServer.usage.storage}%</span>
                            </div>
                            <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${Number(currentServer.usage.storage) > 90 ? 'bg-red-500' : 'bg-green-500'
                                        }`}
                                    style={{ width: `${currentServer.usage.storage}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>{currentServer.resources.allocated.storage.toFixed(1)} GB Used</span>
                                <span>{currentServer.resources.total.storage} GB Total</span>
                            </div>
                        </div>

                        {currentServer.warnings.length > 0 && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-2">
                                {currentServer.warnings.map((w, i) => (
                                    <div key={i} className="flex items-center space-x-2 text-red-400 text-sm">
                                        <ExclamationTriangleIcon className="h-4 w-4" />
                                        <span>{w.message}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Limit Calculator */}
                    <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 space-y-6">
                        <div className="flex items-center space-x-3 mb-6">
                            <CalculatorIcon className="h-6 w-6 text-purple-400" />
                            <h2 className="text-xl font-bold text-white">Plan Limits & Calculator</h2>
                        </div>

                        <p className="text-sm text-gray-400">
                            Set maximum active users per plan. The system calculates remaining capacity based on these limits.
                        </p>

                        <div className="space-y-4">
                            {plans.map(plan => (
                                <div key={plan.name} className="flex items-center justify-between bg-black/20 p-4 rounded-xl border border-white/5">
                                    <div className="flex-1">
                                        <h3 className="text-white font-medium">{plan.displayName}</h3>
                                        <p className="text-xs text-gray-500">
                                            {plan.resources.cpu} CPU • {plan.resources.ram} GB RAM
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <label className="text-xs text-gray-500 mb-1">Max Users</label>
                                        <input
                                            type="number"
                                            value={simulatedLimits[plan.name] || 0}
                                            onChange={(e) => setSimulatedLimits({
                                                ...simulatedLimits,
                                                [plan.name]: parseInt(e.target.value) || 0
                                            })}
                                            className="w-20 bg-gray-800 border-gray-700 text-white rounded px-2 py-1 text-sm text-right focus:ring-purple-500"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-gray-800 pt-6 space-y-4">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Projected Free Capacity</h3>

                            {simulatedProjection && (
                                <div className="grid grid-cols-3 gap-2">
                                    <div className={`p-3 rounded-lg border ${simulatedProjection.cpu < 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                                        <p className="text-xs text-gray-400">Free CPU</p>
                                        <p className={`text-lg font-bold ${simulatedProjection.cpu < 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                            {simulatedProjection.cpu.toFixed(1)}
                                        </p>
                                    </div>
                                    <div className={`p-3 rounded-lg border ${simulatedProjection.ram < 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-purple-500/10 border-purple-500/30'}`}>
                                        <p className="text-xs text-gray-400">Free RAM</p>
                                        <p className={`text-lg font-bold ${simulatedProjection.ram < 0 ? 'text-red-400' : 'text-purple-400'}`}>
                                            {simulatedProjection.ram.toFixed(1)} GB
                                        </p>
                                    </div>
                                    <div className={`p-3 rounded-lg border ${simulatedProjection.storage < 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                                        <p className="text-xs text-gray-400">Free Storage</p>
                                        <p className={`text-lg font-bold ${simulatedProjection.storage < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                            {simulatedProjection.storage.toFixed(0)} GB
                                        </p>
                                    </div>
                                </div>
                            )}

                            {simulatedProjection && (simulatedProjection.cpu < 0 || simulatedProjection.ram < 0 || simulatedProjection.storage < 0) ? (
                                <p className="text-red-400 text-xs flex items-center gap-1">
                                    <ExclamationTriangleIcon className="h-4 w-4" />
                                    Warning: Current limits exceed server capacity!
                                </p>
                            ) : (
                                <p className="text-green-400 text-xs flex items-center gap-1">
                                    <CheckCircleIcon className="h-4 w-4" />
                                    Safe Configuration
                                </p>
                            )}

                            <button
                                onClick={saveLimits}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-purple-500/20"
                            >
                                Apply Capacity Limits
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
