'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import FeatureGuard from '@/components/FeatureGuard';

interface Domain {
    _id: string;
    domain: string;
    isCustom: boolean;
    isPrimary: boolean;
    verified: boolean;
    sslEnabled: boolean;
    sslStatus?: string;
    verificationToken?: string;
    verifiedAt?: string;
}

export default function DomainsPage({ params }: { params: { id: string } }) {
    return (
        <FeatureGuard feature="customDomains">
            <DomainsPageContent params={params} />
        </FeatureGuard>
    );
}

function DomainsPageContent({ params }: { params: { id: string } }) {
    const [project, setProject] = useState<any>(null);
    const [domains, setDomains] = useState<Domain[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newDomain, setNewDomain] = useState('');
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        fetchProject();
    }, [params.id]);

    const fetchProject = async () => {
        try {
            const res = await api.get(`/projects/${params.id}`);
            setProject(res.data);
            setDomains(res.data.domains || []);
        } catch (error) {
            console.error('Error fetching project:', error);
            toast.error('Failed to load project');
        } finally {
            setLoading(false);
        }
    };

    const handleAddDomain = async () => {
        if (!newDomain || !newDomain.includes('.')) {
            toast.error('Please enter a valid domain name');
            return;
        }

        setAdding(true);
        try {
            const res = await api.post(`/projects/${params.id}/domains`, { domain: newDomain });
            toast.success(res.data.message || 'Domain added! Configure DNS to verify.');
            setShowAddModal(false);
            setNewDomain('');
            fetchProject();
        } catch (error: any) {
            console.error('Add domain error:', error);
            toast.error(error.response?.data?.error || 'Failed to add domain');
        } finally {
            setAdding(false);
        }
    };

    const handleVerifyDomain = async (domainId: string) => {
        try {
            const res = await api.post(`/projects/${params.id}/domains/${domainId}/verify`);
            toast.success(res.data.message || 'Domain verified successfully!');
            fetchProject();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Verification failed');
        }
    };

    const handleEnableSSL = async (domainId: string) => {
        toast.success('🔒 For HTTPS, use Cloudflare proxy (free & automatic SSL!)');
        // Future: Let's Encrypt automation
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Custom Domains</h1>
                    <p className="text-gray-400">Connect your own domain to this project</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Domain
                </button>
            </div>

            {/* Default Domain */}
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-white mb-3">Platform Domain</h2>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white font-medium mb-1">
                                {project?.slug}.platform.com
                            </p>
                            <p className="text-sm text-gray-400">Default deployment URL</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1.5 bg-green-900/20 border border-green-500/30 text-green-300 text-sm rounded-lg">
                                Active
                            </span>
                            <a
                                href={`https://${project?.slug}.platform.com`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-gray-400 hover:text-white transition"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom Domains */}
            {domains.filter(d => d.isCustom).length > 0 ? (
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-white mb-3">Custom Domains</h2>
                    <div className="space-y-3">
                        {domains.filter(d => d.isCustom).map((domain) => (
                            <div
                                key={domain._id}
                                className="bg-gray-900 border border-gray-800 rounded-xl p-5"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <p className="text-white font-medium text-lg">
                                                {domain.domain}
                                            </p>
                                            {domain.isPrimary && (
                                                <span className="px-2 py-1 bg-purple-900/20 border border-purple-500/30 text-purple-300 text-xs rounded">
                                                    Primary
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-3 py-1.5 border rounded-lg text-sm font-medium ${domain.verified
                                                ? 'bg-green-900/20 border-green-500/30 text-green-300'
                                                : 'bg-yellow-900/20 border-yellow-500/30 text-yellow-300'
                                                }`}>
                                                {domain.verified ? '✓ Verified' : 'Pending Verification'}
                                            </span>
                                            <span className={`px-3 py-1.5 border rounded-lg text-sm font-medium ${domain.sslEnabled
                                                ? 'bg-green-900/20 border-green-500/30 text-green-300'
                                                : 'bg-gray-800 border-gray-600 text-gray-300'
                                                }`}>
                                                {domain.sslEnabled ? '🔒 SSL Active' : 'SSL Inactive'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {!domain.verified && domain.verificationToken && (
                                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
                                        <h4 className="text-white font-medium mb-2">DNS Configuration Required</h4>
                                        <div className="space-y-2 text-sm">
                                            <p className="text-gray-300">Add this TXT record to your DNS:</p>
                                            <div className="bg-gray-900 rounded p-3 font-mono text-xs">
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div>
                                                        <span className="text-gray-500">Type:</span> TXT
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Name:</span> _platform-verify
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Value:</span> {domain.verificationToken}
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-gray-400 text-xs mt-2">
                                                Then add an A record pointing to: 123.456.789.0
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {domain.verified && (
                                    <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-lg p-4 mb-4">
                                        <div className="flex items-start gap-3">
                                            <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <div className="flex-1">
                                                <h4 className="text-green-300 font-medium mb-2">✅ Domain Verified!</h4>
                                                <p className="text-sm text-gray-300 mb-3">
                                                    Your domain is verified. For HTTPS, use Cloudflare (free & automatic):
                                                </p>
                                                <ol className="text-xs text-gray-300 space-y-1 ml-4 list-decimal mb-3">
                                                    <li>Add domain to Cloudflare (free plan)</li>
                                                    <li>Point DNS to Cloudflare nameservers</li>
                                                    <li>Enable "Proxied" mode (orange cloud icon)</li>
                                                    <li>SSL works automatically! 🔒</li>
                                                </ol>
                                                <a
                                                    href="https://dash.cloudflare.com"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition"
                                                >
                                                    Setup Cloudflare Now
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                    </svg>
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    {!domain.verified && (
                                        <button
                                            onClick={() => handleVerifyDomain(domain._id)}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
                                        >
                                            Verify DNS
                                        </button>
                                    )}
                                    {domain.verified && (
                                        <a
                                            href={`http://${domain.domain}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            Visit Site (HTTP)
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center mb-6">
                    <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <h3 className="text-xl font-semibold text-white mb-2">No Custom Domains</h3>
                    <p className="text-gray-400 mb-4">Add your first custom domain to get started</p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                    >
                        Add Domain
                    </button>
                </div>
            )}

            {/* SSL Recommendation */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
                <div className="flex gap-3">
                    <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <h4 className="text-blue-300 font-medium mb-2">💡 Recommended: Cloudflare for SSL</h4>
                        <p className="text-sm text-gray-300 mb-3">
                            Get free automatic SSL certificates by using Cloudflare:
                        </p>
                        <ol className="text-sm text-gray-300 space-y-2 ml-4 list-decimal">
                            <li>Add your domain to Cloudflare (free plan works)</li>
                            <li>Point DNS to Cloudflare nameservers</li>
                            <li>Enable "Proxied" mode (orange cloud)</li>
                            <li>Cloudflare handles SSL automatically!</li>
                        </ol>
                        <a
                            href="https://www.cloudflare.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition"
                        >
                            Setup Cloudflare
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    </div>
                </div>
            </div>

            {/* Add Domain Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6">
                        <h3 className="text-2xl font-bold text-white mb-6">Add Custom Domain</h3>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Domain Name
                            </label>
                            <input
                                type="text"
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
                                placeholder="example.com"
                                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Enter your domain without http:// or https://
                            </p>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setNewDomain('');
                                }}
                                disabled={adding}
                                className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddDomain}
                                disabled={adding || !newDomain}
                                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50"
                            >
                                {adding ? 'Adding...' : 'Add Domain'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
