'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface DeploymentLog {
    timestamp: string;
    level: 'info' | 'error' | 'success';
    message: string;
}

export interface DeploymentStatus {
    deploymentId: string;
    status: 'queued' | 'building' | 'deploying' | 'success' | 'failed';
    progress: number;
    message?: string;
    url?: string;
    error?: string;
    logs: DeploymentLog[];
}

export function useDeployment(deploymentId: string | null) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [status, setStatus] = useState<DeploymentStatus>({
        deploymentId: deploymentId || '',
        status: 'queued',
        progress: 0,
        logs: []
    });
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!deploymentId) return;

        // Create socket connection
        const newSocket = io(API_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            path: '/api/socket.io/'
        });

        newSocket.on('connect', () => {
            console.log('WebSocket connected');
            setIsConnected(true);

            // Join deployment room
            newSocket.emit('join-deployment', deploymentId);
        });

        newSocket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            setIsConnected(false);
        });

        // Listen for deployment status updates
        newSocket.on('deployment-status', (data: any) => {
            // Only update if this is for the current deployment
            if (data.deploymentId !== deploymentId) {
                console.log('Ignoring status for different deployment:', data.deploymentId);
                return;
            }

            console.log('Deployment status:', data);
            setStatus(prev => ({
                ...prev,
                status: data.status,
                progress: data.progress || prev.progress,
                message: data.message,
                url: data.url,
                error: data.error
            }));
        });

        // Listen for deployment logs
        newSocket.on('deployment-log', (data: any) => {
            // Only update if this is for the current deployment
            if (data.deploymentId !== deploymentId) {
                return;
            }

            console.log('Deployment log:', data);
            setStatus(prev => ({
                ...prev,
                logs: [...prev.logs, {
                    timestamp: data.timestamp,
                    level: data.level,
                    message: data.message
                }]
            }));
        });

        // Listen for deployment progress
        newSocket.on('deployment-progress', (data: any) => {
            // Only update if this is for the current deployment
            if (data.deploymentId !== deploymentId) {
                return;
            }

            console.log('Deployment progress:', data.progress);
            setStatus(prev => ({
                ...prev,
                progress: data.progress
            }));
        });

        setSocket(newSocket);

        // Cleanup
        return () => {
            if (newSocket) {
                newSocket.emit('leave-deployment', deploymentId);
                newSocket.disconnect();
            }
        };
    }, [deploymentId]);

    const refresh = useCallback(async () => {
        if (!deploymentId) return;

        try {
            const response = await fetch(`${API_URL}/api/deployments/${deploymentId}/status`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setStatus({
                    deploymentId: data._id,
                    status: data.status,
                    progress: data.progress?.percentage || 0,
                    message: data.progress?.current,
                    url: data.url,
                    error: data.error,
                    logs: data.progress?.logs || []
                });
            }
        } catch (error) {
            console.error('Failed to fetch deployment status:', error);
        }
    }, [deploymentId]);

    // Fetch initial state (logs, status) immediately
    useEffect(() => {
        if (deploymentId) {
            refresh();
        }
    }, [deploymentId, refresh]);

    return {
        status,
        isConnected,
        refresh
    };
}
