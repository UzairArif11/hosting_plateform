'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import { PlusIcon, TrashIcon, LockClosedIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface EnvVar {
    key: string;
    value: string;
    isSecret: boolean;
    environments?: string[];
}

export default function EnvironmentVariablesPage() {
    const params = useParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [envVars, setEnvVars] = useState<EnvVar[]>([]);
    const [projectName, setProjectName] = useState('');

    useEffect(() => {
        fetchProject();
    }, [params.id]);

    const fetchProject = async () => {
        try {
            const res = await api.get(`/projects/${params.id}`);
            const data = res.data;
            if (data.success) {
                setProjectName(data.project.name || '');
                const envVarsData = (data.project.environmentVariables || []).map((env: any) => ({
                    key: env.key || '',
                    value: env.value || '',
                    isSecret: env.isSecret || false,
                    environments: env.environments || ['production']
                }));
                setEnvVars(envVarsData);
            }
        } catch (error) {
            toast.error('Failed to load environment variables');
        } finally {
            setLoading(false);
        }
    };

    const addEnvVar = () => {
        setEnvVars([...envVars, { key: '', value: '', isSecret: false, environments: ['production'] }]);
    };

    const removeEnvVar = (index: number) => {
        const newEnvVars = envVars.filter((_, i) => i !== index);
        setEnvVars(newEnvVars);
    };

    const updateEnvVar = (index: number, field: keyof EnvVar, value: any) => {
        const newEnvVars = [...envVars];
        newEnvVars[index] = { ...newEnvVars[index], [field]: value };
        setEnvVars(newEnvVars);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        // Validation
        const emptyKeys = envVars.filter(env => !env.key.trim());
        if (emptyKeys.length > 0) {
            toast.error('All environment variables must have a key');
            setSaving(false);
            return;
        }

        const duplicateKeys = envVars.filter((env, index) => 
            envVars.findIndex(e => e.key === env.key) !== index
        );
        if (duplicateKeys.length > 0) {
            toast.error('Duplicate environment variable keys are not allowed');
            setSaving(false);
            return;
        }

        try {
            const formattedEnvVars = envVars.map(env => ({
                key: env.key.trim(),
                value: env.value,
                isSecret: env.isSecret,
                environments: env.environments || ['production']
            }));

            const res = await api.put(`/projects/${params.id}`, {
                environmentVariables: formattedEnvVars
            });

            if (res.data.success) {
                toast.success('✅ Environment variables updated successfully');
                fetchProject();
            } else {
                toast.error(res.data.error || 'Failed to update environment variables');
            }
        } catch (error: any) {
            console.error('Save error:', error);
            toast.error(error.response?.data?.error || 'Failed to save environment variables');
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

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Environment Variables</h1>
                <p className="text-gray-400">
                    Manage environment variables for <strong className="text-white">{projectName}</strong>
                </p>
            </div>

            {/* Important Notices */}
            <div className="space-y-3">
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 flex gap-3">
                    <InformationCircleIcon className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-sm font-semibold text-blue-300 mb-1">Isolated Per Project</h3>
                        <p className="text-sm text-blue-200/80">
                            These environment variables are <strong>unique to your project</strong>. Changes you make here only affect <strong>your deployment</strong> and will not impact other users using the same template. Each project has its own isolated set of environment variables.
                        </p>
                    </div>
                </div>

                <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 flex gap-3">
                    <InformationCircleIcon className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-sm font-semibold text-green-300 mb-1">Database Configuration</h3>
                        <p className="text-sm text-green-200/80">
                            <strong>Database is optional.</strong> If your application needs a database, add <code className="bg-green-900/50 px-1 rounded">DATABASE_URL</code> and connect your own database (PostgreSQL, MongoDB, MySQL, etc.). 
                            Platform data (projects, deployments) is stored separately - you only need a database if your application requires it.
                        </p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="space-y-6">
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
                    {envVars.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-gray-700 rounded-lg">
                            <LockClosedIcon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400 mb-2">No environment variables configured</p>
                            <p className="text-sm text-gray-500">
                                Add environment variables to customize your deployment (API keys, database URLs, etc.)
                            </p>
                        </div>
                    ) : (
                        envVars.map((env, index) => (
                            <div
                                key={index}
                                className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3 group hover:border-purple-500/50 transition-colors"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                                    {/* Key */}
                                    <div className="md:col-span-4">
                                        <label className="block text-xs font-medium text-gray-400 mb-1">
                                            Variable Key *
                                        </label>
                                        <input
                                            type="text"
                                            value={env.key}
                                            onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                            placeholder="API_KEY"
                                            required
                                        />
                                    </div>

                                    {/* Value */}
                                    <div className="md:col-span-7">
                                        <label className="block text-xs font-medium text-gray-400 mb-1">
                                            Value {env.isSecret && <span className="text-purple-400">(Hidden)</span>}
                                        </label>
                                        <input
                                            type={env.isSecret ? 'password' : 'text'}
                                            value={env.value}
                                            onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                            placeholder={env.isSecret ? '••••••••' : 'Enter value...'}
                                        />
                                    </div>

                                    {/* Delete Button */}
                                    <div className="md:col-span-1 flex items-end">
                                        <button
                                            type="button"
                                            onClick={() => removeEnvVar(index)}
                                            className="p-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                            title="Remove variable"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Secret Toggle */}
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={env.isSecret}
                                            onChange={(e) => updateEnvVar(index, 'isSecret', e.target.checked)}
                                            className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-700 rounded focus:ring-purple-500"
                                        />
                                        <span className="text-xs text-gray-400">
                                            Mark as secret (value will be hidden)
                                        </span>
                                    </label>
                                </div>
                            </div>
                        ))
                    )}

                    {/* Add Button */}
                    <button
                        type="button"
                        onClick={addEnvVar}
                        className="w-full py-3 border-2 border-dashed border-gray-700 hover:border-purple-500/50 rounded-lg text-gray-400 hover:text-purple-400 transition-all flex items-center justify-center gap-2"
                    >
                        <PlusIcon className="h-5 w-5" />
                        <span>Add Environment Variable</span>
                    </button>
                </div>

                {/* Save Button */}
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={fetchProject}
                        className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className={`px-6 py-2 rounded-lg font-medium transition ${
                            saving
                                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20'
                        }`}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>

            {/* Help Section */}
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <InformationCircleIcon className="h-5 w-5 text-purple-400" />
                    How Environment Variables Work
                </h3>
                <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
                    <li>
                        <strong className="text-white">Isolated per project:</strong> Each project has its own set of environment variables. Changes only affect your deployment.
                    </li>
                    <li>
                        <strong className="text-white">Template independence:</strong> Even if you deployed from a shared template, your environment variables are completely separate from other users.
                    </li>
                    <li>
                        <strong className="text-white">Database configuration:</strong> Add <code className="bg-gray-800 px-1 rounded">DATABASE_URL</code> to connect your own database (PostgreSQL, MongoDB, MySQL, etc.). Database is optional - only needed if your application requires it.
                    </li>
                    <li>
                        <strong className="text-white">Use cases:</strong> API keys, database URLs, service endpoints, feature flags, and any configuration that varies per deployment.
                    </li>
                    <li>
                        <strong className="text-white">Secret variables:</strong> Mark sensitive values (like API keys, database URLs) as secret to hide them in the UI.
                    </li>
                    <li>
                        <strong className="text-white">After saving:</strong> Environment variables are injected into your deployment at build and runtime.
                    </li>
                    <li>
                        <strong className="text-white">Platform data:</strong> All platform data (projects, deployments, templates) is stored in our MongoDB. You only need your own database for application-specific data.
                    </li>
                </ul>
            </div>
        </div>
    );
}
