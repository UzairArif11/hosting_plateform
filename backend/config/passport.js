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
                try {
                    logger.info('🔐 GitHub OAuth callback received', {
                        githubId: profile.id,
                        username: profile.username,
                        email: profile.emails?.[0]?.value,
                        hasAccessToken: !!accessToken,
                        tokenLength: accessToken ? accessToken.length : 0
                    });

                    // Check if user already exists
                    let user = await User.findOne({ githubId: profile.id });

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
                    let email = profile.emails?.[0]?.value || `${profile.username}@github.com`;
                    let username = profile.username || `github_${profile.id}`;
                    const displayName = profile.displayName || profile.username || username;

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

                    user = await User.create({
                        githubId: profile.id,
                        email: email,
                        displayName: displayName,
                        username: username,
                        avatar: profile.photos?.[0]?.value || '',
                        githubAccessToken: accessToken,
                        provider: 'github'
                    });

                    logger.info('✅ New user created with GitHub token!', {
                        userId: user._id,
                        email: user.email,
                        hasToken: !!user.githubAccessToken,
                        tokenPreview: user.githubAccessToken ? `${user.githubAccessToken.substring(0, 10)}...` : 'none'
                    });

                    done(null, user);
                } catch (error) {
                    logger.error('❌ GitHub OAuth Error:', {
                        message: error.message,
                        stack: error.stack,
                        githubId: profile?.id,
                        username: profile?.username,
                        email: profile.emails?.[0]?.value,
                        errorName: error.name,
                        errorCode: error.code,
                        errors: error.errors ? Object.keys(error.errors) : null,
                        validationErrors: error.errors ? Object.entries(error.errors).map(([key, val]) => ({
                            field: key,
                            message: val.message,
                            value: val.value
                        })) : null
                    });
                    done(error, null);
                }
            }
        )
    );
}

module.exports = passport;
