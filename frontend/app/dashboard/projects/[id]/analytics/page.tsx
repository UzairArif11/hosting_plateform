'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface AnalyticsSummary {
    pageViews: number;
    uniqueVisitors: number;
    topPages: Array<{ path: string; views: number }>;
    topReferrers: Array<{ referrer: string; count: number }>;
    countries: Array<{ country: string; count: number }>;
    trend: Array<{ date: string; views: number; visitors: number }>;
}

export default function AnalyticsPage({ params }: { params: { id: string } }) {
    const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('7d');
    const [hasAccess, setHasAccess] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, [params.id, timeframe]);

    const fetchAnalytics = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/projects/${params.id}/analytics/summary?timeframe=${timeframe}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.status === 403) {
                setHasAccess(false);
                setLoading(false);
                return;
            }

            if (!res.ok) throw new Error('Failed to fetch analytics');

            const data = await res.json();
            setAnalytics(data);
        } catch (error) {
            console.error('Error fetching analytics:', error);
            toast.error('Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    if (!hasAccess) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-2xl p-12 text-center">
                    <svg className="w-20 h-20 text-purple-400 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <h2 className="text-3xl font-bold text-white mb-4">Analytics Unavailable</h2>
                    <p className="text-gray-300 text-lg mb-8">
                        Analytics are not available in your current plan.
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
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Analytics</h1>
                    <p className="text-gray-400">Monitor your project's traffic and performance</p>
                </div>

                <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="bg-gray-900 border border-gray-800 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                >
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                </select>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-500/30 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-400 text-sm font-medium">Page Views</h3>
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-white">{analytics?.pageViews?.toLocaleString() || 0}</p>
                </div>

                <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 border border-blue-500/30 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-400 text-sm font-medium">Unique Visitors</h3>
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-white">{analytics?.uniqueVisitors?.toLocaleString() || 0}</p>
                </div>

                <div className="bg-gradient-to-br from-green-900/20 to-green-800/10 border border-green-500/30 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-400 text-sm font-medium">Top Page</h3>
                        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-lg font-semibold text-white truncate">
                        {analytics?.topPages?.[0]?.path || '/'}
                    </p>
                    <p className="text-sm text-gray-400">{analytics?.topPages?.[0]?.views || 0} views</p>
                </div>

                <div className="bg-gradient-to-br from-orange-900/20 to-orange-800/10 border border-orange-500/30 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-400 text-sm font-medium">Top Referrer</h3>
                        <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-lg font-semibold text-white truncate">
                        {analytics?.topReferrers?.[0]?.referrer || 'Direct'}
                    </p>
                    <p className="text-sm text-gray-400">{analytics?.topReferrers?.[0]?.count || 0} visitors</p>
                </div>
            </div>

            {/* Simple Bar Chart Visualization */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Top Pages */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-6">Top Pages</h3>
                    <div className="space-y-4">
                        {analytics?.topPages?.slice(0, 5).map((page, index) => {
                            const maxViews = analytics.topPages[0]?.views || 1;
                            const percentage = (page.views / maxViews) * 100;
                            return (
                                <div key={index}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-gray-300 text-sm truncate flex-1">{page.path}</span>
                                        <span className="text-white font-medium ml-2">{page.views}</span>
                                    </div>
                                    <div className="w-full bg-gray-800 rounded-full h-2">
                                        <div
                                            className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {(!analytics?.topPages || analytics.topPages.length === 0) && (
                            <p className="text-gray-500 text-center py-8">No page data available</p>
                        )}
                    </div>
                </div>

                {/* Top Referrers */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-6">Top Referrers</h3>
                    <div className="space-y-4">
                        {analytics?.topReferrers?.slice(0, 5).map((referrer, index) => {
                            const maxCount = analytics.topReferrers[0]?.count || 1;
                            const percentage = (referrer.count / maxCount) * 100;
                            return (
                                <div key={index}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-gray-300 text-sm truncate flex-1">{referrer.referrer}</span>
                                        <span className="text-white font-medium ml-2">{referrer.count}</span>
                                    </div>
                                    <div className="w-full bg-gray-800 rounded-full h-2">
                                        <div
                                            className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {(!analytics?.topReferrers || analytics.topReferrers.length === 0) && (
                            <p className="text-gray-500 text-center py-8">No referrer data available</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Countries */}
            {analytics?.countries && analytics.countries.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-6">Visitors by Country</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {analytics.countries.slice(0, 8).map((country, index) => (
                            <div key={index} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                <p className="text-gray-300 text-sm mb-1">{country.country}</p>
                                <p className="text-2xl font-bold text-white">{country.count}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Integration Instructions */}
            <div className="mt-8 bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-3">📊 Enable Analytics Tracking</h3>
                <p className="text-gray-300 mb-4">
                    Add this script to your website to start tracking visitors:
                </p>
                <pre className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto">
                    {`<script>
  (function() {
    const projectId = '${params.id}';
    const apiUrl = '${typeof window !== 'undefined' ? window.location.origin : ''}/api/analytics/collect';
    
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        path: window.location.pathname,
        referrer: document.referrer,
        visitorId: localStorage.getItem('vid') || (localStorage.setItem('vid', Math.random().toString(36)), localStorage.getItem('vid'))
      })
    });
  })();
</script>`}
                </pre>
            </div>
        </div>
    );
}
