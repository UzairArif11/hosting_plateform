'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    EyeIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
} from '@heroicons/react/24/outline';

interface ManualPayment {
    _id: string;
    user: { _id: string; username: string; email: string; avatar?: string };
    plan: { _id: string; displayName: string };
    planName: string;
    amount: number;
    currency: string;
    bankAccount: { bankName: string; accountTitle: string; accountNumber: string };
    senderName: string;
    senderAccount: string;
    transactionId: string;
    screenshot: string;
    status: 'pending' | 'verified' | 'rejected';
    adminNotes: string;
    createdAt: string;
    verifiedAt?: string;
    rejectedAt?: string;
}

export default function AdminPaymentsPage() {
    const [payments, setPayments] = useState<ManualPayment[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('pending');
    const [pendingCount, setPendingCount] = useState(0);
    const [selectedPayment, setSelectedPayment] = useState<ManualPayment | null>(null);
    const [actionLoading, setActionLoading] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        fetchPayments();
    }, [statusFilter]);

    const fetchPayments = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/admin/manual-payments?status=${statusFilter}`);
            setPayments(res.data.payments || []);
            setPendingCount(res.data.pendingCount || 0);
        } catch (error) {
            console.error('Failed to fetch payments', error);
            toast.error('Failed to load payments');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (paymentId: string) => {
        setActionLoading(paymentId);
        try {
            await api.post(`/admin/manual-payments/${paymentId}/verify`, { notes });
            toast.success('Payment verified and plan upgraded!');
            setNotes('');
            setSelectedPayment(null);
            fetchPayments();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to verify payment');
        } finally {
            setActionLoading('');
        }
    };

    const handleReject = async (paymentId: string) => {
        if (!notes.trim()) {
            toast.error('Please provide a reason for rejection');
            return;
        }
        setActionLoading(paymentId);
        try {
            await api.post(`/admin/manual-payments/${paymentId}/reject`, { reason: notes });
            toast.success('Payment rejected');
            setNotes('');
            setSelectedPayment(null);
            fetchPayments();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to reject payment');
        } finally {
            setActionLoading('');
        }
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <span className="px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded-full text-xs font-medium flex items-center gap-1"><ClockIcon className="h-3 w-3" /> Pending</span>;
            case 'verified':
                return <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-medium flex items-center gap-1"><CheckCircleIcon className="h-3 w-3" /> Verified</span>;
            case 'rejected':
                return <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded-full text-xs font-medium flex items-center gap-1"><XCircleIcon className="h-3 w-3" /> Rejected</span>;
            default:
                return null;
        }
    };

    const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Payment Verifications</h1>
                    <p className="text-gray-400 mt-1">
                        Manage manual bank transfer payment submissions
                        {pendingCount > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-bold">
                                {pendingCount} pending
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Status Filters */}
            <div className="flex gap-2">
                {['pending', 'verified', 'rejected', 'all'].map((status) => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${statusFilter === status
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {/* Payments List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
            ) : payments.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
                    <p className="text-gray-400 text-lg">No {statusFilter !== 'all' ? statusFilter : ''} payments found</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {payments.map((payment) => (
                        <div key={payment._id} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-3">
                                        <span className="text-white font-semibold text-lg">
                                            {payment.user?.username || payment.user?.email || 'Unknown User'}
                                        </span>
                                        {statusBadge(payment.status)}
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <p className="text-gray-500">Plan</p>
                                            <p className="text-white font-medium">{payment.planName}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Amount</p>
                                            <p className="text-green-400 font-bold">{payment.currency === 'PKR' ? '₨' : '$'}{payment.amount}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Bank</p>
                                            <p className="text-white">{payment.bankAccount?.bankName}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Submitted</p>
                                            <p className="text-white">{new Date(payment.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    {payment.senderName && (
                                        <p className="text-sm text-gray-400">
                                            Sender: <span className="text-white">{payment.senderName}</span>
                                            {payment.transactionId && <> | TxID: <span className="text-white">{payment.transactionId}</span></>}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-3">
                                    {payment.screenshot && (
                                        <a
                                            href={`${backendUrl}${payment.screenshot}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition flex items-center gap-2 text-sm"
                                        >
                                            <EyeIcon className="h-4 w-4" /> View Screenshot
                                        </a>
                                    )}
                                    {payment.status === 'pending' && (
                                        <button
                                            onClick={() => {
                                                setSelectedPayment(payment);
                                                setNotes('');
                                            }}
                                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
                                        >
                                            Review
                                        </button>
                                    )}
                                </div>
                            </div>

                            {payment.adminNotes && (
                                <div className="mt-3 pt-3 border-t border-gray-800">
                                    <p className="text-sm text-gray-400">Admin Notes: <span className="text-gray-300">{payment.adminNotes}</span></p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Review Modal */}
            {selectedPayment && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full space-y-4">
                        <h2 className="text-xl font-bold text-white">Review Payment</h2>

                        <div className="space-y-2 text-sm">
                            <p className="text-gray-400">User: <span className="text-white">{selectedPayment.user?.username || selectedPayment.user?.email}</span></p>
                            <p className="text-gray-400">Plan: <span className="text-white font-semibold">{selectedPayment.planName}</span></p>
                            <p className="text-gray-400">Amount: <span className="text-green-400 font-bold">{selectedPayment.currency === 'PKR' ? '₨' : '$'}{selectedPayment.amount}</span></p>
                            <p className="text-gray-400">Bank: <span className="text-white">{selectedPayment.bankAccount?.bankName}</span></p>
                            <p className="text-gray-400">Sender: <span className="text-white">{selectedPayment.senderName}</span></p>
                            {selectedPayment.transactionId && (
                                <p className="text-gray-400">Transaction ID: <span className="text-white">{selectedPayment.transactionId}</span></p>
                            )}
                        </div>

                        {selectedPayment.screenshot && (
                            <div className="border border-gray-700 rounded-lg overflow-hidden">
                                <img
                                    src={`${backendUrl}${selectedPayment.screenshot}`}
                                    alt="Payment Screenshot"
                                    className="w-full max-h-64 object-contain bg-gray-800"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Admin Notes / Rejection Reason</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Optional notes (required for rejection)"
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                rows={3}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => handleVerify(selectedPayment._id)}
                                disabled={actionLoading === selectedPayment._id}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition disabled:opacity-50"
                            >
                                {actionLoading === selectedPayment._id ? 'Processing...' : '✅ Verify & Upgrade'}
                            </button>
                            <button
                                onClick={() => handleReject(selectedPayment._id)}
                                disabled={actionLoading === selectedPayment._id}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition disabled:opacity-50"
                            >
                                {actionLoading === selectedPayment._id ? 'Processing...' : '❌ Reject'}
                            </button>
                        </div>

                        <button
                            onClick={() => setSelectedPayment(null)}
                            className="w-full text-gray-400 hover:text-white transition text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
