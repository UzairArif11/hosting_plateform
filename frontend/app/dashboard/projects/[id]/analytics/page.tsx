'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import AnalyticsChart from '@/components/analytics/AnalyticsChart';
import { toast } from 'react-hot-toast';

export default function AnalyticsPage() {
    const params = useParams();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [timeframe, setTimeframe] = useState('24h');
    const [viewMode, setViewMode] = useState<'visitors' | 'pageViews'>('visitors');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchAnalytics();
    }, [params.id, timeframe]);

    const fetchAnalytics = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/projects/${params.id}/analytics/summary?timeframe=${timeframe}`);
            const json = await res.json();

            if (json.success) {
                setData(json.data);
            } else {
                // Handle forbidden/plan limits specifically
                if (res.status === 403) {
                    setError(json.error || 'Analytics not enabled for your plan.');
                } else {
                    setError('Failed to load analytics data.');
                }
            }
        } catch (err) {
            setError('Connection failed.');
        } finally {
            setLoading(false);
        }
    };

    const TopTable = ({ title, items, icon }: any) => (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50 flex items-center gap-2">
                <span>{icon}</span>
                <h3 className="font-semibold text-gray-200">{title}</h3>
            </div>
            <div className="p-0">
                {!items || items.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">No data</div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <tbody className="divide-y divide-gray-700">
                            {items.map((item: any, i: number) => (
                                <tr key={i} className="hover:bg-gray-700/50">
                                    <td className="px-4 py-2 text-gray-300 truncate max-w-[200px]" title={item._id}>
                                        {item._id || 'Unknown'}
                                    </td>
                                    <td className="px-4 py-2 text-right text-gray-400 font-mono">
                                        {item.count}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );

    if (loading && !data) return <div className="p-8 text-center text-gray-500">Loading analytics...</div>;

    if (error) {
        return (
            <div className="p-8 text-center">
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg inline-block max-w-lg">
                    <h3 className="text-lg font-bold mb-2">Analytics Unavailable</h3>
                    <p>{error}</p>
                    {error.includes('plan') && (
                        <button className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
                            Upgrade Plan
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const chartData = data?.chart || [];
    const totalVisitors = chartData.reduce((acc: number, curr: any) => acc + curr.visitors, 0);
    const totalViews = chartData.reduce((acc: number, curr: any) => acc + curr.pageViews, 0);

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Analytics</h1>
                    <p className="text-gray-400 text-sm">Real-time statistics for your deployments</p>
                </div>

                {/* Controls */}
                <div className="flex gap-2 bg-gray-800 p-1 rounded-lg border border-gray-700">
                    {['24h', '7d', '30d'].map((t) => (
                        <button
                            key={t}
                            onClick={() => setTimeframe(t)}
                            className={`px-3 py-1 text-sm rounded transition-colors ${timeframe === t ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-300'
                                }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div
                    onClick={() => setViewMode('visitors')}
                    className={`p-6 rounded-xl border cursor-pointer transition-all ${viewMode === 'visitors'
                            ? 'bg-purple-500/10 border-purple-500/50 ring-1 ring-purple-500/50'
                            : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                        }`}
                >
                    <div className="text-sm text-gray-400 mb-1">Unique Visitors</div>
                    <div className="text-3xl font-bold text-white">{totalVisitors}</div>
                </div>

                <div
                    onClick={() => setViewMode('pageViews')}
                    className={`p-6 rounded-xl border cursor-pointer transition-all ${viewMode === 'pageViews'
                            ? 'bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500/50'
                            : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                        }`}
                >
                    <div className="text-sm text-gray-400 mb-1">Total Page Views</div>
                    <div className="text-3xl font-bold text-white">{totalViews}</div>
                </div>
            </div>

            {/* Main Chart */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-6">
                    {viewMode === 'visitors' ? 'Visitors' : 'Page Views'} Over Time
                </h3>
                <AnalyticsChart data={chartData} type={viewMode} />
            </div>

            {/* Detail Tables */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <TopTable title="Top Pages" items={data?.top.paths} icon="📄" />
                <TopTable title="Referrers" items={data?.top.referrers} icon="🔗" />
                <TopTable title="Countries" items={data?.top.countries} icon="🌍" />
                <TopTable title="Devices" items={data?.top.devices} icon="📱" />
            </div>
        </div>
    );
}
