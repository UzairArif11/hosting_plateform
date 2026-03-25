'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';

export default function InvitePage() {
    const params = useParams();
    const router = useRouter();
    const [invitation, setInvitation] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        validateInvitation();
    }, [params.token]);

    const validateInvitation = async () => {
        try {
            const res = await api.get(`/invitations/${params.token}`);
            if (res.data.success) {
                setInvitation(res.data.invitation);
            } else {
                setError(res.data.error || 'Invalid invitation');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load invitation');
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        setAccepting(true);

        try {
            const res = await api.post(`/invitations/${params.token}/accept`);

            if (res.data.success) {
                toast.success('Successfully joined the project!');
                router.push(`/dashboard/projects/${res.data.project.id}`);
            } else {
                toast.error(res.data.error || 'Failed to accept invitation');
            }
        } catch (error: any) {
            if (error.response?.status === 401) {
                toast.error('Please login to accept the invitation');
                router.push(`/login?redirect=/invite/${params.token}`);
            } else {
                toast.error(error.response?.data?.error || 'Failed to accept invitation');
            }
        } finally {
            setAccepting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-gray-400">Loading invitation...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-gray-800 rounded-lg border border-red-500/20 p-8 text-center">
                    <div className="text-6xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold text-white mb-2">Invalid Invitation</h1>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800 rounded-lg border border-gray-700 p-8">
                <div className="text-center mb-6">
                    <div className="text-6xl mb-4">📨</div>
                    <h1 className="text-2xl font-bold text-white mb-2">You're Invited!</h1>
                    <p className="text-gray-400">
                        {invitation.inviterName} invited you to join
                    </p>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-6 mb-6">
                    <div className="space-y-3">
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Project</div>
                            <div className="text-lg font-semibold text-white">{invitation.projectName}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Your Role</div>
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-sm font-bold rounded border border-purple-500/30 uppercase">
                                    {invitation.role}
                                </span>
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Invited To</div>
                            <div className="text-sm text-gray-300">{invitation.email}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Expires</div>
                            <div className="text-sm text-gray-400">
                                {new Date(invitation.expiresAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleAccept}
                    disabled={accepting}
                    className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {accepting ? 'Accepting...' : 'Accept Invitation'}
                </button>

                <p className="text-xs text-gray-500 text-center mt-4">
                    By accepting, you'll get {invitation.role} access to this project.
                </p>
            </div>
        </div>
    );
}
