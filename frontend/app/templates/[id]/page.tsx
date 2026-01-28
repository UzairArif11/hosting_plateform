'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Template {
    _id: string;
    name: string;
    description: string;
    framework: string;
    previewImage: string;
    previewUrl?: string; // External live preview URL (reference)
    demoDeploymentUrl?: string; // Admin-deployed internal demo
    githubRepo: string;
    deployCount: number;
    environmentVariables: Array<{
        key: string;
        description: string;
        defaultValue?: string;
        isRequired: boolean;
        isSecret: boolean;
    }>;
    supportedModes?: ('lite' | 'pro')[];
}

export default function DeployTemplatePage() {
    const params = useParams();
    const router = useRouter();
    const [template, setTemplate] = useState<Template | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDeploying, setIsDeploying] = useState(false);

    // Form state
    const [projectName, setProjectName] = useState('');
    const [envVars, setEnvVars] = useState<Record<string, string>>({});
    const [mode, setMode] = useState<'lite' | 'pro'>('lite');

    useEffect(() => {
        if (params.id) {
            fetchTemplate(params.id as string);
        }
    }, [params.id]);

    const fetchTemplate = async (id: string) => {
        try {
            const res = await fetch(`/api/templates/${id}`);
            const data = await res.json();

            if (data.success) {
                // Ensure previewUrl is included
                const templateData = {
                    ...data.template,
                    previewUrl: data.template.previewUrl || undefined
                };
                setTemplate(templateData);
                // Initialize env vars with defaults
                const initialEnv: Record<string, string> = {};
                data.template.environmentVariables?.forEach((ev: any) => {
                    if (ev.defaultValue) initialEnv[ev.key] = ev.defaultValue;
                });
                setEnvVars(initialEnv);
            } else {
                toast.error('Template not found');
                router.push('/templates');
            }
        } catch (error) {
            console.error('Failed to fetch template:', error);
            toast.error('Failed to load template');
        } finally {
            setLoading(false);
        }
    };

    const handleDeploy = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!template) return;

        if (!projectName.trim()) {
            toast.error('Project name is required');
            return;
        }

        setIsDeploying(true);
        try {
            // Format env vars for API
            const formattedEnvVars = Object.entries(envVars).map(([key, value]) => ({
                key,
                value
            }));

            const res = await fetch(`/api/templates/${params.id}/deploy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    name: projectName,
                    environmentVariables: formattedEnvVars,
                    mode: template.supportedModes && template.supportedModes.length > 1 ? mode : undefined // Only send mode for Smart Templates
                })
            });

            const data = await res.json();

            if (data.success) {
                toast.success('🚀 Project created successfully!');
                router.push(`/dashboard/projects/${data.project._id}`);
            } else {
                toast.error(data.error || 'Deployment failed');
                if (data.upgradeRequired) {
                    // Could show upgrade modal
                }
            }
        } catch (error) {
            console.error('Deployment error:', error);
            toast.error('Failed to create project');
        } finally {
            setIsDeploying(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    if (!template) return null;

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            {/* Header */}
            <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-30">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/templates" className="flex items-center text-sm text-gray-400 hover:text-white transition-colors">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        Back to Gallery
                    </Link>
                    <div className="font-mono text-sm text-gray-500">
                        Deploying <span className="text-purple-400">{template.name}</span>
                    </div>
                </div>
            </div>

            <main className="flex-grow max-w-4xl mx-auto px-4 py-12 w-full grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Left Column: Form */}
                <div className="lg:col-span-2 space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500 mb-2">
                            Create New Project
                        </h1>
                        <p className="text-gray-400">
                            Configure your new project based on the <strong className="text-white">{template.name}</strong> starter kit.
                        </p>
                    </div>

                    <form onSubmit={handleDeploy} className="space-y-6">
                        {/* Project Name */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-300">Project Name <span className="text-purple-500">*</span></label>
                            <input
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="my-awesome-project"
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                required
                            />
                            <p className="text-xs text-gray-500">
                                This will be your project's unique identifier and URL slug.
                            </p>
                        </div>

                        {/* Mode Selection (Smart Templates) */}
                        {template.supportedModes && template.supportedModes.length > 1 && (
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-300">Deployment Mode</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setMode('lite')}
                                        className={`p-4 rounded-xl border text-left transition-all ${mode === 'lite'
                                            ? 'bg-purple-900/20 border-purple-500 ring-2 ring-purple-500/20'
                                            : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-2 h-2 rounded-full ${mode === 'lite' ? 'bg-green-400' : 'bg-gray-500'}`} />
                                            <span className={`font-bold ${mode === 'lite' ? 'text-white' : 'text-gray-300'}`}>Lite Mode</span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Zero config. Uses embedded SQLite. Perfect for testing and small sites.
                                        </p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setMode('pro')}
                                        className={`p-4 rounded-xl border text-left transition-all ${mode === 'pro'
                                            ? 'bg-purple-900/20 border-purple-500 ring-2 ring-purple-500/20'
                                            : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-2 h-2 rounded-full ${mode === 'pro' ? 'bg-blue-400' : 'bg-gray-500'}`} />
                                            <span className={`font-bold ${mode === 'pro' ? 'text-white' : 'text-gray-300'}`}>Pro Mode</span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Production ready. Connects to your own external database (Postgres/MySQL).
                                        </p>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Git Repository Info (Read Only) */}
                        <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-xl space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-800 rounded-lg text-white">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"></path></svg>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-white">Shared Template Repository</h4>
                                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                                        github.com/{template.githubRepo}
                                    </p>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-gray-800">
                                <p className="text-xs text-gray-400">
                                    <strong className="text-gray-300">Note:</strong> This template uses a shared repository. Your environment variables and project settings are unique to your deployment and won't affect other users.
                                </p>
                            </div>
                        </div>

                        {/* Environment Variables */}
                        {template.environmentVariables && template.environmentVariables.length > 0 && (
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Environment Variables</h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Configure your deployment settings. Database is optional - connect your own if needed.
                                    </p>
                                </div>

                                {/* Database Notice */}
                                {template.environmentVariables.some(v => v.key.includes('DATABASE') || v.key.includes('DB')) && (
                                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                                        <p className="text-xs text-blue-300">
                                            <strong className="text-blue-200">💡 Database:</strong> Connect your own database (PostgreSQL, MongoDB, MySQL, etc.).
                                            Platform data is stored separately - you only need a database if your application requires it.
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    {template.environmentVariables
                                        .filter(v => {
                                            if (mode === 'lite' && (v.key === 'DATABASE_URL' || v.description.toLowerCase().includes('database'))) return false;
                                            return true;
                                        })
                                        .map((variable) => (
                                            <div key={variable.key} className="space-y-1">
                                                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
                                                    {variable.key} {variable.isRequired && mode === 'pro' && <span className="text-purple-500">*</span>}
                                                </label>
                                                <input
                                                    type={variable.isSecret ? "password" : "text"}
                                                    value={envVars[variable.key] || ''}
                                                    onChange={(e) => setEnvVars(prev => ({ ...prev, [variable.key]: e.target.value }))}
                                                    placeholder={variable.defaultValue || variable.description || 'Enter value...'}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 placeholder-gray-600 transition-colors"
                                                    required={(mode === 'pro' && variable.key === 'DATABASE_URL') || (variable.isRequired && mode === 'pro') || (variable.isRequired && !variable.key.includes('DATABASE'))}
                                                />
                                                {variable.description && (
                                                    <p className="text-xs text-gray-600">{variable.description}</p>
                                                )}
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={isDeploying}
                                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg shadow-purple-900/20 transition-all transform hover:scale-[1.01] active:scale-[0.99] ${isDeploying
                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                    : 'bg-white text-black hover:bg-gray-100'
                                    }`}
                            >
                                {isDeploying ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Deploying...
                                    </span>
                                ) : (
                                    'Deploy Project'
                                )}
                            </button>
                            <p className="text-center text-xs text-gray-500 mt-4">
                                By deploying, you agree to our Terms of Service and Privacy Policy.
                            </p>
                        </div>
                    </form>
                </div>

                {/* Right Column: Preview */}
                <div className="hidden lg:block space-y-6">
                    <div className="sticky top-24">
                        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                            <div className="aspect-[4/3] relative bg-gray-800">
                                {template.previewImage ? (
                                    <img
                                        src={template.previewImage}
                                        alt={template.name}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/1e293b/ffffff?text=No+Preview';
                                        }}
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-700">
                                        <span className="font-mono text-sm">No Preview Available</span>
                                    </div>
                                )}
                                {/* Live Preview Button Overlay */}
                                {(template as any).demoDeploymentUrl && (
                                    <div className="absolute bottom-3 right-3 z-10">
                                        <a
                                            href={(template as any).demoDeploymentUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex items-center gap-2 px-4 py-2 bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/20 rounded-lg text-sm font-medium text-white transition-all hover:scale-105 shadow-lg"
                                        >
                                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            <span>Live Demo</span>
                                        </a>
                                    </div>
                                )}
                                {!(template as any).demoDeploymentUrl && (
                                    <div className="absolute bottom-3 right-3 z-10">
                                        <span className="flex items-center gap-2 px-4 py-2 bg-gray-800/70 backdrop-blur-md border border-gray-700/50 rounded-lg text-xs font-medium text-gray-400">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span>Preview Only</span>
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="p-6">
                                <h3 className="text-lg font-bold text-white mb-2">{template.name}</h3>
                                <p className="text-sm text-gray-400 mb-4">{template.description}</p>

                                <div className="space-y-4 pt-4 border-t border-gray-800">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Framework</span>
                                        <span className="text-white font-mono capitalize">{template.framework}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Deployments</span>
                                        <span className="text-white">{template.deployCount}</span>
                                    </div>
                                    {(template as any).previewUrl && (
                                        <a
                                            href={(template as any).previewUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block w-full mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium text-center transition-colors"
                                        >
                                            View Live Demo →
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
