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
    CloudArrowUpIcon,
    BanknotesIcon,
    DevicePhoneMobileIcon,
    ClockIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

interface PaymentConfig {
    payoneer: { enabled: boolean };
    jazzcashEasypaisa: { enabled: boolean };
    manualBank: {
        enabled: boolean;
        accounts: Array<{
            id: string;
            bankName: string;
            accountTitle: string;
            accountNumber: string;
            iban: string;
            currency: string;
        }>;
    };
    crypto: {
        enabled: boolean;
        wallets: Array<{
            id: string;
            coinName: string;
            network: string;
            walletAddress: string;
        }>;
    };
    currencyConfig: {
        displayCurrency: string;
        exchangeRates: { usdToPkr?: number; usdToEur?: number; usdToGbp?: number };
    };
}

export default function BillingPage() {
    const { user } = useSelector((state: RootState) => state.auth);
    const [availablePlans, setAvailablePlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);

    // Payment modal state
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<any>(null);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [paymentLoading, setPaymentLoading] = useState(false);

    // Manual payment state
    const [selectedBankAccount, setSelectedBankAccount] = useState('');
    const [senderName, setSenderName] = useState('');
    const [senderAccount, setSenderAccount] = useState('');
    const [transactionId, setTransactionId] = useState('');
    const [screenshot, setScreenshot] = useState<File | null>(null);

    // JazzCash/EasyPaisa
    const [mobileNumber, setMobileNumber] = useState('');

    // Crypto payment state
    const [selectedCryptoWallet, setSelectedCryptoWallet] = useState('');

    // Billing period selector
    const [selectedBillingPeriod, setSelectedBillingPeriod] = useState(1);

    // Manual payment history
    const [manualPayments, setManualPayments] = useState<any[]>([]);

    // Subscription days left helper
    const getDaysLeft = () => {
        if (!user?.planExpiresAt) return null;
        const now = new Date();
        const expiry = new Date(user.planExpiresAt);
        const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const getGraceDaysLeft = () => {
        if (!user?.gracePeriodEndsAt) return null;
        const now = new Date();
        const grace = new Date(user.gracePeriodEndsAt);
        const diff = Math.ceil((grace.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff > 0 ? diff : 0;
    };

    // Currency helpers
    const getCurrencySymbol = (currency: string) => {
        const symbols: Record<string, string> = { usd: '$', pkr: 'Rs ', eur: '€', gbp: '£' };
        return symbols[currency?.toLowerCase()] || '$';
    };

    const getDisplayCurrency = () => paymentConfig?.currencyConfig?.displayCurrency || 'usd';

    const formatPrice = (plan: any) => {
        const currency = getDisplayCurrency();
        const symbol = getCurrencySymbol(currency);
        const price = plan.price;
        if (typeof price === 'object') return `${symbol}${price[currency] || price.usd}`;
        return `${symbol}${price}`;
    };

    // Get the correct price for the selected billing period
    const getSelectedPeriodPrice = (plan: any, period: number) => {
        if (!plan?.billingPeriods) return { total: plan?.price || 0, monthly: plan?.price || 0, label: 'Monthly' };
        const found = plan.billingPeriods.find((p: any) => p.months === period);
        if (found) return { total: found.totalPrice, monthly: found.monthlyPrice, label: found.label, savings: found.savings || 0 };
        return { total: plan.price * period, monthly: plan.price, label: 'Monthly' };
    };

    const getConvertedAmount = (usdAmount: number, targetCurrency: string) => {
        const rates = paymentConfig?.currencyConfig?.exchangeRates || {};
        const rateMap: Record<string, number> = { pkr: rates.usdToPkr || 278, eur: rates.usdToEur || 0.92, gbp: rates.usdToGbp || 0.79, usd: 1 };
        const rate = rateMap[targetCurrency.toLowerCase()] || 1;
        return Math.round(usdAmount * rate);
    };

    useEffect(() => {
        loadBillingData();
        fetchManualPayments();
    }, []);

    const loadBillingData = async () => {
        try {
            // Fetch payment config FIRST (has display currency)
            const configRes = await api.get('/billing/payment-config');
            const config = configRes.data.paymentConfig;
            setPaymentConfig(config);

            // Then fetch plans with the correct display currency
            const currency = config?.currencyConfig?.displayCurrency || 'usd';
            const plansRes = await api.get(`/billing/plans?currency=${currency}`);
            setAvailablePlans(plansRes.data.plans || []);
        } catch (error) {
            console.error('Failed to load billing data', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchManualPayments = async () => {
        try {
            const res = await api.get('/billing/manual-payments');
            setManualPayments(res.data.payments || []);
        } catch (error) {
            console.error('Failed to fetch manual payments', error);
        }
    };

    const handleUpgrade = (plan: any) => {
        if (!paymentConfig) {
            toast.error('Payment methods are not configured. Contact admin.');
            return;
        }
        const hasAnyMethod = paymentConfig.payoneer.enabled ||
            paymentConfig.jazzcashEasypaisa.enabled ||
            paymentConfig.manualBank.enabled ||
            paymentConfig.crypto?.enabled;

        if (!hasAnyMethod) {
            toast.error('No payment methods are currently available. Contact admin.');
            return;
        }

        setSelectedPlan(plan);
        setPaymentMethod('');
        setSelectedBillingPeriod(1);
        setShowPaymentModal(true);
    };

    const handlePayoneerCheckout = async () => {
        setPaymentLoading(true);
        try {
            const res = await api.post('/billing/create-session', { planId: selectedPlan.id });
            if (res.data.success && res.data.session?.checkoutUrl) {
                window.location.href = res.data.session.checkoutUrl;
            } else {
                toast.error('Failed to create payment session');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Payment session creation failed');
        } finally {
            setPaymentLoading(false);
        }
    };

    const handleJazzCashCheckout = async () => {
        if (!mobileNumber.trim()) {
            toast.error('Please enter your JazzCash mobile number');
            return;
        }
        setPaymentLoading(true);
        try {
            const res = await api.post('/billing/create-session-jazzcash', {
                planId: selectedPlan.id,
                mobileNumber,
                billingPeriod: selectedBillingPeriod
            });
            if (res.data.success && res.data.session?.checkoutUrl) {
                window.location.href = res.data.session.checkoutUrl;
            } else {
                toast.success('Payment initiated! Complete payment on your JazzCash app.');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'JazzCash session creation failed');
        } finally {
            setPaymentLoading(false);
        }
    };

    const handleEasyPaisaCheckout = async () => {
        setPaymentLoading(true);
        try {
            const res = await api.post('/billing/create-session-easypaisa', {
                planId: selectedPlan.id,
                mobileNumber: mobileNumber || '',
                billingPeriod: selectedBillingPeriod
            });
            if (res.data.success && res.data.session?.checkoutUrl) {
                window.location.href = res.data.session.checkoutUrl;
            } else {
                toast.success('Payment initiated! Complete payment on your EasyPaisa app.');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'EasyPaisa session creation failed');
        } finally {
            setPaymentLoading(false);
        }
    };

    const handleManualPayment = async () => {
        if (!selectedBankAccount || !senderName || !screenshot) {
            toast.error('Please fill all required fields and attach screenshot');
            return;
        }
        setPaymentLoading(true);
        try {
            const formData = new FormData();
            formData.append('planId', selectedPlan.id);
            formData.append('bankAccountId', selectedBankAccount);
            formData.append('senderName', senderName);
            formData.append('senderAccount', senderAccount);
            formData.append('transactionId', transactionId);
            formData.append('billingPeriod', String(selectedBillingPeriod));
            formData.append('screenshot', screenshot);

            const res = await api.post('/billing/manual-payment', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                toast.success(res.data.message || 'Payment submitted! Admin will verify shortly.');
                setShowPaymentModal(false);
                resetForm();
                fetchManualPayments();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to submit payment');
        } finally {
            setPaymentLoading(false);
        }
    };

    const handleCryptoPayment = async () => {
        if (!selectedCryptoWallet || !screenshot) {
            toast.error('Please select a wallet and attach payment screenshot');
            return;
        }
        setPaymentLoading(true);
        try {
            const formData = new FormData();
            formData.append('planId', selectedPlan.id);
            formData.append('cryptoWalletId', selectedCryptoWallet);
            formData.append('senderName', senderName || 'Crypto Payment');
            formData.append('transactionId', transactionId);
            formData.append('paymentType', 'crypto');
            formData.append('billingPeriod', String(selectedBillingPeriod));
            formData.append('screenshot', screenshot);

            const res = await api.post('/billing/manual-payment', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                toast.success(res.data.message || 'Crypto payment submitted! Admin will verify shortly.');
                setShowPaymentModal(false);
                resetForm();
                fetchManualPayments();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to submit crypto payment');
        } finally {
            setPaymentLoading(false);
        }
    };

    const resetForm = () => {
        setSelectedBankAccount('');
        setSelectedCryptoWallet('');
        setSenderName('');
        setSenderAccount('');
        setTransactionId('');
        setScreenshot(null);
        setMobileNumber('');
        setPaymentMethod('');
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded-full text-xs font-medium">⏳ Pending Verification</span>;
            case 'verified': return <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full text-xs font-medium">✅ Verified & Upgraded</span>;
            case 'rejected': return <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded-full text-xs font-medium">❌ Rejected</span>;
            default: return null;
        }
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
                        <div className="flex items-center space-x-2 mb-2 flex-wrap gap-2">
                            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                                {user?.subscriptionStatus === 'trial' ? 'Free Trial' : user?.subscriptionStatus === 'past_due' ? '⚠️ Grace Period' : 'Active Subscription'}
                            </span>
                            {getDaysLeft() !== null && user?.subscriptionStatus !== 'trial' && (
                                <span className={`px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm ${
                                    (getDaysLeft() || 0) <= 0 ? 'bg-red-500/30 text-red-200' :
                                    (getDaysLeft() || 0) <= 10 ? 'bg-yellow-500/30 text-yellow-200' :
                                    'bg-green-500/30 text-green-200'
                                }`}>
                                    {(getDaysLeft() || 0) <= 0 ? '❌ Expired' : `⏰ ${getDaysLeft()} days left`}
                                </span>
                            )}
                            {user?.billingPeriod && user.billingPeriod > 1 && (
                                <span className="bg-blue-500/20 px-3 py-1 rounded-full text-xs font-bold text-blue-200">
                                    {user.billingPeriod === 3 ? 'Quarterly' : user.billingPeriod === 6 ? 'Semi-Annual' : user.billingPeriod === 12 ? 'Annual' : `${user.billingPeriod}mo`}
                                </span>
                            )}
                        </div>
                        {user?.subscriptionStatus === 'past_due' && getGraceDaysLeft() !== null && (
                            <div className="bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-2 mb-3">
                                <p className="text-sm text-red-200">⚠️ Your subscription has expired. <strong>{getGraceDaysLeft()} days left</strong> in grace period. Renew now to avoid suspension.</p>
                            </div>
                        )}
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
                            <ServerIcon className="h-4 w-4" /> Your Plan Limits
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
                                        <span className="text-4xl font-bold text-white">{formatPrice(plan)}</span>
                                        <span className="text-gray-400">/month</span>
                                    </div>

                                    <div className="flex-1">
                                        <ul className="space-y-3 mb-6">
                                            {plan.features && plan.features.length > 0 ? (
                                                plan.features
                                                    .filter((feature: any) => {
                                                        if (typeof feature === 'string') return true;
                                                        return feature.enabled !== false;
                                                    })
                                                    .map((feature: any, index: number) => (
                                                        <li key={index} className="flex items-start space-x-2">
                                                            <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                                                            <span className="text-gray-300 text-sm">
                                                                {typeof feature === 'string'
                                                                    ? feature
                                                                    : feature.displayName || feature.name || feature.description || feature.text || JSON.stringify(feature)}
                                                            </span>
                                                        </li>
                                                    ))
                                            ) : (
                                                <>
                                                    <li className="flex items-start space-x-2">
                                                        <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                                                        <span className="text-gray-300 text-sm">{displayResources.ram} GB RAM</span>
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
                                        onClick={() => handleUpgrade(plan)}
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

            {/* Payment Methods - Dynamic based on admin config */}
            {paymentConfig && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Available Payment Methods</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {paymentConfig.payoneer.enabled && (
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center hover:border-purple-500 transition">
                                <CreditCardIcon className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                                <p className="text-white text-sm font-medium">Payoneer</p>
                                <p className="text-gray-500 text-xs">Automatic</p>
                            </div>
                        )}
                        {paymentConfig.jazzcashEasypaisa.enabled && (
                            <>
                                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center hover:border-purple-500 transition">
                                    <DevicePhoneMobileIcon className="h-8 w-8 text-red-400 mx-auto mb-2" />
                                    <p className="text-white text-sm font-medium">JazzCash</p>
                                    <p className="text-gray-500 text-xs">Automatic</p>
                                </div>
                                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center hover:border-purple-500 transition">
                                    <DevicePhoneMobileIcon className="h-8 w-8 text-green-400 mx-auto mb-2" />
                                    <p className="text-white text-sm font-medium">EasyPaisa</p>
                                    <p className="text-gray-500 text-xs">Automatic</p>
                                </div>
                            </>
                        )}
                        {paymentConfig.manualBank.enabled && (
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center hover:border-purple-500 transition">
                                <BanknotesIcon className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
                                <p className="text-white text-sm font-medium">Bank Transfer</p>
                                <p className="text-gray-500 text-xs">Manual Verification</p>
                            </div>
                        )}
                        {paymentConfig.crypto?.enabled && (
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center hover:border-purple-500 transition">
                                <span className="text-3xl block mb-1">🪙</span>
                                <p className="text-white text-sm font-medium">Crypto</p>
                                <p className="text-gray-500 text-xs">Manual Verification</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Manual Payment History */}
            {manualPayments.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Payment History</h3>
                    <div className="space-y-3">
                        {manualPayments.map((payment: any) => (
                            <div key={payment._id} className="flex items-center justify-between bg-gray-800 p-4 rounded-lg">
                                <div>
                                    <p className="text-white font-medium">{payment.planName}</p>
                                    <p className="text-sm text-gray-400">
                                        {payment.currency === 'PKR' ? '₨' : '$'}{payment.amount} — {new Date(payment.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                {statusBadge(payment.status)}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Payment Method Selection Modal */}
            {showPaymentModal && selectedPlan && paymentConfig && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-xl w-full space-y-5 my-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white">Upgrade to {selectedPlan.displayName}</h2>
                                {(() => {
                                    const pp = getSelectedPeriodPrice(selectedPlan, selectedBillingPeriod);
                                    const sym = getCurrencySymbol(getDisplayCurrency());
                                    return (
                                        <p className="text-gray-400 text-sm">
                                            {selectedBillingPeriod > 1
                                                ? <>{sym}{pp.total} total ({pp.label} — {sym}{pp.monthly}/mo)</>
                                                : <>{sym}{pp.total}/month</>
                                            }
                                        </p>
                                    );
                                })()}
                            </div>
                            <button onClick={() => { setShowPaymentModal(false); resetForm(); }} className="text-gray-400 hover:text-white">
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Billing Period Selector */}
                        {selectedPlan.billingPeriods && selectedPlan.billingPeriods.length > 1 && (
                            <div className="space-y-2">
                                <p className="text-gray-300 text-sm font-medium">Select billing period:</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {selectedPlan.billingPeriods.map((period: any) => (
                                        <button
                                            key={period.months}
                                            onClick={() => setSelectedBillingPeriod(period.months)}
                                            className={`relative p-3 rounded-xl border text-left transition-all ${
                                                selectedBillingPeriod === period.months
                                                    ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500'
                                                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                            }`}
                                        >
                                            {period.discountPercent > 0 && (
                                                <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                    -{period.discountPercent}%
                                                </span>
                                            )}
                                            <p className="text-white font-medium text-sm">{period.label}</p>
                                            <p className="text-purple-400 font-bold text-lg">{getCurrencySymbol(getDisplayCurrency())}{period.totalPrice}</p>
                                            {period.months > 1 && (
                                                <p className="text-gray-500 text-xs">{getCurrencySymbol(getDisplayCurrency())}{period.monthlyPrice}/mo</p>
                                            )}
                                            {period.savings > 0 && (
                                                <p className="text-green-400 text-xs font-medium">Save {getCurrencySymbol(getDisplayCurrency())}{period.savings}</p>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Payment Method Selection */}
                        {!paymentMethod && (
                            <div className="space-y-3">
                                <p className="text-gray-300 text-sm font-medium">Choose payment method:</p>

                                {paymentConfig.payoneer.enabled && (
                                    <button
                                        onClick={() => setPaymentMethod('payoneer')}
                                        className="w-full flex items-center gap-4 p-4 bg-gray-800 border border-gray-700 rounded-xl hover:border-purple-500 transition text-left"
                                    >
                                        <CreditCardIcon className="h-8 w-8 text-blue-400" />
                                        <div>
                                            <p className="text-white font-medium">Payoneer</p>
                                            <p className="text-gray-400 text-sm">Pay with card via Payoneer. Auto-upgrade.</p>
                                        </div>
                                    </button>
                                )}

                                {paymentConfig.jazzcashEasypaisa.enabled && (
                                    <>
                                        <button
                                            onClick={() => setPaymentMethod('jazzcash')}
                                            className="w-full flex items-center gap-4 p-4 bg-gray-800 border border-gray-700 rounded-xl hover:border-red-500 transition text-left"
                                        >
                                            <DevicePhoneMobileIcon className="h-8 w-8 text-red-400" />
                                            <div>
                                                <p className="text-white font-medium">JazzCash</p>
                                                <p className="text-gray-400 text-sm">Pay via JazzCash mobile wallet. Auto-upgrade.</p>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => setPaymentMethod('easypaisa')}
                                            className="w-full flex items-center gap-4 p-4 bg-gray-800 border border-gray-700 rounded-xl hover:border-green-500 transition text-left"
                                        >
                                            <DevicePhoneMobileIcon className="h-8 w-8 text-green-400" />
                                            <div>
                                                <p className="text-white font-medium">EasyPaisa</p>
                                                <p className="text-gray-400 text-sm">Pay via EasyPaisa mobile wallet. Auto-upgrade.</p>
                                            </div>
                                        </button>
                                    </>
                                )}

                                {paymentConfig.manualBank.enabled && (
                                    <button
                                        onClick={() => setPaymentMethod('manual')}
                                        className="w-full flex items-center gap-4 p-4 bg-gray-800 border border-gray-700 rounded-xl hover:border-yellow-500 transition text-left"
                                    >
                                        <BanknotesIcon className="h-8 w-8 text-yellow-400" />
                                        <div>
                                            <p className="text-white font-medium">Bank Transfer (Manual)</p>
                                            <p className="text-gray-400 text-sm">Transfer to our bank account and upload screenshot. Admin verifies.</p>
                                        </div>
                                    </button>
                                )}

                                {paymentConfig.crypto?.enabled && paymentConfig.crypto.wallets.length > 0 && (
                                    <button
                                        onClick={() => setPaymentMethod('crypto')}
                                        className="w-full flex items-center gap-4 p-4 bg-gray-800 border border-gray-700 rounded-xl hover:border-orange-500 transition text-left"
                                    >
                                        <span className="text-3xl">🪙</span>
                                        <div>
                                            <p className="text-white font-medium">Crypto Payment</p>
                                            <p className="text-gray-400 text-sm">Pay with USDT, USDC, BTC etc. Send to wallet and upload screenshot.</p>
                                        </div>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Payoneer Checkout */}
                        {paymentMethod === 'payoneer' && (
                            <div className="space-y-4">
                                <button onClick={() => setPaymentMethod('')} className="text-sm text-purple-400 hover:text-purple-300">← Back to methods</button>
                                <p className="text-gray-300 text-sm">You will be redirected to Payoneer's secure checkout to complete your payment.</p>
                                <button
                                    onClick={handlePayoneerCheckout}
                                    disabled={paymentLoading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition disabled:opacity-50"
                                >
                                    {paymentLoading ? 'Redirecting...' : `Pay ${getCurrencySymbol(getDisplayCurrency())}${getSelectedPeriodPrice(selectedPlan, selectedBillingPeriod).total} with Payoneer`}
                                </button>
                            </div>
                        )}

                        {/* JazzCash Checkout */}
                        {paymentMethod === 'jazzcash' && (
                            <div className="space-y-4">
                                <button onClick={() => setPaymentMethod('')} className="text-sm text-purple-400 hover:text-purple-300">← Back to methods</button>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">JazzCash Mobile Number *</label>
                                    <input
                                        type="tel"
                                        value={mobileNumber}
                                        onChange={(e) => setMobileNumber(e.target.value)}
                                        placeholder="03XX-XXXXXXX"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                </div>
                                <button
                                    onClick={handleJazzCashCheckout}
                                    disabled={paymentLoading}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold transition disabled:opacity-50"
                                >
                                    {paymentLoading ? 'Processing...' : 'Pay with JazzCash'}
                                </button>
                            </div>
                        )}

                        {/* EasyPaisa Checkout */}
                        {paymentMethod === 'easypaisa' && (
                            <div className="space-y-4">
                                <button onClick={() => setPaymentMethod('')} className="text-sm text-purple-400 hover:text-purple-300">← Back to methods</button>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">EasyPaisa Mobile Number (optional)</label>
                                    <input
                                        type="tel"
                                        value={mobileNumber}
                                        onChange={(e) => setMobileNumber(e.target.value)}
                                        placeholder="03XX-XXXXXXX"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>
                                <button
                                    onClick={handleEasyPaisaCheckout}
                                    disabled={paymentLoading}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold transition disabled:opacity-50"
                                >
                                    {paymentLoading ? 'Processing...' : 'Pay with EasyPaisa'}
                                </button>
                            </div>
                        )}

                        {/* Manual Bank Transfer */}
                        {paymentMethod === 'manual' && paymentConfig.manualBank.accounts.length > 0 && (
                            <div className="space-y-4">
                                <button onClick={() => setPaymentMethod('')} className="text-sm text-purple-400 hover:text-purple-300">← Back to methods</button>

                                {/* Bank Accounts to transfer to */}
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Select account to send money to: *</label>
                                    <div className="space-y-2">
                                        {paymentConfig.manualBank.accounts.map((acc) => {
                                            const accCurrency = acc.currency || 'PKR';
                                            const showConversion = accCurrency.toLowerCase() !== getDisplayCurrency();
                                            return (
                                            <label
                                                key={acc.id}
                                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${selectedBankAccount === acc.id
                                                        ? 'border-purple-500 bg-purple-500/10'
                                                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="bank"
                                                    value={acc.id}
                                                    checked={selectedBankAccount === acc.id}
                                                    onChange={(e) => setSelectedBankAccount(e.target.value)}
                                                    className="accent-purple-500"
                                                />
                                                <div className="flex-1">
                                                    <p className="text-white font-medium">{acc.bankName} <span className="text-xs text-blue-400">({accCurrency})</span></p>
                                                    <p className="text-sm text-gray-400">{acc.accountTitle} — {acc.accountNumber}</p>
                                                    {acc.iban && <p className="text-xs text-gray-500">IBAN: {acc.iban}</p>}
                                                    {showConversion && (
                                                        <p className="text-xs text-yellow-400 mt-1">
                                                            {getCurrencySymbol(getDisplayCurrency())}{getSelectedPeriodPrice(selectedPlan, selectedBillingPeriod).total} ≈ {getCurrencySymbol(accCurrency)}{getConvertedAmount(getSelectedPeriodPrice(selectedPlan, selectedBillingPeriod).total, accCurrency).toLocaleString()} {accCurrency}
                                                        </p>
                                                    )}
                                                </div>
                                            </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Your Name (Sender) *</label>
                                        <input
                                            type="text"
                                            value={senderName}
                                            onChange={(e) => setSenderName(e.target.value)}
                                            placeholder="Your full name"
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Your Account/IBAN</label>
                                        <input
                                            type="text"
                                            value={senderAccount}
                                            onChange={(e) => setSenderAccount(e.target.value)}
                                            placeholder="Your account/IBAN number"
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Transaction ID (from receipt)</label>
                                    <input
                                        type="text"
                                        value={transactionId}
                                        onChange={(e) => setTransactionId(e.target.value)}
                                        placeholder="Transaction reference number"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                {/* Screenshot Upload */}
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Payment Screenshot *</label>
                                    <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center hover:border-purple-500 transition cursor-pointer"
                                        onClick={() => document.getElementById('screenshot-input')?.click()}
                                    >
                                        <CloudArrowUpIcon className="h-10 w-10 text-gray-500 mx-auto mb-2" />
                                        {screenshot ? (
                                            <p className="text-green-400 text-sm">✅ {screenshot.name}</p>
                                        ) : (
                                            <p className="text-gray-400 text-sm">Click to upload payment screenshot (JPG, PNG, PDF — max 5MB)</p>
                                        )}
                                        <input
                                            id="screenshot-input"
                                            type="file"
                                            accept="image/*,.pdf"
                                            onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                                            className="hidden"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleManualPayment}
                                    disabled={paymentLoading}
                                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded-xl font-bold transition disabled:opacity-50"
                                >
                                    {paymentLoading ? 'Submitting...' : 'Submit Payment for Verification'}
                                </button>

                                <p className="text-xs text-gray-500 text-center">
                                    After submission, admin will verify your payment and upgrade your account. This usually takes a few hours.
                                </p>
                            </div>
                        )}

                        {/* Crypto Payment */}
                        {paymentMethod === 'crypto' && paymentConfig.crypto?.wallets && (
                            <div className="space-y-4">
                                <button onClick={() => setPaymentMethod('')} className="text-sm text-purple-400 hover:text-purple-300">← Back to methods</button>

                                {/* Wallet Selection */}
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Select wallet to send crypto to: *</label>
                                    <div className="space-y-2">
                                        {paymentConfig.crypto.wallets.map((wallet) => {
                                            const isStable = ['USDT', 'USDC'].includes(wallet.coinName);
                                            return (
                                            <label
                                                key={wallet.id}
                                                className={`block p-3 rounded-lg border cursor-pointer transition ${selectedCryptoWallet === wallet.id
                                                        ? 'border-orange-500 bg-orange-500/10'
                                                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="radio"
                                                        name="crypto"
                                                        value={wallet.id}
                                                        checked={selectedCryptoWallet === wallet.id}
                                                        onChange={(e) => setSelectedCryptoWallet(e.target.value)}
                                                        className="accent-orange-500"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-white font-medium">{wallet.coinName} <span className="text-xs text-orange-400">({wallet.network})</span></p>
                                                        <p className="text-xs text-gray-400 font-mono truncate">{wallet.walletAddress}</p>
                                                        {isStable && (
                                                            <p className="text-xs text-green-400 mt-1">
                                                                Send exactly <strong>${getSelectedPeriodPrice(selectedPlan, selectedBillingPeriod).total} {wallet.coinName}</strong>
                                                            </p>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(wallet.walletAddress); toast.success('Wallet address copied!'); }}
                                                        className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded transition flex-shrink-0"
                                                    >
                                                        Copy
                                                    </button>
                                                </div>
                                            </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Amount Info + QR Code */}
                                {selectedCryptoWallet && (() => {
                                    const wallet = paymentConfig.crypto.wallets.find((w: any) => w.id === selectedCryptoWallet);
                                    return wallet ? (
                                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 space-y-3">
                                        <p className="text-orange-300 text-sm font-medium text-center">💰 Amount to send: <strong>${getSelectedPeriodPrice(selectedPlan, selectedBillingPeriod).total} USD</strong>{selectedBillingPeriod > 1 && <span className="text-xs"> ({getSelectedPeriodPrice(selectedPlan, selectedBillingPeriod).label})</span>}</p>
                                        <p className="text-xs text-gray-400 text-center">For stablecoins (USDT/USDC), send exactly ${getSelectedPeriodPrice(selectedPlan, selectedBillingPeriod).total}. For other coins, send the equivalent USD value.</p>
                                        <div className="flex justify-center">
                                            <div className="bg-white p-3 rounded-xl">
                                                <QRCodeSVG value={wallet.walletAddress} size={160} level="H" />
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 text-center mb-1">Scan QR code or copy address below</p>
                                        <div className="flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-2">
                                            <p className="text-xs text-white font-mono flex-1 break-all">{wallet.walletAddress}</p>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(wallet.walletAddress); toast.success('Wallet address copied!'); }}
                                                className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded transition flex-shrink-0"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </div>
                                    ) : null;
                                })()}

                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Transaction Hash / TX ID *</label>
                                    <input
                                        type="text"
                                        value={transactionId}
                                        onChange={(e) => setTransactionId(e.target.value)}
                                        placeholder="e.g. 0x1234...abcd"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>

                                {/* Screenshot Upload */}
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Payment Screenshot *</label>
                                    <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center hover:border-orange-500 transition cursor-pointer"
                                        onClick={() => document.getElementById('crypto-screenshot-input')?.click()}
                                    >
                                        <CloudArrowUpIcon className="h-10 w-10 text-gray-500 mx-auto mb-2" />
                                        {screenshot ? (
                                            <p className="text-green-400 text-sm">✅ {screenshot.name}</p>
                                        ) : (
                                            <p className="text-gray-400 text-sm">Click to upload payment screenshot (JPG, PNG, PDF — max 5MB)</p>
                                        )}
                                        <input
                                            id="crypto-screenshot-input"
                                            type="file"
                                            accept="image/*,.pdf"
                                            onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                                            className="hidden"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleCryptoPayment}
                                    disabled={paymentLoading}
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-bold transition disabled:opacity-50"
                                >
                                    {paymentLoading ? 'Submitting...' : 'Submit Crypto Payment for Verification'}
                                </button>

                                <p className="text-xs text-gray-500 text-center">
                                    After submission, admin will verify your payment on blockchain and upgrade your account.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
