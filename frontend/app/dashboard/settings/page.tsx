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
                            {/* GitHub Connection */}
                            <div className="p-4 bg-gray-800 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-3">
                                        <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                                        </svg>
                                        <p className="text-white font-medium">GitHub</p>
                                    </div>
                                    {user?.githubId ? (
                                        <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm">
                                            Connected
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 rounded-full text-sm">
                                            Not Connected
                                        </span>
                                    )}
                                </div>
                                {user?.githubId ? (
                                    <p className="text-gray-400 text-sm">
                                        Connected as <span className="text-purple-400 font-medium">@{user.username}</span> — custom repo deploys enabled
                                    </p>
                                ) : (
                                    <div>
                                        <p className="text-gray-400 text-sm mb-3">
                                            Connect your GitHub account to deploy your own repositories. Template deployments work without GitHub.
                                        </p>
                                        <a
                                            href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/github`}
                                            className="inline-flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors text-sm border border-gray-600"
                                        >
                                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                                            </svg>
                                            <span>Connect GitHub Account</span>
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Google Connection */}
                            <div className="p-4 bg-gray-800 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-3">
                                        <svg className="h-6 w-6" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                        <p className="text-white font-medium">Google</p>
                                    </div>
                                    {user?.googleId ? (
                                        <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm">
                                            Connected
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1 bg-gray-500/10 text-gray-500 rounded-full text-sm">
                                            Not Connected
                                        </span>
                                    )}
                                </div>
                                <p className="text-gray-400 text-sm">
                                    {user?.googleId
                                        ? `Connected via Google OAuth — ${user.email}`
                                        : 'Google account not linked'}
                                </p>
                            </div>

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
