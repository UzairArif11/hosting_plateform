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
                    // Check if user already exists
                    let user = await User.findOne({ githubId: profile.id });

                    if (user) {
                        // Update GitHub access token
                        user.githubAccessToken = accessToken;
                        await user.save();
                        return done(null, user);
                    }

                    // Create new user
                    user = await User.create({
                        githubId: profile.id,
                        email: profile.emails?.[0]?.value || `${profile.username}@github.com`,
                        displayName: profile.displayName || profile.username,
                        username: profile.username,
                        avatar: profile.photos?.[0]?.value,
                        githubAccessToken: accessToken,
                    });

                    done(null, user);
                } catch (error) {
                    done(error, null);
                }
            }
        )
    );
}

module.exports = passport;
