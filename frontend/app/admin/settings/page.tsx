'use client';

import { useState } from 'react';
import { Cog6ToothIcon, EnvelopeIcon, CreditCardIcon, ShieldCheckIcon, BellIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function AdminSettingsPage() {
    const [activeTab, setActiveTab] = useState('platform');
    const [saving, setSaving] = useState(false);

    const [platformSettings, setPlatformSettings] = useState({
        siteName: 'Vercel Clone Platform',
        siteUrl: 'https://yourplatform.com',
        supportEmail: 'support@yourplatform.com',
        allowRegistration: true,
        maintenanceMode: false,
    });

    const [emailSettings, setEmailSettings] = useState({
        smtpHost: 'smtp.gmail.com',
        smtpPort: '587',
        smtpUser: '',
        smtpPassword: '',
        fromEmail: 'noreply@yourplatform.com',
        fromName: 'Vercel Clone Platform',
    });

    const [securitySettings, setSecuritySettings] = useState({
        requireEmailVerification: false,
        enable2FA: false,
        sessionTimeout: '24',
        maxLoginAttempts: '5',
        passwordMinLength: '8',
    });

    const handleSave = async () => {
        setSaving(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success('Settings saved successfully');
        } catch (error) {
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'platform', name: 'Platform', icon: Cog6ToothIcon },
        { id: 'email', name: 'Email', icon: EnvelopeIcon },
        { id: 'payment', name: 'Payment', icon: CreditCardIcon },
        { id: 'security', name: 'Security', icon: ShieldCheckIcon },
        { id: 'notifications', name: 'Notifications', icon: BellIcon },
    ];

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
                        {activeTab === 'platform' && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white">Platform Configuration</h2>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Site Name
                                    </label>
                                    <input
                                        type="text"
                                        value={platformSettings.siteName}
                                        onChange={(e) => setPlatformSettings({ ...platformSettings, siteName: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Site URL
                                    </label>
                                    <input
                                        type="url"
                                        value={platformSettings.siteUrl}
                                        onChange={(e) => setPlatformSettings({ ...platformSettings, siteUrl: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Support Email
                                    </label>
                                    <input
                                        type="email"
                                        value={platformSettings.supportEmail}
                                        onChange={(e) => setPlatformSettings({ ...platformSettings, supportEmail: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                                    <div>
                                        <p className="text-white font-medium">Allow New Registrations</p>
                                        <p className="text-sm text-gray-400">Enable users to create new accounts</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={platformSettings.allowRegistration}
                                            onChange={(e) => setPlatformSettings({ ...platformSettings, allowRegistration: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                                    <div>
                                        <p className="text-white font-medium">Maintenance Mode</p>
                                        <p className="text-sm text-gray-400">Temporarily disable the platform</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={platformSettings.maintenanceMode}
                                            onChange={(e) => setPlatformSettings({ ...platformSettings, maintenanceMode: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                    </label>
                                </div>
                            </div>
                        )}

                        {activeTab === 'email' && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white">Email Configuration</h2>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            SMTP Host
                                        </label>
                                        <input
                                            type="text"
                                            value={emailSettings.smtpHost}
                                            onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            SMTP Port
                                        </label>
                                        <input
                                            type="text"
                                            value={emailSettings.smtpPort}
                                            onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        SMTP Username
                                    </label>
                                    <input
                                        type="text"
                                        value={emailSettings.smtpUser}
                                        onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        SMTP Password
                                    </label>
                                    <input
                                        type="password"
                                        value={emailSettings.smtpPassword}
                                        onChange={(e) => setEmailSettings({ ...emailSettings, smtpPassword: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            From Email
                                        </label>
                                        <input
                                            type="email"
                                            value={emailSettings.fromEmail}
                                            onChange={(e) => setEmailSettings({ ...emailSettings, fromEmail: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            From Name
                                        </label>
                                        <input
                                            type="text"
                                            value={emailSettings.fromName}
                                            onChange={(e) => setEmailSettings({ ...emailSettings, fromName: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'payment' && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white">Payment Gateway</h2>

                                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                    <p className="text-blue-400 text-sm">
                                        <strong>Note:</strong> Payment integration with Payoneer is configured in the backend.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Payoneer API Key
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="Enter Payoneer API key"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Webhook URL
                                    </label>
                                    <input
                                        type="url"
                                        value="https://yourplatform.com/api/webhooks/payoneer"
                                        readOnly
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-400"
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white">Security Settings</h2>

                                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                                    <div>
                                        <p className="text-white font-medium">Require Email Verification</p>
                                        <p className="text-sm text-gray-400">Users must verify email before accessing platform</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={securitySettings.requireEmailVerification}
                                            onChange={(e) => setSecuritySettings({ ...securitySettings, requireEmailVerification: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                                    <div>
                                        <p className="text-white font-medium">Enable 2FA</p>
                                        <p className="text-sm text-gray-400">Allow users to enable two-factor authentication</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={securitySettings.enable2FA}
                                            onChange={(e) => setSecuritySettings({ ...securitySettings, enable2FA: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Session Timeout (hours)
                                    </label>
                                    <input
                                        type="number"
                                        value={securitySettings.sessionTimeout}
                                        onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Max Login Attempts
                                    </label>
                                    <input
                                        type="number"
                                        value={securitySettings.maxLoginAttempts}
                                        onChange={(e) => setSecuritySettings({ ...securitySettings, maxLoginAttempts: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Minimum Password Length
                                    </label>
                                    <input
                                        type="number"
                                        value={securitySettings.passwordMinLength}
                                        onChange={(e) => setSecuritySettings({ ...securitySettings, passwordMinLength: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'notifications' && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white">Notification Settings</h2>

                                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                    <p className="text-yellow-400 text-sm">
                                        Configure which notifications are sent to users and admins.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                                        <div>
                                            <p className="text-white font-medium">Deployment Success</p>
                                            <p className="text-sm text-gray-400">Notify users when deployment completes</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" defaultChecked className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                        </label>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                                        <div>
                                            <p className="text-white font-medium">Deployment Failure</p>
                                            <p className="text-sm text-gray-400">Notify users when deployment fails</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" defaultChecked className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                        </label>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                                        <div>
                                            <p className="text-white font-medium">Payment Received</p>
                                            <p className="text-sm text-gray-400">Notify users of successful payments</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" defaultChecked className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Save Button */}
                        <div className="flex justify-end pt-6 border-t border-gray-800">
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
