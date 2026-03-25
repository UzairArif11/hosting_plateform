'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Collaborator {
    user: {
        _id: string;
        email: string;
        displayName?: string;
        username?: string;
    };
    role: 'admin' | 'developer' | 'viewer';
    addedAt: string;
}

interface Invitation {
    _id: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
}

export default function TeamPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [project, setProject] = useState<any>(null);
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'developer' | 'viewer'>('viewer');
    const [inviting, setInviting] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<Collaborator | null>(null);

    useEffect(() => {
        fetchProjectAndTeam();
    }, [params.id]);

    const fetchProjectAndTeam = async () => {
        try {
            const res = await api.get(`/projects/${params.id}`);
            setProject(res.data);
            setCollaborators(res.data.collaborators || []);

            // Fetch pending invitations
            try {
                const invRes = await api.get(`/projects/${params.id}/invitations`);
                setInvitations(invRes.data.invitations || []);
            } catch { /* ignore invitation fetch errors */ }
        } catch (error) {
            console.error('Error fetching team:', error);
            toast.error('Failed to load team information');
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async () => {
        if (!inviteEmail || !inviteEmail.includes('@')) {
            toast.error('Please enter a valid email address');
            return;
        }

        setInviting(true);
        try {
            const res = await api.post(`/projects/${params.id}/invitations`, {
                email: inviteEmail,
                role: inviteRole
            });

            toast.success(`Invitation sent to ${inviteEmail}`);
            setShowInviteModal(false);
            setInviteEmail('');
            setInviteRole('viewer');
            fetchProjectAndTeam();
        } catch (error: any) {
            console.error('Invite error:', error);
            const errMsg = error.response?.data?.error || 'Failed to send invitation';
            if (error.response?.data?.upgradeRequired) {
                toast.error(errMsg);
            } else {
                toast.error(errMsg);
            }
        } finally {
            setInviting(false);
        }
    };

    const handleRemoveMember = async () => {
        if (!removeTarget) return;

        try {
            await api.delete(`/projects/${params.id}/collaborators/${removeTarget.user._id}`);
            toast.success('Member removed successfully');
            setRemoveTarget(null);
            fetchProjectAndTeam();
        } catch (error: any) {
            console.error('Remove member error:', error);
            toast.error(error.response?.data?.error || 'Failed to remove member');
        }
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin': return 'bg-purple-900/20 border-purple-500/30 text-purple-300';
            case 'developer': return 'bg-blue-900/20 border-blue-500/30 text-blue-300';
            case 'viewer': return 'bg-gray-800 border-gray-600 text-gray-300';
            default: return 'bg-gray-800 border-gray-600 text-gray-300';
        }
    };

    const getRoleDescription = (role: string) => {
        switch (role) {
            case 'admin': return 'Can manage project settings and team';
            case 'developer': return 'Can deploy and manage deployments';
            case 'viewer': return 'Can view project and deployments';
            default: return '';
        }
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
                    <h1 className="text-3xl font-bold text-white mb-2">Team Members</h1>
                    <p className="text-gray-400">Manage who has access to this project</p>
                </div>
                <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Invite Member
                </button>
            </div>

            {/* Owner */}
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-white mb-3">Owner</h2>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                <span className="text-white font-bold text-lg">
                                    {project?.owner?.email?.[0]?.toUpperCase() || 'O'}
                                </span>
                            </div>
                            <div>
                                <p className="text-white font-medium">
                                    {project?.owner?.displayName || project?.owner?.username || 'Owner'}
                                </p>
                                <p className="text-sm text-gray-400">{project?.owner?.email}</p>
                            </div>
                        </div>
                        <span className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-lg">
                            Owner
                        </span>
                    </div>
                </div>
            </div>

            {/* Collaborators */}
            {collaborators.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-white mb-3">Collaborators ({collaborators.length})</h2>
                    <div className="space-y-3">
                        {collaborators.map((collab) => (
                            <div
                                key={collab.user._id}
                                className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                                            <span className="text-white font-medium text-lg">
                                                {collab.user.email?.[0]?.toUpperCase() || 'U'}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">
                                                {collab.user.displayName || collab.user.username || 'User'}
                                            </p>
                                            <p className="text-sm text-gray-400">{collab.user.email}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Added {new Date(collab.addedAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <span className={`px-3 py-1.5 border rounded-lg text-sm font-medium ${getRoleBadgeColor(collab.role)}`}>
                                                {collab.role.charAt(0).toUpperCase() + collab.role.slice(1)}
                                            </span>
                                            <p className="text-xs text-gray-500 mt-1">{getRoleDescription(collab.role)}</p>
                                        </div>
                                        <button
                                            onClick={() => setRemoveTarget(collab)}
                                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pending Invitations */}
            {invitations.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-white mb-3">Pending Invitations ({invitations.length})</h2>
                    <div className="space-y-3">
                        {invitations.map((inv) => (
                            <div
                                key={inv._id}
                                className="bg-gray-900 border border-gray-800 rounded-xl p-5 opacity-75"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">{inv.email}</p>
                                            <p className="text-xs text-gray-500">
                                                Invited {new Date(inv.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1.5 border rounded-lg text-sm font-medium ${getRoleBadgeColor(inv.role)}`}>
                                            {inv.role.charAt(0).toUpperCase() + inv.role.slice(1)}
                                        </span>
                                        <span className="px-3 py-1.5 bg-yellow-900/20 border border-yellow-500/30 text-yellow-300 text-sm rounded-lg">
                                            Pending
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6">
                        <h3 className="text-2xl font-bold text-white mb-6">Invite Team Member</h3>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="colleague@example.com"
                                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Role
                                </label>
                                <select
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value as any)}
                                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="viewer">Viewer - Can view project</option>
                                    <option value="developer">Developer - Can deploy</option>
                                    <option value="admin">Admin - Full access</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-2">
                                    {getRoleDescription(inviteRole)}
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowInviteModal(false);
                                    setInviteEmail('');
                                    setInviteRole('viewer');
                                }}
                                disabled={inviting}
                                className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleInvite}
                                disabled={inviting || !inviteEmail}
                                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {inviting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                        Sending...
                                    </>
                                ) : (
                                    'Send Invitation'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Remove Confirmation Modal */}
            {removeTarget && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6">
                        <h3 className="text-2xl font-bold text-white mb-4">Remove Member</h3>

                        <p className="text-gray-300 mb-6">
                            Are you sure you want to remove <strong>{removeTarget.user.email}</strong> from this project?
                            They will immediately lose access.
                        </p>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setRemoveTarget(null)}
                                className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRemoveMember}
                                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                            >
                                Remove Member
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
