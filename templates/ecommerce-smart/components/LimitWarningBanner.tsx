'use client';

import { useEffect, useState } from 'react';

interface LimitWarning {
    level: 'info' | 'warning' | 'critical';
    message: string;
}

interface LimitStatus {
    mode: 'lite' | 'pro';
    itemCount: number | null;
    limit: number | null;
    percentage: number;
    warning: LimitWarning | null;
}

export default function LimitWarningBanner() {
    const [status, setStatus] = useState<LimitStatus | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        async function fetchLimitStatus() {
            try {
                const res = await fetch('/api/limits');
                const data = await res.json();
                setStatus(data);
            } catch (error) {
                console.error('Failed to fetch limit status:', error);
            }
        }

        fetchLimitStatus();
        // Refresh every 30 seconds
        const interval = setInterval(fetchLimitStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    if (!status || !status.warning || dismissed || status.mode === 'pro') {
        return null;
    }

    const { warning, itemCount, limit, percentage } = status;

    // Color schemes based on warning level
    const colors = {
        info: {
            bg: 'bg-blue-900/20',
            border: 'border-blue-500/30',
            text: 'text-blue-300',
            button: 'bg-blue-600 hover:bg-blue-700'
        },
        warning: {
            bg: 'bg-yellow-900/20',
            border: 'border-yellow-500/30',
            text: 'text-yellow-300',
            button: 'bg-yellow-600 hover:bg-yellow-700'
        },
        critical: {
            bg: 'bg-red-900/20',
            border: 'border-red-500/30',
            text: 'text-red-300',
            button: 'bg-red-600 hover:bg-red-700'
        }
    };

    const scheme = colors[warning.level];

    return (
        <div className={`relative ${scheme.bg} border ${scheme.border} rounded-lg p-4 mb-6`}>
            <button
                onClick={() => setDismissed(true)}
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
                aria-label="Dismiss"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">
                    {warning.level === 'critical' && (
                        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    )}
                    {warning.level === 'warning' && (
                        <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    )}
                    {warning.level === 'info' && (
                        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${scheme.text}`}>
                        {warning.message}
                    </p>

                    {/* Progress bar */}
                    <div className="mt-3 w-full bg-gray-800 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full transition-all ${percentage >= 90 ? 'bg-red-500' :
                                    percentage >= 75 ? 'bg-yellow-500' : 'bg-blue-500'
                                }`}
                            style={{ width: `${percentage}%` }}
                        />
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                            {itemCount} / {limit} items used
                        </span>
                    </div>
                </div>

                {warning.level !== 'info' && (
                    <div className="flex-shrink-0">
                        <a
                            href="/billing"
                            className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${scheme.button}`}
                        >
                            Upgrade to Pro
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
