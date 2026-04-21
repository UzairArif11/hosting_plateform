'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
    ServerIcon,
    CpuChipIcon,
    CircleStackIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface ContainerUser {
    email: string;
    displayName: string;
    plan: string;
    status: string;
    createdAt?: string;
}

interface ContainerStats {
    id: string;
    name: string;
    image: string;
    state: string;
    status: string;
    userId?: string | null;
    user?: ContainerUser | null;
    stats: {
        cpu?: string;
        memory?: {
            usage: string;
            limit: string;
            percent: string;
        };
        network?: {
            rx: string;
            tx: string;
        };
        pids?: number;
        error?: string;
    };
}

interface DockerStats {
    containers: {
        total: number;
        running: number;
        stopped: number;
        list: ContainerStats[];
    };
    system: {
        version: string;
        kernelVersion: string;
        operatingSystem: string;
        architecture: string;
        cpus: number;
        totalMemory: string;
        images: number;
        driver: string;
    };
}

interface ServerInfo {
    serverKey: string;
    serverInfo: {
        name: string;
        host: string;
        sshConfig: any;
    };
    systemStats?: {
        success: boolean;
        cpu?: {
            percent: string;
            cores: number;
        };
        memory?: {
            total: number;
            used: number;
            percent: string;
        };
        disk?: {
            total: string;
            used: string;
            percent: number;
        };
        uptime?: string;
    };
    utilization?: {
        success: boolean;
    };
    containerCount: number;
    isOnline: boolean;
}

export default function ServersPage() {
    const [servers, setServers] = useState<ServerInfo[]>([]);
    const [dockerStats, setDockerStats] = useState<Record<string, DockerStats>>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState<string | null>(null);
    const [selectedServer, setSelectedServer] = useState<string>('');
    const [showDockerStats, setShowDockerStats] = useState(false);

    // Initial load
    useEffect(() => {
        fetchServers();
    }, []);

    // Auto-refresh server stats every 5 seconds (htop style)
    useEffect(() => {
        const interval = setInterval(() => {
            fetchServers();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Auto-refresh Docker stats if modal is open
    useEffect(() => {
        if (!showDockerStats || !selectedServer) return;

        const interval = setInterval(() => {
            fetchDockerStats(selectedServer, true); // true = silent refresh
        }, 5000);
        return () => clearInterval(interval);
    }, [showDockerStats, selectedServer]);

    const fetchServers = async () => {
        try {
            // silent refresh - don't show loading spinner if we already have data
            const res = await api.get('/admin/servers');
            setServers(res.data.servers || []);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch servers', error);
            // Don't toast on background refresh failure to avoid spam
            if (loading) setLoading(false);
        }
    };

    const fetchDockerStats = async (serverKey: string, silent = false) => {
        if (!silent) setRefreshing(serverKey);
        try {
            const res = await api.get(`/admin/servers/${serverKey}/docker-stats`);
            setDockerStats(prev => ({
                ...prev,
                [serverKey]: res.data.docker
            }));
            if (!silent) {
                setShowDockerStats(true);
                setSelectedServer(serverKey);
                toast.success(`Docker stats loaded for ${serverKey}`);
            }
        } catch (error: any) {
            console.error(error);
            if (!silent) toast.error(error.response?.data?.error || 'Failed to fetch Docker stats');
        } finally {
            if (!silent) setRefreshing(null);
        }
    };

    const [logs, setLogs] = useState<string>('');
    const [showLogs, setShowLogs] = useState(false);
    const [logsLoading, setLogsLoading] = useState(false);
    const [selectedContainer, setSelectedContainer] = useState<string | null>(null);

    // ... existing functions ...

    const fetchContainerLogs = async (serverKey: string, containerId: string, containerName: string) => {
        setLogsLoading(true);
        setSelectedContainer(containerName);
        setShowLogs(true);
        setLogs(''); // clear previous

        try {
            const res = await api.get(`/admin/servers/${serverKey}/containers/${containerId}/logs`);
            setLogs(res.data.logs);
        } catch (error: any) {
            setLogs(`Error fetching logs: ${error.response?.data?.error || error.message}`);
        } finally {
            setLogsLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    const currentDockerStats = selectedServer ? dockerStats[selectedServer] : null;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-white">Server Management</h1>
                    <p className="text-gray-400 mt-2">Monitor and manage deployment servers</p>
                </div>
                <button
                    onClick={fetchServers}
                    className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
                >
                    <ArrowPathIcon className="h-5 w-5" />
                    <span>Refresh</span>
                </button>
            </div>

            {/* Server Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {servers.map((server) => (
                    <div
                        key={server.serverKey}
                        className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all"
                    >
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                                        <ServerIcon className="h-6 w-6" />
                                        {server.serverKey}
                                    </h3>
                                    <p className="text-sm text-gray-400 mt-1">{server.serverInfo.host}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {server.isOnline ? (
                                        <span className="flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                                            <CheckCircleIcon className="h-4 w-4" />
                                            Online
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs">
                                            <XCircleIcon className="h-4 w-4" />
                                            Offline
                                        </span>
                                    )}
                                </div>
                            </div>

                            {server.systemStats?.success && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="bg-black/20 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <CpuChipIcon className="h-4 w-4 text-blue-400" />
                                            <span className="text-xs text-gray-400">CPU</span>
                                        </div>
                                        <p className="text-lg font-bold text-white">
                                            {server.systemStats.cpu?.percent}%
                                        </p>
                                    </div>
                                    <div className="bg-black/20 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <CircleStackIcon className="h-4 w-4 text-green-400" />
                                            <span className="text-xs text-gray-400">RAM</span>
                                        </div>
                                        <p className="text-lg font-bold text-white">
                                            {server.systemStats.memory?.percent}%
                                        </p>
                                    </div>
                                    <div className="bg-black/20 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <CircleStackIcon className="h-4 w-4 text-purple-400" />
                                            <span className="text-xs text-gray-400">Disk</span>
                                        </div>
                                        <p className="text-lg font-bold text-white">
                                            {server.systemStats.disk?.percent}%
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="pt-3 border-t border-gray-800">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm text-gray-400">Active Containers</span>
                                    <span className="text-lg font-bold text-purple-400">{server.containerCount}</span>
                                </div>
                                <button
                                    onClick={() => fetchDockerStats(server.serverKey)}
                                    disabled={refreshing === server.serverKey}
                                    className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg transition"
                                >
                                    {refreshing === server.serverKey ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                                            <span>Loading...</span>
                                        </>
                                    ) : (
                                        <>
                                            <ServerIcon className="h-4 w-4" />
                                            <span>View Docker Stats</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Docker Stats Modal/Section */}
            {showDockerStats && currentDockerStats && (
                <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl overflow-hidden relative">
                    {showLogs && (
                        <div className="absolute inset-0 bg-gray-900 z-50 flex flex-col animate-in fade-in zoom-in duration-200">
                            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-black/40">
                                <h3 className="font-mono text-green-400 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    logs@{selectedContainer} ~ % tail -n 100
                                </h3>
                                <button
                                    onClick={() => setShowLogs(false)}
                                    className="text-gray-400 hover:text-white px-3 py-1 rounded border border-gray-700 hover:bg-gray-800"
                                >
                                    Close Logs
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-4 font-mono text-xs text-gray-300 bg-black/90">
                                {logsLoading ? (
                                    <div className="flex items-center gap-2 text-purple-400">
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-purple-400"></div>
                                        Fetching logs...
                                    </div>
                                ) : (
                                    <pre className="whitespace-pre-wrap">{logs || 'No logs available.'}</pre>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-white">
                                Docker Stats - {selectedServer}
                            </h2>
                            <p className="text-sm text-gray-400 mt-1">
                                {currentDockerStats.containers.running} running, {currentDockerStats.containers.stopped} stopped
                            </p>
                        </div>
                        <button
                            onClick={() => setShowDockerStats(false)}
                            className="text-gray-400 hover:text-white transition"
                        >
                            <XCircleIcon className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Docker System Info */}
                    <div className="p-6 border-b border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-4">System Information</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-xs text-gray-400">Docker Version</p>
                                <p className="text-sm font-semibold text-white">{currentDockerStats.system.version}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">OS</p>
                                <p className="text-sm font-semibold text-white">{currentDockerStats.system.operatingSystem}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">CPUs</p>
                                <p className="text-sm font-semibold text-white">{currentDockerStats.system.cpus}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Total Memory</p>
                                <p className="text-sm font-semibold text-white">{currentDockerStats.system.totalMemory}</p>
                            </div>
                        </div>
                    </div>

                    {/* Containers Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-800/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Container
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        User
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        CPU
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Memory
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Network
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {currentDockerStats.containers.list.map((container) => (
                                    <tr key={container.id} className="hover:bg-gray-800/30">
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="text-sm font-medium text-white">{container.name}</p>
                                                <p className="text-xs text-gray-500 font-mono">{container.id}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {container.user ? (
                                                <div>
                                                    <p className="text-sm font-medium text-white">{container.user.displayName}</p>
                                                    <p className="text-xs text-gray-500">{container.user.email}</p>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                                                            container.user.plan === 'pro' ? 'bg-purple-500/20 text-purple-400' :
                                                            container.user.plan === 'starter' ? 'bg-blue-500/20 text-blue-400' :
                                                            'bg-gray-500/20 text-gray-400'
                                                        }`}>{container.user.plan}</span>
                                                        <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                                                            container.user.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                                            container.user.status === 'suspended' ? 'bg-yellow-500/20 text-yellow-400' :
                                                            container.user.status === 'deleted' ? 'bg-red-500/20 text-red-400' :
                                                            'bg-gray-500/20 text-gray-400'
                                                        }`}>{container.user.status}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-600 italic">System</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-2 py-1 text-xs rounded-full ${container.state === 'running'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-gray-500/20 text-gray-400'
                                                    }`}
                                            >
                                                {container.state}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {container.stats.error ? (
                                                <span className="text-xs text-gray-500">N/A</span>
                                            ) : (
                                                <span className="text-sm text-white">{container.stats.cpu}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {container.stats.memory && !container.stats.error ? (
                                                <div>
                                                    <p className="text-sm text-white">{container.stats.memory.usage}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {container.stats.memory.percent} of {container.stats.memory.limit}
                                                    </p>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-500">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {container.stats.network && !container.stats.error ? (
                                                <div className="text-xs">
                                                    <p className="text-white">↓ {container.stats.network.rx}</p>
                                                    <p className="text-gray-400">↑ {container.stats.network.tx}</p>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-500">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => fetchContainerLogs(selectedServer, container.id, container.name)}
                                                className="text-purple-400 hover:text-purple-300 text-sm hover:underline"
                                            >
                                                View Logs
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 bg-gray-800/30 flex justify-between items-center">
                        <p className="text-sm text-gray-400">
                            Showing {currentDockerStats.containers.list.length} containers
                        </p>
                        <button
                            onClick={() => fetchDockerStats(selectedServer)}
                            className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
                        >
                            <ArrowPathIcon className="h-4 w-4" />
                            Refresh Stats
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
