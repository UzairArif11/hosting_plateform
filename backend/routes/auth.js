const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Plan = require('../models/Plan');
const { assignUserToServer } = require('../services/containerOrchestrator');
const logger = require('../utils/logger');
const notify = require('../services/notificationService');

// Strict rate limiter for OAuth endpoints (prevent redirect spam)
const oauthLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 attempts per minute per IP
  message: { error: 'Too many login attempts. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

// Helper functions
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const extractTokenFromRequest = (req) => {
  // Try to get token from cookie first, then from Authorization header
  let token = req.cookies?.auth_token;

  if (!token && req.headers.authorization) {
    token = req.headers.authorization.replace('Bearer ', '');
  }

  return token;
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw error;
  }
};

// NOTE: GitHub and Google OAuth authentication is handled inline in config/passport.js
// (not in separate functions here) to keep the logic co-located with the strategy.



// Route handlers
const handleGitHubOAuthStart = passport.authenticate('github', {
  scope: ['user:email', 'repo']
});

const handleGitHubCallback = async (req, res) => {
  try {
    // Log callback received for debugging
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info('🔐 GITHUB OAUTH CALLBACK HANDLER');
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info('📥 Callback received:', {
      hasUser: !!req.user,
      userId: req.user?._id?.toString() || null,
      username: req.user?.username || null,
      email: req.user?.email || null,
      query: req.query,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      sessionId: req.sessionID
    });

    // Check if user exists (set by passport middleware)
    if (!req.user) {
      logger.error('GitHub OAuth callback: req.user is undefined', {
        query: req.query,
        session: req.session,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendURL}/login?error=auth_failed`);
    }

    // Block deleted/banned users from OAuth login
    if (req.user.status === 'deleted') {
      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
      logger.warn(`Deleted user ${req.user.email} attempted OAuth login`);
      return res.redirect(`${frontendURL}/login?error=${encodeURIComponent('Account has been deleted')}`);
    }
    if (req.user.status === 'banned') {
      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
      logger.warn(`Banned user ${req.user.email} attempted OAuth login`);
      return res.redirect(`${frontendURL}/login?error=${encodeURIComponent('Account has been banned')}`);
    }

    // Generate JWT token
    logger.info('🔑 Step 1: Generating JWT token...');
    const token = generateToken(req.user);
    logger.info('✅ JWT token generated', {
      tokenLength: token.length,
      tokenPreview: token.substring(0, 20) + '...'
    });

    // Set JWT as HTTP-only cookie
    // In production with HTTPS, use secure cookies with sameSite: 'none' for OAuth redirects
    const isProduction = process.env.NODE_ENV === 'production';
    const isHTTPS = process.env.FRONTEND_URL?.startsWith('https://') || isProduction;

    logger.info('🍪 Step 2: Setting authentication cookie...', {
      isProduction,
      isHTTPS,
      frontendURL: process.env.FRONTEND_URL
    });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: isHTTPS, // Must be true for HTTPS
      sameSite: isHTTPS ? 'none' : 'lax', // 'none' required for cross-site OAuth redirects over HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: isProduction ? undefined : undefined // Let browser set domain automatically
    });
    logger.info('✅ Cookie set successfully');

    // Log successful authentication
    logger.info('✅ Step 3: Authentication successful!');
    logger.security('User authenticated successfully', {
      userId: req.user._id.toString(),
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Redirect to dashboard or admin panel based on role
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const targetPath = req.user.role === 'admin' ? '/admin' : '/dashboard';
    const redirectURL = `${frontendURL}${targetPath}`;

    logger.info('🔄 Step 4: Redirecting user...', {
      redirectURL,
      role: req.user.role,
      targetPath
    });
    logger.info('═══════════════════════════════════════════════════════════');

    res.redirect(redirectURL);
  } catch (error) {
    logger.error('═══════════════════════════════════════════════════════════');
    logger.error('❌ CALLBACK HANDLER ERROR');
    logger.error('═══════════════════════════════════════════════════════════');
    logger.error('Error Details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      hasUser: !!req.user,
      userId: req.user?._id?.toString() || null,
      stack: error.stack
    });

    if (error.errors) {
      logger.error('Validation Errors:', error.errors);
    }

    logger.error('═══════════════════════════════════════════════════════════');

    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendURL}/login?error=callback_failed`);
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    // Verify JWT token
    const decoded = verifyToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId)
      .populate('plan')
      .select('-apiKeys'); // Don't expose API keys

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if trial has expired
    if (user.isTrialActive && new Date() > user.trialExpiry) {
      user.isTrialActive = false;
      if (user.subscriptionStatus === 'trial') {
        user.subscriptionStatus = 'expired';
        user.status = 'suspended';
      }
      await user.save();
    }

    // Conditional resource hiding
    const showResources = user.showResourceStats || user.role === 'admin';

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        role: user.role,
        githubId: user.githubId || null,
        githubConnected: !!user.githubAccessToken,
        googleId: user.googleId || null,
        provider: user.provider || null,
        status: user.status,
        subscriptionStatus: user.subscriptionStatus,
        plan: user.plan ? {
          _id: user.plan._id,
          name: user.plan.name,
          displayName: user.plan.displayName,
          features: user.plan.features,
          resources: user.plan.resources,
          pricing: user.plan.pricing || {},
          limits: user.plan.limits || {}
        } : null,
        trialDaysRemaining: user.trialDaysRemaining,
        isTrialActive: user.isTrialActive,

        // Resources: Hide usage if not allowed
        resourceAllocation: user.resourceAllocation, // Limits stay visible usually
        currentUsage: showResources ? user.currentUsage : null,
        currentResourceUsage: showResources ? user.currentResourceUsage : null,
        resourceUsagePercentage: showResources ? user.resourceUsagePercentage : null,
        displayedResources: user.displayedResources || user.resourceAllocation, // Always show limits

        // Subscription lifecycle
        planExpiresAt: user.planExpiresAt || null,
        billingPeriod: user.billingPeriod || 1,
        gracePeriodEndsAt: user.gracePeriodEndsAt || null,

        // Plan downgrade/deletion scheduling
        scheduledDowngradeTo: user.scheduledDowngradeTo || null,
        scheduledDowngradeAt: user.scheduledDowngradeAt || null,
        scheduledDeletionAt: user.scheduledDeletionAt || null,

        createdAt: user.createdAt
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Authentication token expired' });
    }

    logger.error('Get current user error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const handleLogout = (req, res) => {
  try {
    // Clear authentication cookie
    res.clearCookie('auth_token');

    // If using sessions
    if (req.session) {
      req.session.destroy();
    }

    logger.security('User logged out', {
      userId: req.user?._id,
      username: req.user?.username
    });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error.message);
    res.status(500).json({ error: 'Failed to logout' });
  }
};

const generateApiKey = async (req, res) => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'API key name is required' });
    }

    // Generate new API key
    const apiKey = user.generateApiKey();

    // Add to user's API keys
    user.apiKeys.push({
      name: name.trim(),
      key: apiKey,
      lastUsed: null
    });

    await user.save();

    logger.security('API key generated', {
      userId: user._id,
      keyName: name,
      keyPreview: apiKey.substring(0, 10) + '...'
    });

    res.json({
      success: true,
      apiKey: {
        name: name.trim(),
        key: apiKey,
        createdAt: new Date()
      }
    });
  } catch (error) {
    logger.error('Generate API key error:', error.message);
    res.status(500).json({ error: 'Failed to generate API key' });
  }
};

const revokeApiKey = async (req, res) => {
  try {
    const token = extractTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const { keyId } = req.params;

    // Remove API key
    const initialLength = user.apiKeys.length;
    user.apiKeys = user.apiKeys.filter(key => key._id.toString() !== keyId);

    if (user.apiKeys.length === initialLength) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await user.save();

    logger.security('API key revoked', {
      userId: user._id,
      keyId: keyId
    });

    res.json({ success: true, message: 'API key revoked successfully' });
  } catch (error) {
    logger.error('Revoke API key error:', error.message);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
};

const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    // Verify current token (even if expired, we can refresh)
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        // Token is expired, decode without verification to get user info
        decoded = jwt.decode(token);
      } else {
        throw error;
      }
    }

    // Get fresh user data
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Generate new token
    const newToken = generateToken(user);

    // Set new cookie
    res.cookie('auth_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      token: newToken
    });
  } catch (error) {
    logger.error('Token refresh error:', error.message);
    res.status(401).json({ error: 'Failed to refresh token' });
  }
};

// Routes

// GitHub OAuth
router.get('/github', oauthLimiter, handleGitHubOAuthStart);

router.get('/github/callback', (req, res, next) => {
  passport.authenticate('github', { session: false }, (err, user, info) => {
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    if (err) {
      logger.error('🔴 GitHub OAuth error:', {
        error: err.message,
        stack: err.stack?.substring(0, 500),
        query: req.query,
        info: info
      });
      return res.redirect(`${frontendURL}/login?error=${encodeURIComponent(err.message || 'auth_failed')}`);
    }

    if (!user) {
      logger.error('🔴 GitHub OAuth: No user returned', {
        info: info,
        query: req.query
      });
      return res.redirect(`${frontendURL}/login?error=no_user_returned`);
    }

    // Attach user to request and proceed to callback handler
    req.user = user;
    handleGitHubCallback(req, res);
  })(req, res, next);
});

// Google OAuth
router.get('/google', oauthLimiter, passport.authenticate('google', {
  scope: ['profile', 'email']
}));

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user, info) => {
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    if (err) {
      logger.error('🔴 Google OAuth error:', {
        error: err.message,
        stack: err.stack?.substring(0, 500),
        query: req.query,
        info: info
      });
      return res.redirect(`${frontendURL}/login?error=${encodeURIComponent(err.message || 'auth_failed')}`);
    }

    if (!user) {
      logger.error('🔴 Google OAuth: No user returned', {
        info: info,
        query: req.query
      });
      return res.redirect(`${frontendURL}/login?error=no_user_returned`);
    }

    // Attach user to request and proceed to callback handler
    req.user = user;
    handleGitHubCallback(req, res); // Reuse same callback handler
  })(req, res, next);
});

// Direct registration route for testing
const handleDirectRegistration = async (req, res) => {
  try {
    const { email, password, plan = 'free' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.status === 'deleted') {
        return res.status(400).json({ error: 'This email belongs to a deleted account. Ask an admin to permanently delete it before re-registering.' });
      }
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create new user
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      password: hashedPassword,
      plan,
      planType: plan || 'free',
      createdAt: new Date()
    });

    await user.save();

    // Generate token
    const token = generateToken(user);

    // Set cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Assign user to container server
    try {
      const containerAssignment = await assignUserToServer(user._id, plan);

      logger.info('User assigned to container server', {
        userId: user._id,
        email: user.email,
        plan,
        serverId: containerAssignment.serverId,
        containerType: containerAssignment.containerType
      });

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          email: user.email,
          plan: user.plan
        },
        containerAssignment
      });
    } catch (containerError) {
      logger.error('Failed to assign user to container server:', containerError.message);

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          email: user.email,
          plan: user.plan
        },
        warning: 'Container assignment pending'
      });
    }

    try {
      await notify.welcomeUser(user);
      await notify.newUserSignup(user);
    } catch (notifyErr) {
      logger.warn('Welcome notification failed (non-fatal):', notifyErr.message);
    }

  } catch (error) {
    logger.error('Direct registration error:', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
};

// Login handler
const handleLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ email }).populate('plan');

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Block deleted and banned users at login
    if (user.status === 'deleted') {
      return res.status(403).json({ error: 'This account has been deleted. Contact support if you believe this is a mistake.' });
    }
    if (user.status === 'banned') {
      return res.status(403).json({ error: 'This account has been banned.' });
    }

    // Generate token
    const token = generateToken(user);

    // Set cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role, // Added for frontend redirection
        plan: user.plan ? {
          _id: user.plan._id,
          name: user.plan.name,
          displayName: user.plan.displayName,
          features: user.plan.features,
          resources: user.plan.resources,
          pricing: user.plan.pricing || {},
          limits: user.plan.limits || {}
        } : null,
      }
    });

  } catch (error) {
    logger.error('Login error:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
};

router.post('/login', handleLogin);
router.get('/me', getCurrentUser);
router.post('/logout', handleLogout);
router.post('/register', handleDirectRegistration);
router.post('/api-key', generateApiKey);
router.delete('/api-key/:keyId', revokeApiKey);
router.post('/refresh', refreshToken);

module.exports = router;
