'use client';
import { useState, useEffect, useRef } from 'react';
import { BellIcon, CheckIcon, ExclamationTriangleIcon, CheckCircleIcon, InformationCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store';
import api from '@/lib/api';
import { io as socketIO, Socket } from 'socket.io-client';
import Link from 'next/link';

export default function NotificationBell() {
    const { user } = useSelector((state: RootState) => state.auth);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [flash, setFlash] = useState(false);
    const [markingAll, setMarkingAll] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<Socket | null>(null);

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/user/notifications?limit=20');
            if (res.data) {
                setNotifications(res.data.notifications);
                setUnreadCount(res.data.unreadCount);
            }
        } catch (error) {
            console.error('Failed to fetch notifications');
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const socket = socketIO(socketUrl, { path: '/api/socket.io/', transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            if (user?.id) socket.emit('join-notifications', user.id);
            if (user?.role === 'admin') socket.emit('join-admin');
        });

        const handleNewNotification = () => {
            fetchNotifications();
            setFlash(true);
            setTimeout(() => setFlash(false), 2000);
        };

        socket.on('notification', handleNewNotification);
        socket.on('admin-notification', handleNewNotification);

        return () => {
            clearInterval(interval);
            socket.disconnect();
        };
    }, [user?.id, user?.role]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await api.put(`/user/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) { }
    };

    const markAllAsRead = async () => {
        if (markingAll || unreadCount === 0) return;
        setMarkingAll(true);
        try {
            await api.put('/user/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark all as read');
        } finally {
            setMarkingAll(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'warning': return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
            case 'error': return <TrashIcon className="h-5 w-5 text-red-500" />;
            case 'success': return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
            default: return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
        }
    };

    const timeAgo = (date: string) => {
        const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(date).toLocaleDateString();
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => { setIsOpen(!isOpen); setFlash(false); }}
                className={`relative p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-800 focus:outline-none ${flash ? 'animate-bounce' : ''}`}
            >
                <BellIcon className={`h-6 w-6 ${flash ? 'text-yellow-400' : ''}`} />
                {unreadCount > 0 && (
                    <span className={`absolute top-1 right-1 h-3 w-3 rounded-full border-2 border-gray-950 ${flash ? 'bg-yellow-400 animate-ping' : 'bg-red-500'}`}></span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
                        <h3 className="text-sm font-semibold text-white">Notifications</h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    disabled={markingAll}
                                    className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                                    title="Mark all as read"
                                >
                                    <CheckIcon className="h-3.5 w-3.5" />
                                    <span>{markingAll ? 'Marking...' : 'Read all'}</span>
                                </button>
                            )}
                            {unreadCount > 0 && (
                                <span className="text-xs bg-purple-900 text-purple-200 px-2 py-0.5 rounded-full">{unreadCount}</span>
                            )}
                        </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-sm">
                                No notifications
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-800">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification._id}
                                        className={`p-3 hover:bg-gray-800/50 transition-colors cursor-pointer ${!notification.read ? 'bg-gray-800/30' : ''}`}
                                        onClick={() => !notification.read && markAsRead(notification._id)}
                                    >
                                        <div className="flex items-start space-x-3">
                                            <div className="flex-shrink-0 mt-0.5">
                                                {getIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium ${!notification.read ? 'text-white' : 'text-gray-300'}`}>
                                                    {notification.title}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-0.5 break-words line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    {timeAgo(notification.createdAt)}
                                                </p>
                                            </div>
                                            {!notification.read && (
                                                <div className="flex-shrink-0">
                                                    <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="px-4 py-2.5 border-t border-gray-800 text-center">
                        <Link
                            href="/dashboard/notifications"
                            onClick={() => setIsOpen(false)}
                            className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium"
                        >
                            View All Notifications
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
