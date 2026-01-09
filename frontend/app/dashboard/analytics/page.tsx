'use client';

import { useEffect, useState } from 'react';
import { useAppSelector } from '@/lib/hooks';
import {
    ChartBarIcon,
    ArrowTrendingUpIcon,
    ClockIcon,
    XCircleIcon
} from '@heroicons/react/24/outline';

export default function AnalyticsPage() {
    const { user } = useAppSelector((state) => state.auth);
    const [stats, setStats] = useState({
        totalDeployments: 0,
        successfulDeployments: 0,
        failedDeployments: 0,
        averageBuildTime: 0
    });

    useEffect(() => {
        // TODO: Fetch analytics data from API
        // For now, show placeholder
        setStats({
            totalDeployments: 0,
            successfulDeployments: 0,
            failedDeployments: 0,
            averageBuildTime: 0
        });
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Total Deployments</p>
                            <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalDeployments}</p>
                        </div>
                        <ChartBarIcon className="h-8 w-8 text-blue-500" />
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Successful</p>
                            <p className="text-2xl font-bold text-green-600 mt-2">{stats.successfulDeployments}</p>
                        </div>
                        <ArrowTrendingUpIcon className="h-8 w-8 text-green-500" />
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Failed</p>
                            <p className="text-2xl font-bold text-red-600 mt-2">{stats.failedDeployments}</p>
                        </div>
                        <XCircleIcon className="h-8 w-8 text-red-500" />
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Avg Build Time</p>
                            <p className="text-2xl font-bold text-gray-900 mt-2">{stats.averageBuildTime}s</p>
                        </div>
                        <ClockIcon className="h-8 w-8 text-gray-500" />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-500 text-center py-8">
                    Analytics charts and detailed metrics coming soon...
                </p>
            </div>
        </div>
    );
}

