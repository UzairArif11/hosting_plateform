'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
    MagnifyingGlassIcon,
    FolderIcon,
    TrashIcon,
    EyeIcon,
    ArrowPathIcon,
    UserIcon,
    ServerIcon,
    CpuChipIcon,
    GlobeAltIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function AdminProjectsPage() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [rebuilding, setRebuilding] = useState<string | null>(null);

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const response = await api.get('/api/admin/projects?limit=1000');
            setProjects(response.data.projects || []);
        } catch (error) {
            console.error('Failed to fetch projects:', error);
            toast.error('Failed to load projects');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProject = async (projectId: string, projectName: string) => {
        if (!confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await api.delete(`/api/projects/${projectId}`);
            toast.success('Project deleted successfully');
            fetchProjects();
        } catch (error) {
            toast.error('Failed to delete project');
        }
    };

    const handleForceRebuild = async (projectId: string) => {
        if (!confirm('Force a full rebuild and deployment for this project?')) return;

        setRebuilding(projectId);
        try {
            // This endpoint will be added to admin.js
            await api.post(`/api/admin/projects/${projectId}/rebuild`);
            toast.success('Rebuild queued successfully');
        } catch (error) {
            toast.error('Failed to queue rebuild');
        } finally {
            setRebuilding(null);
            fetchProjects();
        }
    };

    const filteredProjects = projects.filter((project: any) => {
        const matchesSearch =
            project.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.owner?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.owner?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.repository?.name?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = filterStatus === 'all' || project.status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-6 max-w-[1600px] mx-auto">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                        <FolderIcon className="h-10 w-10 text-purple-500" />
                        Infrastructure Projects
                    </h1>
                    <p className="text-gray-400 mt-2">Administrative view of all deployments across the cluster</p>
                </div>
                <div className="bg-gray-900/50 px-6 py-3 rounded-2xl border border-gray-800 shadow-xl">
                    <span className="text-gray-500 text-sm font-bold uppercase tracking-widest">Global Fleet:</span>
                    <span className="text-2xl font-black text-white ml-3">{projects.length}</span>
                </div>
            </div>

            {/* Power Filters */}
            <div className="flex flex-col lg:flex-row gap-4 bg-gray-900/30 p-4 rounded-2xl border border-gray-800">
                <div className="flex-1 relative">
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search by name, repo, or owner email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-12 pr-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium"
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded-xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                    >
                        <option value="all">ALL STATUS</option>
                        <option value="success">ACTIVE (SUCCESS)</option>
                        <option value="failed">FAILED</option>
                        <option value="building">BUILDING</option>
                        <option value="pending">PENDING</option>
                    </select>
                </div>
            </div>

            {/* High-Performance Table/Grid View */}
            {filteredProjects.length === 0 ? (
                <div className="bg-gray-900/20 border border-gray-800 rounded-3xl p-20 text-center">
                    <div className="bg-gray-800/50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                        <BugAntIcon className="h-12 w-12 text-gray-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">No projects matching criteria</h3>
                    <p className="text-gray-500 max-w-md mx-auto">Try broadening your search or checking the global infrastructure status.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
                    {filteredProjects.map((project: any) => (
                        <div
                            key={project._id}
                            className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl overflow-hidden hover:border-purple-500/40 transition-all duration-300 group shadow-2xl"
                        >
                            {/* Card Header */}
                            <div className="p-6 pb-0 flex justify-between items-start">
                                <div className="flex items-start gap-4 flex-1 min-w-0">
                                    <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-3 rounded-2xl shadow-lg shadow-purple-500/20">
                                        <CpuChipIcon className="h-6 w-6 text-white" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-lg font-black text-white truncate leading-tight">{project.name}</h3>
                                        <p className="text-xs text-gray-400 font-mono mt-1 opacity-70">ID: {project._id}</p>
                                    </div>
                                </div>
                                <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter border ${project.status === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                        project.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    }`}>
                                    {project.status || 'DEPLOYED'}
                                </div>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* Owner Info Section */}
                                <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                                    <div className="bg-gray-800 p-2 rounded-lg">
                                        <UserIcon className="h-4 w-4 text-purple-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase">Project Owner</p>
                                        <p className="text-sm text-white font-medium truncate">{project.owner?.email || 'N/A'}</p>
                                    </div>
                                </div>

                                {/* Deployment Detail Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-800/30 p-3 rounded-2xl border border-white/5">
                                        <div className="flex items-center gap-2 mb-1">
                                            <ServerIcon className="h-3 w-3 text-blue-400" />
                                            <span className="text-[10px] text-gray-500 font-bold uppercase">Host Info</span>
                                        </div>
                                        <p className="text-sm text-white font-mono">{project.assignedServer || 'EC3 CLUSTER'}</p>
                                    </div>
                                    <div className="bg-gray-800/30 p-3 rounded-2xl border border-white/5">
                                        <div className="flex items-center gap-2 mb-1">
                                            <GlobeAltIcon className="h-3 w-3 text-orange-400" />
                                            <span className="text-[10px] text-gray-500 font-bold uppercase">Framework</span>
                                        </div>
                                        <p className="text-sm text-white font-black truncate">{project.framework?.toUpperCase() || 'VANILLA'}</p>
                                    </div>
                                </div>

                                {/* URL Section */}
                                {project.deploymentUrl && (
                                    <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Deployment URL</p>
                                        <a
                                            href={project.deploymentUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-purple-400 hover:underline truncate block font-mono"
                                        >
                                            {project.deploymentUrl}
                                        </a>
                                    </div>
                                )}

                                {/* Card Footer Actions */}
                                <div className="flex gap-2 pt-2">
                                    <a
                                        href={`/dashboard/projects/${project._id}`}
                                        className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-xl text-xs font-bold transition-all border border-white/5"
                                    >
                                        <EyeIcon className="h-4 w-4" />
                                        <span>DASHBOARD</span>
                                    </a>
                                    <button
                                        onClick={() => handleForceRebuild(project._id)}
                                        disabled={rebuilding === project._id}
                                        className="flex-1 flex items-center justify-center gap-2 bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white p-3 rounded-xl text-xs font-bold transition-all border border-purple-500/20"
                                    >
                                        <ArrowPathIcon className={`h-4 w-4 ${rebuilding === project._id ? 'animate-spin' : ''}`} />
                                        <span>REBUILD</span>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteProject(project._id, project.name)}
                                        className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white p-3 rounded-xl transition-all border border-red-500/20"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function BugAntIcon({ className }: { className: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
    );
}

