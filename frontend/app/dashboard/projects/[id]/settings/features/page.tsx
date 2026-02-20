'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface FeatureToggle {
    name: string;
    displayName: string;
    description: string;
    enabled: boolean;
    available: boolean; // Available in plan
    category: string;
    icon: string;
}

export default function FeaturesPage({ params }: { params: { id: string } }) {
    const [project, setProject] = useState<any>(null);
    const [features, setFeatures] = useState<FeatureToggle[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    useEffect(() => {
        fetchProject();
    }, [params.id]);

    const fetchProject = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/projects/${params.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to fetch project');
            const data = await res.json();
            setProject(data);

            // Build feature list from plan and project settings
            buildFeatureList(data);
        } catch (error) {
            console.error('Error fetching project:', error);
            toast.error('Failed to load project');
        } finally {
            setLoading(false);
        }
    };

    const buildFeatureList = (projectData: any) => {
        const planFeatures = projectData.owner?.plan?.features || [];
        const projectSettings = projectData.settings?.features || {};

        const featureList: FeatureToggle[] = [
            {
                name: 'previewDeployments',
                displayName: 'Preview Deployments',
                description: 'Automatically deploy Pull Requests to preview URLs',
                enabled: projectSettings.previewDeployments !== false,
                available: planFeatures.some((f: any) => f.name === 'previewDeployments' && f.enabled),
                category: 'Deployments',
                icon: '🔄'
            },
            {
                name: 'buildCache',
                displayName: 'Build Cache',
                description: 'Cache dependencies for 95% faster rebuilds',
                enabled: projectSettings.buildCache !== false,
                available: planFeatures.some((f: any) => f.name === 'buildCache' && f.enabled),
                category: 'Performance',
                icon: '⚡'
            },
            {
                name: 'analytics',
                displayName: 'Analytics',
                description: 'Track page views, visitors, and traffic sources',
                enabled: projectSettings.analytics !== false,
                available: planFeatures.some((f: any) => f.name === 'analytics' && f.enabled),
                category: 'Monitoring',
                icon: '📊'
            },
            {
                name: 'autoDeploy',
                displayName: 'Auto Deploy',
                description: 'Automatically deploy when you push to your branch',
                enabled: projectData.autoDeploy?.enabled || false,
                available: true, // Always available
                category: 'Deployments',
                icon: '🚀'
            },
            {
                name: 'customDomains',
                displayName: 'Custom Domains',
                description: 'Use your own domain with automatic SSL',
                enabled: projectSettings.customDomains !== false,
                available: planFeatures.some((f: any) => f.name === 'customDomains' && f.enabled),
                category: 'Domains',
                icon: '🌐'
            },
            {
                name: 'teamCollaboration',
                displayName: 'Team Collaboration',
                description: 'Invite team members and manage permissions',
                enabled: projectSettings.teamCollaboration !== false,
                available: planFeatures.some((f: any) => f.name === 'teamCollaboration' && f.enabled),
                category: 'Team',
                icon: '👥'
            },
            {
                name: 'rollback',
                displayName: 'Deployment Rollback',
                description: 'Rollback to previous deployments instantly',
                enabled: projectSettings.rollback !== false,
                available: planFeatures.some((f: any) => f.name === 'rollback' && f.enabled),
                category: 'Deployments',
                icon: '⏮️'
            },
            {
                name: 'auditLogs',
                displayName: 'Audit Logs',
                description: 'Track all actions and changes in your project',
                enabled: projectSettings.auditLogs !== false,
                available: planFeatures.some((f: any) => f.name === 'auditLogs' && f.enabled),
                category: 'Security',
                icon: '📝'
            }
        ];

        setFeatures(featureList);
    };

    const handleToggle = async (featureName: string, currentValue: boolean) => {
        setSaving(featureName);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/projects/${params.id}/features`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    feature: featureName,
                    enabled: !currentValue
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update feature');
            }

            toast.success(`${featureName} ${!currentValue ? 'enabled' : 'disabled'}`);
            fetchProject();
        } catch (error: any) {
            console.error('Toggle error:', error);
            toast.error(error.message || 'Failed to update feature');
        } finally {
            setSaving(null);
        }
    };

    const groupedFeatures = features.reduce((acc, feature) => {
        if (!acc[feature.category]) {
            acc[feature.category] = [];
        }
        acc[feature.category].push(feature);
        return acc;
    }, {} as Record<string, FeatureToggle[]>);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Project Features</h1>
                <p className="text-gray-400">Enable or disable features for this project</p>
            </div>

            {/* Feature Categories */}
            {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
                <div key={category} className="mb-8">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        {category}
                    </h2>
                    <div className="space-y-3">
                        {categoryFeatures.map((feature) => (
                            <div
                                key={feature.name}
                                className={`bg-gray-900 border rounded-xl p-5 transition ${feature.available
                                        ? 'border-gray-800 hover:border-gray-700'
                                        : 'border-gray-800 opacity-60'
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-2xl">{feature.icon}</span>
                                            <div>
                                                <h3 className="text-white font-medium text-lg">
                                                    {feature.displayName}
                                                </h3>
                                                {!feature.available && (
                                                    <span className="inline-block px-2 py-0.5 bg-yellow-900/20 border border-yellow-500/30 text-yellow-300 text-xs rounded mt-1">
                                                        Upgrade Required
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-gray-400 text-sm ml-11">
                                            {feature.description}
                                        </p>
                                    </div>

                                    {/* Toggle Switch */}
                                    <button
                                        onClick={() => {
                                            if (!feature.available) {
                                                toast.error('This feature is not available in your plan');
                                                return;
                                            }
                                            handleToggle(feature.name, feature.enabled);
                                        }}
                                        disabled={!feature.available || saving === feature.name}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${feature.enabled && feature.available
                                                ? 'bg-purple-600'
                                                : 'bg-gray-700'
                                            } ${!feature.available ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                                    >
                                        <span
                                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${feature.enabled && feature.available ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>

                                {/* Feature-specific info */}
                                {feature.enabled && feature.available && (
                                    <div className="mt-4 ml-11 text-xs text-gray-500">
                                        {feature.name === 'previewDeployments' && (
                                            <p>✓ PR previews will be created automatically</p>
                                        )}
                                        {feature.name === 'buildCache' && (
                                            <p>✓ Build times reduced by up to 95%</p>
                                        )}
                                        {feature.name === 'analytics' && (
                                            <p>✓ Visitor tracking active</p>
                                        )}
                                        {feature.name === 'autoDeploy' && (
                                            <p>✓ Pushes to main will auto-deploy</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Plan Info */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6 mt-8">
                <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <h4 className="text-blue-300 font-medium mb-2">Your Current Plan</h4>
                        <p className="text-sm text-gray-300 mb-2">
                            Plan: <strong>{project?.owner?.plan?.displayName || 'Free'}</strong>
                        </p>
                        <p className="text-xs text-gray-400">
                            Features marked with "Upgrade Required" are not available in your current plan.
                        </p>
                        <button
                            onClick={() => window.location.href = '/dashboard/billing'}
                            className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition"
                        >
                            View Plans
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
