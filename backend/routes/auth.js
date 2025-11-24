const express = require('express');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
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

const handleGitHubAuthentication = async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists
    let user = await User.findByGithubId(profile.id);
    
    if (user) {
      // Update existing user data
      user = await updateExistingUser(user, profile);
      
      logger.security('User logged in', {
        userId: user._id,
        username: user.username,
        loginCount: user.loginCount
      });
      
      return done(null, user);
    }
    
    // Create new user
    user = await createUserFromGitHubProfile(profile);
    
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

// Configure GitHub OAuth Strategy
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: process.env.GITHUB_CALLBACK_URL || "http://localhost:5000/api/auth/github/callback"
}, handleGitHubAuthentication));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).populate('plan');
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

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
    
    // Redirect to dashboard
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendURL}/dashboard`);
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
        resourceAllocation: user.resourceAllocation,
        currentUsage: user.currentUsage,
        resourceUsagePercentage: user.resourceUsagePercentage,
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
router.get('/github', handleGitHubOAuthStart);

router.get('/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login?error=auth_failed' }),
  handleGitHubCallback
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
      createdAt: new Date()
    });
    
    await user.save();
    
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
        user: {
          id: user._id,
          email: user.email,
          plan: user.plan
        },
        containerAssignment
      });
    } catch (containerError) {
      logger.error('Failed to assign user to container server:', containerError.message);
      res.status(500).json({ 
        error: 'User created but container assignment failed',
        details: containerError.message
      });
    }
    
  } catch (error) {
    logger.error('Direct registration error:', error.message);
    res.status(500).json({ error: 'Registration failed' });
  }
};

router.get('/me', getCurrentUser);
router.post('/logout', handleLogout);
router.post('/register', handleDirectRegistration);
router.post('/api-key', generateApiKey);
router.delete('/api-key/:keyId', revokeApiKey);
router.post('/refresh', refreshToken);

module.exports = router;
