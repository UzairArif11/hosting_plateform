'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Settings {
    baseDomain: string;
    serverDomains: Record<string, string>;
    sslEmail: string;
    protocol: string;
}

export default function DomainManagement() {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [newDomains, setNewDomains] = useState<Record<string, string>>({});
    const [migrationMode, setMigrationMode] = useState<'automatic' | 'manual'>('automatic');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/settings');
            const data = res.data;
            setSettings(data);
            setNewDomains(data.serverDomains || {});
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch settings:', error);
            toast.error('Failed to load domain settings');
            setLoading(false);
        }
    };

    const handleUpdateDomains = async () => {
        if (!confirm(`Are you sure you want to update domains with ${migrationMode} migration?`)) {
            return;
        }

        setProcessing(true);

        try {
            const res = await api.put('/settings/domains', {
                serverDomains: newDomains,
                updateServerConfig: migrationMode === 'automatic'
            });

            toast.success(res.data.message || 'Domains updated successfully');
            setEditing(false);
            fetchSettings();
            setProcessing(false);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Error updating domains');
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading domain settings...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">🌐 Domain Management</h1>
                    <p className="text-gray-300">Configure platform domains and migration settings</p>
                </div>

                {/* Current Domains */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-white">Current Domains</h2>
                        {!editing && (
                            <button
                                onClick={() => setEditing(true)}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition"
                            >
                                Edit Domains
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {settings && Object.entries(settings.serverDomains).map(([serverKey, domain]) => (
                            <div key={serverKey} className="bg-black/20 border border-white/10 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">{serverKey}</h3>
                                        {editing ? (
                                            <input
                                                type="text"
                                                value={newDomains[serverKey] || ''}
                                                onChange={(e) => setNewDomains({ ...newDomains, [serverKey]: e.target.value })}
                                                className="mt-2 w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                                                placeholder="example.com"
                                            />
                                        ) : (
                                            <p className="text-gray-300 mt-1">{domain}</p>
                                        )}
                                    </div>
                                    <span className="px-4 py-2 rounded-full text-sm font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                                        Active
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Migration Options */}
                {editing && (
                    <>
                        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 mb-6">
                            <h2 className="text-2xl font-bold text-white mb-4">Migration Mode</h2>

                            <div className="space-y-4">
                                {/* Automatic Migration */}
                                <div
                                    onClick={() => setMigrationMode('automatic')}
                                    className={`border-2 rounded-lg p-4 cursor-pointer transition ${migrationMode === 'automatic'
                                            ? 'border-green-500 bg-green-500/10'
                                            : 'border-white/10 bg-black/20 hover:border-white/30'
                                        }`}
                                >
                                    <div className="flex items-start">
                                        <input
                                            type="radio"
                                            checked={migrationMode === 'automatic'}
                                            onChange={() => setMigrationMode('automatic')}
                                            className="mt-1 mr-4"
                                        />
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-white mb-2">
                                                🤖 Automatic Migration (Recommended)
                                            </h3>
                                            <p className="text-gray-300 text-sm mb-2">
                                                System automatically updates:
                                            </p>
                                            <ul className="text-gray-400 text-sm space-y-1">
                                                <li>✅ Database (deployment URLs)</li>
                                                <li>✅ Nginx configuration on servers</li>
                                                <li>✅ SSL certificates (certbot)</li>
                                                <li>✅ User email notifications</li>
                                                <li>✅ Zero downtime migration</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Manual Migration */}
                                <div
                                    onClick={() => setMigrationMode('manual')}
                                    className={`border-2 rounded-lg p-4 cursor-pointer transition ${migrationMode === 'manual'
                                            ? 'border-yellow-500 bg-yellow-500/10'
                                            : 'border-white/10 bg-black/20 hover:border-white/30'
                                        }`}
                                >
                                    <div className="flex items-start">
                                        <input
                                            type="radio"
                                            checked={migrationMode === 'manual'}
                                            onChange={() => setMigrationMode('manual')}
                                            className="mt-1 mr-4"
                                        />
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-white mb-2">
                                                🔧 Manual Migration
                                            </h3>
                                            <p className="text-gray-300 text-sm mb-2">
                                                System updates database only:
                                            </p>
                                            <ul className="text-gray-400 text-sm space-y-1">
                                                <li>✅ Database (deployment URLs)</li>
                                                <li>✅ User email notifications</li>
                                                <li>⚠️ You must manually update Nginx</li>
                                                <li>⚠️ You must manually update SSL</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Warning */}
                        {migrationMode === 'manual' && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 mb-6">
                                <h3 className="text-xl font-bold text-yellow-400 mb-2">⚠️ Manual Steps Required</h3>
                                <p className="text-gray-300 mb-4">
                                    After updating domains, you must manually:
                                </p>
                                <ol className="text-gray-300 space-y-2">
                                    <li>1. SSH to each server (EC2, EC3, etc.)</li>
                                    <li>2. Update <code className="bg-black/30 px-2 py-1 rounded">/etc/nginx/sites-available/default</code></li>
                                    <li>3. Run <code className="bg-black/30 px-2 py-1 rounded">sudo nginx -t</code> to test</li>
                                    <li>4. Run <code className="bg-black/30 px-2 py-1 rounded">sudo systemctl reload nginx</code></li>
                                    <li>5. Run <code className="bg-black/30 px-2 py-1 rounded">sudo certbot --nginx -d newdomain.com</code></li>
                                </ol>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex space-x-4">
                            <button
                                onClick={() => {
                                    setEditing(false);
                                    setNewDomains(settings?.serverDomains || {});
                                }}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateDomains}
                                disabled={processing}
                                className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white font-semibold px-6 py-3 rounded-lg transition"
                            >
                                {processing ? 'Processing...' : `Update Domains (${migrationMode})`}
                            </button>
                        </div>
                    </>
                )}

                {/* Help Section */}
                <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-blue-400 mb-4">💡 Domain Migration Guide</h3>
                    <div className="text-gray-300 space-y-4">
                        <div>
                            <h4 className="font-semibold text-white mb-2">Before Migration:</h4>
                            <ol className="space-y-1 text-sm">
                                <li>1. Go to Server Management page</li>
                                <li>2. Note the IP addresses for each server</li>
                                <li>3. Add DNS A records at your domain registrar</li>
                                <li>4. Verify DNS configuration</li>
                                <li>5. Wait for DNS propagation (5-10 minutes)</li>
                            </ol>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-2">During Migration:</h4>
                            <ol className="space-y-1 text-sm">
                                <li>1. Choose Automatic Migration (recommended)</li>
                                <li>2. System updates everything automatically</li>
                                <li>3. Zero downtime - deployments stay live</li>
                                <li>4. Users receive email notifications</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
