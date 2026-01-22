const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

class AuditService {
    /**
     * Log an audit event
     * @param {Object} params
     * @param {string} params.userId - User performing the action
     * @param {string} params.action - Action type
     * @param {string} params.resourceType - Type of resource affected
     * @param {string} params.resourceId - ID of resource
     * @param {string} params.resourceName - Name/description of resource
     * @param {string} params.ip - User IP address
     * @param {string} params.userAgent - User agent string
     * @param {Object} params.details - Additional details
     * @param {string} params.status - success or failure
     * @param {string} params.errorMessage - Error message if failed
     */
    async log({
        userId,
        action,
        resourceType,
        resourceId = null,
        resourceName = '',
        ip = 'unknown',
        userAgent = '',
        details = {},
        status = 'success',
        errorMessage = ''
    }) {
        try {
            await AuditLog.create({
                userId,
                action,
                resourceType,
                resourceId,
                resourceName,
                ip,
                userAgent,
                details,
                status,
                errorMessage
            });
        } catch (error) {
            // Don't fail the main operation if audit logging fails
            logger.error('Audit log creation failed:', error);
        }
    }

    /**
     * Get user audit logs
     * @param {string} userId
     * @param {Object} options
     * @returns {Promise<Array>}
     */
    async getUserLogs(userId, { limit = 50, skip = 0, action = null } = {}) {
        const query = { userId };
        if (action) {
            query.action = action;
        }

        return await AuditLog.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .lean();
    }

    /**
     * Get logs for a specific resource
     * @param {string} resourceType
     * @param {string} resourceId
     * @returns {Promise<Array>}
     */
    async getResourceLogs(resourceType, resourceId, { limit = 50 } = {}) {
        return await AuditLog.find({ resourceType, resourceId })
            .populate('userId', 'email displayName username')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }

    /**
     * Middleware to extract request info
     * @param {Object} req - Express request object
     * @returns {Object}
     */
    extractRequestInfo(req) {
        return {
            userId: req.user?._id || req.user?.id,
            ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'] || ''
        };
    }
}

module.exports = new AuditService();
