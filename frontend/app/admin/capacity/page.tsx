'use client';

import { useEffect, useState } from 'react';

interface ResourceUsage {
    cpu: { total: number; used: number; available: number; percentage: number };
    ram: { total: number; used: number; available: number; percentage: number };
    storage: { total: number; used: number; available: number; percentage: number };
}

interface Capacity {
    allocated: any;
    remaining: any;
    capacity: {
        free: number;
        pro: number;
        enterprise: number;
        canAcceptNewUsers: boolean;
        limitReached: boolean;
    };
}

interface Recommendations {
    allocated: any;
    remaining: any;
    capacity: any;
    usage: ResourceUsage;
    recommendations: Array<{
        level: string;
        message: string;
        action: string;
    }>;
}

export default function ResourceCapacity() {
    const [usage, setUsage] = useState<ResourceUsage | null>(null);
    const [capacity, setCapacity] = useState<Capacity | null>(null);
    const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
    const [limits, setLimits] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds

        // Cleanup interval on unmount
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            setError(null);
            const token = localStorage.getItem('token');

            if (!token) {
                setError('No authentication token found');
                setLoading(false);
                return;
            }

            const [usageRes, capacityRes, recommendationsRes, limitsRes] = await Promise.all([
                fetch('/api/resources/usage', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/resources/capacity', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/resources/recommendations', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/resources/limits', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            // Check for errors
            if (!usageRes.ok || !capacityRes.ok || !recommendationsRes.ok || !limitsRes.ok) {
                throw new Error('Failed to fetch resource data');
            }

            const [usageData, capacityData, recommendationsData, limitsData] = await Promise.all([
                usageRes.json(),
                capacityRes.json(),
                recommendationsRes.json(),
                limitsRes.json()
            ]);

            setUsage(usageData);
            setCapacity(capacityData);
            setRecommendations(recommendationsData);
            setLimits(limitsData);
            setLoading(false);
        } catch (error: any) {
            console.error('Failed to fetch resource data:', error);
            setError(error.message || 'Failed to load resource data');
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading resource data...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">📊 Resource Capacity Planning</h1>
                    <p className="text-gray-300">Oracle Free Tier - 4 CPU, 24GB RAM, 45GB Storage</p>
                </div>

                {/* Alerts */}
                {recommendations && recommendations.recommendations.filter(r => r.level === 'critical').length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 mb-8">
                        <h3 className="text-xl font-bold text-red-400 mb-4">🚨 Critical Alerts</h3>
                        <div className="space-y-2">
                            {recommendations.recommendations.filter(r => r.level === 'critical').map((rec, idx) => (
                                <div key={idx} className="bg-red-500/10 border border-red-500/30 rounded p-3">
                                    <p className="text-red-400 font-semibold">{rec.message}</p>
                                    <p className="text-gray-300 text-sm">{rec.action}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Resource Usage */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <ResourceCard
                        title="CPU Usage"
                        icon="⚡"
                        used={usage?.cpu.used.toFixed(2) || 0}
                        total={limits?.total.cpu || 4}
                        available={limits?.availableForUsers.cpu || 3}
                        percentage={usage?.cpu.percentage || 0}
                        unit="cores"
                    />
                    <ResourceCard
                        title="RAM Usage"
                        icon="🧠"
                        used={usage?.ram.used.toFixed(2) || 0}
                        total={limits?.total.ram || 24}
                        available={limits?.availableForUsers.ram || 18}
                        percentage={usage?.ram.percentage || 0}
                        unit="GB"
                    />
                    <ResourceCard
                        title="Storage Usage"
                        icon="💾"
                        used={usage?.storage.used || 0}
                        total={limits?.total.storage || 45}
                        available={limits?.availableForUsers.storage || 30}
                        percentage={usage?.storage.percentage || 0}
                        unit="GB"
                    />
                </div>

                {/* Capacity by Plan */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-6">Available Capacity by Plan</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <PlanCapacityCard
                            plan="Free"
                            icon="🆓"
                            capacity={capacity?.capacity.free || 0}
                            allocated={capacity?.allocated.free.count || 0}
                            resources={limits?.planResources.free}
                            color="blue"
                        />
                        <PlanCapacityCard
                            plan="Pro"
                            icon="⭐"
                            capacity={capacity?.capacity.pro || 0}
                            allocated={capacity?.allocated.pro.count || 0}
                            resources={limits?.planResources.pro}
                            color="purple"
                        />
                        <PlanCapacityCard
                            plan="Enterprise"
                            icon="👑"
                            capacity={capacity?.capacity.enterprise || 0}
                            allocated={capacity?.allocated.enterprise.count || 0}
                            resources={limits?.planResources.enterprise}
                            color="yellow"
                        />
                    </div>

                    {capacity?.capacity.limitReached && (
                        <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                            <p className="text-red-400 font-semibold">
                                ⚠️ Server capacity reached! New signups are blocked.
                            </p>
                            <p className="text-gray-300 text-sm mt-2">
                                Clean up inactive users or upgrade server to accept new users.
                            </p>
                        </div>
                    )}
                </div>

                {/* Resource Allocation */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-6">Current Resource Allocation</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <AllocationCard
                            title="CPU Allocated"
                            allocated={capacity?.allocated.total.cpu.toFixed(2) || 0}
                            remaining={capacity?.remaining.cpu.toFixed(2) || 0}
                            total={limits?.availableForUsers.cpu || 3}
                            unit="cores"
                        />
                        <AllocationCard
                            title="RAM Allocated"
                            allocated={capacity?.allocated.total.ram.toFixed(2) || 0}
                            remaining={capacity?.remaining.ram.toFixed(2) || 0}
                            total={limits?.availableForUsers.ram || 18}
                            unit="GB"
                        />
                        <AllocationCard
                            title="Storage Allocated"
                            allocated={capacity?.allocated.total.storage.toFixed(2) || 0}
                            remaining={capacity?.remaining.storage.toFixed(2) || 0}
                            total={limits?.availableForUsers.storage || 30}
                            unit="GB"
                        />
                    </div>
                </div>

                {/* Recommendations */}
                {recommendations && recommendations.recommendations.length > 0 && (
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
                        <h2 className="text-2xl font-bold text-white mb-6">💡 Recommendations</h2>
                        <div className="space-y-3">
                            {recommendations.recommendations.map((rec, idx) => (
                                <div
                                    key={idx}
                                    className={`border rounded-lg p-4 ${rec.level === 'critical'
                                        ? 'bg-red-500/10 border-red-500/30'
                                        : rec.level === 'warning'
                                            ? 'bg-yellow-500/10 border-yellow-500/30'
                                            : 'bg-blue-500/10 border-blue-500/30'
                                        }`}
                                >
                                    <p className={`font-semibold ${rec.level === 'critical'
                                        ? 'text-red-400'
                                        : rec.level === 'warning'
                                            ? 'text-yellow-400'
                                            : 'text-blue-400'
                                        }`}>
                                        {rec.message}
                                    </p>
                                    <p className="text-gray-300 text-sm mt-1">{rec.action}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Refresh Button */}
                <div className="mt-8 text-center">
                    <button
                        onClick={fetchData}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition"
                    >
                        🔄 Refresh Data
                    </button>
                    <p className="text-gray-400 text-sm mt-2">Auto-refreshes every 30 seconds</p>
                </div>
            </div>
        </div>
    );
}

function ResourceCard({ title, icon, used, total, available, percentage, unit }: any) {
    const getColor = () => {
        if (percentage >= 90) return 'red';
        if (percentage >= 70) return 'yellow';
        return 'green';
    };

    const colors = {
        red: 'from-red-500/20 to-red-600/20 border-red-500/30',
        yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
        green: 'from-green-500/20 to-green-600/20 border-green-500/30'
    };

    return (
        <div className={`bg-gradient-to-br ${colors[getColor()]} border rounded-lg p-6`}>
            <div className="flex items-center justify-between mb-4">
                <span className="text-4xl">{icon}</span>
                <span className="text-3xl font-bold text-white">{percentage.toFixed(1)}%</span>
            </div>
            <h3 className="text-white font-semibold mb-2">{title}</h3>
            <div className="space-y-1 text-sm text-gray-300">
                <p>Used: <strong className="text-white">{used} {unit}</strong></p>
                <p>Available: <strong className="text-white">{available} {unit}</strong></p>
                <p>Total: <strong className="text-white">{total} {unit}</strong></p>
            </div>
            <div className="mt-3 bg-black/20 rounded-full h-2">
                <div
                    className={`h-2 rounded-full ${percentage >= 90 ? 'bg-red-500' : percentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
            </div>
        </div>
    );
}

function PlanCapacityCard({ plan, icon, capacity, allocated, resources, color }: any) {
    const colors: any = {
        blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
        purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
        yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30'
    };

    return (
        <div className={`bg-gradient-to-br ${colors[color]} border rounded-lg p-6`}>
            <div className="flex items-center justify-between mb-4">
                <span className="text-4xl">{icon}</span>
                <span className="text-3xl font-bold text-white">{capacity}</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{plan} Plan</h3>
            <p className="text-gray-300 mb-3">
                <strong className="text-white">{allocated}</strong> users active
            </p>
            <div className="space-y-1 text-xs text-gray-400">
                <p>CPU: {resources?.cpu} cores</p>
                <p>RAM: {resources?.ram} MB</p>
                <p>Storage: {resources?.storage} GB</p>
            </div>
            <div className="mt-4">
                {capacity > 0 ? (
                    <span className="text-green-400 text-sm">✅ {capacity} slots available</span>
                ) : (
                    <span className="text-red-400 text-sm">⚠️ No slots available</span>
                )}
            </div>
        </div>
    );
}

function AllocationCard({ title, allocated, remaining, total, unit }: any) {
    const percentage = (allocated / total) * 100;

    return (
        <div className="bg-black/20 border border-white/10 rounded-lg p-6">
            <h3 className="text-white font-semibold mb-4">{title}</h3>
            <div className="space-y-2 text-sm text-gray-300">
                <p>Allocated: <strong className="text-white">{allocated} {unit}</strong></p>
                <p>Remaining: <strong className="text-white">{remaining} {unit}</strong></p>
                <p>Total: <strong className="text-white">{total} {unit}</strong></p>
            </div>
            <div className="mt-3 bg-black/30 rounded-full h-2">
                <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
            </div>
            <p className="text-gray-400 text-xs mt-2">{percentage.toFixed(1)}% allocated</p>
        </div>
    );
}
