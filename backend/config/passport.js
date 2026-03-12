const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: `${process.env.API_URL || 'http://localhost:5000'}/api/auth/google/callback`,
                passReqToCallback: true,
            },
            async (req, accessToken, refreshToken, profile, done) => {
                try {
                    const Plan = require('../models/Plan');
                    const logger = require('../utils/logger');
                    const ipAddress = req?.ip || req?.connection?.remoteAddress || 'unknown';

                    // 1. Check if user already exists by Google ID
                    let user = await User.findOne({ googleId: profile.id });
                    if (user) {
                        user.lastLogin = new Date();
                        user.loginCount = (user.loginCount || 0) + 1;
                        await user.save();

                        // Track login IP
                        try {
                            const ipRestrictions = require('../services/ipRestrictions');
                            await ipRestrictions.trackIP(user._id, ipAddress, 'login');
                        } catch (ipErr) {
                            logger.warn('Google IP tracking failed (non-fatal):', ipErr.message);
                        }

                        return done(null, user);
                    }

                    // 2. Check if user exists with same email (link accounts)
                    const googleEmail = profile.emails?.[0]?.value;
                    user = await User.findOne({ email: googleEmail });
                    if (user) {
                        user.googleId = profile.id;
                        user.avatar = profile.photos?.[0]?.value || user.avatar;
                        user.lastLogin = new Date();
                        user.loginCount = (user.loginCount || 0) + 1;
                        await user.save();

                        // Track login IP
                        try {
                            const ipRestrictions = require('../services/ipRestrictions');
                            await ipRestrictions.trackIP(user._id, ipAddress, 'login');
                        } catch (ipErr) {
                            logger.warn('Google IP tracking failed (non-fatal):', ipErr.message);
                        }

                        logger.info('Google account linked to existing user', { email: user.email });
                        return done(null, user);
                    }

                    // 3. Check signup restrictions before creating new user
                    try {
                        const ipRestrictions = require('../services/ipRestrictions');
                        const signupCheck = await ipRestrictions.canSignup(googleEmail, ipAddress);
                        if (!signupCheck.allowed) {
                            logger.warn('Google signup blocked - restriction', { email: googleEmail, ip: ipAddress, reason: signupCheck.reason });
                            return done(new Error(signupCheck.reason), null);
                        }
                    } catch (restrictErr) {
                        logger.warn('Signup restriction check failed (allowing signup):', restrictErr.message);
                    }

                    // 4. Check platform capacity (two-tier: warn admin at normal overload, block at admin-set limit)
                    try {
                        const resourceMonitoring = require('../services/resourceMonitoring');
                        const capacityCheck = await resourceMonitoring.canSignupForPlan('free');
                        if (!capacityCheck.allowed) {
                            // CRITICAL overload (exceeds admin-set limit) — block signup
                            logger.error('🛑 CRITICAL: Capacity limit exceeded, blocking Google signup', {
                                reason: capacityCheck.reason,
                                usageRatio: capacityCheck.usageRatio,
                                email: googleEmail
                            });
                            return done(new Error('Server is currently at full capacity. Please try again later.'), null);
                        }
                        if (capacityCheck.severity === 'warning') {
                            // Normal overload — allow signup, alert admin
                            logger.warn('⚠️ ADMIN ALERT: Capacity warning - Google signup allowed', {
                                reason: capacityCheck.reason,
                                usageRatio: capacityCheck.usageRatio,
                                email: googleEmail,
                                action: 'Admin should review server resources'
                            });
                        }
                    } catch (capErr) {
                        logger.warn('Capacity check failed (allowing signup):', capErr.message);
                    }

                    // 5. Create new user with proper plan setup
                    let defaultPlan = await Plan.findTrialPlan();
                    if (!defaultPlan) {
                        await Plan.createDefaultPlans();
                        defaultPlan = await Plan.findTrialPlan();
                    }

                    let username = googleEmail?.split('@')[0] || profile.displayName?.toLowerCase().replace(/\s+/g, '') || `user_${profile.id}`;
                    const existingUsername = await User.findOne({ username });
                    if (existingUsername) {
                        username = `${username}${Math.floor(Math.random() * 1000)}`;
                    }

                    user = new User({
                        googleId: profile.id,
                        email: googleEmail || `${profile.id}@google.local`,
                        username: username,
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

                    try {
                        await user.save();
                    } catch (saveError) {
                        // Handle E11000 duplicate key race condition
                        if (saveError.code === 11000) {
                            logger.info('Google OAuth race condition detected, retrying lookup');
                            const existingUser = await User.findOne({
                                $or: [{ googleId: profile.id }, { email: googleEmail }]
                            });
                            if (existingUser) {
                                if (!existingUser.googleId) existingUser.googleId = profile.id;
                                existingUser.lastLogin = new Date();
                                existingUser.loginCount = (existingUser.loginCount || 0) + 1;
                                await existingUser.save();
                                return done(null, existingUser);
                            }
                            throw saveError;
                        }
                        throw saveError;
                    }

                    // Track signup IP
                    try {
                        user.signupIP = ipAddress;
                        user.ipHistory = [{ ip: ipAddress, timestamp: new Date(), action: 'signup' }];
                        await user.save();
                    } catch (ipSaveErr) {
                        logger.warn('Google IP save failed (non-fatal):', ipSaveErr.message);
                    }

                    // Assign to container server
                    try {
                        const { assignUserToServer } = require('../services/containerOrchestrator');
                        if (assignUserToServer) {
                            await assignUserToServer(user._id, 'free-trial');
                        }
                    } catch (containerErr) {
                        logger.warn('Container assignment deferred:', containerErr.message);
                    }

                    // Create Payoneer customer
                    try {
                        const payoneerService = require('../services/payoneer');
                        await payoneerService.createCustomer({
                            userId: user._id,
                            email: user.email,
                            name: user.displayName
                        });
                    } catch (payErr) {
                        logger.warn('Payoneer customer creation failed (non-fatal):', payErr.message);
                    }

                    logger.info('New Google user created', { email: user.email, userId: user._id });
                    done(null, user);
                } catch (error) {
                    console.error('❌ Google OAuth Error:', error.message);
                    done(error, null);
                }
            }
        )
    );
}

// GitHub OAuth Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    const logger = require('../utils/logger');

    passport.use(
        new GitHubStrategy(
            {
                clientID: process.env.GITHUB_CLIENT_ID,
                clientSecret: process.env.GITHUB_CLIENT_SECRET,
                callbackURL: `${process.env.API_URL || 'http://localhost:5000'}/api/auth/github/callback`,
                scope: ['user:email', 'repo'],
                passReqToCallback: true,
            },
            async (req, accessToken, refreshToken, profile, done) => {
                // Declare variables outside try block for error logging
                let username, email, displayName, defaultPlan, user;

                try {
                    logger.info('🔐 GitHub OAuth callback received', {
                        githubId: profile.id,
                        username: profile.username,
                        email: profile.emails?.[0]?.value,
                        hasAccessToken: !!accessToken,
                        tokenLength: accessToken ? accessToken.length : 0
                    });

                    // Check if user already exists
                    user = await User.findOne({ githubId: profile.id });

                    if (user) {
                        logger.info('✅ Existing user found, updating token...', {
                            userId: user._id,
                            email: user.email,
                            hadTokenBefore: !!user.githubAccessToken
                        });

                        // Update GitHub access token
                        user.githubAccessToken = accessToken;
                        user.lastLogin = new Date();
                        user.loginCount = (user.loginCount || 0) + 1;
                        await user.save();

                        // Track login IP
                        try {
                            const ipRestrictions = require('../services/ipRestrictions');
                            const ipAddress = req?.ip || req?.connection?.remoteAddress || 'unknown';
                            await ipRestrictions.trackIP(user._id, ipAddress, 'login');
                        } catch (ipErr) {
                            logger.warn('IP tracking failed (non-fatal):', ipErr.message);
                        }

                        logger.info('✅ GitHub token updated successfully!', {
                            userId: user._id,
                            email: user.email,
                            hasToken: !!user.githubAccessToken,
                            tokenPreview: user.githubAccessToken ? `${user.githubAccessToken.substring(0, 10)}...` : 'none'
                        });

                        return done(null, user);
                    }

                    // Create new user
                    // Check signup restrictions before creating
                    email = profile.emails?.[0]?.value || `${profile.username}@github.com`;
                    const ipAddress = req?.ip || req?.connection?.remoteAddress || 'unknown';

                    try {
                        const ipRestrictions = require('../services/ipRestrictions');
                        const signupCheck = await ipRestrictions.canSignup(email, ipAddress);
                        if (!signupCheck.allowed) {
                            logger.warn('GitHub signup blocked - restriction', { email, ip: ipAddress, reason: signupCheck.reason });
                            return done(new Error(signupCheck.reason), null);
                        }
                    } catch (restrictErr) {
                        logger.warn('Signup restriction check failed (allowing signup):', restrictErr.message);
                    }

                    // Check platform capacity (two-tier: warn admin at normal overload, block at admin-set limit)
                    try {
                        const resourceMonitoring = require('../services/resourceMonitoring');
                        const capacityCheck = await resourceMonitoring.canSignupForPlan('free');
                        if (!capacityCheck.allowed) {
                            // CRITICAL overload (exceeds admin-set limit) — block signup
                            logger.error('🛑 CRITICAL: Capacity limit exceeded, blocking GitHub signup', {
                                reason: capacityCheck.reason,
                                usageRatio: capacityCheck.usageRatio,
                                email: email
                            });
                            return done(new Error('Server is currently at full capacity. Please try again later.'), null);
                        }
                        if (capacityCheck.severity === 'warning') {
                            // Normal overload — allow signup, alert admin
                            logger.warn('⚠️ ADMIN ALERT: Capacity warning - GitHub signup allowed', {
                                reason: capacityCheck.reason,
                                usageRatio: capacityCheck.usageRatio,
                                email: email,
                                action: 'Admin should review server resources'
                            });
                        }
                    } catch (capErr) {
                        logger.warn('Capacity check failed (allowing signup):', capErr.message);
                    }

                    // Ensure all required fields are present
                    username = profile.username || `github_${profile.id}`;
                    displayName = profile.displayName || profile.username || username;

                    // Check if username or email already exists
                    let usernameExists = await User.findOne({ username });
                    let emailExists = await User.findOne({ email });

                    // CRITICAL: If email exists, LINK the GitHub account instead of creating duplicate
                    if (emailExists) {
                        logger.info(`🔗 Linking GitHub account to existing user with email: ${email}`, {
                            existingUserId: emailExists._id,
                            githubId: profile.id,
                            username: profile.username
                        });
                        emailExists.githubId = profile.id;
                        emailExists.githubAccessToken = accessToken;
                        emailExists.avatar = profile.photos?.[0]?.value || emailExists.avatar;
                        emailExists.lastLogin = new Date();
                        emailExists.loginCount = (emailExists.loginCount || 0) + 1;
                        await emailExists.save();
                        return done(null, emailExists);
                    }

                    if (usernameExists) {
                        username = `${username}_${profile.id}`;
                        logger.info(`Username already exists, using: ${username}`);
                    }

                    logger.info('👤 Creating new user from GitHub...', {
                        githubId: profile.id,
                        username: username,
                        email: email,
                        displayName: displayName
                    });

                    // Validate data before creating
                    if (!username || !email || !displayName) {
                        throw new Error(`Missing required fields: username=${!!username}, email=${!!email}, displayName=${!!displayName}`);
                    }

                    // Get default plan for new user (same as createUserFromGitHubProfile)
                    logger.info('📋 Step 1: Looking up default plan...');
                    const Plan = require('../models/Plan');
                    defaultPlan = await Plan.findTrialPlan();
                    logger.info('📋 Plan lookup result:', {
                        found: !!defaultPlan,
                        planId: defaultPlan?._id?.toString(),
                        planName: defaultPlan?.name,
                        hasResources: !!defaultPlan?.resources
                    });

                    // Prepare user data
                    const trialExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    const userData = {
                        githubId: profile.id,
                        username: username,
                        email: email,
                        displayName: displayName,
                        avatar: profile.photos?.[0]?.value || '',
                        profileUrl: profile.profileUrl || '',
                        githubAccessToken: accessToken,
                        provider: 'github',
                        plan: defaultPlan?._id || null,
                        planType: 'free',
                        status: 'trial',
                        subscriptionStatus: 'trial',
                        isTrialActive: true,
                        trialStarted: new Date(),
                        trialExpiry: trialExpiry
                    };

                    logger.info('📝 Step 2: Prepared user data:', {
                        ...userData,
                        githubAccessToken: userData.githubAccessToken ? `${userData.githubAccessToken.substring(0, 10)}...` : 'none',
                        plan: userData.plan ? userData.plan.toString() : null,
                        trialStarted: userData.trialStarted.toISOString(),
                        trialExpiry: userData.trialExpiry.toISOString()
                    });

                    // Create user with EXACT same fields as createUserFromGitHubProfile
                    logger.info('👤 Step 3: Creating User instance...');
                    // Ensure createdAt is set (Mongoose should do this, but being explicit)
                    if (!userData.createdAt) {
                        userData.createdAt = new Date();
                    }
                    const newUser = new User(userData);

                    // Set resource allocation based on trial plan (same as createUserFromGitHubProfile)
                    if (defaultPlan && defaultPlan.resources) {
                        logger.info('📊 Step 4: Setting resource allocation:', defaultPlan.resources);
                        newUser.resourceAllocation = { ...defaultPlan.resources };
                    } else {
                        logger.warn('⚠️  No default plan resources found, resourceAllocation will use defaults');
                    }

                    // Validate before save
                    logger.info('✅ Step 5: Validating user document before save...');
                    const validationError = newUser.validateSync();
                    if (validationError) {
                        logger.error('❌ Validation failed before save:', {
                            errors: Object.keys(validationError.errors || {}),
                            errorDetails: Object.entries(validationError.errors || {}).map(([key, val]) => ({
                                field: key,
                                message: val.message,
                                value: val.value,
                                kind: val.kind
                            }))
                        });
                        throw validationError;
                    }
                    logger.info('✅ Validation passed');

                    // Log the document that will be saved
                    logger.info('💾 Step 6: Attempting to save user to database...');
                    logger.info('📄 Document to save:', {
                        _id: newUser._id,
                        githubId: newUser.githubId,
                        username: newUser.username,
                        email: newUser.email,
                        displayName: newUser.displayName,
                        plan: newUser.plan?.toString() || null,
                        planType: newUser.planType,
                        status: newUser.status,
                        subscriptionStatus: newUser.subscriptionStatus,
                        hasResourceAllocation: !!newUser.resourceAllocation,
                        resourceAllocation: newUser.resourceAllocation
                    });

                    // Save user
                    user = await newUser.save();
                    logger.info('✅ Step 7: User saved successfully!', {
                        userId: user._id.toString(),
                        username: user.username,
                        email: user.email
                    });

                    logger.info('✅ New user created with GitHub token!', {
                        userId: user._id,
                        email: user.email,
                        hasToken: !!user.githubAccessToken,
                        tokenPreview: user.githubAccessToken ? `${user.githubAccessToken.substring(0, 10)}...` : 'none'
                    });

                    // Track signup IP
                    try {
                        user.signupIP = ipAddress;
                        user.ipHistory = [{ ip: ipAddress, timestamp: new Date(), action: 'signup' }];
                        await user.save();
                    } catch (ipSaveErr) {
                        logger.warn('IP save failed (non-fatal):', ipSaveErr.message);
                    }

                    // Assign new user to container server
                    try {
                        const { assignUserToServer } = require('../services/containerOrchestrator');
                        const containerAssignment = await assignUserToServer(user._id, 'free-trial');
                        logger.info('✅ New GitHub user assigned to server', {
                            userId: user._id,
                            serverId: containerAssignment.serverId,
                            serverName: containerAssignment.serverName
                        });
                    } catch (containerError) {
                        logger.error('Failed to assign GitHub user to server:', containerError.message);
                        // Don't fail user creation if container assignment fails
                    }

                    // Create Payoneer customer for billing
                    try {
                        const payoneerService = require('../services/payoneer');
                        await payoneerService.createCustomer({
                            userId: user._id,
                            email: user.email,
                            name: user.displayName
                        });
                    } catch (payErr) {
                        logger.warn('Payoneer customer creation failed (non-fatal):', payErr.message);
                    }

                    done(null, user);
                } catch (error) {
                    logger.error('═══════════════════════════════════════════════════════════');
                    logger.error('❌ GITHUB OAUTH ERROR - COMPREHENSIVE DEBUG INFO');
                    logger.error('═══════════════════════════════════════════════════════════');

                    // Basic error info
                    logger.error('📌 Basic Error Info:', {
                        name: error.name,
                        message: error.message,
                        code: error.code,
                        codeName: error.codeName
                    });

                    // Profile data received
                    logger.error('📋 Profile Data Received:', {
                        id: profile?.id,
                        username: profile?.username,
                        displayName: profile?.displayName,
                        emails: profile?.emails,
                        photos: profile?.photos?.length || 0,
                        profileUrl: profile?.profileUrl
                    });

                    // Processed data (only log if variables were set)
                    if (typeof username !== 'undefined' || typeof email !== 'undefined') {
                        logger.error('📝 Processed User Data:', {
                            username: username || 'NOT SET',
                            email: email || 'NOT SET',
                            displayName: displayName || 'NOT SET',
                            githubId: profile?.id
                        });
                    }

                    // Plan info (only log if plan was looked up)
                    if (typeof defaultPlan !== 'undefined') {
                        logger.error('📋 Plan Information:', {
                            hasPlan: !!defaultPlan,
                            planId: defaultPlan?._id?.toString() || null,
                            planName: defaultPlan?.name || null,
                            planResources: defaultPlan?.resources || null
                        });
                    }

                    // Mongoose Validation Errors
                    if (error.name === 'ValidationError' && error.errors) {
                        logger.error('❌ Mongoose Validation Errors:');
                        Object.entries(error.errors).forEach(([field, err]) => {
                            logger.error(`  Field: ${field}`, {
                                message: err.message,
                                value: err.value,
                                kind: err.kind,
                                path: err.path,
                                properties: err.properties
                            });
                        });
                    }

                    // MongoDB Server Errors
                    if (error.name === 'MongoServerError' || error.code === 121) {
                        logger.error('❌ MongoDB Server Error Details:');
                        logger.error('  Code:', error.code);
                        logger.error('  Code Name:', error.codeName);
                        logger.error('  Error Message:', error.errmsg || error.message);

                        // Error Info (contains validation details)
                        if (error.errorInfo) {
                            logger.error('  Error Info:', JSON.stringify(error.errorInfo, null, 2));
                        }
                        if (error.errInfo) {
                            logger.error('  Err Info:', JSON.stringify(error.errInfo, null, 2));
                        }

                        // Write Errors
                        if (error.writeErrors && error.writeErrors.length > 0) {
                            logger.error('  Write Errors:');
                            error.writeErrors.forEach((writeErr, idx) => {
                                logger.error(`    Write Error ${idx + 1}:`, {
                                    code: writeErr.code,
                                    errmsg: writeErr.errmsg,
                                    opKeys: writeErr.op ? Object.keys(writeErr.op) : null
                                });
                            });
                        }

                        // Try to get validation details from errorInfo
                        if (error.errorInfo?.details) {
                            logger.error('  Validation Details:', JSON.stringify(error.errorInfo.details, null, 2));
                        }
                    }

                    // Full error object (all properties)
                    logger.error('📦 Full Error Object Properties:');
                    try {
                        const errorProps = {};
                        Object.getOwnPropertyNames(error).forEach(prop => {
                            try {
                                const value = error[prop];
                                if (typeof value === 'object' && value !== null) {
                                    errorProps[prop] = typeof value.toString === 'function' ? value.toString() : '[Object]';
                                } else {
                                    errorProps[prop] = value;
                                }
                            } catch (e) {
                                errorProps[prop] = '[Unable to access]';
                            }
                        });
                        logger.error(JSON.stringify(errorProps, null, 2));
                    } catch (e) {
                        logger.error('  Could not serialize error properties:', e.message);
                        logger.error('  Error keys:', Object.keys(error));
                    }

                    // Stack trace
                    logger.error('📚 Stack Trace:');
                    logger.error(error.stack);

                    logger.error('═══════════════════════════════════════════════════════════');

                    done(error, null);
                }
            }
        )
    );
}

module.exports = passport;
