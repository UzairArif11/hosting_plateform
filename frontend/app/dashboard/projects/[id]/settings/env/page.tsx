'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface EnvVariable {
    key: string;
    value: string;
    isSecret: boolean;
    environments: string[];
}

export default function EnvironmentsPage({ params }: { params: { id: string } }) {
    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedEnv, setSelectedEnv] = useState<'production' | 'preview' | 'development'>('production');
    const [variables, setVariables] = useState<EnvVariable[]>([]);
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [newIsSecret, setNewIsSecret] = useState(false);

    useEffect(() => {
        fetchProject();
    }, [params.id]);

    const fetchProject = async () => {
        try {
            const res = await api.get(`/projects/${params.id}`);
            setProject(res.data.project);
            setVariables(res.data.project?.environmentVariables || []);
        } catch (error) {
            console.error('Error fetching project:', error);
            toast.error('Failed to load project');
        } finally {
            setLoading(false);
        }
    };

    const getFilteredVariables = () => {
        return variables.filter(v =>
            !v.environments ||
            v.environments.length === 0 ||
            v.environments.includes(selectedEnv)
        );
    };

    const handleAddVariable = () => {
        if (!newKey || !newValue) {
            toast.error('Please enter both key and value');
            return;
        }

        const exists = variables.some(v => v.key === newKey);
        if (exists) {
            toast.error('Variable with this key already exists');
            return;
        }

        setVariables([...variables, {
            key: newKey,
            value: newValue,
            isSecret: newIsSecret,
            environments: [selectedEnv]
        }]);

        setNewKey('');
        setNewValue('');
        setNewIsSecret(false);
        toast.success('Variable added (click Save to apply)');
    };

    const handleRemoveVariable = (key: string) => {
        setVariables(variables.filter(v => v.key !== key));
        toast.success('Variable removed (click Save to apply)');
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put(`/projects/${params.id}`, {
                environmentVariables: variables
            });
            toast.success('Environment variables saved successfully');
            fetchProject();
        } catch (error: any) {
            console.error('Error saving variables:', error);
            toast.error(error.response?.data?.error || 'Failed to save variables');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    const filteredVars = getFilteredVariables();

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Environment Variables</h1>
                <p className="text-gray-400">Manage environment-specific configuration</p>
            </div>

            {/* Environment Tabs */}
            <div className="mb-6 border-b border-gray-800">
                <div className="flex gap-1">
                    {['production', 'preview', 'development'].map((env) => (
                        <button
                            key={env}
                            onClick={() => setSelectedEnv(env as any)}
                            className={`px-6 py-3 font-medium transition ${selectedEnv === env
                                    ? 'text-purple-400 border-b-2 border-purple-500'
                                    : 'text-gray-400 hover:text-gray-300'
                                }`}
                        >
                            {env.charAt(0).toUpperCase() + env.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Add Variable Form */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">Add New Variable</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Key</label>
                        <input
                            type="text"
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                            placeholder="API_KEY"
                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Value</label>
                        <input
                            type={newIsSecret ? 'password' : 'text'}
                            value={newValue}
                            onChange={(e) => setNewValue(e.target.value)}
                            placeholder="value123"
                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <div className="flex items-end gap-2">
                        <label className="flex items-center gap-2 text-gray-300 flex-1">
                            <input
                                type="checkbox"
                                checked={newIsSecret}
                                onChange={(e) => setNewIsSecret(e.target.checked)}
                                className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                            />
                            <span className="text-sm">Secret</span>
                        </label>
                        <button
                            onClick={handleAddVariable}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition whitespace-nowrap"
                        >
                            Add Variable
                        </button>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                    This variable will be available in {selectedEnv} environment
                </p>
            </div>

            {/* Variables List */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
                <div className="p-6 border-b border-gray-800">
                    <h3 className="text-lg font-semibold text-white">
                        {selectedEnv.charAt(0).toUpperCase() + selectedEnv.slice(1)} Variables
                    </h3>
                </div>

                {filteredVars.length === 0 ? (
                    <div className="p-12 text-center">
                        <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <h4 className="text-white font-medium mb-2">No Variables</h4>
                        <p className="text-gray-400 text-sm">Add your first environment variable above</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-800">
                        {filteredVars.map((variable) => (
                            <div key={variable.key} className="p-5 hover:bg-gray-800/50 transition">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <code className="text-purple-400 font-mono text-sm font-medium">
                                                {variable.key}
                                            </code>
                                            {variable.isSecret && (
                                                <span className="px-2 py-0.5 bg-yellow-900/20 border border-yellow-500/30 text-yellow-300 text-xs rounded">
                                                    Secret
                                                </span>
                                            )}
                                            {variable.environments && variable.environments.length > 1 && (
                                                <span className="px-2 py-0.5 bg-blue-900/20 border border-blue-500/30 text-blue-300 text-xs rounded">
                                                    All Envs
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-gray-300 font-mono text-sm">
                                            {variable.isSecret ? '••••••••' : variable.value}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveVariable(variable.key)}
                                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-3">
                <button
                    onClick={fetchProject}
                    className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                >
                    {saving ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                            Saving...
                        </>
                    ) : (
                        'Save Changes'
                    )}
                </button>
            </div>

            {/* Info Banner */}
            <div className="mt-8 bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
                <h4 className="text-white font-semibold mb-2">💡 Environment Usage</h4>
                <ul className="text-sm text-gray-300 space-y-2">
                    <li>• <strong>Production:</strong> Variables used in production deployments</li>
                    <li>• <strong>Preview:</strong> Variables used in preview deployments (coming soon)</li>
                    <li>• <strong>Development:</strong> Variables for local development</li>
                    <li>• <strong>Secrets:</strong> Sensitive values are masked and encrypted</li>
                </ul>
            </div>
        </div>
    );
}
