'use client';

import React from 'react';

interface ChartData {
    date: string;
    visitors: number;
    pageViews: number;
}

interface AnalyticsChartProps {
    data: ChartData[];
    type: 'visitors' | 'pageViews';
}

export default function AnalyticsChart({ data, type }: AnalyticsChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center bg-gray-900/50 rounded-lg border border-gray-800 border-dashed">
                <p className="text-gray-500">No data available for this period</p>
            </div>
        );
    }

    // Find max value to normalize height
    const maxValue = Math.max(...data.map(d => Math.max(d.visitors, d.pageViews)));
    const safeMax = maxValue || 1; // Avoid division by zero

    return (
        <div className="h-64 flex items-end justify-between gap-1 p-4 bg-gray-900/30 rounded-lg border border-gray-800">
            {data.map((item, index) => {
                const value = item[type];
                const heightPercent = (value / safeMax) * 100;

                return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2 group relative">
                        {/* Tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-gray-800 text-xs px-2 py-1 rounded border border-gray-700 whitespace-nowrap z-10 pointer-events-none transition-opacity">
                            <div className="font-bold">{item.date}</div>
                            <div>{type === 'visitors' ? 'Visitors' : 'Page Views'}: {value}</div>
                        </div>

                        {/* Bar */}
                        <div
                            className={`w-full max-w-[20px] min-h-[4px] rounded-t-sm transition-all duration-500 ${type === 'visitors' ? 'bg-purple-500 group-hover:bg-purple-400' : 'bg-blue-500 group-hover:bg-blue-400'
                                }`}
                            style={{ height: `${Math.max(heightPercent, 2)}%` }} // Min height 2% for visibility
                        ></div>
                    </div>
                );
            })}
        </div>
    );
}
