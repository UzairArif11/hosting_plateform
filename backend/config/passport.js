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
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    // Check if user already exists
                    let user = await User.findOne({ googleId: profile.id });

                    if (user) {
                        return done(null, user);
                    }

                    // Create new user
                    let username = profile.displayName.toLowerCase().replace(/\s+/g, '');
                    // Ensure username is unique (simple check, ideally should be more robust)
                    const existingUsername = await User.findOne({ username });
                    if (existingUsername) {
                        username = `${username}${Math.floor(Math.random() * 1000)}`;
                    }

                    user = await User.create({
                        googleId: profile.id,
                        email: profile.emails[0].value,
                        displayName: profile.displayName,
                        username: username,
                        avatar: profile.photos[0]?.value,
                    });

                    done(null, user);
                } catch (error) {
                    console.error('❌ Google OAuth User Creation Error:');
                    console.error('Error:', error.message);
                    if (error.errors) {
                        Object.keys(error.errors).forEach(key => {
                            console.error(`  - ${key}:`, error.errors[key].message);
                        });
                    }
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
            },
            async (accessToken, refreshToken, profile, done) => {
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
                        await user.save();

                        logger.info('✅ GitHub token updated successfully!', {
                            userId: user._id,
                            email: user.email,
                            hasToken: !!user.githubAccessToken,
                            tokenPreview: user.githubAccessToken ? `${user.githubAccessToken.substring(0, 10)}...` : 'none'
                        });

                        return done(null, user);
                    }

                    // Create new user
                    // Ensure all required fields are present
                    email = profile.emails?.[0]?.value || `${profile.username}@github.com`;
                    username = profile.username || `github_${profile.id}`;
                    displayName = profile.displayName || profile.username || username;

                    // Check if username or email already exists and make them unique
                    let usernameExists = await User.findOne({ username });
                    let emailExists = await User.findOne({ email });
                    
                    if (usernameExists) {
                        username = `${username}_${profile.id}`;
                        logger.info(`Username already exists, using: ${username}`);
                    }
                    
                    if (emailExists) {
                        email = `github_${profile.id}@github.com`;
                        logger.info(`Email already exists, using: ${email}`);
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
