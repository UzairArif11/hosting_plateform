'use client';

import { useDeployment, DeploymentLog } from '@/hooks/useDeployment';
import { CheckCircleIcon, XCircleIcon, ClockIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

interface DeploymentStatusProps {
    deploymentId: string;
    onComplete?: (url: string) => void;
}

export default function DeploymentStatus({ deploymentId, onComplete }: DeploymentStatusProps) {
    const { status, isConnected, refresh } = useDeployment(deploymentId);

    // Call onComplete when deployment succeeds
    if (status.status === 'success' && status.url && onComplete) {
        onComplete(status.url);
    }

    const getStatusColor = () => {
        switch (status.status) {
            case 'success': return 'bg-green-500';
            case 'failed': return 'bg-red-500';
            case 'building':
            case 'deploying': return 'bg-blue-500';
            default: return 'bg-gray-500';
        }
    };

    const getStatusIcon = () => {
        switch (status.status) {
            case 'success':
                return <CheckCircleIcon className="w-6 h-6 text-green-500" />;
            case 'failed':
                return <XCircleIcon className="w-6 h-6 text-red-500" />;
            case 'building':
            case 'deploying':
                return <ArrowPathIcon className="w-6 h-6 text-blue-500 animate-spin" />;
            default:
                return <ClockIcon className="w-6 h-6 text-gray-500" />;
        }
    };

    const getLogColor = (level: string) => {
        switch (level) {
            case 'error': return 'text-red-400';
            case 'success': return 'text-green-400';
            default: return 'text-gray-300';
        }
    };

    return (
        <div className="bg-gray-900 rounded-lg p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    {getStatusIcon()}
                    <div>
                        <h3 className="text-lg font-semibold text-white capitalize">
                            {status.status}
                        </h3>
                        <p className="text-sm text-gray-400">
                            {status.message || 'Processing...'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-xs text-gray-400">
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Progress</span>
                    <span className="text-white font-medium">{status.progress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                        className={`${getStatusColor()} h-2 rounded-full transition-all duration-300`}
                        style={{ width: `${status.progress}%` }}
                    />
                </div>
            </div>

            {/* Success - Show URL */}
            {status.status === 'success' && status.url && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-green-400 font-medium mb-1">
                                🎉 Deployment Successful!
                            </p>
                            <a
                                href={status.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-300 hover:text-green-200 underline text-sm"
                            >
                                {status.url}
                            </a>
                        </div>
                        <button
                            onClick={() => window.open(status.url, '_blank')}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Visit Site
                        </button>
                    </div>
                </div>
            )}

            {/* Error */}
            {status.status === 'failed' && status.error && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                    <p className="text-sm text-red-400 font-medium mb-1">
                        ❌ Deployment Failed
                    </p>
                    <p className="text-red-300 text-sm">{status.error}</p>
                </div>
            )}

            {/* Live Logs */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-400">Deployment Logs</h4>
                    <button
                        onClick={refresh}
                        className="text-xs text-gray-400 hover:text-white transition-colors"
                    >
                        Refresh
                    </button>
                </div>

                <div className="bg-black rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs space-y-1">
                    {status.logs.length === 0 ? (
                        <p className="text-gray-500">Waiting for logs...</p>
                    ) : (
                        status.logs.map((log, index) => (
                            <div key={index} className="flex space-x-2">
                                <span className="text-gray-500">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                                <span className={getLogColor(log.level)}>
                                    {log.message}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
