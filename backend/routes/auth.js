const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Plan = require('../models/Plan');
const payoneerService = require('../services/payoneer');
const { assignUserToServer } = require('../services/containerOrchestrator');
const logger = require('../utils/logger');

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
    process.env.JWT_SECRET || 'your-secret-key',
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
    return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  } catch (error) {
    throw error;
  }
};

const createUserFromGitHubProfile = async (profile) => {
  try {
    const defaultPlan = await Plan.findTrialPlan();

    const newUser = new User({
      githubId: profile.id,
      username: profile.username,
      email: profile.emails?.[0]?.value || `${profile.username}@github.local`,
      displayName: profile.displayName || profile.username,
      avatar: profile.photos?.[0]?.value || '',
      profileUrl: profile.profileUrl || '',
      plan: defaultPlan?._id || null,
      planType: 'free',
      status: 'trial',
      subscriptionStatus: 'trial',
      isTrialActive: true,
      trialStarted: new Date(),
      trialExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Set resource allocation based on trial plan
    if (defaultPlan) {
      newUser.resourceAllocation = { ...defaultPlan.resources };
    }

    return await newUser.save();
  } catch (error) {
    logger.error('Failed to create user from GitHub profile:', error.message);
    throw error;
  }
};

const updateExistingUser = async (user, profile) => {
  try {
    user.username = profile.username;
    user.displayName = profile.displayName || profile.username;
    user.avatar = profile.photos?.[0]?.value || '';
    user.profileUrl = profile.profileUrl || '';
    user.lastLogin = new Date();
    user.loginCount += 1;

    return await user.save();
  } catch (error) {
    logger.error('Failed to update existing user:', error.message);
    throw error;
  }
};

const createPayoneerCustomerForUser = async (user) => {
  try {
    const payoneerResult = await payoneerService.createCustomer({
      userId: user._id,
      email: user.email,
      displayName: user.displayName,
      username: user.username,
      country: 'PK', // Default to Pakistan, can be changed later
      currency: 'USD'
    });

    if (payoneerResult.success) {
      user.payoneerCustomerId = payoneerResult.customerId;
      await user.save();

      logger.billing('Payoneer customer created for new user', {
        userId: user._id,
        payoneerCustomerId: payoneerResult.customerId
      });
    }
  } catch (error) {
    logger.error('Failed to create Payoneer customer for new user:', error.message);
    // Don't fail user creation if Payoneer fails
  }
};

const handleGitHubAuthentication = async (accessToken, refreshToken, profile, done, req) => {
  try {
    // Check if user already exists
    let user = await User.findByGithubId(profile.id);

    if (user) {
      // Update existing user data
      user = await updateExistingUser(user, profile);

      // Track login IP
      const ipAddress = req.ip || req.connection.remoteAddress;
      const ipRestrictions = require('../services/ipRestrictions');
      await ipRestrictions.trackIP(user._id, ipAddress, 'login');

      logger.security('User logged in', {
        userId: user._id,
        username: user.username,
        loginCount: user.loginCount,
        ip: ipAddress
      });

      return done(null, user);
    }

    // Get IP address
    const ipAddress = req.ip || req.connection.remoteAddress;
    const email = profile.emails?.[0]?.value || `${profile.username}@github.local`;

    // Check email restrictions (not IP - users can create accounts)
    const ipRestrictions = require('../services/ipRestrictions');
    const signupCheck = await ipRestrictions.canSignup(email, ipAddress);

    if (!signupCheck.allowed) {
      logger.warn('Signup blocked - Email restriction', {
        email,
        ip: ipAddress,
        reason: signupCheck.reason
      });
      return done(new Error(signupCheck.reason), null);
    }

    // Check capacity before creating new user
    const resourceMonitoring = require('../services/resourceMonitoring');
    const capacityCheck = await resourceMonitoring.canSignupForPlan('free');

    if (!capacityCheck.allowed) {
      logger.warn('Signup blocked - capacity reached', {
        reason: capacityCheck.reason
      });
      return done(new Error(capacityCheck.reason), null);
    }

    // Create new user
    user = await createUserFromGitHubProfile(profile);

    // Set signup IP
    user.signupIP = ipAddress;
    user.ipHistory = [{
      ip: ipAddress,
      timestamp: new Date(),
      action: 'signup'
    }];
    await user.save();

    // Assign new user to EC2 (shared server) by default
    try {
      const containerAssignment = await assignUserToServer(user._id, 'free-trial');

      logger.info('New user assigned to EC2 (shared server)', {
        userId: user._id,
        serverId: containerAssignment.serverId,
        serverName: containerAssignment.serverName,
        containerType: containerAssignment.containerType,
        resources: containerAssignment.resources
      });
    } catch (containerError) {
      logger.error('Failed to assign user to EC2:', containerError.message);
      // Don't fail user creation if container assignment fails
    }

    // Create Payoneer customer
    await createPayoneerCustomerForUser(user);

    logger.security('New user registered', {
      userId: user._id,
      username: user.username,
      email: user.email,
      plan: user.plan ? 'Trial Plan' : 'No plan'
    });

    return done(null, user);
  } catch (error) {
    logger.error('GitHub OAuth error:', error.message);
    return done(error, null);
  }
};

// GitHub OAuth Strategy configured in config/passport.js

// Google OAuth handler
const handleGoogleAuthentication = async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists by Google ID
    let user = await User.findOne({ googleId: profile.id });

    if (user) {
      // Update existing user
      user.displayName = profile.displayName || user.displayName;
      user.avatar = profile.photos?.[0]?.value || user.avatar;
      user.lastLogin = new Date();
      user.loginCount += 1;
      await user.save();

      logger.security('User logged in via Google', {
        userId: user._id,
        email: user.email,
        loginCount: user.loginCount
      });

      return done(null, user);
    }

    // Check if user exists with same email (link accounts)
    user = await User.findOne({ email: profile.emails?.[0]?.value });

    if (user) {
      // Link Google account to existing user
      user.googleId = profile.id;
      user.avatar = profile.photos?.[0]?.value || user.avatar;
      user.lastLogin = new Date();
      user.loginCount += 1;
      await user.save();

      logger.security('Google account linked to existing user', {
        userId: user._id,
        email: user.email
      });

      return done(null, user);
    }

    // Create new user
    const defaultPlan = await Plan.findTrialPlan();

    user = new User({
      googleId: profile.id,
      email: profile.emails?.[0]?.value || `${profile.id}@google.local`,
      username: profile.emails?.[0]?.value?.split('@')[0] || `user_${profile.id}`,
      displayName: profile.displayName || profile.name?.givenName || 'User',
      avatar: profile.photos?.[0]?.value || '',
      plan: defaultPlan?._id || null,
      planType: 'free',
      status: 'trial',
      subscriptionStatus: 'trial',
      isTrialActive: true,
      trialStarted: new Date(),
      trialExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    if (defaultPlan) {
      user.resourceAllocation = { ...defaultPlan.resources };
    }

    await user.save();

    // Assign to container server
    try {
      const containerAssignment = await assignUserToServer(user._id, 'free-trial');
      logger.info('New Google user assigned to server', {
        userId: user._id,
        serverId: containerAssignment.serverId
      });
    } catch (error) {
      logger.error('Failed to assign Google user to server:', error.message);
    }

    // Create Payoneer customer
    await createPayoneerCustomerForUser(user);

    logger.security('New user registered via Google', {
      userId: user._id,
      email: user.email
    });

    return done(null, user);
  } catch (error) {
    logger.error('Google OAuth error:', error.message);
    return done(error, null);
  }
};

// Google OAuth Strategy configured in config/passport.js

// Serialize/deserialize configured in config/passport.js

// Route handlers
const handleGitHubOAuthStart = passport.authenticate('github', {
  scope: ['user:email', 'repo']
});

const handleGitHubCallback = async (req, res) => {
  try {
    // Generate JWT token
    const token = generateToken(req.user);

    // Set JWT as HTTP-only cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Log successful authentication
    logger.security('User authenticated successfully', {
      userId: req.user._id,
      username: req.user.username,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Redirect to dashboard or admin panel based on role
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const targetPath = req.user.role === 'admin' ? '/admin' : '/dashboard';
    res.redirect(`${frontendURL}${targetPath}`);
  } catch (error) {
    logger.error('Authentication callback error:', error.message);
    res.redirect('/login?error=callback_failed');
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
        status: user.status,
        subscriptionStatus: user.subscriptionStatus,
        plan: user.plan,
        trialDaysRemaining: user.trialDaysRemaining,
        isTrialActive: user.isTrialActive,

        // Resources: Hide usage if not allowed
        resourceAllocation: user.resourceAllocation, // Limits stay visible usually
        currentUsage: showResources ? user.currentUsage : null,
        currentResourceUsage: showResources ? user.currentResourceUsage : null,
        resourceUsagePercentage: showResources ? user.resourceUsagePercentage : null,
        displayedResources: user.displayedResources || user.resourceAllocation, // Always show limits

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
router.get('/github', handleGitHubOAuthStart);

router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/login?error=auth_failed' }),
  handleGitHubCallback
);

// Google OAuth
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' }),
  handleGitHubCallback // Reuse same callback handler
);

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

      // Still return token even if container assignment fails
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
        plan: user.plan?.name || 'free'
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
