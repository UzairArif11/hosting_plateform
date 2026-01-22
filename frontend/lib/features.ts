/**
 * Feature Management Utilities
 * 
 * Centralized utilities for checking feature access and configuration
 * based on user's plan features.
 */

import { useSelector } from 'react-redux';
import { useMemo } from 'react';
import { RootState } from '@/lib/store';

/** System feature keys (must match admin plans SYSTEM_FEATURES) */
export const SYSTEM_FEATURE_KEYS = [
    'templates',
    'rollback',
    'teamCollaboration',
    'analytics',
    'customDomains',
    'environments',
    'ssl',
    'ddos',
    'prioritySupport',
    'sso',
    'auditLogs',
    'sla',
] as const;

/** Human-readable labels for feature keys */
export const FEATURE_LABELS: Record<string, string> = {
    templates: 'Deployment Templates',
    rollback: 'Rollbacks',
    teamCollaboration: 'Team Collaboration',
    analytics: 'Analytics',
    customDomains: 'Custom Domains',
    environments: 'Environments',
    ssl: 'SSL Certificates',
    ddos: 'DDoS Protection',
    prioritySupport: 'Priority Support',
    sso: 'SSO',
    auditLogs: 'Audit Logs',
    sla: 'SLA Guarantee',
};

/**
 * React hook to check if current user has access to a specific feature
 * @param key - Feature key (e.g., 'templates', 'analytics')
 * @returns true if feature is enabled, false otherwise
 * 
 * @example
 * const hasTemplates = useHasFeature('templates');
 */
export const useHasFeature = (key: string): boolean => {
    const { user } = useSelector((state: RootState) => state.auth);
    return checkFeatureAccess(user, key);
};

/**
 * @deprecated Use useHasFeature() hook instead. This function violates React hooks rules.
 * Kept for backward compatibility but will be removed in future versions.
 */
export const hasFeature = (key: string): boolean => {
    // This is a legacy function that shouldn't be used in components
    // Use useHasFeature() hook or checkFeatureAccess() pure function instead
    console.warn('⚠️ hasFeature() is deprecated. Use useHasFeature() hook or checkFeatureAccess() instead.');
    const { user } = useSelector((state: RootState) => state.auth);
    return checkFeatureAccess(user, key);
};

/**
 * Get configuration for a specific feature
 * @param user - User object (from Redux state)
 * @param key - Feature key
 * @returns Feature configuration object or empty object
 */
export const getFeatureConfigForUser = (user: any, key: string): Record<string, any> => {
    if (!user?.plan?.features) return {};
    
    const feature = user.plan.features.find((f: any) => {
        if (typeof f === 'string') return f === key;
        return f.name === key;
    });
    
    return feature?.config || {};
};

/**
 * React hook to get configuration for a specific feature
 * @param key - Feature key
 * @returns Feature configuration object or empty object
 */
export const getFeatureConfig = (key: string): Record<string, any> => {
    const { user } = useSelector((state: RootState) => state.auth);
    return getFeatureConfigForUser(user, key);
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
 * Get feature display name for a user
 * @param user - User object (from Redux state)
 * @param key - Feature key
 * @returns Display name or key if not found
 */
export const getFeatureDisplayNameForUser = (user: any, key: string): string => {
    if (!user?.plan?.features) return key;
    
    const feature = user.plan.features.find((f: any) => {
        if (typeof f === 'string') return f === key;
        return f.name === key;
    });
    
    if (typeof feature === 'string') return key;
    return feature?.displayName || feature?.name || key;
};

/**
 * React hook to get feature display name
 * @param key - Feature key
 * @returns Display name or key if not found
 */
export const getFeatureDisplayName = (key: string): string => {
    const { user } = useSelector((state: RootState) => state.auth);
    return getFeatureDisplayNameForUser(user, key);
};

/**
 * React hook for feature access
 * @param key - Feature key
 * @returns Object with enabled status and config
 */
export const useFeature = (key: string) => {
    const { user } = useSelector((state: RootState) => state.auth);
    const enabled = checkFeatureAccess(user, key);
    const config = getFeatureConfigForUser(user, key);
    const displayName = getFeatureDisplayNameForUser(user, key);
    
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

/**
 * Hook: get status of all system features for current user
 * @returns Array of { key, label, enabled }
 */
export const useFeaturesStatus = (): { key: string; label: string; enabled: boolean }[] => {
    const { user } = useSelector((state: RootState) => state.auth);
    
    // Use useMemo to prevent creating new array on every render
    return useMemo(() => {
        return SYSTEM_FEATURE_KEYS.map((key) => ({
            key,
            label: FEATURE_LABELS[key] || key,
            enabled: user ? checkFeatureAccess(user, key) : false,
        }));
    }, [user]);
};
