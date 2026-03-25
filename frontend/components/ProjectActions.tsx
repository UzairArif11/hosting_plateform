'use client';

import { useState } from 'react';
import { TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface ProjectActionsProps {
    projectId: string;
    projectName: string;
    onDelete?: () => void;
    onRedeploy?: (branch: string) => void;
}

export default function ProjectActions({
    projectId,
    projectName,
    onDelete,
    onRedeploy
}: ProjectActionsProps) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showBranchSelector, setShowBranchSelector] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState('main');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRedeploying, setIsRedeploying] = useState(false);

    const branches = ['main', 'master', 'develop', 'staging'];

    const handleDelete = async () => {
        setIsDeleting(true);

        try {
            await api.delete(`/projects/${projectId}`);
            toast.success('Project deleted successfully');
            if (onDelete) onDelete();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to delete project');
            console.error(error);
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleRedeploy = async (branch: string) => {
        setIsRedeploying(true);

        try {
            await api.post(`/projects/${projectId}/deploy`, { branch });
            toast.success(`Deployment started on branch: ${branch}`);
            if (onRedeploy) onRedeploy(branch);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to start deployment');
            console.error(error);
        } finally {
            setIsRedeploying(false);
            setShowBranchSelector(false);
        }
    };

    return (
        <div className="flex items-center space-x-3">
            {/* Redeploy Button */}
            <div className="relative">
                <button
                    onClick={() => setShowBranchSelector(!showBranchSelector)}
                    disabled={isRedeploying}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
                >
                    <ArrowPathIcon className={`w-5 h-5 ${isRedeploying ? 'animate-spin' : ''}`} />
                    <span>{isRedeploying ? 'Deploying...' : 'Redeploy'}</span>
                </button>

                {/* Branch Selector Dropdown */}
                {showBranchSelector && (
                    <div className="absolute top-full mt-2 left-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 min-w-[200px]">
                        <div className="p-2">
                            <p className="text-xs text-gray-400 mb-2 px-2">Select branch:</p>
                            {branches.map((branch) => (
                                <button
                                    key={branch}
                                    onClick={() => handleRedeploy(branch)}
                                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 rounded transition-colors"
                                >
                                    {branch}
                                    {branch === selectedBranch && (
                                        <span className="ml-2 text-blue-400">✓</span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="border-t border-gray-700 p-2">
                            <input
                                type="text"
                                placeholder="Custom branch..."
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        const branch = e.currentTarget.value.trim();
                                        if (branch) {
                                            handleRedeploy(branch);
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Button */}
            <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors"
            >
                <TrashIcon className="w-5 h-5" />
                <span>Delete</span>
            </button>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-white mb-4">
                            Delete Project?
                        </h3>
                        <p className="text-gray-300 mb-6">
                            Are you sure you want to delete <strong>{projectName}</strong>?
                            This will stop all containers and remove all deployments.
                            This action cannot be undone.
                        </p>
                        <div className="flex space-x-3">
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors"
                            >
                                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
