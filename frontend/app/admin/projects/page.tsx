'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { MagnifyingGlassIcon, FolderIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function AdminProjectsPage() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

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

    const filteredProjects = projects.filter((project: any) => {
        const matchesSearch =
            project.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.repository?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.repository?.owner?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = filterStatus === 'all' || project.status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">All Projects</h1>
                    <p className="text-gray-400 mt-2">Manage all platform projects</p>
                </div>
                <div className="text-sm text-gray-400">
                    Total Projects: <span className="text-white font-semibold">{projects.length}</span>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="deploying">Deploying</option>
                </select>
            </div>

            {/* Projects Grid */}
            {filteredProjects.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
                    <FolderIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No projects found</h3>
                    <p className="text-gray-400">
                        {searchQuery ? 'Try adjusting your search' : 'No projects have been created yet'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProjects.map((project: any) => (
                        <div
                            key={project._id}
                            className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-all"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                    <div className="bg-purple-500/10 p-2 rounded-lg flex-shrink-0">
                                        <FolderIcon className="h-6 w-6 text-purple-500" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-white font-semibold truncate">{project.name}</h3>
                                        <p className="text-sm text-gray-400 truncate">
                                            {project.repository?.owner}/{project.repository?.name}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-400">Status</span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${project.status === 'active' ? 'bg-green-500/10 text-green-500' :
                                        project.status === 'deploying' ? 'bg-blue-500/10 text-blue-500' :
                                            'bg-gray-500/10 text-gray-500'
                                        }`}>
                                        {project.status}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-400">Framework</span>
                                    <span className="text-white">{project.framework || 'Auto-detect'}</span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-400">Created</span>
                                    <span className="text-white">
                                        {new Date(project.createdAt).toLocaleDateString()}
                                    </span>
                                </div>

                                {project.deploymentUrl && (
                                    <div className="pt-2 border-t border-gray-800">
                                        <a
                                            href={project.deploymentUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-purple-400 hover:text-purple-300 truncate block"
                                        >
                                            {project.deploymentUrl}
                                        </a>
                                    </div>
                                )}
                            </div>

                            <div className="flex space-x-2 mt-4 pt-4 border-t border-gray-800">
                                <a
                                    href={`/dashboard/projects/${project._id}`}
                                    className="flex-1 flex items-center justify-center space-x-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                                >
                                    <EyeIcon className="h-4 w-4" />
                                    <span>View</span>
                                </a>
                                <button
                                    onClick={() => handleDeleteProject(project._id, project.name)}
                                    className="flex items-center justify-center space-x-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-2 rounded-lg text-sm transition-colors"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                    <span>Delete</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-400">Total Projects</p>
                    <p className="text-2xl font-bold text-white mt-1">{projects.length}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-400">Active</p>
                    <p className="text-2xl font-bold text-green-500 mt-1">
                        {projects.filter((p: any) => p.status === 'active').length}
                    </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-400">Deploying</p>
                    <p className="text-2xl font-bold text-blue-500 mt-1">
                        {projects.filter((p: any) => p.status === 'deploying').length}
                    </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-400">Inactive</p>
                    <p className="text-2xl font-bold text-gray-500 mt-1">
                        {projects.filter((p: any) => p.status === 'inactive').length}
                    </p>
                </div>
            </div>
        </div>
    );
}
