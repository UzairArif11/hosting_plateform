'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
    BellIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    XCircleIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    CheckIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';

type NotificationType = 'info' | 'warning' | 'error' | 'success';

interface Notification {
    _id: string;
    title: string;
    message: string;
    type: NotificationType;
    read: boolean;
    createdAt: string;
    resourceType?: string;
}

const TYPE_FILTERS: { value: string; label: string; color: string }[] = [
    { value: '', label: 'All', color: 'bg-gray-700 text-gray-300' },
    { value: 'success', label: 'Success', color: 'bg-green-900/50 text-green-400' },
    { value: 'info', label: 'Info', color: 'bg-blue-900/50 text-blue-400' },
    { value: 'warning', label: 'Warning', color: 'bg-yellow-900/50 text-yellow-400' },
    { value: 'error', label: 'Error', color: 'bg-red-900/50 text-red-400' },
];

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [typeFilter, setTypeFilter] = useState('');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [markingAll, setMarkingAll] = useState(false);
    const limit = 20;

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({ page: String(page), limit: String(limit) });
            if (typeFilter) params.set('type', typeFilter);
            if (search) params.set('search', search);
            if (unreadOnly) params.set('unreadOnly', 'true');

            const res = await api.get(`/user/notifications?${params}`);
            if (res.data) {
                setNotifications(res.data.notifications || []);
                setUnreadCount(res.data.unreadCount || 0);
                setTotal(res.data.pagination?.total || 0);
                setTotalPages(res.data.pagination?.totalPages || 1);
            }
        } catch {
            console.error('Failed to fetch notifications');
        } finally {
            setLoading(false);
        }
    }, [page, typeFilter, search, unreadOnly]);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    useEffect(() => { setPage(1); }, [typeFilter, search, unreadOnly]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearch(searchInput);
    };

    const markAsRead = async (id: string) => {
        try {
            await api.put(`/user/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch { }
    };

    const markAllAsRead = async () => {
        if (markingAll || unreadCount === 0) return;
        setMarkingAll(true);
        try {
            await api.put('/user/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch { } finally { setMarkingAll(false); }
    };

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case 'warning': return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
            case 'error': return <XCircleIcon className="h-5 w-5 text-red-500" />;
            case 'success': return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
            default: return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
        }
    };

    const getBadgeColor = (type: NotificationType) => {
        switch (type) {
            case 'warning': return 'bg-yellow-900/40 text-yellow-400 border-yellow-800';
            case 'error': return 'bg-red-900/40 text-red-400 border-red-800';
            case 'success': return 'bg-green-900/40 text-green-400 border-green-800';
            default: return 'bg-blue-900/40 text-blue-400 border-blue-800';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <BellIcon className="h-7 w-7 text-purple-400" />
                        Notifications
                    </h1>
                    <p className="text-gray-400 mt-1">
                        {total} total{unreadCount > 0 && <> &middot; <span className="text-purple-400 font-medium">{unreadCount} unread</span></>}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={markAllAsRead}
                        disabled={markingAll}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <CheckIcon className="h-4 w-4" />
                        {markingAll ? 'Marking...' : 'Mark All as Read'}
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <form onSubmit={handleSearch} className="flex-1 relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search notifications..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 text-sm"
                    />
                </form>

                <div className="flex items-center gap-2 flex-wrap">
                    <FunnelIcon className="h-4 w-4 text-gray-500 hidden sm:block" />
                    {TYPE_FILTERS.map(f => (
                        <button
                            key={f.value}
                            onClick={() => setTypeFilter(f.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                                typeFilter === f.value
                                    ? 'border-purple-500 bg-purple-900/40 text-purple-300'
                                    : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                    <button
                        onClick={() => setUnreadOnly(!unreadOnly)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                            unreadOnly
                                ? 'border-purple-500 bg-purple-900/40 text-purple-300'
                                : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700'
                        }`}
                    >
                        Unread only
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                        <p className="text-gray-500 mt-3 text-sm">Loading notifications...</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="p-12 text-center">
                        <BellIcon className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-400 font-medium">No notifications found</p>
                        <p className="text-gray-600 text-sm mt-1">
                            {search || typeFilter || unreadOnly ? 'Try adjusting your filters' : 'You\'re all caught up!'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-800">
                        {notifications.map(n => (
                            <div
                                key={n._id}
                                className={`p-4 sm:p-5 hover:bg-gray-800/40 transition-colors ${!n.read ? 'bg-gray-800/20 border-l-2 border-l-purple-500' : 'border-l-2 border-l-transparent'}`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-0.5">
                                        {getIcon(n.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className={`text-sm font-semibold ${!n.read ? 'text-white' : 'text-gray-300'}`}>
                                                    {n.title}
                                                </p>
                                                <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                                                    {n.message}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getBadgeColor(n.type)}`}>
                                                    {n.type}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 mt-2">
                                            <p className="text-xs text-gray-600">
                                                {new Date(n.createdAt).toLocaleDateString()} at {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            {!n.read && (
                                                <button
                                                    onClick={() => markAsRead(n._id)}
                                                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                                >
                                                    Mark as read
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                        Page {page} of {totalPages} ({total} results)
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="p-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeftIcon className="h-4 w-4" />
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 5) {
                                pageNum = i + 1;
                            } else if (page <= 3) {
                                pageNum = i + 1;
                            } else if (page >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                            } else {
                                pageNum = page - 2 + i;
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setPage(pageNum)}
                                    className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                                        page === pageNum
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="p-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRightIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
