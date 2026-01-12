const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Helper functions
const extractTokenFromRequest = (req) => {
  // Try to get token from cookie first, then from Authorization header
  let token = req.cookies?.auth_token;

  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  // Check for API key format
  if (!token && req.headers['x-api-key']) {
    return req.headers['x-api-key'];
  }

  return token;
};

const verifyJWTToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  } catch (error) {
    throw error;
  }
};

const verifyApiKey = async (apiKey) => {
  try {
    // API keys have format: vcp_xxxxxxxxxxxxx
    if (!apiKey.startsWith('vcp_')) {
      return null;
    }

    const user = await User.findOne({
      'apiKeys.key': apiKey
    });

    if (!user) {
      return null;
    }

    // Update last used timestamp for the API key
    const keyIndex = user.apiKeys.findIndex(k => k.key === apiKey);
    if (keyIndex !== -1) {
      user.apiKeys[keyIndex].lastUsed = new Date();
      await user.save();
    }

    return user;
  } catch (error) {
    logger.error('API key verification error:', error.message);
    return null;
  }
};

const createUnauthorizedResponse = (res, message = 'Authentication required') => {
  return res.status(401).json({
    success: false,
    error: message,
    code: 'UNAUTHORIZED'
  });
};

const createForbiddenResponse = (res, message = 'Insufficient permissions') => {
  return res.status(403).json({
    success: false,
    error: message,
    code: 'FORBIDDEN'
  });
};

const checkTrialExpiry = async (user) => {
  if (user.isTrialActive && new Date() > user.trialExpiry) {
    user.isTrialActive = false;
    if (user.subscriptionStatus === 'trial') {
      user.subscriptionStatus = 'expired';
      user.status = 'suspended';
    }
    await user.save();
  }
  return user;
};

const logAuthEvent = (eventType, userId, details = {}) => {
  logger.security(`Auth: ${eventType}`, {
    userId,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Main authentication middleware
const requireAuth = async (req, res, next) => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      logAuthEvent('Missing token', null, { ip: req.ip, userAgent: req.get('User-Agent') });
      return createUnauthorizedResponse(res, 'No authentication token provided');
    }

    let user = null;

    // Check if it's an API key or JWT token
    if (token.startsWith('vcp_')) {
      // Handle API key authentication
      user = await verifyApiKey(token);
      if (!user) {
        logAuthEvent('Invalid API key', null, { apiKeyPrefix: token.substring(0, 10) });
        return createUnauthorizedResponse(res, 'Invalid API key');
      }
      req.authMethod = 'api_key';
    } else {
      // Handle JWT token authentication
      const decoded = verifyJWTToken(token);
      user = await User.findById(decoded.userId).populate('plan');

      if (!user) {
        logAuthEvent('User not found', decoded.userId);
        return createUnauthorizedResponse(res, 'User not found');
      }

      // Log token status
      logger.info('🔑 User loaded from JWT', {
        userId: user._id,
        email: user.email,
        hasGithubToken: !!user.githubAccessToken,
        githubTokenLength: user.githubAccessToken ? user.githubAccessToken.length : 0,
        provider: user.provider,
        githubId: user.githubId
      });

      req.authMethod = 'jwt';
    }

    // Check if user account is active
    if (user.status === 'banned') {
      logAuthEvent('Banned user access attempt', user._id);
      return createForbiddenResponse(res, 'Account has been banned');
    }

    if (user.status === 'suspended') {
      logAuthEvent('Suspended user access attempt', user._id);
      return createForbiddenResponse(res, 'Account is suspended');
    }

    // Check trial expiry
    user = await checkTrialExpiry(user);

    // Attach user to request
    req.user = user;
    req.userId = user._id;

    logAuthEvent('Successful authentication', user._id, {
      method: req.authMethod,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logAuthEvent('Invalid JWT token', null, { error: error.message });
      return createUnauthorizedResponse(res, 'Invalid authentication token');
    }

    if (error.name === 'TokenExpiredError') {
      logAuthEvent('Expired JWT token', null);
      return createUnauthorizedResponse(res, 'Authentication token expired');
    }

    logger.error('Authentication middleware error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Authentication service error',
      code: 'AUTH_ERROR'
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      req.user = null;
      req.userId = null;
      return next();
    }

    // Use the main auth logic but don't fail on errors
    return requireAuth(req, res, next);
  } catch (error) {
    // Continue without authentication on error
    req.user = null;
    req.userId = null;
    next();
  }
};

// Check specific user status
const requireActiveSubscription = (req, res, next) => {
  if (!req.user) {
    return createUnauthorizedResponse(res);
  }

  const user = req.user;

  // Allow trial users
  if (user.isTrialActive && user.subscriptionStatus === 'trial') {
    return next();
  }

  // Check for active subscription
  if (user.subscriptionStatus !== 'active') {
    logAuthEvent('Inactive subscription access attempt', user._id, {
      subscriptionStatus: user.subscriptionStatus
    });

    return createForbiddenResponse(res, 'Active subscription required');
  }

  next();
};

// Check if user has sufficient resources
const requireResourceCapacity = (resourceType, amount = 1) => {
  return (req, res, next) => {
    if (!req.user) {
      return createUnauthorizedResponse(res);
    }

    const user = req.user;

    if (!user.hasResourceCapacity(resourceType, amount)) {
      logAuthEvent('Resource capacity exceeded', user._id, {
        resourceType,
        requestedAmount: amount,
        currentUsage: user.currentUsage[resourceType],
        limit: user.resourceAllocation[resourceType]
      });

      return createForbiddenResponse(res, `Insufficient ${resourceType} capacity`);
    }

    next();
  };
};

// Middleware to check project ownership
const requireProjectAccess = (requiredRole = 'viewer') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return createUnauthorizedResponse(res);
      }

      const projectId = req.params.projectId || req.params.id;
      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
          code: 'MISSING_PROJECT_ID'
        });
      }

      const Project = require('../models/Project');
      const project = await Project.findById(projectId);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        });
      }

      // Platform admins can access any project
      if (req.user.role === 'admin') {
        logger.info('Platform admin accessing project', {
          adminId: req.user._id,
          projectId,
          projectOwner: project.owner.toString()
        });
        req.project = project;
        return next();
      }

      // Check if user has access to this project
      if (!project.hasAccess(req.user._id, requiredRole)) {
        logAuthEvent('Unauthorized project access', req.user._id, {
          projectId,
          requiredRole,
          projectOwner: project.owner.toString()
        });

        return createForbiddenResponse(res, 'Insufficient project permissions');
      }

      req.project = project;
      next();
    } catch (error) {
      logger.error('Project access middleware error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Project access check failed',
        code: 'PROJECT_ACCESS_ERROR'
      });
    }
  };
};

module.exports = {
  requireAuth,
  optionalAuth,
  requireActiveSubscription,
  requireResourceCapacity,
  requireProjectAccess,

  // Utility functions for custom middleware
  extractTokenFromRequest,
  verifyJWTToken,
  verifyApiKey,
  createUnauthorizedResponse,
  createForbiddenResponse,
  logAuthEvent
};
