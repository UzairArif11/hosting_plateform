'use client';

import { useEffect, useState, useRef } from 'react';
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
import { io, Socket } from 'socket.io-client';

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
    demoDeploymentUrl?: string; // Admin-deployed demo URL
    demoStatus?: 'none' | 'deploying' | 'success' | 'failed';
    demoProgress?: number; // 0-100
    demoError?: string;
    isPremium: boolean; // Kept for legacy
    minPlan: 'free' | 'pro' | 'enterprise';
    isPublished: boolean;
    tags: string[];
    supportedModes: ('lite' | 'pro')[];
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
    resourceLimits?: {
        maxListings?: number | null;
        maxImageSize?: number;
        maxImageResolution?: {
            width: number;
            height: number;
        };
        maxStoragePerProject?: number;
        maxFilesPerProject?: number;
    };
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
    const [activeTab, setActiveTab] = useState<'basic' | 'build' | 'preview' | 'env' | 'limits'>('basic');
    
    // Deploy Demo Modal
    const [showDemoModal, setShowDemoModal] = useState(false);
    const [demoTemplate, setDemoTemplate] = useState<Template | null>(null);
    const [demoDeploying, setDemoDeploying] = useState(false);

    // Socket.IO for real-time demo deployment updates
    const socketRef = useRef<Socket | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        fetchTemplates();

        // Connect to Socket.IO for real-time updates with reconnection
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
        socketRef.current = io(socketUrl, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: Infinity,
            transports: ['websocket', 'polling'],
            timeout: 20000
        });

        socketRef.current.on('connect', () => {
            console.log('✅ Connected to Socket.IO for template demo updates');
        });

        socketRef.current.on('disconnect', (reason) => {
            console.log('❌ Disconnected from Socket.IO:', reason);
            // Auto-reconnect unless server disconnected intentionally
            if (reason === 'io server disconnect') {
                socketRef.current?.connect();
            }
        });

        socketRef.current.on('reconnect', (attemptNumber) => {
            console.log(`🔄 Reconnected to Socket.IO after ${attemptNumber} attempts`);
        });

        socketRef.current.on('reconnect_attempt', (attemptNumber) => {
            console.log(`🔄 Attempting to reconnect... (${attemptNumber})`);
        });

        socketRef.current.on('connect_error', (error) => {
            console.error('❌ Socket.IO connection error:', error.message);
        });

        socketRef.current.on('template-demo-status', (data: {
            templateId: string;
            status: 'deploying' | 'success' | 'failed';
            progress: number;
            demoUrl?: string;
            error?: string;
            message?: string;
        }) => {
            console.log('📡 Template demo status update:', data);
            
            // Update templates array with new status
            setTemplates(prev => prev.map(t => {
                if (t._id === data.templateId) {
                    return {
                        ...t,
                        demoStatus: data.status,
                        demoProgress: data.progress,
                        demoDeploymentUrl: data.demoUrl || t.demoDeploymentUrl,
                        demoError: data.error
                    };
                }
                return t;
            }));

            // Update deploying state
            if (data.status === 'success' || data.status === 'failed') {
                setDemoDeploying(false);
            }

            // Show toast notifications
            if (data.status === 'success') {
                toast.success(`Demo deployment successful!`, { duration: 5000 });
            } else if (data.status === 'failed') {
                toast.error(`Demo deployment failed: ${data.error || 'Unknown error'}`, { duration: 8000 });
            }
        });

        // Fallback polling for templates stuck in "deploying" state
        pollingIntervalRef.current = setInterval(() => {
            setTemplates(prev => {
                const hasDeploying = prev.some(t => t.demoStatus === 'deploying');
                if (hasDeploying) {
                    console.log('🔄 Polling for template updates (fallback)...');
                    // Refetch templates to get latest status
                    fetchTemplates();
                }
                return prev;
            });
        }, 10000); // Poll every 10 seconds

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
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
            supportedModes: ['lite', 'pro'],
            buildConfig: {
                installCommand: 'npm install',
                buildCommand: 'npm run build',
                outputDirectory: '.next',
                devCommand: 'npm run dev',
                nodeVersion: '18'
            },
            environmentVariables: [],
            resourceLimits: {
                maxListings: null,
                maxImageSize: 5,
                maxImageResolution: {
                    width: 1920,
                    height: 1080
                },
                maxStoragePerProject: 100,
                maxFilesPerProject: 1000
            }
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

    const handleModeChange = (mode: 'lite' | 'pro', checked: boolean) => {
        if (!editingTemplate) return;
        const current = editingTemplate.supportedModes || [];
        const updated = checked
            ? [...current, mode]
            : current.filter(m => m !== mode);
        setEditingTemplate({ ...editingTemplate, supportedModes: updated });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTemplate) return;

        // Validation
        if (!editingTemplate.displayName?.trim()) {
            toast.error('Display name is required');
            return;
        }
        if (!editingTemplate.name?.trim()) {
            toast.error('Template slug/name is required');
            return;
        }
        if (!editingTemplate.githubRepo?.trim()) {
            toast.error('GitHub repository is required');
            return;
        }
        if (!editingTemplate.previewImage?.trim()) {
            toast.error('Preview image URL is required');
            return;
        }

        // Validate environment variables
        const invalidEnvVars = editingTemplate.environmentVariables.filter(env => !env.key?.trim());
        if (invalidEnvVars.length > 0) {
            toast.error('All environment variables must have a key');
            return;
        }

        try {
            const payload: any = { ...editingTemplate };
            if (!payload._id) delete payload._id;

            // Clean up payload
            payload.slug = payload.name; // Ensure slug matches name
            payload.environmentVariables = payload.environmentVariables || [];

            if (editingTemplate._id) {
                await api.put(`/templates/${editingTemplate._id}`, payload);
                toast.success('✅ Template updated successfully');
            } else {
                await api.post('/templates', payload);
                toast.success('✅ Template created successfully');
            }
            setShowModal(false);
            fetchTemplates();
        } catch (error: any) {
            console.error('Template save error:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Operation failed';
            toast.error(`Failed: ${errorMessage}`);
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

    const handleDeployDemo = (template: Template) => {
        setDemoTemplate(template);
        setShowDemoModal(true);
    };

    const handleDemoSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!demoTemplate) return;

        setDemoDeploying(true);
        try {
            const res = await api.post(`/templates/${demoTemplate._id}/deploy-demo`, {
                environmentVariables: [],
            });

            if (res.data.success) {
                // Deployment started successfully - Socket.IO will provide updates
                toast.success(`🚀 Demo deployment started! Watch the progress below.`, { duration: 5000 });
                setShowDemoModal(false);
                
                // Update local state to show deploying status immediately
                setTemplates(prev => prev.map(t => 
                    t._id === demoTemplate._id 
                        ? { ...t, demoStatus: 'deploying' as const, demoProgress: 0 }
                        : t
                ));
            }
        } catch (error: any) {
            console.error('Demo deployment error:', error);
            toast.error(error.response?.data?.error || 'Failed to start demo deployment');
        } finally {
            setDemoDeploying(false);
        }
    };

    const handleRemoveDemo = async (templateId: string, templateName: string) => {
        if (!confirm(`Remove live demo for "${templateName}"?`)) return;
        
        try {
            await api.delete(`/templates/${templateId}/demo`);
            toast.success('Demo removed successfully');
            fetchTemplates();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to remove demo');
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
        return <div className="p-8 text-center text-gray-400">Loading templates...</div>;
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Template Manager</h1>
                    <p className="text-gray-400 mt-1 sm:mt-2 text-sm sm:text-base">Manage deployment templates and starter kits</p>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl transition shadow-lg w-full sm:w-auto text-sm sm:text-base"
                >
                    <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5" />
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

                            {/* Demo Deployment Status */}
                            <div className="mb-3 space-y-2">
                                {template.demoStatus === 'deploying' && (
                                    <div className="flex items-center gap-2 text-xs bg-blue-500/10 border border-blue-500/30 rounded-lg p-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                        <div className="flex-1">
                                            <div className="text-blue-400 font-medium">Deploying...</div>
                                            <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                                                <div 
                                                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                                    style={{ width: `${template.demoProgress || 0}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {template.demoStatus === 'success' && template.demoDeploymentUrl && (
                                    <div className="flex items-center gap-2 text-xs bg-green-500/10 border border-green-500/30 rounded-lg p-2">
                                        <GlobeAltIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-green-400 font-medium">Live Demo Active</div>
                                            <a 
                                                href={template.demoDeploymentUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-green-500/80 hover:text-green-400 truncate block"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {template.demoDeploymentUrl}
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {template.demoStatus === 'failed' && (
                                    <div className="flex items-center gap-2 text-xs bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                                        <XMarkIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                                        <div className="flex-1">
                                            <div className="text-red-400 font-medium">Deployment Failed</div>
                                            {template.demoError && (
                                                <div className="text-red-500/70 text-xs truncate">{template.demoError}</div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {(!template.demoStatus || template.demoStatus === 'none') && !template.demoDeploymentUrl && (
                                    <div className="flex items-center gap-2 text-xs text-gray-500 p-2">
                                        <PhotoIcon className="w-4 h-4" />
                                        <span>No live demo deployed</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row justify-between gap-2 pt-4 border-t border-gray-800">
                                <button
                                    onClick={() => handleEdit(template)}
                                    className="flex-1 flex items-center justify-center space-x-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2.5 sm:px-2 sm:py-2 rounded-lg transition text-sm sm:text-xs"
                                >
                                    <PencilSquareIcon className="h-4 w-4" />
                                    <span>Edit</span>
                                </button>
                                <button
                                    onClick={() => handleDeployDemo(template)}
                                    disabled={template.demoStatus === 'deploying'}
                                    className={`flex-1 flex items-center justify-center space-x-1 px-3 py-2.5 sm:px-2 sm:py-2 rounded-lg transition text-sm sm:text-xs ${
                                        template.demoStatus === 'deploying'
                                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                            : 'bg-blue-600/20 hover:bg-blue-600/40 text-blue-400'
                                    }`}
                                    title={template.demoStatus === 'deploying' ? 'Deployment in progress...' : 'Deploy as live demo'}
                                >
                                    {template.demoStatus === 'deploying' ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
                                            <span className="hidden xs:inline">Deploying...</span>
                                            <span className="xs:hidden">...</span>
                                        </>
                                    ) : (
                                        <>
                                            <GlobeAltIcon className="h-4 w-4" />
                                            <span className="hidden xs:inline">Deploy Demo</span>
                                            <span className="xs:hidden">Demo</span>
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => handleDelete(template._id, template.displayName)}
                                    className="sm:flex-none w-full sm:w-auto flex items-center justify-center sm:justify-start px-3 py-2.5 sm:p-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                    <span className="ml-1 sm:hidden">Delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && editingTemplate && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="p-4 sm:p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900 sticky top-0 rounded-t-xl sm:rounded-t-2xl">
                            <h2 className="text-xl sm:text-2xl font-bold text-white">
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
                        <div className="flex border-b border-gray-800 px-4 sm:px-6 overflow-x-auto scrollbar-hide">
                            {(['basic', 'build', 'preview', 'env', 'limits'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap ${
                                        activeTab === tab
                                            ? 'border-purple-500 text-purple-400'
                                            : 'border-transparent text-gray-400 hover:text-white'
                                    }`}
                                >
                                    {tab === 'limits' ? (
                                        <span className="hidden sm:inline">Resource Limits</span>
                                    ) : (
                                        tab.charAt(0).toUpperCase() + tab.slice(1) + (window.innerWidth > 640 ? ' Info' : '')
                                    )}
                                    {tab === 'limits' && <span className="sm:hidden">Limits</span>}
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto flex-1">
                            <form id="templateForm" onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">

                                {/* Basic Info */}
                                {activeTab === 'basic' && (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="col-span-2">
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    Display Name *
                                                    <span className="text-xs text-gray-500 ml-2">(Shown to users in gallery)</span>
                                                </label>
                                                <input
                                                    required
                                                    type="text"
                                                    value={editingTemplate.displayName}
                                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, displayName: e.target.value })}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                    placeholder="Next.js Ecommerce Starter"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    Template Slug (ID) *
                                                    <span className="text-xs text-gray-500 ml-2">(Unique identifier)</span>
                                                </label>
                                                <input
                                                    required
                                                    type="text"
                                                    value={editingTemplate.name}
                                                    onChange={(e) => {
                                                        const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
                                                        setEditingTemplate({ ...editingTemplate, name: slug, slug: slug });
                                                    }}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                    placeholder="nextjs-ecommerce-starter"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">Lowercase, hyphens only (auto-formatted)</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Category *</label>
                                                <select
                                                    value={editingTemplate.category}
                                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value })}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                >
                                                    {CATEGORIES.map(c => (
                                                        <option key={c} value={c}>
                                                            {c.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    Description *
                                                    <span className="text-xs text-gray-500 ml-2">(Brief description shown in gallery)</span>
                                                </label>
                                                <textarea
                                                    required
                                                    value={editingTemplate.description}
                                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all resize-none"
                                                    rows={3}
                                                    placeholder="A modern ecommerce template built with Next.js, featuring product catalog, cart, and checkout..."
                                                />
                                                <p className="text-xs text-gray-500 mt-1">{editingTemplate.description.length}/200 characters</p>
                                            </div>

                                            <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50 space-y-4 mt-6">
                                                <h4 className="text-sm font-semibold text-white">Visibility & Access</h4>
                                                <div className="flex flex-wrap gap-6">
                                                    <label className="flex items-center space-x-2 cursor-pointer group">
                                                        <input
                                                            type="checkbox"
                                                            checked={editingTemplate.isPublished}
                                                            onChange={(e) => setEditingTemplate({ ...editingTemplate, isPublished: e.target.checked })}
                                                            className="w-5 h-5 text-purple-600 bg-gray-800 border-gray-700 rounded focus:ring-2 focus:ring-purple-500"
                                                        />
                                                        <div>
                                                            <span className="text-white font-medium">Published</span>
                                                            <p className="text-xs text-gray-500">Visible to users in template gallery</p>
                                                        </div>
                                                    </label>

                                                    <label className="flex items-center space-x-2 cursor-pointer group">
                                                        <input
                                                            type="checkbox"
                                                            checked={editingTemplate.isPremium}
                                                            onChange={(e) => setEditingTemplate({ ...editingTemplate, isPremium: e.target.checked })}
                                                            className="rounded border-gray-700 bg-gray-800 text-purple-600 focus:ring-purple-500"
                                                        />
                                                        <span className="text-gray-300 text-sm">Premium Template (Legacy)</span>
                                                    </label>

                                                    <div className="flex items-center gap-3">
                                                        <label className="text-sm font-medium text-gray-300">Minimum Plan:</label>
                                                        <select
                                                            value={editingTemplate.minPlan || 'free'}
                                                            onChange={(e) => setEditingTemplate({
                                                                ...editingTemplate,
                                                                minPlan: e.target.value as any,
                                                                isPremium: e.target.value !== 'free' // Sync legacy flag
                                                            })}
                                                            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                        >
                                                            <option value="free">Free (All Users)</option>
                                                            <option value="pro">Pro (Paid Plans)</option>
                                                            <option value="enterprise">Enterprise</option>
                                                        </select>
                                                        <span className="text-xs text-gray-500">
                                                            {editingTemplate.minPlan === 'free' && '✓ Available to everyone'}
                                                            {editingTemplate.minPlan === 'pro' && '🔒 Requires Pro plan or higher'}
                                                            {editingTemplate.minPlan === 'enterprise' && '🔒 Requires Enterprise plan'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Modes */}
                                        <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50 space-y-4 mt-6">
                                            <h4 className="text-sm font-semibold text-white">Supported Modes</h4>
                                            <div className="flex gap-6">
                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                    <input
                                                        className="w-5 h-5 text-green-500 bg-gray-800 border border-gray-700 rounded focus:ring-2 focus:ring-green-500"
                                                        type="checkbox"
                                                        checked={editingTemplate.supportedModes?.includes('lite') ?? false}
                                                        onChange={(e) => handleModeChange('lite', e.target.checked)}
                                                    />
                                                    <div>
                                                        <span className="text-white font-medium">Lite Mode</span>
                                                        <p className="text-xs text-gray-500">Zero-config, embedded DB (SQLite)</p>
                                                    </div>
                                                </label>

                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                    <input
                                                        className="w-5 h-5 text-blue-500 bg-gray-800 border border-gray-700 rounded focus:ring-2 focus:ring-blue-500"
                                                        type="checkbox"
                                                        checked={editingTemplate.supportedModes?.includes('pro') ?? false}
                                                        onChange={(e) => handleModeChange('pro', e.target.checked)}
                                                    />
                                                    <div>
                                                        <span className="text-white font-medium">Pro Mode</span>
                                                        <p className="text-xs text-gray-500">External DB (Postgres/MySQL)</p>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                    </>
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
                                                <span className="text-xs text-gray-500 font-normal ml-2">(Shared template - all users deploy from this repo)</span>
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs text-gray-400 mb-1">
                                                        GitHub Repo (owner/repo) *
                                                        <span className="text-gray-600 ml-1">Template is shared by all users</span>
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-600 font-mono text-sm">github.com/</span>
                                                        <input
                                                            required
                                                            type="text"
                                                            value={editingTemplate.githubRepo}
                                                            onChange={(e) => setEditingTemplate({ ...editingTemplate, githubRepo: e.target.value })}
                                                            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                            placeholder="vercel/commerce"
                                                        />
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        ⚠️ This template repo is shared. Users customize via environment variables, not code changes.
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Branch</label>
                                                    <input
                                                        type="text"
                                                        value={editingTemplate.githubBranch}
                                                        onChange={(e) => setEditingTemplate({ ...editingTemplate, githubBranch: e.target.value })}
                                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                        placeholder="main"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 space-y-4">
                                            <h3 className="flex items-center gap-2 text-white font-semibold">
                                                <CommandLineIcon className="h-5 w-5 text-purple-400" />
                                                Build Settings
                                                <span className="text-xs text-gray-500 font-normal ml-2">(Users can customize these after deployment)</span>
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
                                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-green-400 font-mono text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                        placeholder="npm install"
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
                                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-green-400 font-mono text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                        placeholder="npm run build"
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
                                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                        placeholder=".next or dist"
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
                                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-green-400 font-mono text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                        placeholder="npm run dev"
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
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                <PhotoIcon className="inline h-4 w-4 mr-1 text-purple-400" />
                                                Preview Image URL *
                                            </label>
                                            <div className="space-y-3">
                                                <div className="flex gap-4">
                                                    <input
                                                        type="url"
                                                        required
                                                        value={editingTemplate.previewImage}
                                                        onChange={(e) => setEditingTemplate({ ...editingTemplate, previewImage: e.target.value })}
                                                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                        placeholder="https://example.com/preview.png"
                                                    />
                                                    <div className="h-12 w-20 bg-gray-800 rounded border border-gray-700 overflow-hidden flex-shrink-0">
                                                        <img
                                                            src={editingTemplate.previewImage || 'https://placehold.co/200x150/1e293b/ffffff?text=Preview'}
                                                            className="w-full h-full object-cover"
                                                            alt="Preview"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = 'https://placehold.co/200x150/1e293b/ffffff?text=Invalid+URL';
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    This image will be displayed in the template gallery. Recommended size: 1200x800px
                                                </p>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                <GlobeAltIcon className="inline h-4 w-4 mr-1 text-purple-400" />
                                                Live Website Preview URL (optional)
                                            </label>
                                            <div className="space-y-2">
                                                <input
                                                    type="url"
                                                    value={editingTemplate.previewUrl || ''}
                                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, previewUrl: e.target.value })}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                    placeholder="https://my-template-demo.vercel.app"
                                                />
                                                {editingTemplate.previewUrl && (
                                                    <a
                                                        href={editingTemplate.previewUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                                    >
                                                        <GlobeAltIcon className="w-3 h-3" />
                                                        Test Preview Link
                                                    </a>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                If provided, users can view a live demo before deploying. This helps users see what the template looks like.
                                            </p>
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
                                            <div>
                                                <h3 className="text-white font-medium">Environment Variables</h3>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Define variables users will configure. Database is optional - users can connect their own.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={addEnvVar}
                                                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 border border-purple-500/30 px-2 py-1 rounded"
                                            >
                                                <PlusIcon className="h-3 w-3" /> Add Var
                                            </button>
                                        </div>

                                        {/* Important Notice */}
                                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                                            <p className="text-xs text-blue-300">
                                                <strong className="text-blue-200">💡 Database Configuration:</strong> Templates don't require a database.
                                                If your template needs a database, add <code className="bg-blue-900/50 px-1 rounded">DATABASE_URL</code> as an environment variable.
                                                Users will connect their own database (PostgreSQL, MongoDB, MySQL, etc.) via this variable.
                                                All platform data is stored in our MongoDB - no database needed for templates.
                                            </p>
                                        </div>

                                        {editingTemplate.environmentVariables.length === 0 && (
                                            <div className="text-center py-8 bg-gray-800/30 rounded border border-dashed border-gray-700">
                                                <p className="text-sm text-gray-500 mb-2">No environment variables defined</p>
                                                <p className="text-xs text-gray-600">
                                                    Add variables like <code className="bg-gray-900 px-1 rounded">DATABASE_URL</code>, <code className="bg-gray-900 px-1 rounded">API_KEY</code>, etc.
                                                    Users will configure these when deploying.
                                                </p>
                                            </div>
                                        )}

                                        {editingTemplate.environmentVariables.map((env, idx) => (
                                            <div key={idx} className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 flex gap-4 items-start relative group hover:border-purple-500/50 transition-colors">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
                                                    <div>
                                                        <label className="text-xs text-gray-400 mb-1 block">Variable Key *</label>
                                                        <input
                                                            type="text"
                                                            value={env.key}
                                                            onChange={(e) => {
                                                                if (!editingTemplate) return;
                                                                const newEnv = [...editingTemplate.environmentVariables];
                                                                newEnv[idx].key = e.target.value;
                                                                setEditingTemplate({ ...editingTemplate, environmentVariables: newEnv });
                                                            }}
                                                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white font-mono focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                            placeholder="DATABASE_URL or API_KEY"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-400 mb-1 block">Default Value</label>
                                                        <input
                                                            type="text"
                                                            value={env.defaultValue || ''}
                                                            onChange={(e) => {
                                                                if (!editingTemplate) return;
                                                                const newEnv = [...editingTemplate.environmentVariables];
                                                                newEnv[idx].defaultValue = e.target.value;
                                                                setEditingTemplate({ ...editingTemplate, environmentVariables: newEnv });
                                                            }}
                                                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                            placeholder="optional default value"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className="text-xs text-gray-400 mb-1 block">Description</label>
                                                        <input
                                                            type="text"
                                                            value={env.description || ''}
                                                            onChange={(e) => {
                                                                if (!editingTemplate) return;
                                                                const newEnv = [...editingTemplate.environmentVariables];
                                                                newEnv[idx].description = e.target.value;
                                                                setEditingTemplate({ ...editingTemplate, environmentVariables: newEnv });
                                                            }}
                                                            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                            placeholder="What is this for? (e.g., Database connection URL, API key, etc.)"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2 flex gap-4">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={env.isRequired || false}
                                                                onChange={(e) => {
                                                                    if (!editingTemplate) return;
                                                                    const newEnv = [...editingTemplate.environmentVariables];
                                                                    newEnv[idx].isRequired = e.target.checked;
                                                                    setEditingTemplate({ ...editingTemplate, environmentVariables: newEnv });
                                                                }}
                                                                className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-700 rounded"
                                                            />
                                                            <span className="text-xs text-gray-400">Required</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={env.isSecret || false}
                                                                onChange={(e) => {
                                                                    if (!editingTemplate) return;
                                                                    const newEnv = [...editingTemplate.environmentVariables];
                                                                    newEnv[idx].isSecret = e.target.checked;
                                                                    setEditingTemplate({ ...editingTemplate, environmentVariables: newEnv });
                                                                }}
                                                                className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-700 rounded"
                                                            />
                                                            <span className="text-xs text-gray-400">Secret (hidden input)</span>
                                                        </label>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeEnvVar(idx)}
                                                    className="mt-6 text-red-500 hover:text-red-400 p-2 hover:bg-red-500/10 rounded transition-colors"
                                                    title="Remove environment variable"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Resource Limits */}
                                {activeTab === 'limits' && (
                                    <div className="space-y-6">
                                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
                                            <h3 className="text-sm font-semibold text-blue-300 mb-2">Resource Limits Strategy</h3>
                                            <p className="text-xs text-blue-200/80">
                                                Set limits to protect platform resources. Users can use their own database/storage for unlimited data.
                                                Limits apply to platform resources only (build files, static assets, images).
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    Max Listings/Items
                                                    <span className="text-xs text-gray-500 ml-2">(null = unlimited via user's DB)</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    value={editingTemplate.resourceLimits?.maxListings || ''}
                                                    onChange={(e) => {
                                                        if (!editingTemplate) return;
                                                        setEditingTemplate({
                                                            ...editingTemplate,
                                                            resourceLimits: {
                                                                ...editingTemplate.resourceLimits,
                                                                maxListings: e.target.value ? parseInt(e.target.value) : null
                                                            }
                                                        });
                                                    }}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                    placeholder="Leave empty for unlimited"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Set limit if storing in platform. Leave empty if users use their own database (recommended).
                                                </p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    Max Image Size (MB)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={editingTemplate.resourceLimits?.maxImageSize || 5}
                                                    onChange={(e) => {
                                                        if (!editingTemplate) return;
                                                        setEditingTemplate({
                                                            ...editingTemplate,
                                                            resourceLimits: {
                                                                ...editingTemplate.resourceLimits,
                                                                maxImageSize: parseInt(e.target.value) || 5
                                                            }
                                                        });
                                                    }}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                    min="1"
                                                    max="50"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">Maximum file size per image upload (1-50 MB)</p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    Max Image Width (px)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={editingTemplate.resourceLimits?.maxImageResolution?.width || 1920}
                                                    onChange={(e) => {
                                                        if (!editingTemplate) return;
                                                        setEditingTemplate({
                                                            ...editingTemplate,
                                                            resourceLimits: {
                                                                ...editingTemplate.resourceLimits,
                                                                maxImageResolution: {
                                                                    width: parseInt(e.target.value) || 1920,
                                                                    height: editingTemplate.resourceLimits?.maxImageResolution?.height || 1080
                                                                }
                                                            }
                                                        });
                                                    }}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                    min="800"
                                                    max="4000"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    Max Image Height (px)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={editingTemplate.resourceLimits?.maxImageResolution?.height || 1080}
                                                    onChange={(e) => {
                                                        if (!editingTemplate) return;
                                                        setEditingTemplate({
                                                            ...editingTemplate,
                                                            resourceLimits: {
                                                                ...editingTemplate.resourceLimits,
                                                                maxImageResolution: {
                                                                    width: editingTemplate.resourceLimits?.maxImageResolution?.width || 1920,
                                                                    height: parseInt(e.target.value) || 1080
                                                                }
                                                            }
                                                        });
                                                    }}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                    min="600"
                                                    max="4000"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    Max Storage Per Project (MB)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={editingTemplate.resourceLimits?.maxStoragePerProject || 100}
                                                    onChange={(e) => {
                                                        if (!editingTemplate) return;
                                                        setEditingTemplate({
                                                            ...editingTemplate,
                                                            resourceLimits: {
                                                                ...editingTemplate.resourceLimits,
                                                                maxStoragePerProject: parseInt(e.target.value) || 100
                                                            }
                                                        });
                                                    }}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                    min="10"
                                                    max="1000"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">Total storage limit for build files and static assets</p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    Max Files Per Project
                                                </label>
                                                <input
                                                    type="number"
                                                    value={editingTemplate.resourceLimits?.maxFilesPerProject || 1000}
                                                    onChange={(e) => {
                                                        if (!editingTemplate) return;
                                                        setEditingTemplate({
                                                            ...editingTemplate,
                                                            resourceLimits: {
                                                                ...editingTemplate.resourceLimits,
                                                                maxFilesPerProject: parseInt(e.target.value) || 1000
                                                            }
                                                        });
                                                    }}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                                                    min="100"
                                                    max="10000"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">Maximum number of files per project</p>
                                            </div>
                                        </div>

                                        <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                                            <h4 className="text-sm font-semibold text-green-300 mb-2">💡 Best Practice</h4>
                                            <ul className="text-xs text-green-200/80 space-y-1 list-disc list-inside">
                                                <li>Set <code className="bg-green-900/50 px-1 rounded">maxListings: null</code> to allow unlimited listings via user's database</li>
                                                <li>Set reasonable image limits (5MB, 1920x1080) to protect server resources</li>
                                                <li>Users can use their own storage (S3, Cloudinary) for large files</li>
                                                <li>Platform limits protect your server, user infrastructure handles scale</li>
                                            </ul>
                                        </div>
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

            {/* Deploy Demo Modal */}
            {showDemoModal && demoTemplate && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl max-w-lg w-full shadow-2xl max-h-[95vh] overflow-y-auto">
                        <div className="p-4 sm:p-6 border-b border-gray-800 sticky top-0 bg-gray-900 rounded-t-xl sm:rounded-t-2xl">
                            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                                <GlobeAltIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                                Deploy Live Demo
                            </h2>
                            <p className="text-gray-400 text-xs sm:text-sm mt-2">
                                Deploy {demoTemplate.displayName} as an internal live preview
                            </p>
                        </div>

                        <form onSubmit={handleDemoSubmit} className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 sm:p-4">
                                <p className="text-xs sm:text-sm text-blue-200 mb-2">
                                    <strong>📍 Deployment URL</strong>
                                </p>
                                <p className="text-xs text-blue-300/80">
                                    Demo will be deployed at a path-based URL like:
                                </p>
                                <p className="text-xs text-blue-400 font-mono mt-2 break-all">
                                    https://foodpanda.site/demo-{demoTemplate.name}-abc123/
                                </p>
                                <p className="text-xs text-blue-300/60 mt-3">
                                    This matches how regular user deployments work. The URL is automatically generated and will be visible on the template card for all users.
                                </p>
                            </div>

                            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 sm:p-4">
                                <p className="text-xs text-gray-400">
                                    <strong>ℹ️ Note:</strong> The demo will be deployed using the same Docker container approach as regular deployments. It will be accessible at the generated path on your main domain.
                                </p>
                            </div>

                            {(demoTemplate as any).demoDeploymentUrl && (
                                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 sm:p-4">
                                    <p className="text-xs text-yellow-200 mb-2">
                                        ⚠️ This template already has a live demo:
                                    </p>
                                    <a 
                                        href={(demoTemplate as any).demoDeploymentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-yellow-400 hover:text-yellow-300 break-all"
                                    >
                                        {(demoTemplate as any).demoDeploymentUrl}
                                    </a>
                                    <p className="text-xs text-yellow-300/60 mt-2">
                                        Deploying again will replace the existing demo.
                                    </p>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowDemoModal(false)}
                                    disabled={demoDeploying}
                                    className="w-full sm:flex-1 px-4 py-2.5 sm:py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 text-white rounded-lg transition text-sm"
                                >
                                    Cancel
                                </button>
                                {(demoTemplate as any).demoDeploymentUrl && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowDemoModal(false);
                                            handleRemoveDemo(demoTemplate._id, demoTemplate.displayName);
                                        }}
                                        disabled={demoDeploying}
                                        className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-red-600/20 hover:bg-red-600/40 disabled:opacity-50 text-red-400 rounded-lg transition text-sm"
                                    >
                                        Remove Demo
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={demoDeploying}
                                    className="w-full sm:flex-1 px-4 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-lg transition flex items-center justify-center gap-2 text-sm"
                                >
                                    {demoDeploying ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            <span>Deploying...</span>
                                        </>
                                    ) : (
                                        <>
                                            <GlobeAltIcon className="w-4 h-4" />
                                            <span>Deploy Demo</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
