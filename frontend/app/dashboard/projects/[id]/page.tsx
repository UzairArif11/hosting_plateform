'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/lib/store';
import { fetchProject, deleteProject } from '@/lib/slices/projectsSlice';
import { fetchDeployments, createDeployment } from '@/lib/slices/deploymentsSlice';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DeploymentStatus from '@/components/DeploymentStatus';
import {
    RocketLaunchIcon,
    Cog6ToothIcon,
    TrashIcon,
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon,
    GlobeAltIcon,
} from '@heroicons/react/24/outline';

export default function ProjectDetailPage() {
    const params = useParams();
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const { currentProject, loading: projectLoading } = useSelector((state: RootState) => state.projects);
    const { deployments, loading: deploymentsLoading } = useSelector((state: RootState) => state.deployments);
    const [activeTab, setActiveTab] = useState('deployments');
    const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);
    const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(null);
    const [isDeploying, setIsDeploying] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState<string>('main');
    const [showBranchDropdown, setShowBranchDropdown] = useState(false);

    // Mock branches - in production, fetch from GitHub API
    const availableBranches = ['main', 'master', 'develop', 'staging'];

    useEffect(() => {
        if (params.id) {
            dispatch(fetchProject(params.id as string));
            dispatch(fetchDeployments(params.id as string));  // Pass string directly
        }
    }, [params.id, dispatch]);

    useEffect(() => {
        if (currentProject?.repository?.branch) {
            setSelectedBranch(currentProject.repository.branch);
        }
    }, [currentProject]);

    useEffect(() => {
        if (currentProject?.environmentVariables) {
            setEnvVars(
                Object.entries(currentProject.environmentVariables).map(([key, value]) => ({
                    key,
                    value: value as string,
                }))
            );
        }
    }, [currentProject]);

    // Track active deployment
    useEffect(() => {
        if (deployments.length > 0) {
            // Find the most recent deployment that's in progress
            const activeDeployment = deployments.find(
                (d: any) => d.status === 'building' || d.status === 'deploying' || d.status === 'queued'
            );

            if (activeDeployment) {
                setActiveDeploymentId(activeDeployment._id);
                setIsDeploying(true);
            } else {
                setActiveDeploymentId(null);
                setIsDeploying(false);
            }
        }
    }, [deployments]);

    const handleDeploy = async () => {
        if (isDeploying) {
            toast.error('A deployment is already in progress');
            return;
        }

        // Lock immediately to prevent double submissions
        setIsDeploying(true);

        try {
            const result = await dispatch(createDeployment({
                projectId: params.id as string,
                branch: selectedBranch,
            })).unwrap();

            // Set the new deployment as active
            setActiveDeploymentId(result._id);
            setIsDeploying(true);

            toast.success(`Deployment started from ${selectedBranch} branch!`);
        } catch (error: any) {
            setIsDeploying(false);
            toast.error(error || 'Failed to start deployment');
        }
    };

    const handleDeleteProject = async () => {
        if (!confirm(`Are you sure you want to delete "${currentProject?.name}"?`)) {
            return;
        }

        try {
            await dispatch(deleteProject(params.id as string)).unwrap();
            toast.success('Project deleted successfully');
            router.push('/dashboard/projects');
        } catch (error: any) {
            toast.error(error || 'Failed to delete project');
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success':
                return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
            case 'failed':
                return <XCircleIcon className="h-5 w-5 text-red-500" />;
            case 'building':
                return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />;
            default:
                return <ClockIcon className="h-5 w-5 text-gray-500" />;
        }
    };

    if (projectLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    if (!currentProject) {
        return (
            <div className="text-center py-12">
                <h3 className="text-xl font-semibold text-white mb-2">Project not found</h3>
                <Link href="/dashboard/projects" className="text-purple-400 hover:text-purple-300">
                    ← Back to projects
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <Link
                        href="/dashboard/projects"
                        className="text-sm text-purple-400 hover:text-purple-300 mb-2 inline-block"
                    >
                        ← Back to projects
                    </Link>
                    <h1 className="text-3xl font-bold text-white">{currentProject.name}</h1>
                    <p className="text-gray-400 mt-1">
                        {currentProject.repository?.owner}/{currentProject.repository?.name}
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    {/* Visit Site Button */}
                    {(currentProject.deploymentUrl || currentProject.latestDeployment?.deploymentUrl) && (
                        <a
                            href={
                                (currentProject.deploymentUrl || currentProject.latestDeployment?.deploymentUrl)?.startsWith('http')
                                    ? (currentProject.deploymentUrl || currentProject.latestDeployment?.deploymentUrl)
                                    : `https://${currentProject.deploymentUrl || currentProject.latestDeployment?.deploymentUrl}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors border border-gray-700 text-white"
                        >
                            <GlobeAltIcon className="h-5 w-5" />
                            <span>Visit</span>
                        </a>
                    )}

                    {/* Branch Selector Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                            className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors border border-gray-700"
                        >
                            <span className="text-sm text-gray-400">Branch:</span>
                            <span className="text-white font-medium">{selectedBranch}</span>
                            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {showBranchDropdown && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setShowBranchDropdown(false)}
                                />
                                <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20 py-1">
                                    {availableBranches.map((branch) => (
                                        <button
                                            key={branch}
                                            onClick={() => {
                                                setSelectedBranch(branch);
                                                setShowBranchDropdown(false);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${branch === selectedBranch
                                                ? 'bg-purple-600 text-white'
                                                : 'text-gray-300 hover:bg-gray-700'
                                                }`}
                                        >
                                            {branch}
                                            {branch === selectedBranch && (
                                                <span className="float-right">✓</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Calculate active build status */
                        (() => {
                            const isBuildInProgress = deployments.some(d => ['queued', 'building', 'deploying'].includes(d.status));

                            return (
                                <button
                                    onClick={handleDeploy}
                                    disabled={isDeploying || isBuildInProgress}
                                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isDeploying || isBuildInProgress
                                        ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                                        }`}
                                    title={isBuildInProgress ? 'A deployment is currently in progress' : 'Start a new deployment'}
                                >
                                    <RocketLaunchIcon className="h-5 w-5" />
                                    <span>
                                        {isDeploying
                                            ? 'Deploying...'
                                            : isBuildInProgress
                                                ? 'Build in Progress'
                                                : 'Deploy Now'}
                                    </span>
                                </button>
                            );
                        })()}
                    <button
                        onClick={handleDeleteProject}
                        className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        <TrashIcon className="h-5 w-5" />
                        <span>Delete</span>
                    </button>
                </div>
            </div>

            {/* Project Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-400">Status</p>
                    <p className="text-lg font-semibold text-white mt-1 capitalize">{currentProject.status}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-400">Framework</p>
                    <p className="text-lg font-semibold text-white mt-1">{currentProject.framework || 'Auto-detect'}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-400">Branch</p>
                    <p className="text-lg font-semibold text-white mt-1">{currentProject.repository?.branch}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-400">Deployments</p>
                    <p className="text-lg font-semibold text-white mt-1">{deployments.length}</p>
                </div>
            </div>

            {/* Active Deployment Status */}
            {activeDeploymentId && (
                <div className="mb-6">
                    <DeploymentStatus deploymentId={activeDeploymentId} />
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-gray-800">
                <div className="flex space-x-8">
                    <button
                        onClick={() => setActiveTab('deployments')}
                        className={`pb-4 px-1 border-b-2 transition-colors ${activeTab === 'deployments'
                            ? 'border-purple-500 text-white'
                            : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        Deployments
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`pb-4 px-1 border-b-2 transition-colors ${activeTab === 'settings'
                            ? 'border-purple-500 text-white'
                            : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        Settings
                    </button>
                    <button
                        onClick={() => setActiveTab('env')}
                        className={`pb-4 px-1 border-b-2 transition-colors ${activeTab === 'env'
                            ? 'border-purple-500 text-white'
                            : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        Environment Variables
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            <div>
                {activeTab === 'deployments' && (
                    <div className="space-y-4">
                        {deploymentsLoading ? (
                            <div className="text-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
                            </div>
                        ) : deployments.length === 0 ? (
                            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
                                <RocketLaunchIcon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-white mb-2">No deployments yet</h3>
                                <p className="text-gray-400 mb-6">Deploy your project to see it live</p>
                                <button
                                    onClick={handleDeploy}
                                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
                                >
                                    Deploy Now
                                </button>
                            </div>
                        ) : (
                            deployments.map((deployment) => (
                                <Link
                                    key={deployment._id}
                                    href={`/dashboard/deployments/${deployment._id}`}
                                    prefetch={false}
                                    className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg p-6 transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-4">
                                            {getStatusIcon(deployment.status)}
                                            <div>
                                                <h3 className="text-white font-medium">
                                                    {deployment.commitMessage || 'Manual deployment'}
                                                </h3>
                                                <p className="text-sm text-gray-400">
                                                    {deployment.branch} • {deployment.commitSha?.substring(0, 7)}
                                                </p>
                                                {/* Show URL for successful deployments */}
                                                {deployment.status === 'success' && deployment.url && (
                                                    <a
                                                        href={deployment.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-green-400 hover:text-green-300 underline mt-1 inline-block"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        View Deployment →
                                                    </a>
                                                )}
                                                {/* Show error for failed deployments */}
                                                {/* Show error for failed deployments */}
                                                {deployment.status === 'failed' && deployment.error && (
                                                    <p className="text-xs text-red-400 mt-1">
                                                        Error: {(() => {
                                                            if (typeof deployment.error === 'string') {
                                                                return deployment.error.substring(0, 100) + (deployment.error.length > 100 ? '...' : '');
                                                            }
                                                            const errorObj = deployment.error as any;
                                                            const errorMsg = errorObj?.message || errorObj?.error || JSON.stringify(deployment.error);
                                                            return errorMsg.substring(0, 100) + (errorMsg.length > 100 ? '...' : '');
                                                        })()}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end space-y-2">
                                            <div className="text-right">
                                                <p className="text-sm text-gray-400">
                                                    {new Date(deployment.createdAt).toLocaleString()}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {deployment.buildTime ? `${deployment.buildTime}ms` : 'Building...'}
                                                </p>
                                            </div>
                                            {/* Quick Redeploy Button Removed as requested */}
                                        </div>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Project Settings</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Project Name
                                </label>
                                <input
                                    type="text"
                                    value={currentProject.name}
                                    disabled
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Repository URL
                                </label>
                                <input
                                    type="text"
                                    value={currentProject.repository?.url}
                                    disabled
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Production Branch
                                </label>
                                <input
                                    type="text"
                                    value={currentProject.repository?.branch}
                                    disabled
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Framework
                                </label>
                                <input
                                    type="text"
                                    value={currentProject.framework || 'Auto-detect'}
                                    disabled
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'env' && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Environment Variables</h3>
                        <p className="text-gray-400 text-sm mb-6">
                            Add environment variables for your project. These will be available during build and runtime.
                        </p>
                        <div className="space-y-3">
                            {envVars.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No environment variables set</p>
                            ) : (
                                envVars.map((env, index) => (
                                    <div key={index} className="flex items-center space-x-3">
                                        <input
                                            type="text"
                                            value={env.key}
                                            disabled
                                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                            placeholder="KEY"
                                        />
                                        <input
                                            type="password"
                                            value={env.value}
                                            disabled
                                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                            placeholder="VALUE"
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
