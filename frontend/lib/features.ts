/**
 * Feature Management Utilities
 * 
 * Centralized utilities for checking feature access and configuration
 * based on user's plan features.
 */

import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store';

/**
 * Check if a user has access to a specific feature
 * @param key - Feature key (e.g., 'templates', 'analytics')
 * @returns true if feature is enabled, false otherwise
 */
export const hasFeature = (key: string): boolean => {
    const { user } = useSelector((state: RootState) => state.auth);
    
    if (!user?.plan?.features) return false;
    
    return user.plan.features.some((f: any) => {
        // Handle both string and object formats
        if (typeof f === 'string') return f === key;
        // Feature is enabled by default if not specified
        return f.name === key && f.enabled !== false;
    });
};

/**
 * Get configuration for a specific feature
 * @param key - Feature key
 * @returns Feature configuration object or empty object
 */
export const getFeatureConfig = (key: string): Record<string, any> => {
    const { user } = useSelector((state: RootState) => state.auth);
    
    if (!user?.plan?.features) return {};
    
    const feature = user.plan.features.find((f: any) => {
        if (typeof f === 'string') return f === key;
        return f.name === key;
    });
    
    return feature?.config || {};
};

/**
 * Get all enabled features for the current user
 * @returns Array of enabled feature names
 */
export const getEnabledFeatures = (): string[] => {
    const { user } = useSelector((state: RootState) => state.auth);
    
    if (!user?.plan?.features) return [];
    
    return user.plan.features
        .filter((f: any) => {
            if (typeof f === 'string') return true;
            return f.enabled !== false;
        })
        .map((f: any) => {
            if (typeof f === 'string') return f;
            return f.name;
        });
};

/**
 * Get feature display name
 * @param key - Feature key
 * @returns Display name or key if not found
 */
export const getFeatureDisplayName = (key: string): string => {
    const { user } = useSelector((state: RootState) => state.auth);
    
    if (!user?.plan?.features) return key;
    
    const feature = user.plan.features.find((f: any) => {
        if (typeof f === 'string') return f === key;
        return f.name === key;
    });
    
    if (typeof feature === 'string') return key;
    return feature?.displayName || feature?.name || key;
};

/**
 * React hook for feature access
 * @param key - Feature key
 * @returns Object with enabled status and config
 */
export const useFeature = (key: string) => {
    const enabled = hasFeature(key);
    const config = getFeatureConfig(key);
    const displayName = getFeatureDisplayName(key);
    
    return {
        enabled,
        config,
        displayName,
    };
};

/**
 * Check if user can access a feature (non-hook version for use outside components)
 * @param user - User object from Redux state
 * @param key - Feature key
 * @returns true if feature is enabled
 */
export const checkFeatureAccess = (user: any, key: string): boolean => {
    if (!user?.plan?.features) return false;
    
    return user.plan.features.some((f: any) => {
        if (typeof f === 'string') return f === key;
        return f.name === key && f.enabled !== false;
    });
};
