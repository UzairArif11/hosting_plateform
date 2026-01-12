'use client';

import { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store';
import toast from 'react-hot-toast';
import {
    UserIcon,
    KeyIcon,
    BellIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/outline';

export default function SettingsPage() {
    const { user } = useSelector((state: RootState) => state.auth);
    const [activeTab, setActiveTab] = useState('profile');
    const [apiKey, setApiKey] = useState(user?.apiKey || '');

    const handleGenerateApiKey = () => {
        const newKey = `vcp_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
        setApiKey(newKey);
        toast.success('API key generated!');
    };

    const handleCopyApiKey = () => {
        navigator.clipboard.writeText(apiKey);
        toast.success('API key copied to clipboard!');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Settings</h1>
                <p className="text-gray-400 mt-1">Manage your account settings and preferences</p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-800">
                <div className="flex space-x-8">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`pb-4 px-1 border-b-2 transition-colors ${activeTab === 'profile'
                                ? 'border-purple-500 text-white'
                                : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        <div className="flex items-center space-x-2">
                            <UserIcon className="h-5 w-5" />
                            <span>Profile</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('api')}
                        className={`pb-4 px-1 border-b-2 transition-colors ${activeTab === 'api'
                                ? 'border-purple-500 text-white'
                                : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        <div className="flex items-center space-x-2">
                            <KeyIcon className="h-5 w-5" />
                            <span>API Keys</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`pb-4 px-1 border-b-2 transition-colors ${activeTab === 'notifications'
                                ? 'border-purple-500 text-white'
                                : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        <div className="flex items-center space-x-2">
                            <BellIcon className="h-5 w-5" />
                            <span>Notifications</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`pb-4 px-1 border-b-2 transition-colors ${activeTab === 'security'
                                ? 'border-purple-500 text-white'
                                : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        <div className="flex items-center space-x-2">
                            <ShieldCheckIcon className="h-5 w-5" />
                            <span>Security</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            <div>
                {activeTab === 'profile' && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
                        <div className="flex items-center space-x-4">
                            <img
                                src={user?.avatar || '/default-avatar.png'}
                                alt={user?.displayName}
                                className="h-20 w-20 rounded-full"
                            />
                            <div>
                                <h3 className="text-xl font-semibold text-white">{user?.displayName}</h3>
                                <p className="text-gray-400">{user?.email}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Display Name
                                </label>
                                <input
                                    type="text"
                                    value={user?.displayName || ''}
                                    disabled
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    GitHub Username
                                </label>
                                <input
                                    type="text"
                                    value={user?.githubUsername || ''}
                                    disabled
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'api' && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-2">API Key</h3>
                            <p className="text-gray-400 text-sm mb-4">
                                Use this API key to authenticate requests to the Vercel Clone Platform API.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Your API Key
                                </label>
                                <div className="flex items-center space-x-3">
                                    <input
                                        type="password"
                                        value={apiKey}
                                        readOnly
                                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white font-mono"
                                    />
                                    <button
                                        onClick={handleCopyApiKey}
                                        className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                                    >
                                        Copy
                                    </button>
                                    <button
                                        onClick={handleGenerateApiKey}
                                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                                    >
                                        Regenerate
                                    </button>
                                </div>
                            </div>

                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                                <p className="text-yellow-500 text-sm">
                                    ⚠️ Keep your API key secret. Do not share it publicly or commit it to version control.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-white font-medium mb-3">Example Usage</h4>
                            <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 font-mono text-sm text-gray-300">
                                <div>curl -H "Authorization: Bearer {apiKey}" \</div>
                                <div className="ml-4">https://api.vercelclone.com/v1/projects</div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-2">Email Notifications</h3>
                            <p className="text-gray-400 text-sm mb-4">
                                Choose which emails you want to receive
                            </p>
                        </div>

                        <div className="space-y-4">
                            <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-750 transition-colors">
                                <div>
                                    <p className="text-white font-medium">Deployment Success</p>
                                    <p className="text-gray-400 text-sm">Get notified when deployments succeed</p>
                                </div>
                                <input type="checkbox" defaultChecked className="w-5 h-5 text-purple-600" />
                            </label>

                            <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-750 transition-colors">
                                <div>
                                    <p className="text-white font-medium">Deployment Failures</p>
                                    <p className="text-gray-400 text-sm">Get notified when deployments fail</p>
                                </div>
                                <input type="checkbox" defaultChecked className="w-5 h-5 text-purple-600" />
                            </label>

                            <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-750 transition-colors">
                                <div>
                                    <p className="text-white font-medium">Resource Alerts</p>
                                    <p className="text-gray-400 text-sm">Get notified when reaching resource limits</p>
                                </div>
                                <input type="checkbox" defaultChecked className="w-5 h-5 text-purple-600" />
                            </label>

                            <label className="flex items-center justify-between p-4 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-750 transition-colors">
                                <div>
                                    <p className="text-white font-medium">Billing Updates</p>
                                    <p className="text-gray-400 text-sm">Get notified about billing and payments</p>
                                </div>
                                <input type="checkbox" defaultChecked className="w-5 h-5 text-purple-600" />
                            </label>
                        </div>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-2">Security Settings</h3>
                            <p className="text-gray-400 text-sm mb-4">
                                Manage your account security and authentication
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 bg-gray-800 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-white font-medium">GitHub Connected</p>
                                    <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm">
                                        Active
                                    </span>
                                </div>
                                <p className="text-gray-400 text-sm">
                                    Your account is connected via GitHub OAuth
                                </p>
                            </div>

                            {user?.googleId && (
                                <div className="p-4 bg-gray-800 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-white font-medium">Google Connected</p>
                                        <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm">
                                            Active
                                        </span>
                                    </div>
                                    <p className="text-gray-400 text-sm">
                                        Your account is also connected via Google OAuth
                                    </p>
                                </div>
                            )}

                            <div className="p-4 bg-gray-800 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-white font-medium">Two-Factor Authentication</p>
                                    <span className="px-3 py-1 bg-gray-500/10 text-gray-500 rounded-full text-sm">
                                        Not Enabled
                                    </span>
                                </div>
                                <p className="text-gray-400 text-sm mb-3">
                                    Add an extra layer of security to your account
                                </p>
                                <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors text-sm">
                                    Enable 2FA
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
