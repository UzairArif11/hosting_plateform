'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import InfraScanner from './InfraScanner';

interface ServerCapacity {
    totalCPU: number;
    totalRAM: number;
    totalStorage: number;
    allocatedCPU: number;
    allocatedRAM: number;
    allocatedStorage: number;
    maxContainers: number;
    serverType: string;
    isActive: boolean;
    warnings: any[];
    lastUpdated: string | null;
}

interface Server {
    domain: string;
    ip: string;
    sshKey: string;
    status: string;
    capacity?: ServerCapacity;
}

interface DNSRecord {
    type: string;
    name: string;
    value: string;
    ttl: number;
}

interface DNSInstructions {
    domain: string;
    ip: string;
    records: DNSRecord[];
}

export default function ServerManagement() {
    const [servers, setServers] = useState<Record<string, Server>>({});
    const [dnsInstructions, setDnsInstructions] = useState<Record<string, DNSInstructions>>({});
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState<string | null>(null);
    const [verificationResults, setVerificationResults] = useState<Record<string, any>>({});
    
    // New Feature State
    const [healthStatus, setHealthStatus] = useState<Record<string, any>>({});
    const [testingServer, setTestingServer] = useState<string | null>(null);
    const [testLogs, setTestLogs] = useState<Record<string, string[]>>({});
    const [serverLogs, setServerLogs] = useState<Record<string, any>>({});
    const [loadingLogs, setLoadingLogs] = useState<string | null>(null);
    const [editingServer, setEditingServer] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ totalCPU: 4, totalRAM: 24, totalStorage: 200, isActive: true });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchServers();
    }, []);

    const fetchServers = async () => {
        try {
            const res = await api.get('/settings/servers');
            setServers(res.data.servers || {});
            setDnsInstructions(res.data.dnsInstructions || {});
            setLoading(false);
            
            // Background fetch health
            fetchHealth();
        } catch (error) {
            console.error('Failed to fetch servers:', error);
            setLoading(false);
        }
    };

    const fetchHealth = async () => {
        try {
            const res = await api.get('/admin/servers/health');
            if (res.data.success) {
                setHealthStatus(res.data.servers);
            }
        } catch (error) {
            console.error('Failed to fetch server health:', error);
        }
    };

    const runTestDeployment = async (serverKey: string) => {
        if (!confirm(`Are you sure you want to run a test deployment on ${serverKey}? This will install PM2 (if missing) and create a temporary Docker container.`)) return;
        
        setTestingServer(serverKey);
        setTestLogs({ ...testLogs, [serverKey]: ['Initiating test deployment...'] });
        
        try {
            const res = await api.post(`/admin/servers/${serverKey}/test-deploy`);
            setTestLogs({ ...testLogs, [serverKey]: res.data.logs || ['Test deployment completed successfully!'] });
        } catch (error: any) {
            setTestLogs({ 
                ...testLogs, 
                [serverKey]: [
                    '❌ Test deployment failed.', 
                    error.response?.data?.error || error.message
                ] 
            });
        } finally {
            setTestingServer(null);
        }
    };

    const fetchServerLogs = async (serverKey: string) => {
        setLoadingLogs(serverKey);
        try {
            const res = await api.get(`/admin/servers/${serverKey}/logs`);
            if (res.data.success) {
                setServerLogs({ ...serverLogs, [serverKey]: res.data.stats });
            }
        } catch (error) {
            alert('Failed to fetch server logs');
        } finally {
            setLoadingLogs(null);
        }
    };

    const startEdit = (serverKey: string, server: Server) => {
        setEditForm({
            totalCPU: server.capacity?.totalCPU || 4,
            totalRAM: server.capacity?.totalRAM || 24,
            totalStorage: server.capacity?.totalStorage || 200,
            isActive: server.capacity?.isActive ?? true
        });
        setEditingServer(serverKey);
    };

    const saveCapacity = async () => {
        if (!editingServer) return;
        setSaving(true);
        try {
            await api.put(`/settings/servers/${editingServer}`, editForm);
            setEditingServer(null);
            fetchServers(); // Refresh data
        } catch (error) {
            alert('Failed to save server capacity');
        } finally {
            setSaving(false);
        }
    };

    const verifyDNS = async (serverKey: string, domain: string) => {
        setVerifying(serverKey);
        try {
            const res = await api.post('/settings/verify-dns', { serverKey, domain });
            setVerificationResults({
                ...verificationResults,
                [serverKey]: res.data
            });
            setVerifying(null);
        } catch (error) {
            alert('Error verifying DNS');
            setVerifying(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading servers...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">🖥️ Server Management</h1>
                    <p className="text-gray-300">Manage deployment servers and DNS configuration</p>
                </div>

                {/* Servers List */}
                <div className="space-y-6">
                    {Object.entries(servers).map(([serverKey, server]) => (
                        <div
                            key={serverKey}
                            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="text-2xl font-bold text-white mb-1">
                                        {serverKey} - {server.domain}
                                    </h3>
                                    <div className="flex items-center space-x-4 text-gray-300">
                                        <span>IP: <strong className="text-white">{server.ip}</strong></span>
                                        <span>SSH: <strong className="text-white">{server.sshKey}</strong></span>
                                    </div>
                                </div>
                                <span
                                    className={`px-4 py-2 rounded-full text-sm font-semibold ${server.status === 'active'
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                        : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                        }`}
                                >
                                    {server.status === 'active' ? '✅ Active' : '⚠️ Inactive'}
                                </span>
                            </div>

                            {/* DNS Instructions */}
                            {dnsInstructions[serverKey] && (
                                <div className="bg-black/20 border border-white/10 rounded-lg p-4 mb-4">
                                    <h4 className="text-lg font-semibold text-white mb-3">📋 DNS Records Required:</h4>
                                    <div className="space-y-2">
                                        {dnsInstructions[serverKey].records.map((record, idx) => (
                                            <div
                                                key={idx}
                                                className="bg-white/5 border border-white/10 rounded p-3 font-mono text-sm"
                                            >
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-gray-300">
                                                    <div>
                                                        <span className="text-gray-500">Type:</span>{' '}
                                                        <strong className="text-blue-400">{record.type}</strong>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Name:</span>{' '}
                                                        <strong className="text-green-400">{record.name}</strong>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Value:</span>{' '}
                                                        <strong className="text-yellow-400">{record.value}</strong>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">TTL:</span>{' '}
                                                        <strong className="text-purple-400">{record.ttl}</strong>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* DNS Verification */}
                            <div className="flex flex-wrap items-center gap-4">
                                <button
                                    onClick={() => verifyDNS(serverKey, server.domain)}
                                    disabled={verifying === serverKey}
                                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg transition"
                                >
                                    {verifying === serverKey ? 'Verifying...' : '🔍 Verify DNS'}
                                </button>
                                
                                {serverKey !== 'EC1' && (
                                    <>
                                        <button
                                            onClick={() => runTestDeployment(serverKey)}
                                            disabled={testingServer === serverKey}
                                            className="bg-purple-500 hover:bg-purple-600 border border-purple-400 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg transition flex items-center gap-2"
                                        >
                                            {testingServer === serverKey ? (
                                                <><span className="animate-spin">⚙️</span> Deploying...</>
                                            ) : (
                                                <>🚀 Run Test Deploy</>
                                            )}
                                        </button>
                                        
                                        <button
                                            onClick={() => fetchServerLogs(serverKey)}
                                            disabled={loadingLogs === serverKey}
                                            className="bg-gray-700 hover:bg-gray-600 border border-gray-500 disabled:bg-gray-800 text-white px-6 py-2 rounded-lg transition"
                                        >
                                            {loadingLogs === serverKey ? 'Loading...' : '📋 View Logs & Stats'}
                                        </button>
                                    </>
                                )}

                                {verificationResults[serverKey] && (
                                    <div
                                        className={`px-4 py-2 rounded-lg border ${verificationResults[serverKey].verified
                                            ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                                            }`}
                                    >
                                        {verificationResults[serverKey].verified ? '✅' : '❌'}{' '}
                                        {verificationResults[serverKey].message}
                                    </div>
                                )}
                            </div>
                            
                            {/* Server Capacity */}
                            {server.capacity && (
                                <div className="mt-6 bg-black/20 border border-white/10 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-lg font-semibold text-white">📊 Server Capacity</h4>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                server.capacity.serverType === 'shared_users'
                                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                    : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                            }`}>
                                                {server.capacity.serverType === 'shared_users' ? '👥 Shared' : '🔒 Dedicated'}
                                            </span>
                                            <button
                                                onClick={() => startEdit(serverKey, server)}
                                                className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-sm transition"
                                            >
                                                ✏️ Edit
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* CPU */}
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-gray-400">CPU</span>
                                                <span className="text-white">{server.capacity.allocatedCPU}/{server.capacity.totalCPU} OCPU</span>
                                            </div>
                                            <div className="w-full bg-gray-700 rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full transition-all ${
                                                        (server.capacity.allocatedCPU / server.capacity.totalCPU) > 0.8 ? 'bg-red-500' :
                                                        (server.capacity.allocatedCPU / server.capacity.totalCPU) > 0.6 ? 'bg-yellow-500' : 'bg-green-500'
                                                    }`}
                                                    style={{ width: `${Math.min(100, (server.capacity.allocatedCPU / server.capacity.totalCPU) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                        {/* RAM */}
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-gray-400">RAM</span>
                                                <span className="text-white">{server.capacity.allocatedRAM}/{server.capacity.totalRAM} GB</span>
                                            </div>
                                            <div className="w-full bg-gray-700 rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full transition-all ${
                                                        (server.capacity.allocatedRAM / server.capacity.totalRAM) > 0.85 ? 'bg-red-500' :
                                                        (server.capacity.allocatedRAM / server.capacity.totalRAM) > 0.6 ? 'bg-yellow-500' : 'bg-green-500'
                                                    }`}
                                                    style={{ width: `${Math.min(100, (server.capacity.allocatedRAM / server.capacity.totalRAM) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                        {/* Storage */}
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-gray-400">Storage</span>
                                                <span className="text-white">{server.capacity.allocatedStorage}/{server.capacity.totalStorage} GB</span>
                                            </div>
                                            <div className="w-full bg-gray-700 rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full transition-all ${
                                                        (server.capacity.allocatedStorage / server.capacity.totalStorage) > 0.9 ? 'bg-red-500' :
                                                        (server.capacity.allocatedStorage / server.capacity.totalStorage) > 0.7 ? 'bg-yellow-500' : 'bg-green-500'
                                                    }`}
                                                    style={{ width: `${Math.min(100, (server.capacity.allocatedStorage / server.capacity.totalStorage) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 mt-3 text-sm text-gray-400">
                                        <span>Max Containers: <strong className="text-white">{server.capacity.maxContainers}</strong></span>
                                        {server.capacity.lastUpdated && (
                                            <span>Updated: <strong className="text-white">{new Date(server.capacity.lastUpdated).toLocaleDateString()}</strong></span>
                                        )}
                                        {server.capacity.warnings.length > 0 && (
                                            <span className="text-yellow-400">⚠️ {server.capacity.warnings.length} warning(s)</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Health Indicators */}
                            {healthStatus[serverKey] && serverKey !== 'EC1' && (
                                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-black/20 border border-white/5 rounded p-3 text-center">
                                        <div className="text-gray-400 text-xs mb-1">SSH Connection</div>
                                        <div className="text-xl">{healthStatus[serverKey].ssh ? '✅' : '❌'}</div>
                                    </div>
                                    <div className="bg-black/20 border border-white/5 rounded p-3 text-center">
                                        <div className="text-gray-400 text-xs mb-1">Docker Daemon</div>
                                        <div className="text-xl">{healthStatus[serverKey].dockerVersion ? '✅' : '❌'}</div>
                                    </div>
                                    <div className="bg-black/20 border border-white/5 rounded p-3 text-center">
                                        <div className="text-gray-400 text-xs mb-1">Tunnel Active</div>
                                        <div className="text-xl">{healthStatus[serverKey].tunnelActive ? '✅' : '❌'}</div>
                                    </div>
                                    <div className="bg-black/20 border border-white/5 rounded p-3 text-center">
                                        <div className="text-gray-400 text-xs mb-1">Server Type</div>
                                        <div className="text-white text-sm font-semibold mt-1">{healthStatus[serverKey].type}</div>
                                    </div>
                                </div>
                            )}

                            {/* Test Deployment Logs */}
                            {testLogs[serverKey] && (
                                <div className="mt-4 bg-black/40 border border-purple-500/30 rounded-lg p-4 font-mono text-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-purple-400 font-semibold">Test Deployment Status</h5>
                                        {testingServer === serverKey && <span className="text-xs text-purple-300 animate-pulse">Running...</span>}
                                    </div>
                                    <div className="h-48 overflow-y-auto space-y-1 text-gray-300">
                                        {testLogs[serverKey].map((log, i) => (
                                            <div key={i}>{log}</div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Server Logs & Stats */}
                            {serverLogs[serverKey] && (
                                <div className="mt-4 bg-black/40 border border-blue-500/30 rounded-lg p-4 font-mono text-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h5 className="text-blue-400 font-semibold">System Statistics</h5>
                                        <button 
                                            onClick={() => setServerLogs({...serverLogs, [serverKey]: null})}
                                            className="text-gray-400 hover:text-white"
                                        >
                                            ✕ Close
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <div className="text-gray-500 text-xs uppercase mb-1">Uptime</div>
                                            <div className="text-white bg-black/50 p-2 rounded">{serverLogs[serverKey].uptime}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 text-xs uppercase mb-1">Memory Usage (MB)</div>
                                            <pre className="text-green-400 bg-black/50 p-2 rounded overflow-x-auto text-xs">{serverLogs[serverKey].memory}</pre>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 text-xs uppercase mb-1">Disk Space</div>
                                            <pre className="text-yellow-400 bg-black/50 p-2 rounded overflow-x-auto text-xs">{serverLogs[serverKey].disk}</pre>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 text-xs uppercase mb-1">Running Containers</div>
                                            <pre className="text-blue-300 bg-black/50 p-2 rounded overflow-x-auto text-xs">{serverLogs[serverKey].containers || 'No containers running'}</pre>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Verification Details */}
                            {verificationResults[serverKey] && !verificationResults[serverKey].verified && (
                                <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                                    <h5 className="text-yellow-400 font-semibold mb-2">DNS Configuration Needed:</h5>
                                    <p className="text-gray-300 text-sm mb-2">
                                        Expected IP: <strong className="text-white">{verificationResults[serverKey].expectedIP}</strong>
                                    </p>
                                    {verificationResults[serverKey].foundIPs && (
                                        <p className="text-gray-300 text-sm">
                                            Found IPs: <strong className="text-white">{verificationResults[serverKey].foundIPs.join(', ')}</strong>
                                        </p>
                                    )}
                                    <p className="text-gray-400 text-xs mt-2">
                                        Please add the DNS records shown above at your domain registrar.
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Edit Capacity Modal */}
                {editingServer && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-gray-900 border border-white/20 rounded-lg p-6 max-w-md w-full mx-4">
                            <h3 className="text-2xl font-bold text-white mb-4">✏️ Edit {editingServer} Capacity</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-gray-300 text-sm block mb-1">Total CPU (OCPU)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={editForm.totalCPU}
                                        onChange={(e) => setEditForm({ ...editForm, totalCPU: parseFloat(e.target.value) })}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-300 text-sm block mb-1">Total RAM (GB)</label>
                                    <input
                                        type="number"
                                        value={editForm.totalRAM}
                                        onChange={(e) => setEditForm({ ...editForm, totalRAM: parseFloat(e.target.value) })}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-300 text-sm block mb-1">Total Storage (GB)</label>
                                    <input
                                        type="number"
                                        value={editForm.totalStorage}
                                        onChange={(e) => setEditForm({ ...editForm, totalStorage: parseFloat(e.target.value) })}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="text-gray-300 text-sm">Server Active</label>
                                    <button
                                        onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                                        className={`px-4 py-1 rounded-full text-sm font-medium transition ${
                                            editForm.isActive
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                        }`}
                                    >
                                        {editForm.isActive ? '✅ Active' : '❌ Inactive'}
                                    </button>
                                </div>
                            </div>
                            <div className="flex space-x-4 mt-6">
                                <button
                                    onClick={() => setEditingServer(null)}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveCapacity}
                                    disabled={saving}
                                    className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white font-semibold px-4 py-2 rounded-lg transition"
                                >
                                    {saving ? 'Saving...' : '💾 Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Infrastructure Scan Utility */}
                <div className="mt-12">
                    <InfraScanner />
                </div>

                {/* Help Section */}
                <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-blue-400 mb-4">💡 How to Configure DNS</h3>
                    <ol className="text-gray-300 space-y-2">
                        <li>1. Go to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)</li>
                        <li>2. Find the DNS management section</li>
                        <li>3. Add the A records shown above for each server</li>
                        <li>4. Wait 5-10 minutes for DNS propagation</li>
                        <li>5. Click "Verify DNS" to check if configuration is correct</li>
                        <li>6. Once verified, you can proceed with domain migration</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
