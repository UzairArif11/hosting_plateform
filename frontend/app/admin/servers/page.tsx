'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import InfraScanner from './InfraScanner';

interface Server {
    domain: string;
    ip: string;
    sshKey: string;
    status: string;
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

    useEffect(() => {
        fetchServers();
    }, []);

    const fetchServers = async () => {
        try {
            const res = await api.get('/api/settings/servers');
            setServers(res.data.servers || {});
            setDnsInstructions(res.data.dnsInstructions || {});
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch servers:', error);
            setLoading(false);
        }
    };

    const verifyDNS = async (serverKey: string, domain: string) => {
        setVerifying(serverKey);
        try {
            const res = await api.post('/api/settings/verify-dns', { serverKey, domain });
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
                                                <div className="grid grid-cols-4 gap-4 text-gray-300">
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
                            <div className="flex items-center space-x-4">
                                <button
                                    onClick={() => verifyDNS(serverKey, server.domain)}
                                    disabled={verifying === serverKey}
                                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg transition"
                                >
                                    {verifying === serverKey ? 'Verifying...' : '🔍 Verify DNS'}
                                </button>

                                {verificationResults[serverKey] && (
                                    <div
                                        className={`flex-1 px-4 py-2 rounded-lg border ${verificationResults[serverKey].verified
                                            ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                                            }`}
                                    >
                                        {verificationResults[serverKey].verified ? '✅' : '❌'}{' '}
                                        {verificationResults[serverKey].message}
                                    </div>
                                )}
                            </div>

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
