'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface IPRestrictionSettings {
    enabled: boolean;
    maxFreeAccountsPerIP: number;
    blockDeletedEmailReuse: boolean;
    exemptPaidAccounts: boolean;
}

interface IPStats {
    ipAddress: string;
    totalAccounts: number;
    freeAccounts: number;
    paidAccounts: number;
    activeAccounts: number;
}

export default function IPRestrictionsPage() {
    const [settings, setSettings] = useState<IPRestrictionSettings | null>(null);
    const [ipStats, setIPStats] = useState<IPStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [testIP, setTestIP] = useState('');
    const [testResult, setTestResult] = useState<any>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error('No authentication token');
                return;
            }

            const [settingsRes, statsRes] = await Promise.all([
                fetch('/api/ip-restrictions/settings', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/ip-restrictions/statistics', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (!settingsRes.ok || !statsRes.ok) {
                throw new Error('Failed to fetch data');
            }

            const settingsData = await settingsRes.json();
            const statsData = await statsRes.json();

            setSettings(settingsData.ipRestrictions);
            setIPStats(statsData.topIPs || []);
            setLoading(false);
        } catch (error: any) {
            toast.error(error.message || 'Failed to load data');
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        if (!settings) return;

        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/ip-restrictions/settings', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to save settings');
            }

            toast.success('Settings saved successfully!');
            setSaving(false);
        } catch (error: any) {
            toast.error(error.message || 'Failed to save settings');
            setSaving(false);
        }
    };

    const handleTestSignup = async () => {
        if (!testEmail || !testIP) {
            toast.error('Please enter both email and IP address');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/ip-restrictions/test', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: testEmail,
                    ipAddress: testIP,
                    planType: 'free'
                })
            });

            const data = await res.json();
            setTestResult(data);
        } catch (error: any) {
            toast.error('Failed to test signup');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">🔒 IP Restrictions</h1>
                    <p className="text-gray-300">Prevent abuse by limiting accounts per IP address</p>
                </div>

                {/* Settings */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>

                    {settings && (
                        <div className="space-y-6">
                            {/* Enable/Disable */}
                            <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg">
                                <div>
                                    <h3 className="text-white font-semibold">Enable IP Restrictions</h3>
                                    <p className="text-gray-400 text-sm">Limit number of accounts per IP address</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.enabled}
                                        onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                            </div>

                            {/* Max Free Accounts */}
                            <div className="p-4 bg-black/20 rounded-lg">
                                <h3 className="text-white font-semibold mb-2">Max Free Accounts Per IP</h3>
                                <p className="text-gray-400 text-sm mb-4">Maximum number of free accounts allowed from one IP</p>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={settings.maxFreeAccountsPerIP}
                                    onChange={(e) => setSettings({ ...settings, maxFreeAccountsPerIP: parseInt(e.target.value) })}
                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                                />
                            </div>

                            {/* Block Deleted Email Reuse */}
                            <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg">
                                <div>
                                    <h3 className="text-white font-semibold">Block Deleted Email Reuse</h3>
                                    <p className="text-gray-400 text-sm">Prevent deleted email addresses from being reused</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.blockDeletedEmailReuse}
                                        onChange={(e) => setSettings({ ...settings, blockDeletedEmailReuse: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                            </div>

                            {/* Exempt Paid Accounts */}
                            <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg">
                                <div>
                                    <h3 className="text-white font-semibold">Exempt Paid Accounts</h3>
                                    <p className="text-gray-400 text-sm">Paid accounts don't count towards IP limit</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.exemptPaidAccounts}
                                        onChange={(e) => setSettings({ ...settings, exemptPaidAccounts: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={handleSaveSettings}
                                disabled={saving}
                                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition"
                            >
                                {saving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Test Signup */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-white mb-6">Test Signup Eligibility</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-gray-300 mb-2">Email Address</label>
                            <input
                                type="email"
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                                placeholder="user@example.com"
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-300 mb-2">IP Address</label>
                            <input
                                type="text"
                                value={testIP}
                                onChange={(e) => setTestIP(e.target.value)}
                                placeholder="192.168.1.1"
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleTestSignup}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg transition mb-4"
                    >
                        Test Signup
                    </button>

                    {testResult && (
                        <div className={`p-4 rounded-lg border ${testResult.allowed
                                ? 'bg-green-500/10 border-green-500/30'
                                : 'bg-red-500/10 border-red-500/30'
                            }`}>
                            <p className={`font-semibold ${testResult.allowed ? 'text-green-400' : 'text-red-400'}`}>
                                {testResult.allowed ? '✅ Signup Allowed' : '❌ Signup Blocked'}
                            </p>
                            {testResult.reason && (
                                <p className="text-gray-300 text-sm mt-2">{testResult.reason}</p>
                            )}
                            {testResult.ipInfo && (
                                <p className="text-gray-400 text-sm mt-2">
                                    {testResult.ipInfo.remaining} slots remaining out of {testResult.ipInfo.maxAllowed}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* IP Statistics */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
                    <h2 className="text-2xl font-bold text-white mb-6">Top IPs by Account Count</h2>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left text-gray-300 py-3 px-4">IP Address</th>
                                    <th className="text-left text-gray-300 py-3 px-4">Total Accounts</th>
                                    <th className="text-left text-gray-300 py-3 px-4">Free</th>
                                    <th className="text-left text-gray-300 py-3 px-4">Paid</th>
                                    <th className="text-left text-gray-300 py-3 px-4">Active</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ipStats.map((stat, idx) => (
                                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                                        <td className="text-white py-3 px-4 font-mono">{stat.ipAddress}</td>
                                        <td className="text-white py-3 px-4">{stat.totalAccounts}</td>
                                        <td className="text-yellow-400 py-3 px-4">{stat.freeAccounts}</td>
                                        <td className="text-green-400 py-3 px-4">{stat.paidAccounts}</td>
                                        <td className="text-blue-400 py-3 px-4">{stat.activeAccounts}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {ipStats.length === 0 && (
                            <div className="text-center text-gray-400 py-8">
                                No IP data available yet
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
