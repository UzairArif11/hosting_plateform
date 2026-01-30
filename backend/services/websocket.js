const { Server } = require('socket.io');
const logger = require('../utils/logger');

let io = null;

/**
 * Initialize Socket.IO server
 */
function initializeWebSocket(server) {
    io = new Server(server, {
        path: '/api/socket.io/',
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        logger.info('WebSocket client connected', { socketId: socket.id });

        // Join deployment room
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

module.exports = {
    initializeWebSocket,
    emitDeploymentLog,
    emitDeploymentProgress,
    emitDeploymentStatus,
    getIO: () => io
};
