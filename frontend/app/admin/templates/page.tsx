'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    XMarkIcon,
    GlobeAltIcon,
    CodeBracketIcon,
    PhotoIcon,
    CommandLineIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Template {
    _id: string;
    name: string;
    slug: string;
    displayName: string;
    description: string;
    category: string;
    framework: string;
    githubRepo: string;
    githubBranch: string;
    previewImage: string;
    previewUrl?: string; // Live website
    isPremium: boolean; // Kept for legacy
    minPlan: 'free' | 'pro' | 'enterprise';
    isPublished: boolean;
    tags: string[];
    buildConfig: {
        installCommand: string;
        buildCommand: string;
        outputDirectory: string;
        devCommand: string;
        nodeVersion: string;
    };
    environmentVariables: {
        key: string;
        description: string;
        defaultValue: string;
        isRequired: boolean;
        isSecret: boolean;
    }[];
}

const CATEGORIES = [
    'blog', 'ecommerce', 'portfolio', 'saas', 'landing-page',
    'api', 'static', 'dashboard', 'documentation', 'other'
];

const FRAMEWORKS = [
    'nextjs', 'react', 'vue', 'nuxt', 'svelte', 'angular',
    'express', 'fastify', 'nestjs', 'koa',
    'static', 'gatsby', 'hugo', 'jekyll',
    'laravel', 'django', 'flask',
    'custom'
];

export default function TemplateManagement() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'basic' | 'build' | 'preview' | 'env'>('basic');

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            // Need to support ?includeUnpublished=true
            const res = await api.get('/templates?includeUnpublished=true');
            setTemplates(res.data.templates || []);
            setLoading(false);
        } catch (error) {
            toast.error('Failed to fetch templates');
            setLoading(false);
        }
    };

    const handleCreateNew = () => {
        setEditingTemplate({
            _id: '',
            name: '',
            slug: '',
            displayName: '',
            description: '',
            category: 'other',
            framework: 'custom',
            githubRepo: '',
            githubBranch: 'main',
            previewImage: 'https://placehold.co/600x400/1e293b/ffffff?text=Template',
            previewUrl: '',
            isPremium: false,
            minPlan: 'free',
            isPublished: false,
            tags: [],
            buildConfig: {
                installCommand: 'npm install',
                buildCommand: 'npm run build',
                outputDirectory: '.next',
                devCommand: 'npm run dev',
                nodeVersion: '18'
            },
            environmentVariables: []
        });
        setShowModal(true);
        setActiveTab('basic');
    };

    const handleEdit = (template: Template) => {
        setEditingTemplate({
            ...template,
            tags: template.tags || [],
            environmentVariables: template.environmentVariables || [],
            buildConfig: {
                ...template.buildConfig,
                nodeVersion: template.buildConfig?.nodeVersion || '18'
            }
        });
        setShowModal(true);
        setActiveTab('basic');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTemplate) return;

        try {
            const payload: any = { ...editingTemplate };
            if (!payload._id) delete payload._id;

            if (editingTemplate._id) {
                await api.put(`/templates/${editingTemplate._id}`, payload);
                toast.success('Template updated');
            } else {
                await api.post('/templates', payload);
                toast.success('Template created');
            }
            setShowModal(false);
            fetchTemplates();
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.error || 'Operation failed');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/templates/${id}`);
            toast.success('Template deleted');
            fetchTemplates();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Delete failed');
        }
    };

    const addEnvVar = () => {
        if (!editingTemplate) return;
        setEditingTemplate({
            ...editingTemplate,
            environmentVariables: [
                ...editingTemplate.environmentVariables,
                { key: '', description: '', defaultValue: '', isRequired: false, isSecret: false }
            ]
        });
    };

    const removeEnvVar = (index: number) => {
        if (!editingTemplate) return;
        const newEnv = [...editingTemplate.environmentVariables];
        newEnv.splice(index, 1);
        setEditingTemplate({ ...editingTemplate, environmentVariables: newEnv });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-white">Template Manager</h1>
                    <p className="text-gray-400 mt-2">Manage deployment templates and starter kits</p>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl transition shadow-lg"
                >
                    <PlusIcon className="h-5 w-5" />
                    <span>Add Template</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {templates.map((template) => (
                    <div
                        key={template._id}
                        className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all flex flex-col"
                    >
                        {/* Image */}
                        <div className="h-40 bg-gray-800 relative overflow-hidden">
                            <img
                                src={template.previewImage}
                                alt={template.displayName}
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/1e293b/ffffff?text=No+Image'; }}
                            />
                            <div className="absolute top-2 right-2 flex gap-2">
                                {!template.isPublished && (
                                    <span className="bg-yellow-500/20 text-yellow-500 text-xs px-2 py-1 rounded backdrop-blur-sm">Draft</span>
                                )}
                                {template.isPremium && (
                                    <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-1 rounded backdrop-blur-sm">Premium</span>
                                )}
                            </div>
                        </div>

                        <div className="p-5 flex-1 flex flex-col">
                            <h3 className="text-lg font-bold text-white mb-1">{template.displayName}</h3>
                            <p className="text-xs text-gray-500 font-mono mb-3">{template.framework} • {template.category}</p>
                            <p className="text-sm text-gray-400  line-clamp-2 mb-4 flex-1">{template.description}</p>

                            <div className="flex justify-between gap-3 pt-4 border-t border-gray-800">
                                <button
                                    onClick={() => handleEdit(template)}
                                    className="flex-1 flex items-center justify-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition text-sm"
                                >
                                    <PencilSquareIcon className="h-4 w-4" />
                                    <span>Edit</span>
                                </button>
                                <button
                                    onClick={() => handleDelete(template._id, template.displayName)}
                                    className="p-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && editingTemplate && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900 sticky top-0 rounded-t-2xl">
                            <h2 className="text-2xl font-bold text-white">
                                {editingTemplate._id ? 'Edit Template' : 'New Template'}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-400 hover:text-white transition"
                            >
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-800 px-6">
                            {(['basic', 'build', 'preview', 'env'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-3 text-sm font-medium border-b-2 transition ${activeTab === tab
                                        ? 'border-purple-500 text-purple-400'
                                        : 'border-transparent text-gray-400 hover:text-white'
                                        }`}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)} Info
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div className="p-8 overflow-y-auto flex-1">
                            <form id="templateForm" onSubmit={handleSubmit} className="space-y-6">

                                {/* Basic Info */}
                                {activeTab === 'basic' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Display Name *</label>
                                            <input
                                                required
                                                type="text"
                                                value={editingTemplate.displayName}
                                                onChange={(e) => setEditingTemplate({ ...editingTemplate, displayName: e.target.value })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Template Slug (ID) *</label>
                                            <input
                                                required
                                                type="text"
                                                value={editingTemplate.name}
                                                onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value, slug: e.target.value })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                                placeholder="e.g., nextjs-starter"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Category *</label>
                                            <select
                                                value={editingTemplate.category}
                                                onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                            >
                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                                            <textarea
                                                required
                                                value={editingTemplate.description}
                                                onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                                rows={3}
                                            />
                                        </div>

                                        <div className="flex gap-6 mt-4">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={editingTemplate.isPublished}
                                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, isPublished: e.target.checked })}
                                                    className="w-5 h-5 text-purple-600 bg-gray-800 border-gray-700 rounded"
                                                />
                                                <span className="text-white">Published</span>
                                            </label>

                                            <div className="flex items-center gap-2">
                                                <label className="text-sm font-medium text-gray-300">Minimum Plan:</label>
                                                <select
                                                    value={editingTemplate.minPlan || 'free'}
                                                    onChange={(e) => setEditingTemplate({
                                                        ...editingTemplate,
                                                        minPlan: e.target.value as any,
                                                        isPremium: e.target.value !== 'free' // Sync legacy flag
                                                    })}
                                                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-white text-sm"
                                                >
                                                    <option value="free">Free (All Users)</option>
                                                    <option value="pro">Pro (Paid)</option>
                                                    <option value="enterprise">Enterprise</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Build Config */}
                                {activeTab === 'build' && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Framework *</label>
                                                <select
                                                    value={editingTemplate.framework}
                                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, framework: e.target.value })}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                                >
                                                    {FRAMEWORKS.map(f => <option key={f} value={f}>{f}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Node Version</label>
                                                <select
                                                    value={editingTemplate.buildConfig.nodeVersion}
                                                    onChange={(e) => setEditingTemplate({
                                                        ...editingTemplate,
                                                        buildConfig: { ...editingTemplate.buildConfig, nodeVersion: e.target.value }
                                                    })}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                                >
                                                    <option value="18">18 (LTS)</option>
                                                    <option value="20">20 (LTS)</option>
                                                    <option value="16">16 (Legacy)</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 space-y-4">
                                            <h3 className="flex items-center gap-2 text-white font-semibold">
                                                <CodeBracketIcon className="h-5 w-5 text-purple-400" />
                                                Source Repository
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs text-gray-400 mb-1">GitHub Repo (user/repo)</label>
                                                    <input
                                                        required
                                                        type="text"
                                                        value={editingTemplate.githubRepo}
                                                        onChange={(e) => setEditingTemplate({ ...editingTemplate, githubRepo: e.target.value })}
                                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm"
                                                        placeholder="vercel/next.js"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Branch</label>
                                                    <input
                                                        type="text"
                                                        value={editingTemplate.githubBranch}
                                                        onChange={(e) => setEditingTemplate({ ...editingTemplate, githubBranch: e.target.value })}
                                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm"
                                                        placeholder="main"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 space-y-4">
                                            <h3 className="flex items-center gap-2 text-white font-semibold">
                                                <CommandLineIcon className="h-5 w-5 text-purple-400" />
                                                Build Settings
                                            </h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Install Command</label>
                                                    <input
                                                        type="text"
                                                        value={editingTemplate.buildConfig.installCommand}
                                                        onChange={(e) => setEditingTemplate({
                                                            ...editingTemplate,
                                                            buildConfig: { ...editingTemplate.buildConfig, installCommand: e.target.value }
                                                        })}
                                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-green-400 font-mono text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Build Command</label>
                                                    <input
                                                        type="text"
                                                        value={editingTemplate.buildConfig.buildCommand}
                                                        onChange={(e) => setEditingTemplate({
                                                            ...editingTemplate,
                                                            buildConfig: { ...editingTemplate.buildConfig, buildCommand: e.target.value }
                                                        })}
                                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-green-400 font-mono text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Output Directory</label>
                                                    <input
                                                        type="text"
                                                        value={editingTemplate.buildConfig.outputDirectory}
                                                        onChange={(e) => setEditingTemplate({
                                                            ...editingTemplate,
                                                            buildConfig: { ...editingTemplate.buildConfig, outputDirectory: e.target.value }
                                                        })}
                                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Dev Command</label>
                                                    <input
                                                        type="text"
                                                        value={editingTemplate.buildConfig.devCommand}
                                                        onChange={(e) => setEditingTemplate({
                                                            ...editingTemplate,
                                                            buildConfig: { ...editingTemplate.buildConfig, devCommand: e.target.value }
                                                        })}
                                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-green-400 font-mono text-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Preview Info */}
                                {activeTab === 'preview' && (
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Preview Image URL *</label>
                                            <div className="flex gap-4">
                                                <input
                                                    type="url"
                                                    required
                                                    value={editingTemplate.previewImage}
                                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, previewImage: e.target.value })}
                                                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                                    placeholder="https://..."
                                                />
                                                <div className="h-10 w-16 bg-gray-800 rounded border border-gray-700 overflow-hidden flex-shrink-0">
                                                    <img src={editingTemplate.previewImage} className="w-full h-full object-cover" alt="" />
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                <GlobeAltIcon className="inline h-4 w-4 mr-1 text-purple-400" />
                                                Live Website Preview URL (optional)
                                            </label>
                                            <input
                                                type="url"
                                                value={editingTemplate.previewUrl || ''}
                                                onChange={(e) => setEditingTemplate({ ...editingTemplate, previewUrl: e.target.value })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                                placeholder="https://my-template-demo.vercel.app"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">If provided, users can view a live demo before deploying.</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Tags (comma separated)</label>
                                            <input
                                                type="text"
                                                value={editingTemplate.tags.join(', ')}
                                                onChange={(e) => setEditingTemplate({
                                                    ...editingTemplate,
                                                    tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                                                })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                                placeholder="blog, minimal, portfolio"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Environment Variables */}
                                {activeTab === 'env' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-white font-medium">Environment Variables</h3>
                                            <button
                                                type="button"
                                                onClick={addEnvVar}
                                                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 border border-purple-500/30 px-2 py-1 rounded"
                                            >
                                                <PlusIcon className="h-3 w-3" /> Add Var
                                            </button>
                                        </div>

                                        {editingTemplate.environmentVariables.length === 0 && (
                                            <p className="text-sm text-gray-500 italic text-center py-4 bg-gray-800/30 rounded border border-dashed border-gray-700">
                                                No environment variables needed for this template.
                                            </p>
                                        )}

                                        {editingTemplate.environmentVariables.map((env, idx) => (
                                            <div key={idx} className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 flex gap-4 items-start relative group">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
                                                    <div>
                                                        <label className="text-xs text-gray-500">Key</label>
                                                        <input
                                                            type="text"
                                                            value={env.key}
                                                            onChange={(e) => {
                                                                const newEnv = [...editingTemplate.environmentVariables];
                                                                newEnv[idx].key = e.target.value;
                                                                setEditingTemplate({ ...editingTemplate, environmentVariables: newEnv });
                                                            }}
                                                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white font-mono"
                                                            placeholder="API_KEY"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-500">Default Value</label>
                                                        <input
                                                            type="text"
                                                            value={env.defaultValue}
                                                            onChange={(e) => {
                                                                const newEnv = [...editingTemplate.environmentVariables];
                                                                newEnv[idx].defaultValue = e.target.value;
                                                                setEditingTemplate({ ...editingTemplate, environmentVariables: newEnv });
                                                            }}
                                                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className="text-xs text-gray-500">Description</label>
                                                        <input
                                                            type="text"
                                                            value={env.description}
                                                            onChange={(e) => {
                                                                const newEnv = [...editingTemplate.environmentVariables];
                                                                newEnv[idx].description = e.target.value;
                                                                setEditingTemplate({ ...editingTemplate, environmentVariables: newEnv });
                                                            }}
                                                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300"
                                                            placeholder="What is this for?"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeEnvVar(idx)}
                                                    className="mt-6 text-red-500 hover:text-red-400 p-1"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </form>
                        </div>

                        <div className="p-6 border-t border-gray-800 bg-gray-900 flex justify-end gap-3 rounded-b-2xl">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                form="templateForm"
                                type="submit"
                                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition shadow-lg shadow-purple-900/20"
                            >
                                {editingTemplate._id ? 'Update Template' : 'Create Template'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
