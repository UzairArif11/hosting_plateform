'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/lib/store';
import { fetchProjects } from '@/lib/slices/projectsSlice';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import {
    FolderIcon,
    RocketLaunchIcon,
    ClockIcon,
    CheckCircleIcon,
    PlusIcon,
    CreditCardIcon,
    Cog6ToothIcon,
    CheckIcon,
    LockClosedIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';
import { useFeaturesStatus } from '@/lib/features';

// TEST: Module-level logging
console.log('═══════════════════════════════════════════════════════');
console.log('🏠 DASHBOARD PAGE LOADED - VERSION 2.0-SOCKET-TEST');
console.log('📁 File: /dashboard/page.tsx');
console.log('⏰ Loaded at:', new Date().toISOString());
console.log('═══════════════════════════════════════════════════════');

export default function DashboardPage() {
    console.log('🎯 DashboardPage component mounting...');

    const dispatch = useDispatch<AppDispatch>();
    const { projects, loading } = useSelector((state: RootState) => state.projects);
    const { user } = useSelector((state: RootState) => state.auth);
    const featuresStatus = useFeaturesStatus();

    // Socket state for testing
    const [socketStatus, setSocketStatus] = useState<string>('Initializing');
    const [socketUrl, setSocketUrl] = useState<string>('');
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        dispatch(fetchProjects({ page: 1, limit: 5 }));
    }, [dispatch]);

    // TEST: Socket.IO Connection
    useEffect(() => {
        const envUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
        const fallbackUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const SOCKET_URL = envUrl || fallbackUrl;

        setSocketUrl(SOCKET_URL);
        console.log(`🔌 TESTING: Connecting to Socket.IO at: ${SOCKET_URL}`);

        const newSocket = io(SOCKET_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
            path: '/api/socket.io/',
        });

        setSocketStatus('Connecting...');

        newSocket.on('connect', () => {
            console.log('✅ Socket connected!', newSocket.id);
            setSocketStatus('Connected');
        });

        newSocket.on('connect_error', (err) => {
            console.error('❌ Socket error:', err);
            setSocketStatus(`Error: ${err.message}`);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('❌ Socket disconnected:', reason);
            setSocketStatus('Disconnected');
        });

        setSocket(newSocket);

        return () => {
            console.log('🔌 Cleaning up socket');
            newSocket.close();
        };
    }, []);

    const stats = [
        {
            name: 'Total Projects',
            value: projects.length,
            icon: FolderIcon,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
        },
        {
            name: 'Active Deployments',
            value: '0',
            icon: RocketLaunchIcon,
            color: 'text-green-500',
            bg: 'bg-green-500/10',
        }
    ];

    // Only show resource usage if data is provided by backend (admin controlled)
    if ((user as any)?.currentResourceUsage) {
        stats.push({
            name: 'CPU Usage',
            value: `${(user as any)?.currentResourceUsage?.cpuPercent || 0}%`,
            icon: ClockIcon,
            color: 'text-purple-500',
            bg: 'bg-purple-500/10',
        });
        stats.push({
            name: 'RAM Usage',
            value: `${(user as any)?.currentResourceUsage?.ramPercent || 0}%`,
            icon: CheckCircleIcon,
            color: 'text-yellow-500',
            bg: 'bg-yellow-500/10',
        });
    }

    return (
        <div className="space-y-6">
            {/* Socket Test Status Bar */}
            <div className="bg-gray-800 text-gray-300 text-xs p-3 rounded-lg border border-gray-700 font-mono flex justify-between items-center">
                <span className="font-bold text-purple-400">🧪 Socket Test v2.0</span>
                <span>Status: <span className={socketStatus === 'Connected' ? 'text-green-400 font-bold' : 'text-yellow-400'}>{socketStatus}</span></span>
                <span>URL: {socketUrl || 'Loading...'}</span>
                {socket && <span>ID: {socket.id || 'None'}</span>}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <div
                        key={stat.name}
                        className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-400">{stat.name}</p>
                                <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
                            </div>
                            <div className={`${stat.bg} p-3 rounded-lg`}>
                                <stat.icon className={`h-6 w-6 ${stat.color}`} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Your Features */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-white">Your Plan Features</h2>
                    <Link
                        href="/dashboard/billing"
                        className="text-sm text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                    >
                        <SparklesIcon className="h-4 w-4" />
                        Upgrade
                    </Link>
                </div>
                <p className="text-gray-400 text-sm mb-4">
                    Features enabled for your current plan. Upgrade to unlock more.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {featuresStatus.map(({ key, label, enabled }) => (
                        <div
                            key={key}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2.5 border transition-colors ${
                                enabled
                                    ? 'bg-green-500/10 border-green-500/30 text-green-300'
                                    : 'bg-gray-800/50 border-gray-700 text-gray-500'
                            }`}
                        >
                            {enabled ? (
                                <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
                            ) : (
                                <LockClosedIcon className="h-5 w-5 text-gray-600 flex-shrink-0" />
                            )}
                            <span className="text-sm font-medium truncate" title={label}>
                                {label}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    {featuresStatus.some((f) => !f.enabled) && (
                        <Link
                            href="/dashboard/billing"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <SparklesIcon className="h-4 w-4" />
                            Unlock more features
                        </Link>
                    )}
                </div>
            </div>

            {/* Recent Projects */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-white">Recent Projects</h2>
                    <Link
                        href="/dashboard/projects"
                        className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                    >
                        View all →
                    </Link>
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
                    </div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-12">
                        <FolderIcon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white mb-2">No projects yet</h3>
                        <p className="text-gray-400 mb-6">Get started by creating your first project</p>
                        <Link
                            href="/dashboard/projects"
                            className="inline-flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
                        >
                            <PlusIcon className="h-5 w-5" />
                            <span>Create Project</span>
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {projects.slice(0, 5).map((project: any) => (
                            <Link
                                key={project._id}
                                href={`/dashboard/projects/${project._id}`}
                                className="block bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-lg p-4 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className="bg-purple-500/10 p-2 rounded-lg">
                                            <FolderIcon className="h-6 w-6 text-purple-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-medium">{project.name}</h3>
                                            <p className="text-sm text-gray-400">
                                                {project.repository?.owner}/{project.repository?.name}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-medium ${project.status === 'active'
                                                ? 'bg-green-500/10 text-green-500'
                                                : 'bg-gray-500/10 text-gray-500'
                                                }`}
                                        >
                                            {project.status}
                                        </span>
                                        <span className="text-sm text-gray-400">
                                            {new Date(project.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className={`grid grid-cols-1 gap-6 ${featuresStatus.find((f) => f.key === 'templates')?.enabled ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                <Link
                    href="/dashboard/projects"
                    className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 hover:from-purple-700 hover:to-purple-800 transition-all transform hover:scale-105"
                >
                    <PlusIcon className="h-8 w-8 text-white mb-3" />
                    <h3 className="text-lg font-semibold text-white mb-2">New Project</h3>
                    <p className="text-purple-100 text-sm">Deploy a new project from GitHub</p>
                </Link>

                {featuresStatus.find((f) => f.key === 'templates')?.enabled && (
                    <Link
                        href="/templates"
                        className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-6 hover:from-indigo-700 hover:to-indigo-800 transition-all transform hover:scale-105"
                    >
                        <SparklesIcon className="h-8 w-8 text-white mb-3" />
                        <h3 className="text-lg font-semibold text-white mb-2">Deploy from Template</h3>
                        <p className="text-indigo-100 text-sm">One-click starter templates</p>
                    </Link>
                )}

                <Link
                    href="/dashboard/billing"
                    className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105"
                >
                    <CreditCardIcon className="h-8 w-8 text-white mb-3" />
                    <h3 className="text-lg font-semibold text-white mb-2">Upgrade Plan</h3>
                    <p className="text-blue-100 text-sm">Get more resources and features</p>
                </Link>

                <Link
                    href="/dashboard/settings"
                    className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 hover:from-green-700 hover:to-green-800 transition-all transform hover:scale-105"
                >
                    <Cog6ToothIcon className="h-8 w-8 text-white mb-3" />
                    <h3 className="text-lg font-semibold text-white mb-2">Settings</h3>
                    <p className="text-green-100 text-sm">Configure your account preferences</p>
                </Link>
            </div>
        </div>
    );
}
