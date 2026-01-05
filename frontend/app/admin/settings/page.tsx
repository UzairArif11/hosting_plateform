'use client';

import { useState, useEffect } from 'react';
import { Cog6ToothIcon, EnvelopeIcon, CreditCardIcon, ShieldCheckIcon, BellIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '@/lib/api';

export default function AdminSettingsPage() {
    const [activeTab, setActiveTab] = useState('platform');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const [platformSettings, setPlatformSettings] = useState({
        siteName: '',
        siteUrl: '',
        supportEmail: '',
        allowRegistration: true,
        maintenanceMode: false,
    });

    const [emailSettings, setEmailSettings] = useState({
        smtpHost: '',
        smtpPort: '',
        smtpUser: '',
        smtpPassword: '',
        fromEmail: '',
        fromName: '',
    });

    const [alertSettings, setAlertSettings] = useState({
        email: '',
        password: '',
        enabled: false
    });

    const [resourceLimits, setResourceLimits] = useState({
        warnThreshold: 80,
        stopThreshold: 90
    });

    const [securitySettings, setSecuritySettings] = useState({
        requireEmailVerification: false,
        enable2FA: false,
        sessionTimeout: '24',
        maxLoginAttempts: '5',
        passwordMinLength: '8',
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/api/admin/settings');
            const data = res.data;
            if (data) {
                // Populate state (mapping backend fields to frontend state)
                // Note: Most of these mock fields (smtp, security) don't exist in backend yet
                // But we will map what we have
                /* 
                   Backend returns: 
                   baseDomain, serverDomains, sslEmail, protocol, features, alertConfig
                */

                if (data.alertConfig) {
                    setAlertSettings(data.alertConfig);
                }
                if (data.resourceLimits) {
                    setResourceLimits(data.resourceLimits);
                }
            }
            setLoading(false);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load settings');
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // We only send back what the backend supports for now
            // + the new alertConfig
            const payload = {
                alertConfig: alertSettings,
                resourceLimits
            };

            await api.put('/api/admin/settings', payload);
            toast.success('Settings saved successfully');
        } catch (error) {
            console.error(error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'platform', name: 'Platform', icon: Cog6ToothIcon },
        { id: 'alerts', name: 'Alerts', icon: ExclamationTriangleIcon },
        { id: 'email', name: 'Email (Example)', icon: EnvelopeIcon },
    ];

    if (loading) {
        return <div className="p-8 text-center text-gray-400">Loading settings...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Platform Settings</h1>
                <p className="text-gray-400 mt-2">Configure platform-wide settings</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Tabs Sidebar */}
                <div className="lg:w-64 flex-shrink-0">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === tab.id
                                    ? 'bg-purple-500/10 text-purple-500'
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                    }`}
                            >
                                <tab.icon className="h-5 w-5" />
                                <span>{tab.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Settings Content */}
                <div className="flex-1">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        {activeTab === 'alerts' && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white">Admin Alerts Configuration</h2>
                                <p className="text-sm text-gray-400">
                                    Configure email alerts for high server load (CPU {'>'} 90% for 5 mins).
                                </p>

                                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                                    <h3 className="text-purple-400 font-medium mb-2">How it works</h3>
                                    <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                                        <li>System monitors remote servers via SSH every 5 minutes.</li>
                                        <li>If CPU usage exceeds 90% repeatedly, an alert is triggered.</li>
                                        <li>You will receive an email notification if configured below.</li>
                                    </ul>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                                        <div>
                                            <p className="text-white font-medium">Enable Email Alerts</p>
                                            <p className="text-sm text-gray-400">Turn on/off email notifications</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={alertSettings.enabled}
                                                onChange={(e) => setAlertSettings({ ...alertSettings, enabled: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                        </label>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Destination Email
                                        </label>
                                        <input
                                            type="email"
                                            placeholder="admin@example.com"
                                            value={alertSettings.email}
                                            onChange={(e) => setAlertSettings({ ...alertSettings, email: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Gmail App Password (SMTP)
                                        </label>
                                        <input
                                            type="password"
                                            placeholder="xxyy zzaa bbcc ddee"
                                            value={alertSettings.password}
                                            onChange={(e) => setAlertSettings({ ...alertSettings, password: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Use a Gmail App Password. The system uses standard Gmail SMTP settings (smtp.gmail.com:587).
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'platform' && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white">Platform Resource Limits</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                        <h3 className="text-lg font-medium text-purple-400 mb-2">Warning Threshold (%)</h3>
                                        <p className="text-sm text-gray-400 mb-4">Send email warning when usage exceeds this %.</p>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={resourceLimits.warnThreshold}
                                            onChange={(e) => setResourceLimits({ ...resourceLimits, warnThreshold: parseInt(e.target.value) })}
                                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                                        />
                                    </div>
                                    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                        <h3 className="text-lg font-medium text-red-400 mb-2">Stop Threshold (%)</h3>
                                        <p className="text-sm text-gray-400 mb-4">Stop the highest consuming process when usage exceeds this %.</p>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={resourceLimits.stopThreshold}
                                            onChange={(e) => setResourceLimits({ ...resourceLimits, stopThreshold: parseInt(e.target.value) })}
                                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'email' && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white">Email Settings</h2>
                                <p className="text-gray-500">This section is for future platform email configuration.</p>
                            </div>
                        )}

                        {/* Save Button */}
                        <div className="flex justify-end pt-6 border-t border-gray-800 mt-6">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
