'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function DomainsPage() {
    const params = useParams();
    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [newDomain, setNewDomain] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [verifyingId, setVerifyingId] = useState<string | null>(null);

    useEffect(() => {
        fetchProject();
    }, [params.id]);

    const fetchProject = async () => {
        try {
            const res = await fetch(`/api/projects/${params.id}`);
            const data = await res.json();
            if (data.success) {
                setProject(data.project);
            }
        } catch (error) {
            toast.error('Failed to load project');
        } finally {
            setLoading(false);
        }
    };

    const handleAddDomain = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDomain) return;

        setIsAdding(true);
        try {
            const res = await fetch(`/api/projects/${params.id}/domains`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ domain: newDomain })
            });
            const data = await res.json();

            if (data.success) {
                toast.success('Domain added! Please verify ownership.');
                setNewDomain('');
                fetchProject();
            } else {
                toast.error(data.error || 'Failed to add domain');
            }
        } catch (error) {
            toast.error('Error adding domain');
        } finally {
            setIsAdding(false);
        }
    };

    const handleVerify = async (domainId: string) => {
        setVerifyingId(domainId);
        try {
            const res = await fetch(`/api/projects/${params.id}/domains/${domainId}/verify`, {
                method: 'POST'
            });
            const data = await res.json();

            if (data.success) {
                toast.success('Domain verified successfully!');
                fetchProject();
            } else {
                toast.error(data.error || 'Verification failed. Check TXT record.');
            }
        } catch (error) {
            toast.error('Verification error');
        } finally {
            setVerifyingId(null);
        }
    };

    const handleRemove = async (domainId: string) => {
        if (!confirm('Are you sure you want to remove this domain?')) return;

        try {
            const res = await fetch(`/api/projects/${params.id}/domains/${domainId}`, {
                method: 'DELETE'
            });
            const data = await res.json();

            if (data.success) {
                toast.success('Domain removed');
                fetchProject();
            } else {
                toast.error(data.error);
            }
        } catch (error) {
            toast.error('Error removing domain');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-400">Loading domains...</div>;

    return (
        <div className="max-w-4xl mx-auto p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Custom Domains</h1>
                    <p className="text-gray-400">Manage domains for your project</p>
                </div>
            </div>

            {/* Add Domain Form */}
            <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Add New Domain</h3>
                <form onSubmit={handleAddDomain} className="flex gap-4">
                    <input
                        type="text"
                        placeholder="example.com"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <button
                        type="submit"
                        disabled={isAdding}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        {isAdding ? 'Adding...' : 'Add Domain'}
                    </button>
                </form>
            </div>

            {/* Domain List */}
            <div className="space-y-4">
                {project?.domains?.map((domain: any) => (
                    <div key={domain._id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                        <div className="p-6 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="text-xl font-medium text-white">{domain.domain}</h3>
                                    {domain.verified ? (
                                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                                            VERIFIED
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                            UNVERIFIED
                                        </span>
                                    )}
                                    {domain.isPrimary && (
                                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                            PRIMARY
                                        </span>
                                    )}
                                </div>
                                {!domain.verified && (
                                    <p className="text-sm text-yellow-400/80 mb-2">
                                        Verification required to enable traffic routing.
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-2">
                                {!domain.verified && (
                                    <button
                                        onClick={() => handleVerify(domain._id)}
                                        disabled={verifyingId === domain._id}
                                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                                    >
                                        {verifyingId === domain._id ? 'Verifying...' : 'Verify DNS'}
                                    </button>
                                )}
                                <button
                                    onClick={() => handleRemove(domain._id)}
                                    className="px-4 py-2 bg-gray-900 hover:bg-red-900/40 text-red-400 border border-gray-700 hover:border-red-800 rounded-lg text-sm transition-colors"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>

                        {/* Verification Instructions (if unverified) */}
                        {!domain.verified && (
                            <div className="bg-gray-900/50 border-t border-gray-700 p-6">
                                <h4 className="text-sm font-semibold text-gray-300 mb-3">Verification Instructions</h4>
                                <p className="text-sm text-gray-400 mb-4">
                                    Add the following TXT record to your DNS provider (Cloudflare, GoDaddy, Namecheap, etc.) to verify ownership.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-black/40 rounded p-3 border border-gray-700">
                                        <div className="text-xs text-gray-500 uppercase font-bold mb-1">Type</div>
                                        <code className="text-purple-400">TXT</code>
                                    </div>
                                    <div className="bg-black/40 rounded p-3 border border-gray-700">
                                        <div className="text-xs text-gray-500 uppercase font-bold mb-1">Name / Host</div>
                                        <code className="text-purple-400">_vcp-challenge</code>
                                        <span className="text-gray-500 text-xs ml-2">(or @)</span>
                                    </div>
                                    <div className="bg-black/40 rounded p-3 border border-gray-700 md:col-span-2">
                                        <div className="text-xs text-gray-500 uppercase font-bold mb-1">Value</div>
                                        <div className="flex justify-between items-center">
                                            <code className="text-green-400 break-all">{domain.verificationToken}</code>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(domain.verificationToken);
                                                    toast.success('Copied to clipboard');
                                                }}
                                                className="ml-2 text-gray-500 hover:text-white"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 flex gap-2 items-start">
                                    <span className="text-blue-400 text-lg">💡</span>
                                    <div className="text-xs text-gray-500 mt-1">
                                        <p>DNS propagation usually takes a few minutes but can take up to 24 hours.</p>
                                        <p>Once verified, you may need to add an <strong>A Record</strong> pointing to <code>{window.location.hostname}</code> (Server IP) to route traffic.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                ))}

                {(!project?.domains || project.domains.length === 0) && (
                    <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700 border-dashed">
                        <p className="text-gray-400">No custom domains added yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
