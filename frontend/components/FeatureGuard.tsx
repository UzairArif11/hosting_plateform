'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store';
import { checkFeatureAccess } from '@/lib/features';
import toast from 'react-hot-toast';
import { LockClosedIcon, SparklesIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

interface FeatureGuardProps {
    feature: string;
    children: React.ReactNode;
    redirectTo?: string;
    showUpgradePrompt?: boolean;
}

export default function FeatureGuard({ 
    feature, 
    children, 
    redirectTo = '/dashboard/billing',
    showUpgradePrompt = true
}: FeatureGuardProps) {
    const router = useRouter();
    const { user } = useSelector((state: RootState) => state.auth);
    const [hasAccess, setHasAccess] = useState<boolean | null>(null);
    const [isChecking, setIsChecking] = useState(true);
    
    useEffect(() => {
        if (!user) {
            setIsChecking(true);
            return;
        }
        
        const access = checkFeatureAccess(user, feature);
        setHasAccess(access);
        setIsChecking(false);
        
        if (!access && showUpgradePrompt) {
            toast.error(`This feature requires an upgrade to your plan.`, {
                duration: 4000,
            });
        }
    }, [user, feature, showUpgradePrompt]);
    
    // Show loading state while checking
    if (isChecking || !user) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Checking access...</p>
                </div>
            </div>
        );
    }
    
    // Show upgrade prompt if feature is not available
    if (hasAccess === false) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LockClosedIcon className="w-8 h-8 text-purple-400" />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Feature Not Available
                    </h2>
                    
                    <p className="text-gray-400 mb-6">
                        The <span className="font-semibold text-white">{feature}</span> feature is not available in your current plan.
                    </p>
                    
                    <div className="space-y-3">
                        <Link
                            href={`${redirectTo}?upgrade=${feature}`}
                            className="block w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-purple-500/20"
                        >
                            <div className="flex items-center justify-center gap-2">
                                <SparklesIcon className="w-5 h-5" />
                                Upgrade Plan
                            </div>
                        </Link>
                        
                        <Link
                            href="/dashboard"
                            className="block w-full px-6 py-3 bg-gray-800 text-gray-300 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                        >
                            Back to Dashboard
                        </Link>
                    </div>
                    
                    <p className="text-xs text-gray-500 mt-6">
                        Need help? Contact support for assistance with plan upgrades.
                    </p>
                </div>
            </div>
        );
    }
    
    // Feature is available, render children
    return <>{children}</>;
}
