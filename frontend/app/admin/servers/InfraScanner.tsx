'use client';

import { useState } from 'react';
import api from '@/lib/api';
import {
    ExclamationTriangleIcon,
    TrashIcon,
    CheckCircleIcon,
    MagnifyingGlassCircleIcon,
    ServerStackIcon,
    BugAntIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Orphan {
    name: string;
    server: string;
    image: string;
    status: string;
    state: string;
    created: string;
}

interface Zombie {
    name: string;
    email: string;
    userId: string;
    assignedServer: string;
    userStatus: string;
}

interface InfraScanResult {
    orphans: Orphan[];
    zombies: Zombie[];
    active: { name: string; server: string; user: string }[];
    stats: {
        totalContainers: number;
        orphanCount: number;
        zombieCount: number;
        serverUsage: Record<string, number>;
    };
}

export default function InfraScanner() {
    const [scanData, setScanData] = useState<InfraScanResult | null>(null);
    const [scanning, setScanning] = useState(false);
    const [pruning, setPruning] = useState<string | null>(null);

    const runScan = async () => {
        setScanning(true);
        try {
            const res = await api.get('/api/admin/infra/scan');
            setScanData(res.data);
            toast.success('Infrastructure scan complete');
        } catch (error) {
            toast.error('Scan failed');
        } finally {
            setScanning(false);
        }
    };

    const pruneContainer = async (server: string, name: string) => {
        if (!confirm(`Are you sure you want to force-delete ${name} on ${server}?`)) return;

        setPruning(name);
        try {
            await api.delete(`/api/admin/infra/containers/${server}/${name}`);
            toast.success(`Pruned ${name}`);
            // Refresh scan data
            setScanData(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    orphans: prev.orphans.filter(o => o.name !== name),
                    stats: {
                        ...prev.stats,
                        orphanCount: prev.stats.orphanCount - 1
                    }
                };
            });
        } catch (error) {
            toast.error('Pruning failed');
        } finally {
            setPruning(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-gray-900/50 p-6 rounded-2xl border border-gray-800 shadow-2xl">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <BugAntIcon className="h-6 w-6 text-purple-400" />
                        Infrastructure Health Scanner
                    </h2>
                    <p className="text-gray-400">Detect and prune orphan containers or zombie records across all Oracle clusters</p>
                </div>
                <button
                    onClick={runScan}
                    disabled={scanning}
                    className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white px-6 py-3 rounded-xl transition shadow-lg shadow-purple-500/20"
                >
                    <MagnifyingGlassCircleIcon className={`h-6 w-6 ${scanning ? 'animate-spin' : ''}`} />
                    <span>{scanning ? 'Scanning Servers...' : 'Run Full System Scan'}</span>
                </button>
            </div>

            {scanData && (
                <div className="grid grid-cols-1 gap-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-gray-900/40 border border-gray-800 p-4 rounded-xl">
                            <p className="text-gray-500 text-xs uppercase font-bold">Total Containers</p>
                            <p className="text-2xl font-bold text-white">{scanData.stats.totalContainers}</p>
                        </div>
                        <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl">
                            <p className="text-orange-400 text-xs uppercase font-bold">Orphans (Safe to prune)</p>
                            <p className="text-2xl font-bold text-orange-500">{scanData.stats.orphanCount}</p>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
                            <p className="text-red-400 text-xs uppercase font-bold">Zombies (Need rebuild)</p>
                            <p className="text-2xl font-bold text-red-500">{scanData.stats.zombieCount}</p>
                        </div>
                        <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl">
                            <p className="text-green-400 text-xs uppercase font-bold">Active Matched</p>
                            <p className="text-2xl font-bold text-green-500">{scanData.active.length}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Orphans Column */}
                        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden flex flex-col shadow-xl">
                            <div className="p-4 bg-orange-500/20 border-b border-orange-500/30 flex items-center justify-between">
                                <h3 className="text-orange-400 font-bold flex items-center gap-2">
                                    <ExclamationTriangleIcon className="h-5 w-5" />
                                    Orphan Containers
                                </h3>
                                <span className="text-xs bg-orange-500/20 px-2 py-1 rounded text-orange-300">Found: {scanData.orphans.length}</span>
                            </div>
                            <div className="overflow-y-auto max-h-[500px] divide-y divide-gray-800">
                                {scanData.orphans.length === 0 ? (
                                    <p className="p-8 text-center text-gray-500 italic">No orphan containers detected. Infrastructure is clean. ✨</p>
                                ) : (
                                    scanData.orphans.map((orphan) => (
                                        <div key={orphan.name} className="p-4 flex items-center justify-between hover:bg-white/5 transition group">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-white font-mono text-sm truncate">{orphan.name}</p>
                                                <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                                                    <span className="bg-gray-800 px-1.5 py-0.5 rounded text-white font-bold">{orphan.server}</span>
                                                    <span>{orphan.status}</span>
                                                    <span className="truncate max-w-[150px]">{orphan.image}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => pruneContainer(orphan.server, orphan.name)}
                                                disabled={pruning === orphan.name}
                                                className="ml-4 flex-shrink-0 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white p-2.5 rounded-xl transition-all border border-red-500/20 shadow-lg"
                                            >
                                                {pruning === orphan.name ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <TrashIcon className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Zombies Column */}
                        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden flex flex-col shadow-xl">
                            <div className="p-4 bg-red-500/20 border-b border-red-500/30 flex items-center justify-between">
                                <h3 className="text-red-400 font-bold flex items-center gap-2">
                                    <ServerStackIcon className="h-5 w-5" />
                                    Zombie Records
                                </h3>
                                <span className="text-xs bg-red-500/20 px-2 py-1 rounded text-red-300">Found: {scanData.zombies.length}</span>
                            </div>
                            <div className="overflow-y-auto max-h-[500px] divide-y divide-gray-800">
                                {scanData.zombies.length === 0 ? (
                                    <p className="p-8 text-center text-gray-500 italic">No zombie records found. Database matches reality. ✨</p>
                                ) : (
                                    scanData.zombies.map((zombie) => (
                                        <div key={zombie.name} className="p-4 flex items-center justify-between hover:bg-white/5 transition group">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-white font-mono text-sm truncate">{zombie.name}</p>
                                                <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                                                    <span className="text-red-400 font-bold">{zombie.email}</span>
                                                    <span>{zombie.assignedServer}</span>
                                                    <span className="bg-gray-800 px-1.5 py-0.5 rounded uppercase">{zombie.userStatus}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => toast('Force Rebuild coming soon')}
                                                className="ml-4 opacity-0 group-hover:opacity-100 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all border border-blue-500/30"
                                            >
                                                REBUILD
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
