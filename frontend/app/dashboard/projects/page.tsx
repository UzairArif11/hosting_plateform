'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/lib/store';
import { fetchProjects, createProject, deleteProject } from '@/lib/slices/projectsSlice';
import Link from 'next/link';
import {
    FolderIcon,
    PlusIcon,
    MagnifyingGlassIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function ProjectsPage() {
    const dispatch = useDispatch<AppDispatch>();
    const { projects, loading } = useSelector((state: RootState) => state.projects);
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProject, setNewProject] = useState({
        name: '',
        repository: '',
        branch: 'main',
    });

    useEffect(() => {
        dispatch(fetchProjects({ page: 1, limit: 100 }));
    }, [dispatch]);


    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newProject.name || !newProject.repository) {
            toast.error('Please fill in all fields');
            return;
        }

        // Smart repository parsing - handle multiple formats
        let owner = '';
        let repoName = '';

        const repoInput = newProject.repository.trim();

        // Format 1: Full GitHub HTTPS URL (https://github.com/owner/repo)
        if (repoInput.startsWith('http')) {
            const match = repoInput.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
            if (match) {
                owner = match[1];
                repoName = match[2].replace('.git', '');
            }
        }
        // Format 2: SSH Git URL (git@github.com:owner/repo.git)
        else if (repoInput.startsWith('git@')) {
            const match = repoInput.match(/git@github\.com:([^\/]+)\/(.+)/);
            if (match) {
                owner = match[1];
                repoName = match[2].replace('.git', '');
            }
        }
        // Format 3: gh CLI command (gh repo clone owner/repo)
        else if (repoInput.includes('gh repo clone')) {
            const match = repoInput.match(/gh repo clone\s+([^\/\s]+)\/([^\s]+)/);
            if (match) {
                owner = match[1];
                repoName = match[2];
            }
        }
        // Format 4: Simple owner/repo format
        else if (repoInput.includes('/')) {
            const parts = repoInput.split('/');
            if (parts.length >= 2) {
                owner = parts[0];
                repoName = parts[1].replace('.git', '');
            }
        }

        if (!owner || !repoName) {
            toast.error('Invalid repository format. Use: owner/repo or paste GitHub URL');
            return;
        }

        try {
            await dispatch(createProject({
                name: newProject.name,
                repository: {
                    url: `https://github.com/${owner}/${repoName}`,
                    fullName: `${owner}/${repoName}`,
                    branch: newProject.branch || 'main',
                },
                framework: 'nextjs',
            })).unwrap();

            toast.success('Project created successfully!');
            setShowCreateModal(false);
            setNewProject({ name: '', repository: '', branch: 'main' });
        } catch (error: any) {
            toast.error(error || 'Failed to create project');
        }
    };

    const handleDeleteProject = async (projectId: string, projectName: string) => {
        if (!confirm(`Are you sure you want to delete "${projectName}"?`)) {
            return;
        }

        try {
            await dispatch(deleteProject(projectId)).unwrap();
            toast.success('Project deleted successfully');
        } catch (error: any) {
            toast.error(error || 'Failed to delete project');
        }
    };

    const filteredProjects = projects.filter(project =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Projects</h1>
                    <p className="text-gray-400 mt-1">Manage your deployed projects</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
                >
                    <PlusIcon className="h-5 w-5" />
                    <span>New Project</span>
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
            </div>

            {/* Projects Grid */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
                </div>
            ) : filteredProjects.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
                    <FolderIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">
                        {searchQuery ? 'No projects found' : 'No projects yet'}
                    </h3>
                    <p className="text-gray-400 mb-6">
                        {searchQuery
                            ? 'Try adjusting your search'
                            : 'Get started by creating your first project'}
                    </p>
                    {!searchQuery && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
                        >
                            <PlusIcon className="h-5 w-5" />
                            <span>Create Project</span>
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProjects.map((project: any) => (
                        <div
                            key={project._id}
                            className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-all group"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className="bg-purple-500/10 p-2 rounded-lg">
                                        <FolderIcon className="h-6 w-6 text-purple-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-semibold">{project.name}</h3>
                                        <p className="text-sm text-gray-400">
                                            {project.repository?.owner}/{project.repository?.name}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteProject(project._id, project.name)}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <TrashIcon className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <span
                                    className={`px-3 py-1 rounded-full text-xs font-medium ${project.status === 'active'
                                        ? 'bg-green-500/10 text-green-500'
                                        : 'bg-gray-500/10 text-gray-500'
                                        }`}
                                >
                                    {project.status}
                                </span>
                                <Link
                                    href={`/dashboard/projects/${project._id}`}
                                    className="text-sm text-purple-400 hover:text-purple-300"
                                >
                                    View →
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Project Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full">
                        <h2 className="text-xl font-bold text-white mb-4">Create New Project</h2>
                        <form onSubmit={handleCreateProject} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Project Name
                                </label>
                                <input
                                    type="text"
                                    value={newProject.name}
                                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="my-awesome-project"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    GitHub Repository
                                </label>
                                <input
                                    type="text"
                                    value={newProject.repository}
                                    onChange={(e) => setNewProject({ ...newProject, repository: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="owner/repo"
                                />
                                <p className="mt-2 text-xs text-gray-400">
                                    Accepts: <span className="text-purple-400">owner/repo</span>, GitHub URL, SSH URL, or <span className="text-purple-400">gh repo clone</span> command
                                </p>
                                <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                                    <div>• UzairArif11/Trello-Clone</div>
                                    <div>• https://github.com/UzairArif11/Trello-Clone.git</div>
                                    <div>• git@github.com:UzairArif11/Trello-Clone.git</div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Branch
                                </label>
                                <input
                                    type="text"
                                    value={newProject.branch}
                                    onChange={(e) => setNewProject({ ...newProject, branch: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="main"
                                />
                            </div>
                            <div className="flex space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div >
            )
            }
        </div >
    );
}
