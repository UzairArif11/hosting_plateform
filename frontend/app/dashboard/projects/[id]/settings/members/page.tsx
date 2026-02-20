'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import FeatureGuard from '@/components/FeatureGuard';

export default function MembersPage() {
    return (
        <FeatureGuard feature="teamCollaboration">
            <MembersPageContent />
        </FeatureGuard>
    );
}

function MembersPageContent() {
    const params = useParams();
    const [project, setProject] = useState<any>(null);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('viewer');
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        fetchData();
    }, [params.id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [projectRes, invitesRes] = await Promise.all([
                fetch(`/api/projects/${params.id}`),
                fetch(`/api/projects/${params.id}/invitations`)
            ]);

            const projectData = await projectRes.json();
            const invitesData = await invitesRes.json();

            if (projectData.success) setProject(projectData.project);
            if (invitesData.success) setInvitations(invitesData.invitations || []);
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);

        try {
            const res = await fetch(`/api/projects/${params.id}/invitations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail, role: inviteRole })
            });

            const data = await res.json();

            if (data.success) {
                toast.success('Invitation sent!');
                setShowInviteModal(false);
                setInviteEmail('');
                setInviteRole('viewer');
                fetchData();
            } else {
                toast.error(data.error || 'Failed to send invitation');
            }
        } catch (error) {
            toast.error('Network error');
        } finally {
            setInviting(false);
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!confirm('Remove this member from the project?')) return;

        try {
            const res = await fetch(`/api/projects/${params.id}/members/${userId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                toast.success('Member removed');
                fetchData();
            } else {
                toast.error('Failed to remove member');
            }
        } catch (error) {
            toast.error('Network error');
        }
    };

    const handleCancelInvite = async (inviteId: string) => {
        try {
            const res = await fetch(`/api/invitations/${inviteId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                toast.success('Invitation cancelled');
                fetchData();
            } else {
                toast.error('Failed to cancel invitation');
            }
        } catch (error) {
            toast.error('Network error');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Team Members</h1>
                    <p className="text-gray-400">Manage collaborators for this project</p>
                </div>
                <button
                    onClick={() => setShowInviteModal(true)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                    + Invite Member
                </button>
            </div>

            {/* Current Members */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden mb-8">
                <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50">
                    <h3 className="font-semibold text-gray-200">Current Members</h3>
                </div>
                <div className="divide-y divide-gray-700">
                    {/* Owner */}
                    <div className="p-4 flex items-center justify-between">
                        <div>
                            <div className="font-medium text-white">Owner</div>
                            <div className="text-sm text-gray-400">{project?.owner?.email || 'Unknown'}</div>
                        </div>
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs font-bold rounded border border-purple-500/30">
                            OWNER
                        </span>
                    </div>

                    {/* Collaborators */}
                    {project?.collaborators?.map((collab: any) => (
                        <div key={collab._id} className="p-4 flex items-center justify-between">
                            <div>
                                <div className="font-medium text-white">
                                    {collab.user?.displayName || collab.user?.username || 'Unknown'}
                                </div>
                                <div className="text-sm text-gray-400">{collab.user?.email || 'No email'}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded border border-blue-500/30 uppercase">
                                    {collab.role}
                                </span>
                                <button
                                    onClick={() => handleRemoveMember(collab.user?._id)}
                                    className="px-3 py-1 bg-gray-900 hover:bg-red-900/40 text-red-400 border border-gray-700 hover:border-red-800 rounded text-sm transition-colors"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))}

                    {(!project?.collaborators || project.collaborators.length === 0) && (
                        <div className="p-8 text-center text-gray-500 text-sm">
                            No collaborators yet. Invite someone to get started!
                        </div>
                    )}
                </div>
            </div>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50">
                        <h3 className="font-semibold text-gray-200">Pending Invitations</h3>
                    </div>
                    <div className="divide-y divide-gray-700">
                        {invitations.map((invite: any) => (
                            <div key={invite.id} className="p-4 flex items-center justify-between">
                                <div>
                                    <div className="font-medium text-white">{invite.email}</div>
                                    <div className="text-sm text-gray-400">
                                        Invited by {invite.invitedBy} • Expires {new Date(invite.expiresAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded border border-yellow-500/30 uppercase">
                                        {invite.role}
                                    </span>
                                    <button
                                        onClick={() => handleCancelInvite(invite.id)}
                                        className="px-3 py-1 bg-gray-900 hover:bg-gray-700 text-gray-400 border border-gray-700 rounded text-sm transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold text-white mb-4">Invite Team Member</h2>
                        <form onSubmit={handleSendInvite}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    required
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                                <select
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                >
                                    <option value="viewer">Viewer - View only</option>
                                    <option value="developer">Developer - Can deploy & manage</option>
                                    <option value="admin">Admin - Full access</option>
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowInviteModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white border border-gray-700 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={inviting}
                                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {inviting ? 'Sending...' : 'Send Invite'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
