const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Helper functions
const createValidationErrorResponse = (res, errors) => {
  return res.status(400).json({
    success: false,
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }))
  });
};

const logValidationError = (req, errors) => {
  logger.error('Validation error', {
    path: req.path,
    method: req.method,
    errors: errors.array(),
    body: req.body,
    query: req.query,
    params: req.params,
    userId: req.user?._id
  });
};

// Main validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    logValidationError(req, errors);
    return createValidationErrorResponse(res, errors);
  }
  
  next();
};

// Common validation rules
const commonValidations = {
  // MongoDB ObjectId validation
  mongoId: param('id').isMongoId().withMessage('Invalid ID format'),
  
  // Email validation
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email address is required'),
  
  // Password validation (for future use)
  password: body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  
  // Project name validation
  projectName: body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Project name must be 1-100 characters')
    .matches(/^[a-zA-Z0-9\s\-_\.]+$/)
    .withMessage('Project name can only contain letters, numbers, spaces, hyphens, underscores, and dots'),
  
  // Repository URL validation
  repositoryUrl: body('repositoryUrl')
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Valid repository URL is required')
    .custom((value) => {
      if (!value.includes('github.com') && !value.includes('gitlab.com')) {
        throw new Error('Repository must be from GitHub or GitLab');
      }
      return true;
    }),
  
  // Environment variable validation
  envKey: body('key')
    .trim()
    .matches(/^[A-Z_][A-Z0-9_]*$/)
    .withMessage('Environment variable key must be uppercase letters, numbers, and underscores'),
  
  envValue: body('value')
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Environment variable value cannot exceed 1000 characters'),
  
  // Domain validation
  domain: body('domain')
    .isFQDN({ require_tld: true, allow_underscores: false })
    .withMessage('Valid domain name is required')
    .custom((value) => {
      // Prevent common security issues
      const blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0'];
      if (blockedDomains.some(blocked => value.includes(blocked))) {
        throw new Error('Domain not allowed');
      }
      return true;
    }),
  
  // Plan validation
  planId: body('planId')
    .optional()
    .isMongoId()
    .withMessage('Invalid plan ID format'),
  
  // Resource allocation validation
  cpu: body('cpu')
    .isFloat({ min: 0.1, max: 10 })
    .withMessage('CPU allocation must be between 0.1 and 10 OCPU'),
  
  ram: body('ram')
    .isInt({ min: 1, max: 128 })
    .withMessage('RAM allocation must be between 1 and 128 GB'),
  
  storage: body('storage')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Storage allocation must be between 1 and 1000 GB'),
  
  // Pagination validation
  page: query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  limit: query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  // Search validation
  search: query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query cannot exceed 100 characters')
    .escape(), // Escape HTML entities for security
  
  // Framework validation
  framework: body('framework')
    .isIn([
      'nextjs', 'react', 'vue', 'nuxt', 'svelte', 'angular',
      'express', 'fastify', 'nestjs', 'koa',
      'static', 'gatsby', 'hugo', 'jekyll',
      'laravel', 'symfony', 'django', 'flask',
      'custom'
    ])
    .withMessage('Invalid framework selection')
};

// Specific validation chains for different endpoints
const validationChains = {
  // Project validations
  createProject: [
    commonValidations.projectName,
    commonValidations.repositoryUrl,
    body('branch')
      .optional()
      .trim()
      .matches(/^[a-zA-Z0-9\-_\/\.]+$/)
      .withMessage('Invalid branch name'),
    commonValidations.framework,
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic must be a boolean'),
    handleValidationErrors
  ],
  
  updateProject: [
    commonValidations.mongoId,
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Project name must be 1-100 characters'),
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic must be a boolean'),
    handleValidationErrors
  ],
  
  // Environment variable validations
  addEnvVar: [
    commonValidations.envKey,
    commonValidations.envValue,
    body('isSecret')
      .optional()
      .isBoolean()
      .withMessage('isSecret must be a boolean'),
    body('environments')
      .optional()
      .isArray()
      .withMessage('environments must be an array')
      .custom((environments) => {
        const validEnvs = ['production', 'preview', 'development'];
        if (!environments.every(env => validEnvs.includes(env))) {
          throw new Error('Invalid environment specified');
        }
        return true;
      }),
    handleValidationErrors
  ],
  
  // Domain validations
  addDomain: [
    commonValidations.domain,
    body('isPrimary')
      .optional()
      .isBoolean()
      .withMessage('isPrimary must be a boolean'),
    handleValidationErrors
  ],
  
  // Plan validations
  createPlan: [
    body('name')
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Plan name must be 1-50 characters')
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage('Plan name can only contain letters, numbers, spaces, hyphens, and underscores'),
    
    body('displayName')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Display name must be 1-100 characters'),
    
    body('description')
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Description must be 1-500 characters'),
    
    body('pricing.usd')
      .isFloat({ min: 0 })
      .withMessage('USD price must be a positive number'),
    
    body('pricing.pkr')
      .isFloat({ min: 0 })
      .withMessage('PKR price must be a positive number'),
    
    commonValidations.cpu.optional(),
    commonValidations.ram.optional(),
    commonValidations.storage.optional(),
    
    handleValidationErrors
  ],
  
  // Admin user management validations
  updateUserResources: [
    commonValidations.mongoId,
    commonValidations.cpu.optional(),
    commonValidations.ram.optional(),
    commonValidations.storage.optional(),
    body('bandwidth')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Bandwidth allocation must be between 1 and 10000 GB'),
    handleValidationErrors
  ],
  
  updateUserPlan: [
    commonValidations.mongoId,
    commonValidations.planId,
    handleValidationErrors
  ],
  
  // Payment validations
  createPaymentSession: [
    commonValidations.planId,
    body('currency')
      .isIn(['USD', 'PKR', 'EUR', 'GBP'])
      .withMessage('Invalid currency'),
    body('returnUrl')
      .isURL({ require_protocol: true })
      .withMessage('Valid return URL is required'),
    body('cancelUrl')
      .isURL({ require_protocol: true })
      .withMessage('Valid cancel URL is required'),
    handleValidationErrors
  ],
  
  // Pagination validations
  pagination: [
    commonValidations.page,
    commonValidations.limit,
    commonValidations.search,
    handleValidationErrors
  ],
  
  // API key validations
  createApiKey: [
    body('name')
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('API key name must be 1-50 characters')
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage('API key name can only contain letters, numbers, spaces, hyphens, and underscores'),
    handleValidationErrors
  ],
  
  // Webhook validations
  webhookSignature: [
    body()
      .custom((value, { req }) => {
        const signature = req.headers['x-hub-signature-256'] || req.headers['webhook-signature'] || req.headers['btcpay-sig'];
        if (!signature) {
          throw new Error('Webhook signature is required');
        }
        return true;
      }),
    handleValidationErrors
  ]
};

// Sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Recursive function to sanitize all string values
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      // Remove potentially dangerous characters
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim();
    } else if (typeof value === 'object' && value !== null) {
      const sanitized = {};
      for (const key in value) {
        sanitized[key] = sanitizeValue(value[key]);
      }
      return sanitized;
    }
    return value;
  };
  
  // Sanitize body, query, and params
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }
  
  next();
};

module.exports = {
  validationChains,
  commonValidations,
  handleValidationErrors,
  sanitizeInput,
  createValidationErrorResponse
};
