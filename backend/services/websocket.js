const { Server } = require('socket.io');
const logger = require('../utils/logger');

let io = null;

/**
 * Initialize Socket.IO server
 */
function initializeWebSocket(server, sessionMiddleware) {
    io = new Server(server, {
        path: '/api/socket.io/',
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    // Attach Express session to Socket.IO if available
    if (sessionMiddleware) {
        io.use((socket, next) => {
            sessionMiddleware(socket.request, {}, next);
        });
    }

    io.on('connection', (socket) => {
        const sessionUser = socket.request?.session?.passport?.user;
        logger.info('WebSocket client connected', { socketId: socket.id, hasSession: !!sessionUser });

        // Join deployment room (open — build logs are not sensitive)
        socket.on('join-deployment', (deploymentId) => {
            socket.join(`deployment-${deploymentId}`);
            logger.info('Client joined deployment room', {
                socketId: socket.id,
                deploymentId
            });
        });

        // Leave deployment room
        socket.on('leave-deployment', (deploymentId) => {
            socket.leave(`deployment-${deploymentId}`);
            logger.info('Client left deployment room', {
                socketId: socket.id,
                deploymentId
            });
        });

        // Join user-specific notification room (validate userId matches session)
        socket.on('join-notifications', (userId) => {
            if (sessionUser && sessionUser.toString() === userId?.toString()) {
                socket.join(`user-${userId}`);
            } else if (!sessionMiddleware) {
                // Fallback: if no session middleware configured, allow (backwards compat)
                socket.join(`user-${userId}`);
            } else {
                logger.warn('Socket join-notifications rejected — userId mismatch', {
                    socketId: socket.id,
                    requestedUserId: userId,
                    sessionUserId: sessionUser
                });
            }
        });

        // Join admin notification room (validate admin role from session)
        socket.on('join-admin', async () => {
            if (!sessionMiddleware) {
                // No session middleware — allow (backwards compat)
                socket.join('admin-room');
                return;
            }
            if (!sessionUser) {
                logger.warn('Socket join-admin rejected — no session', { socketId: socket.id });
                return;
            }
            try {
                const User = require('../models/User');
                const user = await User.findById(sessionUser).select('role').lean();
                if (user?.role === 'admin') {
                    socket.join('admin-room');
                } else {
                    logger.warn('Socket join-admin rejected — not admin', {
                        socketId: socket.id,
                        userId: sessionUser
                    });
                }
            } catch (err) {
                logger.error('Socket join-admin auth check failed:', err.message);
            }
        });

        socket.on('disconnect', () => {
            logger.info('WebSocket client disconnected', { socketId: socket.id });
        });
    });

    logger.info('✅ WebSocket server initialized');
    return io;
}

/**
 * Emit deployment log to all clients watching this deployment
 */
function emitDeploymentLog(deploymentId, log) {
    if (!io) {
        logger.warn('Socket.IO not initialized, skipping deployment log');
        return;
    }

    try {
        io.to(`deployment-${deploymentId}`).emit('deployment-log', {
            deploymentId,
            timestamp: new Date().toISOString(),
            ...log
        });
    } catch (err) {
        logger.error('Failed to emit deployment log:', err);
    }
}

/**
 * Emit deployment progress update
 */
function emitDeploymentProgress(deploymentId, progress) {
    if (!io) {
        logger.warn('Socket.IO not initialized, skipping deployment progress');
        return;
    }

    try {
        io.to(`deployment-${deploymentId}`).emit('deployment-progress', {
            deploymentId,
            progress,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        logger.error('Failed to emit deployment progress:', err);
    }
}

/**
 * Emit deployment status change
 */
function emitDeploymentStatus(deploymentId, status, data = {}) {
    if (!io) {
        logger.warn('Socket.IO not initialized, skipping deployment status');
        return;
    }

    try {
        io.to(`deployment-${deploymentId}`).emit('deployment-status', {
            deploymentId,
            status,
            timestamp: new Date().toISOString(),
            ...data
        });
    } catch (err) {
        logger.error('Failed to emit deployment status:', err);
    }
}

/**
 * Send a notification to a specific user via socket
 */
function emitNotification(userId, notification) {
    if (!io) return;
    try {
        io.to(`user-${userId}`).emit('notification', notification);
    } catch (err) {
        logger.error('Failed to emit notification:', err);
    }
}

/**
 * Send a notification to all admins via socket
 */
function emitAdminNotification(notification) {
    if (!io) return;
    try {
        io.to('admin-room').emit('admin-notification', notification);
    } catch (err) {
        logger.error('Failed to emit admin notification:', err);
    }
}

module.exports = {
    initializeWebSocket,
    emitDeploymentLog,
    emitDeploymentProgress,
    emitDeploymentStatus,
    emitNotification,
    emitAdminNotification,
    getIO: () => io
};
