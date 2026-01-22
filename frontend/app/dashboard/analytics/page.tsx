'use client';

import { useEffect, useState } from 'react';
import { useAppSelector } from '@/lib/hooks';
import api from '@/lib/api';
import FeatureGuard from '@/components/FeatureGuard';
import {
    ChartBarIcon,
    ArrowTrendingUpIcon,
    ClockIcon,
    RocketLaunchIcon
} from '@heroicons/react/24/outline';

export default function AnalyticsPage() {
    return (
        <FeatureGuard feature="analytics">
            <AnalyticsPageContent />
        </FeatureGuard>
    );
}

function AnalyticsPageContent() {
    const { user } = useAppSelector((state) => state.auth);
    const [stats, setStats] = useState({
        totalDeployments: 0,
        totalPageViews: 0,
        totalVisitors: 0,
        chart: []
    });
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('24h');

    useEffect(() => {
        fetchAnalytics();
    }, [timeframe]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/analytics/global?timeframe=${timeframe}`);
            if (res.data.success) {
                setStats(res.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch analytics', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Analytics</h1>
                <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2"
                >
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                </select>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-gray-800 rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-400">Total Deployments</p>
                                    <p className="text-2xl font-bold text-white mt-2">{stats.totalDeployments}</p>
                                </div>
                                <RocketLaunchIcon className="h-8 w-8 text-blue-500" />
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-400">Page Views</p>
                                    <p className="text-2xl font-bold text-green-400 mt-2">{stats.totalPageViews}</p>
                                </div>
                                <ChartBarIcon className="h-8 w-8 text-green-500" />
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-400">Unique Visitors</p>
                                    <p className="text-2xl font-bold text-purple-400 mt-2">{stats.totalVisitors}</p>
                                </div>
                                <ArrowTrendingUpIcon className="h-8 w-8 text-purple-500" />
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-400">Avg Views/Day</p>
                                    <p className="text-2xl font-bold text-white mt-2">
                                        {stats.chart.length > 0 ? Math.round(stats.totalPageViews / stats.chart.length) : 0}
                                    </p>
                                </div>
                                <ClockIcon className="h-8 w-8 text-gray-400" />
                            </div>
                        </div>
                    </div>

                    {/* Simple Chart */}
                    <div className="bg-gray-800 rounded-lg shadow p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">Activity Chart</h2>
                        {stats.chart.length > 0 ? (
                            <div className="flex items-end space-x-2 h-64">
                                {stats.chart.map((item: any, index: number) => {
                                    const maxViews = Math.max(...stats.chart.map((d: any) => d.pageViews));
                                    const height = maxViews > 0 ? (item.pageViews / maxViews) * 100 : 0;
                                    return (
                                        <div key={index} className="flex-1 flex flex-col items-center">
                                            <div
                                                className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t transition-all hover:opacity-80"
                                                style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0' }}
                                                title={`${item.date}: ${item.pageViews} views`}
                                            ></div>
                                            <p className="text-xs text-gray-500 mt-2 truncate w-full text-center">
                                                {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-center py-12">No data available for this timeframe</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
