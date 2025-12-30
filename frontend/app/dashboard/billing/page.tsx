'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store';
import api from '@/lib/api';
import {
    CreditCardIcon,
    CheckIcon,
    StarIcon,
    ServerIcon,
    CpuChipIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function BillingPage() {
    const { user } = useSelector((state: RootState) => state.auth);
    const [availablePlans, setAvailablePlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const res = await api.get('/api/billing/plans');
            setAvailablePlans(res.data.plans || []);
        } catch (error) {
            console.error('Failed to fetch plans', error);
            // Fallback or toast
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async (planId: string) => {
        toast.error('Payment integration is not configured in this demo.');
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Billing & Plans</h1>
                <p className="text-gray-400 mt-1">Manage your subscription and billing information</p>
            </div>

            {/* Current Plan & Resources Card */}
            <div className="bg-gradient-to-br from-purple-600 to-purple-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-purple-500 rounded-full blur-3xl opacity-20"></div>

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div>
                        <div className="flex items-center space-x-2 mb-2">
                            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                                {user?.subscriptionStatus === 'trial' ? 'Free Trial' : 'Active Subscription'}
                            </span>
                        </div>
                        <h2 className="text-4xl font-bold mb-2">
                            {user?.plan?.displayName || user?.plan?.name || 'Free'} Plan
                        </h2>
                        <p className="text-purple-100 mb-6 max-w-sm">
                            You are currently enjoying the features of our {user?.plan?.name} tier.
                        </p>

                        <div className="flex items-baseline space-x-2">
                            <p className="text-5xl font-bold">
                                ${user?.plan?.pricing?.usd || user?.plan?.price || 0}
                            </p>
                            <span className="text-lg opacity-80">/month</span>
                        </div>
                    </div>

                    {/* Dynamic User Resource Display */}
                    <div className="bg-black/30 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-purple-200 mb-4 flex items-center gap-2">
                            <ServerIcon className="h-4 w-4" /> Your Plan Limits (Marketing)
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-xs text-purple-300">CPU Allocation</p>
                                <p className="text-xl font-bold">{user?.displayedResources?.cpu || user?.resourceAllocation?.cpu || 0} OCPU</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-purple-300">RAM Allocation</p>
                                <p className="text-xl font-bold">{user?.displayedResources?.ram || user?.resourceAllocation?.ram || 0} GB</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-purple-300">Storage</p>
                                <p className="text-xl font-bold">{user?.displayedResources?.storage || user?.resourceAllocation?.storage || 0} GB</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-purple-300">Projects</p>
                                <p className="text-xl font-bold">{user?.displayedResources?.projects || user?.resourceAllocation?.projects || 0}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Available Plans */}
            <div>
                <h2 className="text-xl font-bold text-white mb-6">Available Plans</h2>

                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {availablePlans.map((plan) => {
                            const isCurrent = user?.plan?._id === plan.id || user?.plan === plan.id;
                            // Use resources (which are now Display resources from backend)
                            const displayResources = plan.resources || {};

                            return (
                                <div
                                    key={plan.id}
                                    className={`relative bg-gray-900 border rounded-2xl p-6 flex flex-col transition-all duration-300 ${isCurrent
                                        ? 'border-purple-500 shadow-lg shadow-purple-500/10 scale-[1.02]'
                                        : 'border-gray-800 hover:border-gray-600'
                                        }`}
                                >
                                    {plan.isDefault && (
                                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                            <span className="bg-gray-700 text-white px-3 py-1 rounded-full text-xs font-bold">
                                                Please Start Here
                                            </span>
                                        </div>
                                    )}

                                    {isCurrent && (
                                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                                            <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                                                CURRENT PLAN
                                            </span>
                                        </div>
                                    )}

                                    <div className="mb-6 mt-2">
                                        <h3 className="text-xl font-bold text-white mb-1">{plan.displayName}</h3>
                                        <p className="text-gray-400 text-sm line-clamp-2 min-h-[40px]">{plan.description}</p>
                                    </div>

                                    <div className="mb-6">
                                        <span className="text-4xl font-bold text-white">${plan.price ?? 0}</span>
                                        <span className="text-gray-400">/month</span>
                                    </div>

                                    <div className="flex-1">
                                        <ul className="space-y-3 mb-6">
                                            {/* Auto-generated features based on resources if features list is empty or generic */}
                                            {plan.features && plan.features.length > 0 ? (
                                                plan.features.map((feature: any, index: number) => (
                                                    <li key={index} className="flex items-start space-x-2">
                                                        <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                                                        <span className="text-gray-300 text-sm">
                                                            {typeof feature === 'string'
                                                                ? feature
                                                                : feature.name || feature.description || feature.text || JSON.stringify(feature)}
                                                        </span>
                                                    </li>
                                                ))
                                            ) : (
                                                <>
                                                    <li className="flex items-start space-x-2">
                                                        <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                                                        <span className="text-gray-300 text-sm">{displayResources.ram} GB RAM (Display)</span>
                                                    </li>
                                                    <li className="flex items-start space-x-2">
                                                        <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                                                        <span className="text-gray-300 text-sm">{displayResources.cpu} OCPU</span>
                                                    </li>
                                                    <li className="flex items-start space-x-2">
                                                        <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                                                        <span className="text-gray-300 text-sm">{displayResources.storage} GB Storage</span>
                                                    </li>
                                                </>
                                            )}
                                        </ul>
                                    </div>

                                    <button
                                        disabled={isCurrent}
                                        onClick={() => handleUpgrade(plan.id)}
                                        className={`w-full py-3 rounded-xl font-bold transition-all ${isCurrent
                                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                            : 'bg-white text-black hover:bg-gray-200'
                                            }`}
                                    >
                                        {isCurrent ? 'Current Plan' : 'Upgrade'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Payment Methods */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Payment Methods</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center hover:border-purple-500 transition cursor-pointer">
                        <CreditCardIcon className="h-8 w-8 text-white mx-auto mb-2" />
                        <p className="text-white text-sm">Credit Card</p>
                    </div>
                    {/* Add other dynamic methods here if needed */}
                </div>
            </div>
        </div>
    );
}
