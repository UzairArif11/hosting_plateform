'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface PlanFeature {
    name: string;
    enabled: boolean;
}

interface Plan {
    id: string;
    name: string;
    displayName: string;
    description?: string;
    price: number;
    formattedPrice?: string;
    resources: {
        cpu?: number | string;
        ram?: number | string;
        storage?: number | string;
        bandwidth?: number | string;
        deployments?: number;
        projects?: number;
    };
    features: PlanFeature[];
    billingPeriods: {
        months: number;
        discountPercent: number;
        monthlyPrice: number;
        totalPrice: number;
        savings: number;
        label: string;
    }[];
    isDefault?: boolean;
    isTrial?: boolean;
}

export default function PricingPage() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [currency, setCurrency] = useState('usd');
    const [billingPeriod, setBillingPeriod] = useState(1);
    const [loading, setLoading] = useState(true);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://foodpanda.site';

    useEffect(() => {
        fetchPlans();
    }, [currency]);

    const fetchPlans = async () => {
        try {
            const res = await fetch(`${API_URL}/api/billing/plans?currency=${currency}`);
            const data = await res.json();
            if (data.success) {
                setPlans(data.plans);
            }
        } catch (error) {
            console.error('Failed to fetch plans:', error);
        } finally {
            setLoading(false);
        }
    };

    const getPriceForPeriod = (plan: Plan) => {
        if (plan.price === 0) return { monthlyPrice: 0, totalPrice: 0, savings: 0, label: 'Free' };
        const period = plan.billingPeriods?.find(p => p.months === billingPeriod);
        if (period) return period;
        // Plan doesn't have this period enabled — fall back to monthly
        const monthly = plan.billingPeriods?.find(p => p.months === 1);
        if (monthly) return monthly;
        return { monthlyPrice: plan.price, totalPrice: plan.price, savings: 0, label: 'Monthly' };
    };

    // Build available billing periods dynamically from what plans actually have enabled
    const availablePeriods = (() => {
        if (plans.length === 0) return [{ m: 1, label: 'Monthly' }];
        const paidPlans = plans.filter(p => p.price > 0 && !p.isTrial);
        // Collect all unique periods from paid plans
        const periodMap = new Map<number, string>();
        paidPlans.forEach(plan => {
            plan.billingPeriods?.forEach(bp => {
                if (!periodMap.has(bp.months)) {
                    periodMap.set(bp.months, bp.label);
                }
            });
        });
        // Sort by months ascending
        const periods = Array.from(periodMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([m, label]) => ({ m, label }));
        return periods.length > 0 ? periods : [{ m: 1, label: 'Monthly' }];
    })();

    // Reset billing period if current selection isn't available
    useEffect(() => {
        if (availablePeriods.length > 0 && !availablePeriods.some(p => p.m === billingPeriod)) {
            setBillingPeriod(availablePeriods[0].m);
        }
    }, [plans, billingPeriod]);

    const currencySymbol = currency === 'usd' ? '$' : currency === 'pkr' ? 'Rs' : currency === 'eur' ? '\u20ac' : '\u00a3';

    const loginUrl = '/login';

    return (
        <div className="min-h-screen bg-gray-950 text-gray-300">
            {/* Header */}
            <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                            <svg width="22" height="22" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <span className="text-white font-bold text-lg">DeployHub</span>
                    </Link>
                    <div className="flex items-center gap-6">
                        <Link href="/terms" className="text-gray-400 hover:text-white text-sm transition-colors hidden sm:block">Terms</Link>
                        <Link href="/privacy" className="text-gray-400 hover:text-white text-sm transition-colors hidden sm:block">Privacy</Link>
                        <Link href={loginUrl} className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-500 rounded-lg text-white font-semibold text-sm hover:shadow-lg hover:shadow-purple-500/30 transition-all">
                            Get Started
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="pt-16 pb-8 text-center px-6">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                    Simple, Transparent <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Pricing</span>
                </h1>
                <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
                    Start free, upgrade when you need more power. No hidden fees, cancel anytime.
                </p>

                {/* Currency & Period Toggles */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                    {/* Currency */}
                    <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
                        {['usd', 'pkr', 'eur', 'gbp'].map(c => (
                            <button key={c} onClick={() => setCurrency(c)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${currency === c ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                                {c.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {/* Billing Period — only show periods that at least one paid plan supports */}
                    {availablePeriods.length > 1 && (
                        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
                            {availablePeriods.map(p => {
                                // Get max discount for this period from any paid plan
                                const maxDiscount = plans
                                    .filter(plan => plan.price > 0 && !plan.isTrial)
                                    .reduce((max, plan) => {
                                        const period = plan.billingPeriods?.find((bp: any) => bp.months === p.m);
                                        return Math.max(max, period?.discountPercent || 0);
                                    }, 0);
                                return (
                                    <button key={p.m} onClick={() => setBillingPeriod(p.m)}
                                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${billingPeriod === p.m ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                                        {p.label}
                                        {maxDiscount > 0 && <span className="ml-1 text-xs text-green-400">-{maxDiscount}%</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* Plans Grid */}
            <section className="max-w-7xl mx-auto px-6 pb-20">
                {loading ? (
                    <div className="text-center py-20">
                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading plans...</p>
                    </div>
                ) : plans.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-gray-400 text-lg mb-2">Unable to load plans right now.</p>
                        <p className="text-gray-500">Please try again later or <Link href="/login" className="text-purple-400 hover:text-purple-300">sign in</Link> to view plans.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {plans.map((plan) => {
                            const isFree = plan.price === 0 || plan.isTrial || plan.name?.toLowerCase() === 'free' || plan.name?.toLowerCase() === 'free-trial';
                            const pricing = getPriceForPeriod(plan);
                            const isPopular = plan.name?.toLowerCase() === 'pro' || plan.name?.toLowerCase() === 'starter';
                            // Free plans only support monthly — ignore the global billing period selector
                            const hasMultiplePeriods = plan.billingPeriods && plan.billingPeriods.length > 1;

                            return (
                                <div key={plan.id}
                                    className={`relative bg-gray-900/50 border rounded-2xl p-6 flex flex-col transition-all hover:scale-[1.02] hover:shadow-xl ${isPopular ? 'border-purple-500/50 shadow-lg shadow-purple-500/10' : 'border-gray-800 hover:border-gray-700'}`}>

                                    {isPopular && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-pink-500 rounded-full text-xs font-bold text-white">
                                            POPULAR
                                        </div>
                                    )}

                                    <div className="mb-4">
                                        <h3 className="text-xl font-bold text-white mb-1">{plan.displayName}</h3>
                                        {plan.description && <p className="text-sm text-gray-500">{plan.description}</p>}
                                    </div>

                                    {/* Price */}
                                    <div className="mb-6">
                                        {isFree ? (
                                            <>
                                                <div className="text-4xl font-bold text-white">Free</div>
                                                <p className="text-sm text-gray-500 mt-1">30-day trial</p>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-4xl font-bold text-white">{currencySymbol}{pricing.monthlyPrice?.toFixed(2)}</span>
                                                    <span className="text-gray-500">/mo</span>
                                                </div>
                                                {billingPeriod > 1 && hasMultiplePeriods && (
                                                    <div className="mt-1 text-sm text-gray-500">
                                                        {currencySymbol}{pricing.totalPrice?.toFixed(2)} total
                                                        {pricing.savings > 0 && (
                                                            <span className="ml-2 text-green-400 font-medium">Save {currencySymbol}{pricing.savings?.toFixed(2)}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Resources */}
                                    <div className="space-y-2 mb-6 text-sm">
                                        {plan.resources?.cpu != null && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-blue-400">CPU</span>
                                                <span className="text-gray-300"><span className="font-semibold text-white">{plan.resources.cpu}</span> OCPU</span>
                                            </div>
                                        )}
                                        {plan.resources?.ram != null && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-purple-400">RAM</span>
                                                <span className="text-gray-300"><span className="font-semibold text-white">{plan.resources.ram}</span> GB</span>
                                            </div>
                                        )}
                                        {plan.resources?.storage != null && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-green-400">Storage</span>
                                                <span className="text-gray-300"><span className="font-semibold text-white">{plan.resources.storage}</span> GB</span>
                                            </div>
                                        )}
                                        {plan.resources?.bandwidth != null && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-yellow-400">Bandwidth</span>
                                                <span className="text-gray-300"><span className="font-semibold text-white">{plan.resources.bandwidth}</span> GB</span>
                                            </div>
                                        )}
                                        {plan.resources?.projects != null && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-orange-400">Projects</span>
                                                <span className="text-gray-300"><span className="font-semibold text-white">{plan.resources.projects}</span></span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Features */}
                                    {plan.features && plan.features.length > 0 && (
                                        <div className="space-y-2 mb-6 flex-1">
                                            {plan.features.map((f, i) => (
                                                <div key={i} className="flex items-center gap-2 text-sm">
                                                    <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span className="text-gray-400">{f.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* CTA Button — redirects to login */}
                                    <Link href={isFree ? loginUrl : `${loginUrl}?plan=${plan.id}`}
                                        className={`mt-auto block text-center py-3 px-6 rounded-xl font-semibold transition-all ${isPopular
                                            ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/30'
                                            : isFree
                                                ? 'bg-gray-800 text-white hover:bg-gray-700'
                                                : 'bg-gray-800 text-white hover:bg-purple-600/20 border border-gray-700 hover:border-purple-500/50'
                                        }`}>
                                        {isFree ? 'Start Free' : 'Get Started'}
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* FAQ */}
            <section className="max-w-3xl mx-auto px-6 pb-20">
                <h2 className="text-2xl font-bold text-white text-center mb-10">Frequently Asked Questions</h2>
                <div className="space-y-4">
                    {[
                        { q: 'Can I upgrade or downgrade anytime?', a: 'Yes. Upgrade instantly and only pay the difference. Downgrades take effect at the end of your billing period.' },
                        { q: 'What payment methods do you accept?', a: 'We accept Visa, Mastercard, PayPal, cryptocurrency (BTC), JazzCash, EasyPaisa, and bank transfers.' },
                        { q: 'Is there a free trial?', a: 'Yes! Every new account starts with a 30-day free trial. No credit card required.' },
                        { q: 'What happens when my trial ends?', a: 'Your projects remain safe. You can upgrade to keep them running or they will be paused until you choose a plan.' },
                        { q: 'Can I cancel anytime?', a: 'Absolutely. Cancel anytime from your dashboard. No cancellation fees. See our refund policy for details.' },
                    ].map((faq, i) => (
                        <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                            <h3 className="text-white font-semibold mb-2">{faq.q}</h3>
                            <p className="text-gray-400 text-sm">{faq.a}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-gray-800 py-8 px-6">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-gray-500 text-sm">&copy; {new Date().getFullYear()} DeployHub. All rights reserved.</p>
                    <div className="flex gap-6 text-sm">
                        <Link href="/pricing" className="text-purple-400">Pricing</Link>
                        <Link href="/terms" className="text-gray-500 hover:text-white transition-colors">Terms</Link>
                        <Link href="/privacy" className="text-gray-500 hover:text-white transition-colors">Privacy</Link>
                        <Link href="/refund" className="text-gray-500 hover:text-white transition-colors">Refund</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
