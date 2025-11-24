'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/lib/store';
import { fetchDeploymentLogs, addLog, updateDeploymentStatus } from '@/lib/slices/deploymentsSlice';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';

export default function DeploymentLogsPage() {
    const params = useParams();
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const { currentDeployment, logs } = useSelector((state: RootState) => state.deployments);
    const [socket, setSocket] = useState<Socket | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Fetch deployment logs
    useEffect(() => {
        if (params.id) {
            dispatch(fetchDeploymentLogs(params.id as string));
        }
    }, [params.id, dispatch]);

    // Socket.IO connection for real-time logs
    useEffect(() => {
        const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
        const newSocket = io(SOCKET_URL, {
            withCredentials: true,
        });

        newSocket.on('connect', () => {
            console.log('✅ Connected to deployment logs');
            newSocket.emit('join-deployment', params.id);
        });

        newSocket.on('deployment-log', (data: { deploymentId: string; log: string }) => {
            if (data.deploymentId === params.id) {
                dispatch(addLog(data.log));
            }
        });

        newSocket.on('deployment-status', (data: { deploymentId: string; status: string }) => {
            if (data.deploymentId === params.id) {
                dispatch(updateDeploymentStatus(data.status));
            }
        });

        newSocket.on('disconnect', () => {
            console.log('❌ Disconnected from deployment logs');
        });

        setSocket(newSocket);

        return () => {
            newSocket.emit('leave-deployment', params.id);
            newSocket.close();
        };
    }, [params.id, dispatch]);

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { icon: any; color: string; text: string }> = {
            queued: {
                icon: ClockIcon,
                color: 'bg-gray-500/10 text-gray-500',
                text: 'Queued',
            },
            building: {
                icon: ArrowPathIcon,
                color: 'bg-blue-500/10 text-blue-500',
                text: 'Building',
            },
            success: {
                icon: CheckCircleIcon,
                color: 'bg-green-500/10 text-green-500',
                text: 'Success',
            },
            failed: {
                icon: XCircleIcon,
                color: 'bg-red-500/10 text-red-500',
                text: 'Failed',
            },
        };

        const badge = badges[status] || badges.queued;
        const Icon = badge.icon;

        return (
            <span className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full ${badge.color}`}>
                <Icon className={`h-4 w-4 ${status === 'building' ? 'animate-spin' : ''}`} />
                <span className="font-medium">{badge.text}</span>
            </span>
        );
    };

    const formatLogLine = (log: string, index: number) => {
        // Color-code different log types
        let className = 'text-gray-300';

        if (log.includes('ERROR') || log.includes('Failed')) {
            className = 'text-red-400';
        } else if (log.includes('SUCCESS') || log.includes('✓')) {
            className = 'text-green-400';
        } else if (log.includes('WARNING') || log.includes('⚠')) {
            className = 'text-yellow-400';
        } else if (log.includes('INFO') || log.includes('→')) {
            className = 'text-blue-400';
        }

        return (
            <div key={index} className={`font-mono text-sm ${className} py-1`}>
                <span className="text-gray-600 mr-4">{String(index + 1).padStart(4, ' ')}</span>
                {log}
            </div>
        );
    };

    if (!currentDeployment) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <button
                        onClick={() => router.back()}
                        className="flex items-center space-x-2 text-purple-400 hover:text-purple-300 mb-3"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        <span>Back</span>
                    </button>
                    <h1 className="text-2xl font-bold text-white">Deployment Logs</h1>
                    <p className="text-gray-400 mt-1">
                        {currentDeployment.commitMessage || 'Manual deployment'}
                    </p>
                </div>
                <div>
                    {getStatusBadge(currentDeployment.status)}
                </div>
            </div>

            {/* Deployment Info */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-400">Branch</p>
                    <p className="text-lg font-semibold text-white mt-1">{currentDeployment.branch}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-400">Commit</p>
                    <p className="text-lg font-semibold text-white mt-1 font-mono">
                        {currentDeployment.commitSha?.substring(0, 7)}
                    </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-400">Build Time</p>
                    <p className="text-lg font-semibold text-white mt-1">
                        {currentDeployment.buildTime ? `${(currentDeployment.buildTime / 1000).toFixed(1)}s` : '—'}
                    </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-400">Started</p>
                    <p className="text-lg font-semibold text-white mt-1">
                        {new Date(currentDeployment.createdAt).toLocaleTimeString()}
                    </p>
                </div>
            </div>

            {/* Logs Container */}
            <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
                <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
                    <h3 className="text-white font-semibold">Build Logs</h3>
                    <div className="flex items-center space-x-2">
                        {socket?.connected ? (
                            <span className="flex items-center space-x-2 text-green-500 text-sm">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                <span>Live</span>
                            </span>
                        ) : (
                            <span className="flex items-center space-x-2 text-gray-500 text-sm">
                                <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                                <span>Disconnected</span>
                            </span>
                        )}
                    </div>
                </div>

                <div className="p-6 h-[600px] overflow-y-auto bg-gray-950">
                    {logs.length === 0 ? (
                        <div className="text-center py-12">
                            <ClockIcon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400">Waiting for logs...</p>
                        </div>
                    ) : (
                        <div className="space-y-0">
                            {logs.map((log, index) => formatLogLine(log, index))}
                            <div ref={logsEndRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            {currentDeployment.status === 'failed' && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
                    <h3 className="text-red-500 font-semibold mb-2">Deployment Failed</h3>
                    <p className="text-gray-400 mb-4">
                        The deployment encountered an error. Check the logs above for details.
                    </p>
                    <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors">
                        Retry Deployment
                    </button>
                </div>
            )}

            {currentDeployment.status === 'success' && currentDeployment.deploymentUrl && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
                    <h3 className="text-green-500 font-semibold mb-2">Deployment Successful! 🎉</h3>
                    <p className="text-gray-400 mb-4">
                        Your project is now live and accessible at:
                    </p>
                    <a
                        href={currentDeployment.deploymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                        Visit Deployment →
                    </a>
                </div>
            )}
        </div>
    );
}
