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
import DeploymentSettings from '@/components/DeploymentSettings';
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
    const [openingSetup, setOpeningSetup] = useState(false);
    const [newDomain, setNewDomain] = useState('');
    const [domainLoading, setDomainLoading] = useState<string | null>(null);
    const [addingDomain, setAddingDomain] = useState(false);
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

    // Opens secure setup page via short-lived JWT token (never exposes the signing secret)
    const openSetupPage = async () => {
        const latestDeployment = currentProject?.latestDeployment as any;
        if (!latestDeployment?._id) return;
        if (openingSetup) return;
        setOpeningSetup(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/deployments/${latestDeployment._id}/setup-token`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok || !data.setupUrl) throw new Error(data.error || 'Failed to get setup URL');
            window.open(data.setupUrl, '_blank', 'noopener,noreferrer');
        } catch (err: any) {
            toast.error(err.message || 'Could not open setup page');
        } finally {
            setOpeningSetup(false);
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
                        <>
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
                            {(currentProject.latestDeployment as any)?.metadata?.jwtSigningSecret && (
                                <button
                                    onClick={openSetupPage}
                                    disabled={openingSetup}
                                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors border border-indigo-500 text-white"
                                    title="Setup / admin — secure JWT link (valid 10 min)"
                                >
                                    {openingSetup ? (
                                        <><div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Opening...</span></>
                                    ) : (
                                        <><Cog6ToothIcon className="h-5 w-5" /><span>Setup</span></>
                                    )}
                                </button>
                            )}
                        </>
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
                    <button
                        onClick={() => setActiveTab('domains')}
                        className={`pb-4 px-1 border-b-2 transition-colors ${activeTab === 'domains'
                            ? 'border-purple-500 text-white'
                            : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        Domains
                    </button>
                    <button
                        onClick={() => setActiveTab('deployment_settings')}
                        className={`pb-4 px-1 border-b-2 transition-colors ${activeTab === 'deployment_settings'
                            ? 'border-purple-500 text-white'
                            : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        Deployment
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

                {activeTab === 'domains' && (
                    <div className="space-y-4">
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-1">Domains</h3>
                            <p className="text-gray-400 text-sm mb-6">Add a custom domain to your deployment. Point your DNS A record to the server IP, then verify here.</p>

                            {/* Server IP info */}
                            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6 flex items-start gap-3">
                                <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div>
                                    <p className="text-blue-300 font-medium text-sm">DNS Setup Instructions</p>
                                    <p className="text-blue-200/70 text-xs mt-1">Point your domain's <code className="bg-blue-900/50 px-1 rounded">A record</code> to your server IP, then click Verify below.</p>
                                </div>
                            </div>

                            {/* Existing domains */}
                            <div className="space-y-3 mb-6">
                                {(currentProject.domains || []).map((d: any) => (
                                    <div key={d._id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${d.verified ? 'bg-green-400' : 'bg-yellow-400'}`} />
                                            <div>
                                                <p className="text-white font-medium text-sm">{d.domain}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${d.isCustom ? 'bg-indigo-900/40 text-indigo-300' : 'bg-gray-700 text-gray-400'}`}>
                                                        {d.isCustom ? 'Custom' : 'Platform'}
                                                    </span>
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${d.sslEnabled && d.verified ? 'bg-green-900/40 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                                                        {d.sslEnabled && d.verified ? '🔒 SSL Active' : d.verified ? 'No SSL yet' : 'Not Verified'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {d.isCustom && !d.verified && (
                                                <button
                                                    onClick={async () => {
                                                        setDomainLoading(d._id);
                                                        try {
                                                            const token = localStorage.getItem('token');
                                                            const res = await fetch(`/api/projects/${params.id}/domains/${d._id}/verify`, {
                                                                method: 'POST',
                                                                headers: { 'Authorization': `Bearer ${token}` }
                                                            });
                                                            const data = await res.json();
                                                            if (data.verified) {
                                                                toast.success('Domain verified! SSL provisioning...');
                                                                dispatch(fetchProject(params.id as string));
                                                            } else {
                                                                toast.error(data.error || 'DNS not yet propagated');
                                                            }
                                                        } catch { toast.error('Verification failed'); }
                                                        finally { setDomainLoading(null); }
                                                    }}
                                                    disabled={domainLoading === d._id}
                                                    className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded transition"
                                                >
                                                    {domainLoading === d._id ? 'Verifying...' : 'Verify DNS'}
                                                </button>
                                            )}
                                            {d.verified && (
                                                <a href={`https://${d.domain}`} target="_blank" rel="noopener noreferrer"
                                                    className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition">
                                                    Visit →
                                                </a>
                                            )}
                                            {d.isCustom && (
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm(`Remove ${d.domain}?`)) return;
                                                        setDomainLoading(d._id);
                                                        try {
                                                            const token = localStorage.getItem('token');
                                                            await fetch(`/api/projects/${params.id}/domains/${d._id}`, {
                                                                method: 'DELETE',
                                                                headers: { 'Authorization': `Bearer ${token}` }
                                                            });
                                                            toast.success('Domain removed');
                                                            dispatch(fetchProject(params.id as string));
                                                        } catch { toast.error('Remove failed'); }
                                                        finally { setDomainLoading(null); }
                                                    }}
                                                    disabled={domainLoading === d._id}
                                                    className="px-3 py-1.5 text-xs bg-red-900/40 hover:bg-red-900/70 disabled:opacity-50 text-red-300 rounded transition"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Add custom domain */}
                            <div className="border-t border-gray-700 pt-4">
                                <p className="text-sm font-medium text-gray-300 mb-3">Add Custom Domain</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newDomain}
                                        onChange={e => setNewDomain(e.target.value)}
                                        placeholder="myblog.com"
                                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
                                        onKeyDown={e => e.key === 'Enter' && !addingDomain && (() => {
                                            // submit
                                        })()}
                                    />
                                    <button
                                        disabled={addingDomain || !newDomain.trim()}
                                        onClick={async () => {
                                            setAddingDomain(true);
                                            try {
                                                const token = localStorage.getItem('token');
                                                const res = await fetch(`/api/projects/${params.id}/domains`, {
                                                    method: 'POST',
                                                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ domain: newDomain.trim().toLowerCase() })
                                                });
                                                const data = await res.json();
                                                if (res.ok) {
                                                    toast.success('Domain added — verify DNS next');
                                                    setNewDomain('');
                                                    dispatch(fetchProject(params.id as string));
                                                } else {
                                                    toast.error(data.error || 'Failed to add domain');
                                                }
                                            } catch { toast.error('Request failed'); }
                                            finally { setAddingDomain(false); }
                                        }}
                                        className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm transition"
                                    >
                                        {addingDomain ? 'Adding...' : 'Add Domain'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'deployment_settings' && (
                    <DeploymentSettings project={currentProject} />
                )}
            </div>
        </div >
    );
}
