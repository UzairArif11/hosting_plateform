/**
 * Feature Check Utilities
 * 
 * Centralized utilities for checking plan feature access on the backend.
 * Handles both string and object feature formats for backward compatibility.
 */

const logger = require('./logger');

/**
 * Check if user's plan has a feature enabled
 * @param {Object} plan - User's plan object (must be populated)
 * @param {string} featureName - Feature name to check (e.g., 'templates', 'analytics')
 * @returns {boolean} - True if feature is enabled, false otherwise
 */
function hasFeature(plan, featureName) {
    // Safety check: plan must exist
    if (!plan) {
        logger.warn(`⚠️ hasFeature('${featureName}') - No plan provided`);
        return false;
    }
    
    // Safety check: features must be an array
    if (!plan.features || !Array.isArray(plan.features)) {
        logger.warn(`⚠️ hasFeature('${featureName}') - No features array in plan`, {
            planName: plan.name,
            hasFeatures: !!plan.features
        });
        return false;
    }
    
    // Find feature in plan (handles both string and object formats)
    const feature = plan.features.find(f => {
        // Legacy format: feature is a string
        if (typeof f === 'string') {
            return f === featureName;
        }
        // Modern format: feature is an object with name property
        return f.name === featureName;
    });
    
    // If feature not found, return false
    if (!feature) {
        return false;
    }
    
    // If feature is a string (legacy format), it's always enabled
    if (typeof feature === 'string') {
        return true;
    }
    
    // If feature is an object, check enabled property
    // Default to enabled (true) if not specified (enabled !== false)
    return feature.enabled !== false;
}

/**
 * Middleware to require a specific feature
 * Populates user plan and checks feature access
 * 
 * @param {string} featureName - Feature name to require
 * @returns {Function} Express middleware
 */
function requireFeature(featureName) {
    return async (req, res, next) => {
        try {
            // Ensure user is authenticated (should be set by requireAuth middleware)
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }
            
            // Populate user plan if not already populated
            const User = require('../models/User');
            const fullUser = await User.findById(req.user._id).populate('plan');
            
            if (!fullUser) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }
            
            if (!fullUser.plan) {
                return res.status(403).json({
                    success: false,
                    error: 'Plan information unavailable',
                    upgradeRequired: true
                });
            }
            
            // Check feature access
            if (!hasFeature(fullUser.plan, featureName)) {
                return res.status(403).json({
                    success: false,
                    error: `${featureName} is not available in your current plan`,
                    upgradeRequired: true
                });
            }
            
            // Attach populated user to request for downstream use
            req.user = fullUser;
            next();
        } catch (error) {
            logger.error('Feature check middleware error:', error);
            res.status(500).json({
                success: false,
                error: 'Feature check failed'
            });
        }
    };
}

/**
 * Helper function to check feature in route handlers
 * Use this when you need to check features manually (not as middleware)
 * 
 * @param {Object} user - User object (plan should be populated)
 * @param {string} featureName - Feature name to check
 * @returns {Object} - { hasAccess: boolean, error?: string }
 */
function checkFeatureAccess(user, featureName) {
    if (!user) {
        return {
            hasAccess: false,
            error: 'User not found'
        };
    }
    
    if (!user.plan) {
        return {
            hasAccess: false,
            error: 'Plan information unavailable'
        };
    }
    
    const access = hasFeature(user.plan, featureName);
    
    return {
        hasAccess: access,
        error: access ? null : `${featureName} is not available in your current plan`
    };
}

module.exports = {
    hasFeature,
    requireFeature,
    checkFeatureAccess
};
