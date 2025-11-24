const logger = require('../utils/logger');

// Helper functions
const createForbiddenResponse = (res, message = 'Admin access required') => {
  return res.status(403).json({
    success: false,
    error: message,
    code: 'ADMIN_REQUIRED'
  });
};

const createUnauthorizedResponse = (res, message = 'Authentication required') => {
  return res.status(401).json({
    success: false,
    error: message,
    code: 'UNAUTHORIZED'
  });
};

const logAdminEvent = (eventType, adminId, details = {}) => {
  logger.admin(`Admin: ${eventType}`, {
    adminId,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Check if user has admin role
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return createUnauthorizedResponse(res, 'Authentication required for admin access');
  }

  if (req.user.role !== 'admin') {
    logAdminEvent('Unauthorized admin access attempt', req.user._id, {
      userRole: req.user.role,
      requestPath: req.path,
      method: req.method,
      ip: req.ip
    });
    
    return createForbiddenResponse(res, 'Admin role required');
  }

  logAdminEvent('Admin access granted', req.user._id, {
    requestPath: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  next();
};

// Check if user is super admin (for critical operations)
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return createUnauthorizedResponse(res, 'Authentication required for super admin access');
  }

  // Super admin check can be based on specific user IDs or additional role
  const superAdminIds = (process.env.SUPER_ADMIN_IDS || '').split(',').filter(Boolean);
  const isSuper = req.user.role === 'admin' && superAdminIds.includes(req.user._id.toString());

  if (!isSuper) {
    logAdminEvent('Unauthorized super admin access attempt', req.user._id, {
      userRole: req.user.role,
      requestPath: req.path,
      method: req.method,
      ip: req.ip
    });
    
    return createForbiddenResponse(res, 'Super admin access required');
  }

  logAdminEvent('Super admin access granted', req.user._id, {
    requestPath: req.path,
    method: req.method,
    ip: req.ip
  });

  next();
};

// Log admin actions for audit trail
const logAdminAction = (action) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the admin action
      logAdminEvent(`Action: ${action}`, req.user?._id, {
        action,
        requestPath: req.path,
        method: req.method,
        params: req.params,
        body: req.method !== 'GET' ? req.body : undefined,
        query: req.query,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        responseStatus: res.statusCode,
        success: res.statusCode < 400
      });
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Check specific admin permissions
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return createUnauthorizedResponse(res);
    }

    if (req.user.role !== 'admin') {
      return createForbiddenResponse(res, 'Admin role required');
    }

    // For now, all admins have all permissions
    // In the future, this could check specific permissions
    const adminPermissions = {
      'user.read': true,
      'user.write': true,
      'user.delete': true,
      'plan.read': true,
      'plan.write': true,
      'plan.delete': true,
      'server.read': true,
      'server.write': true,
      'billing.read': true,
      'billing.write': true,
      'analytics.read': true,
      'system.manage': true
    };

    if (!adminPermissions[permission]) {
      logAdminEvent('Insufficient admin permission', req.user._id, {
        requiredPermission: permission,
        requestPath: req.path,
        method: req.method
      });
      
      return createForbiddenResponse(res, `Permission '${permission}' required`);
    }

    next();
  };
};

// Rate limiting for admin actions
const createAdminRateLimit = (maxRequests = 100, windowMs = 60 * 1000) => {
  const adminRequests = new Map();
  
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return next(); // Let other middleware handle auth
    }
    
    const adminId = req.user._id.toString();
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get or create admin request log
    if (!adminRequests.has(adminId)) {
      adminRequests.set(adminId, []);
    }
    
    const requests = adminRequests.get(adminId);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    adminRequests.set(adminId, validRequests);
    
    // Check if admin has exceeded limit
    if (validRequests.length >= maxRequests) {
      logAdminEvent('Admin rate limit exceeded', adminId, {
        requestCount: validRequests.length,
        maxRequests,
        windowMs,
        requestPath: req.path
      });
      
      return res.status(429).json({
        success: false,
        error: 'Admin rate limit exceeded',
        code: 'ADMIN_RATE_LIMITED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    // Add current request
    validRequests.push(now);
    adminRequests.set(adminId, validRequests);
    
    next();
  };
};

// Validate dangerous operations
const requireConfirmation = (req, res, next) => {
  const dangerousPaths = [
    '/api/admin/users/delete',
    '/api/admin/plans/delete',
    '/api/admin/system/reset',
    '/api/admin/billing/refund'
  ];
  
  const isDangerous = dangerousPaths.some(path => req.path.includes(path.split('/').pop()));
  
  if (isDangerous && !req.body.confirmation) {
    logAdminEvent('Dangerous operation without confirmation', req.user._id, {
      requestPath: req.path,
      method: req.method
    });
    
    return res.status(400).json({
      success: false,
      error: 'Confirmation required for this operation',
      code: 'CONFIRMATION_REQUIRED',
      message: 'Add "confirmation": true to request body'
    });
  }
  
  if (isDangerous) {
    logAdminEvent('Dangerous operation confirmed', req.user._id, {
      requestPath: req.path,
      method: req.method
    });
  }
  
  next();
};

// IP whitelist for admin access (optional security layer)
const requireWhitelistedIP = (req, res, next) => {
  const adminWhitelist = (process.env.ADMIN_IP_WHITELIST || '').split(',').filter(Boolean);
  
  if (adminWhitelist.length === 0) {
    return next(); // No whitelist configured
  }
  
  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (!adminWhitelist.includes(clientIP)) {
    logAdminEvent('Admin access from non-whitelisted IP', req.user?._id, {
      clientIP,
      requestPath: req.path,
      method: req.method
    });
    
    return createForbiddenResponse(res, 'IP address not whitelisted for admin access');
  }
  
  next();
};

// Business hours restriction (optional)
const requireBusinessHours = (req, res, next) => {
  if (process.env.ADMIN_BUSINESS_HOURS !== 'true') {
    return next(); // Business hours restriction disabled
  }
  
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Business hours: Monday-Friday, 9 AM - 6 PM
  const isBusinessDay = day >= 1 && day <= 5;
  const isBusinessHour = hour >= 9 && hour < 18;
  
  if (!isBusinessDay || !isBusinessHour) {
    // Allow super admins to bypass business hours
    const superAdminIds = (process.env.SUPER_ADMIN_IDS || '').split(',').filter(Boolean);
    const isSuper = req.user?.role === 'admin' && superAdminIds.includes(req.user._id.toString());
    
    if (!isSuper) {
      logAdminEvent('Admin access outside business hours', req.user?._id, {
        currentTime: now.toISOString(),
        day,
        hour,
        requestPath: req.path
      });
      
      return createForbiddenResponse(res, 'Admin access restricted to business hours (Monday-Friday, 9 AM - 6 PM)');
    }
  }
  
  next();
};

module.exports = {
  requireAdmin,
  requireSuperAdmin,
  requirePermission,
  requireConfirmation,
  requireWhitelistedIP,
  requireBusinessHours,
  logAdminAction,
  createAdminRateLimit,
  
  // Utility functions
  createForbiddenResponse,
  createUnauthorizedResponse,
  logAdminEvent
};
