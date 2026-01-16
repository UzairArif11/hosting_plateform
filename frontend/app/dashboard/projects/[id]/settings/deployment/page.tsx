'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function DeploymentSettingsPage() {
    const params = useParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        buildCommand: '',
        installCommand: '',
        outputDirectory: '',
        framework: ''
    });

    useEffect(() => {
        fetchSettings();
    }, [params.id]);

    const fetchSettings = async () => {
        try {
            const res = await fetch(`/api/projects/${params.id}`);
            const data = await res.json();
            if (data.success) {
                setSettings({
                    buildCommand: data.project.buildCommand || '',
                    installCommand: data.project.installCommand || 'npm install',
                    outputDirectory: data.project.outputDirectory || 'dist',
                    framework: data.project.framework || ''
                });
            }
        } catch (error) {
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const res = await fetch(`/api/projects/${params.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            if (res.ok) {
                toast.success('Settings saved successfully');
            } else {
                toast.error('Failed to save settings');
            }
        } catch (error) {
            toast.error('Network error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

    return (
        <div className="max-w-3xl mx-auto p-8">
            <h1 className="text-2xl font-bold text-white mb-6">Deployment Settings</h1>

            <form onSubmit={handleSave} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Build Command
                    </label>
                    <input
                        type="text"
                        value={settings.buildCommand}
                        onChange={(e) => setSettings({ ...settings, buildCommand: e.target.value })}
                        placeholder="npm run build"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Command to build your project</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Install Command
                    </label>
                    <input
                        type="text"
                        value={settings.installCommand}
                        onChange={(e) => setSettings({ ...settings, installCommand: e.target.value })}
                        placeholder="npm install"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Command to install dependencies</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Output Directory
                    </label>
                    <input
                        type="text"
                        value={settings.outputDirectory}
                        onChange={(e) => setSettings({ ...settings, outputDirectory: e.target.value })}
                        placeholder="dist"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Directory containing build output</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Framework
                    </label>
                    <select
                        value={settings.framework}
                        onChange={(e) => setSettings({ ...settings, framework: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                        <option value="">Auto-detect</option>
                        <option value="nextjs">Next.js</option>
                        <option value="react">React</option>
                        <option value="vue">Vue.js</option>
                        <option value="angular">Angular</option>
                        <option value="static">Static HTML</option>
                    </select>
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
            </form>
        </div>
    );
}
