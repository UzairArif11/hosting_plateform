'use client';

import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store';
import {
    CreditCardIcon,
    CheckIcon,
    StarIcon,
} from '@heroicons/react/24/outline';

export default function BillingPage() {
    const { user } = useSelector((state: RootState) => state.auth);

    const plans = [
        {
            name: 'Free',
            price: '$0',
            description: 'Perfect for personal projects',
            features: [
                'Shared container (10% resources)',
                '1 GB Storage',
                '10 GB Bandwidth',
                '5 Projects',
                'Community Support',
            ],
            current: user?.plan?.name === 'Free',
            popular: false,
        },
        {
            name: 'Starter',
            price: '$10',
            description: 'For growing projects',
            features: [
                'Dedicated container',
                '10 GB Storage',
                '100 GB Bandwidth',
                '20 Projects',
                'Email Support',
                'Custom Domains',
            ],
            current: user?.plan?.name === 'Starter',
            popular: false,
        },
        {
            name: 'Pro',
            price: '$25',
            description: 'For professional developers',
            features: [
                'Dedicated container (2x resources)',
                '50 GB Storage',
                '500 GB Bandwidth',
                'Unlimited Projects',
                'Priority Support',
                'Custom Domains',
                'Team Collaboration',
                'Advanced Analytics',
            ],
            current: user?.plan?.name === 'Pro',
            popular: true,
        },
        {
            name: 'Enterprise',
            price: '$99',
            description: 'For large teams',
            features: [
                'Dedicated container (4x resources)',
                '500 GB Storage',
                'Unlimited Bandwidth',
                'Unlimited Projects',
                '24/7 Support',
                'Custom Domains',
                'Team Collaboration',
                'Advanced Analytics',
                'SLA Guarantee',
                'Dedicated Account Manager',
            ],
            current: user?.plan?.name === 'Enterprise',
            popular: false,
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Billing & Plans</h1>
                <p className="text-gray-400 mt-1">Manage your subscription and billing information</p>
            </div>

            {/* Current Plan */}
            <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold mb-2">
                            {user?.plan?.name || 'Free'} Plan
                        </h2>
                        <p className="text-purple-100">Active subscription</p>
                    </div>
                    <div className="text-right">
                        <p className="text-4xl font-bold">
                            ${user?.plan?.price || 0}
                            <span className="text-lg font-normal">/mo</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Available Plans */}
            <div>
                <h2 className="text-xl font-bold text-white mb-4">Available Plans</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`relative bg-gray-900 border rounded-xl p-6 ${plan.current ? 'border-purple-500' : plan.popular ? 'border-yellow-500' : 'border-gray-800'
                                }`}
                        >
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                    <span className="bg-yellow-500 text-gray-900 px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
                                        <StarIcon className="h-3 w-3" />
                                        <span>POPULAR</span>
                                    </span>
                                </div>
                            )}

                            {plan.current && (
                                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                    <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                                        CURRENT PLAN
                                    </span>
                                </div>
                            )}

                            <div className="mb-4">
                                <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                                <p className="text-gray-400 text-sm">{plan.description}</p>
                            </div>

                            <div className="mb-6">
                                <span className="text-4xl font-bold text-white">{plan.price}</span>
                                <span className="text-gray-400">/month</span>
                            </div>

                            <ul className="space-y-3 mb-6">
                                {plan.features.map((feature, index) => (
                                    <li key={index} className="flex items-start space-x-2">
                                        <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span className="text-gray-300 text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                disabled={plan.current}
                                className={`w-full py-2 rounded-lg font-medium transition-colors ${plan.current
                                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                        : plan.popular
                                            ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900'
                                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                                    }`}
                            >
                                {plan.current ? 'Current Plan' : 'Upgrade'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Payment Methods */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Payment Methods</h3>
                <p className="text-gray-400 text-sm mb-4">
                    We support multiple payment methods including credit cards and Pakistani payment options.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                        <CreditCardIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-white text-sm">Credit Card</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                        <CreditCardIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-white text-sm">JazzCash</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                        <CreditCardIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-white text-sm">EasyPaisa</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                        <CreditCardIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-white text-sm">Bank Transfer</p>
                    </div>
                </div>
            </div>

            {/* Billing History */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Billing History</h3>
                <div className="text-center py-8">
                    <p className="text-gray-400">No billing history yet</p>
                </div>
            </div>
        </div>
    );
}
