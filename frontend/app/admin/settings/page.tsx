'use client';

import { useState, useEffect } from 'react';
import { Cog6ToothIcon, EnvelopeIcon, CreditCardIcon, ShieldCheckIcon, BellIcon, ExclamationTriangleIcon, BanknotesIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface BankAccount {
    _id?: string;
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    iban: string;
    currency: string;
    isActive: boolean;
}

interface CryptoWallet {
    _id?: string;
    coinName: string;
    network: string;
    walletAddress: string;
    isActive: boolean;
}

export default function AdminSettingsPage() {
    const [activeTab, setActiveTab] = useState('platform');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const [platformSettings, setPlatformSettings] = useState({
        siteName: '',
        siteUrl: '',
        supportEmail: '',
        allowRegistration: true,
        maintenanceMode: false,
    });

    const [emailSettings, setEmailSettings] = useState({
        smtpHost: '',
        smtpPort: '',
        smtpUser: '',
        smtpPassword: '',
        fromEmail: '',
        fromName: '',
    });

    const [alertSettings, setAlertSettings] = useState({
        email: '',
        password: '',
        enabled: false
    });

    const [resourceLimits, setResourceLimits] = useState({
        warnThreshold: 80,
        stopThreshold: 90,
        signupCapacityLimit: 200
    });

    const [securitySettings, setSecuritySettings] = useState({
        requireEmailVerification: false,
        enable2FA: false,
        sessionTimeout: '24',
        maxLoginAttempts: '5',
        passwordMinLength: '8',
    });

    // Payment Configuration
    const [paymentConfig, setPaymentConfig] = useState({
        paddle: {
            enabled: false,
            testMode: true,
            sandboxSellerId: '',
            sandboxApiKey: '',
            sandboxClientToken: '',
            sandboxWebhookSecret: '',
            liveSellerId: '',
            liveApiKey: '',
            liveClientToken: '',
            liveWebhookSecret: '',
            processingFeePercent: 5,
            cryptoDiscountPercent: 3
        },
        btcpay: { enabled: false, serverUrl: '', apiKey: '', storeId: '', webhookSecret: '', testMode: true },
        jazzcashEasypaisa: { enabled: false },
        manualBank: {
            enabled: false,
            accounts: [] as BankAccount[]
        },
        crypto: {
            enabled: false,
            wallets: [] as CryptoWallet[]
        }
    });

    // Currency Configuration
    const [currencyConfig, setCurrencyConfig] = useState({
        displayCurrency: 'usd',
        exchangeRates: { usdToPkr: 278, usdToEur: 0.92, usdToGbp: 0.79 }
    });

    // Account Deletion Settings
    const [accountDeletion, setAccountDeletion] = useState({
        enabled: false,
        daysAfterSuspension: 30,
        warningEmailDays: 10
    });

    const [newAccount, setNewAccount] = useState<BankAccount>({
        bankName: '',
        accountTitle: '',
        accountNumber: '',
        iban: '',
        currency: 'PKR',
        isActive: true
    });

    const [newWallet, setNewWallet] = useState<CryptoWallet>({
        coinName: '',
        network: '',
        walletAddress: '',
        isActive: true
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/settings');
            const data = res.data;
            if (data) {
                if (data.alertConfig) setAlertSettings(data.alertConfig);
                if (data.resourceLimits) setResourceLimits(data.resourceLimits);
                if (data.paymentConfig) {
                    setPaymentConfig({
                        paddle: {
                            enabled: data.paymentConfig.paddle?.enabled || false,
                            testMode: data.paymentConfig.paddle?.testMode !== false,
                            sandboxSellerId: data.paymentConfig.paddle?.sandboxSellerId || '',
                            sandboxApiKey: data.paymentConfig.paddle?.sandboxApiKey || '',
                            sandboxClientToken: data.paymentConfig.paddle?.sandboxClientToken || '',
                            sandboxWebhookSecret: data.paymentConfig.paddle?.sandboxWebhookSecret || '',
                            liveSellerId: data.paymentConfig.paddle?.liveSellerId || '',
                            liveApiKey: data.paymentConfig.paddle?.liveApiKey || '',
                            liveClientToken: data.paymentConfig.paddle?.liveClientToken || '',
                            liveWebhookSecret: data.paymentConfig.paddle?.liveWebhookSecret || '',
                            processingFeePercent: data.paymentConfig.paddle?.processingFeePercent ?? 5,
                            cryptoDiscountPercent: data.paymentConfig.paddle?.cryptoDiscountPercent ?? 3
                        },
                        btcpay: {
                            enabled: data.paymentConfig.btcpay?.enabled || false,
                            serverUrl: data.paymentConfig.btcpay?.serverUrl || '',
                            apiKey: data.paymentConfig.btcpay?.apiKey || '',
                            storeId: data.paymentConfig.btcpay?.storeId || '',
                            webhookSecret: data.paymentConfig.btcpay?.webhookSecret || '',
                            testMode: data.paymentConfig.btcpay?.testMode !== false
                        },
                        jazzcashEasypaisa: { enabled: data.paymentConfig.jazzcashEasypaisa?.enabled || false },
                        manualBank: {
                            enabled: data.paymentConfig.manualBank?.enabled || false,
                            accounts: data.paymentConfig.manualBank?.accounts || []
                        },
                        crypto: {
                            enabled: data.paymentConfig.crypto?.enabled || false,
                            wallets: data.paymentConfig.crypto?.wallets || []
                        }
                    });
                }
                if (data.currencyConfig) {
                    setCurrencyConfig(data.currencyConfig);
                }
                if (data.accountDeletion) {
                    setAccountDeletion(data.accountDeletion);
                }
            }
            setLoading(false);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load settings');
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                alertConfig: alertSettings,
                resourceLimits,
                paymentConfig,
                currencyConfig,
                accountDeletion
            };

            await api.put('/settings', payload);
            toast.success('Settings saved successfully');
        } catch (error) {
            console.error(error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const addBankAccount = async () => {
        if (!newAccount.bankName || !newAccount.accountTitle || !newAccount.accountNumber) {
            toast.error('Bank name, account title, and account number are required');
            return;
        }
        const updatedConfig = {
            ...paymentConfig,
            manualBank: {
                ...paymentConfig.manualBank,
                enabled: true,
                accounts: [...paymentConfig.manualBank.accounts, { ...newAccount }]
            }
        };
        setPaymentConfig(updatedConfig);
        setNewAccount({ bankName: '', accountTitle: '', accountNumber: '', iban: '', currency: 'PKR', isActive: true });
        try {
            await api.put('/settings', { paymentConfig: updatedConfig });
            toast.success('Bank account added and saved!');
        } catch (error) {
            toast.error('Failed to save bank account');
        }
    };

    const removeBankAccount = async (index: number) => {
        const updated = [...paymentConfig.manualBank.accounts];
        updated.splice(index, 1);
        const updatedConfig = {
            ...paymentConfig,
            manualBank: { ...paymentConfig.manualBank, accounts: updated }
        };
        setPaymentConfig(updatedConfig);
        try {
            await api.put('/settings', { paymentConfig: updatedConfig });
            toast.success('Account removed!');
        } catch (error) {
            toast.error('Failed to save');
        }
    };

    const addCryptoWallet = async () => {
        if (!newWallet.coinName || !newWallet.network || !newWallet.walletAddress) {
            toast.error('Coin name, network, and wallet address are required');
            return;
        }
        const updatedConfig = {
            ...paymentConfig,
            crypto: {
                ...paymentConfig.crypto,
                enabled: true,
                wallets: [...paymentConfig.crypto.wallets, { ...newWallet }]
            }
        };
        setPaymentConfig(updatedConfig);
        setNewWallet({ coinName: '', network: '', walletAddress: '', isActive: true });
        try {
            await api.put('/settings', { paymentConfig: updatedConfig });
            toast.success('Crypto wallet added and saved!');
        } catch (error) {
            toast.error('Failed to save crypto wallet');
        }
    };

    const removeCryptoWallet = async (index: number) => {
        const updated = [...paymentConfig.crypto.wallets];
        updated.splice(index, 1);
        const updatedConfig = {
            ...paymentConfig,
            crypto: { ...paymentConfig.crypto, wallets: updated }
        };
        setPaymentConfig(updatedConfig);
        try {
            await api.put('/settings', { paymentConfig: updatedConfig });
            toast.success('Wallet removed!');
        } catch (error) {
            toast.error('Failed to save');
        }
    };

    const tabs = [
        { id: 'platform', name: 'Platform', icon: Cog6ToothIcon },
        { id: 'alerts', name: 'Alerts', icon: ExclamationTriangleIcon },
        { id: 'payments', name: 'Payment Methods', icon: BanknotesIcon },
        { id: 'email', name: 'Email (Example)', icon: EnvelopeIcon },
    ];

    if (loading) {
        return <div className="p-8 text-center text-gray-400">Loading settings...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Platform Settings</h1>
                <p className="text-gray-400 mt-2">Configure platform-wide settings</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Tabs Sidebar */}
                <div className="lg:w-64 flex-shrink-0">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === tab.id
                                    ? 'bg-purple-500/10 text-purple-500'
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                    }`}
                            >
                                <tab.icon className="h-5 w-5" />
                                <span>{tab.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Settings Content */}
                <div className="flex-1">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        {activeTab === 'alerts' && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white">Admin Alerts Configuration</h2>
                                <p className="text-sm text-gray-400">
                                    Configure email alerts for high server load (CPU {'>'} 90% for 5 mins).
                                </p>

                                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                                    <h3 className="text-purple-400 font-medium mb-2">How it works</h3>
                                    <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                                        <li>System monitors remote servers via SSH every 5 minutes.</li>
                                        <li>If CPU usage exceeds 90% repeatedly, an alert is triggered.</li>
                                        <li>You will receive an email notification if configured below.</li>
                                    </ul>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                                        <div>
                                            <p className="text-white font-medium">Enable Email Alerts</p>
                                            <p className="text-sm text-gray-400">Turn on/off email notifications</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={alertSettings.enabled}
                                                onChange={(e) => setAlertSettings({ ...alertSettings, enabled: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                        </label>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Destination Email
                                        </label>
                                        <input
                                            type="email"
                                            placeholder="admin@example.com"
                                            value={alertSettings.email}
                                            onChange={(e) => setAlertSettings({ ...alertSettings, email: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Gmail App Password (SMTP)
                                        </label>
                                        <input
                                            type="password"
                                            placeholder="xxyy zzaa bbcc ddee"
                                            value={alertSettings.password}
                                            onChange={(e) => setAlertSettings({ ...alertSettings, password: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Use a Gmail App Password. The system uses standard Gmail SMTP settings (smtp.gmail.com:587).
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'platform' && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white">Platform Resource Limits</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                        <h3 className="text-lg font-medium text-purple-400 mb-2">Warning Threshold (%)</h3>
                                        <p className="text-sm text-gray-400 mb-4">Send email warning when system usage exceeds this %.</p>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={resourceLimits.warnThreshold}
                                            onChange={(e) => setResourceLimits({ ...resourceLimits, warnThreshold: parseInt(e.target.value) })}
                                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                                        />
                                    </div>
                                    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                        <h3 className="text-lg font-medium text-red-400 mb-2">Stop Threshold (%)</h3>
                                        <p className="text-sm text-gray-400 mb-4">Stop the highest consuming process when system usage exceeds this %.</p>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={resourceLimits.stopThreshold}
                                            onChange={(e) => setResourceLimits({ ...resourceLimits, stopThreshold: parseInt(e.target.value) })}
                                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                                        />
                                    </div>
                                </div>

                                {/* Signup Capacity Limit */}
                                <div className="bg-gray-800 p-5 rounded-lg border border-yellow-600/30">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="text-2xl">👥</span>
                                        <div>
                                            <h3 className="text-lg font-medium text-yellow-400">Signup Capacity Limit (%)</h3>
                                            <p className="text-sm text-gray-400">Block new signups when total user allocations exceed this % of available resources</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="number"
                                            min="100"
                                            max="500"
                                            step="10"
                                            value={resourceLimits.signupCapacityLimit}
                                            onChange={(e) => setResourceLimits({ ...resourceLimits, signupCapacityLimit: parseInt(e.target.value) || 200 })}
                                            className="w-32 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-lg font-bold text-center"
                                        />
                                        <span className="text-gray-400 text-lg">%</span>
                                    </div>
                                    <div className="mt-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                                        <p className="text-xs text-gray-400">
                                            <strong className="text-gray-300">How it works:</strong> This is based on enrolled user plan allocations (CPU, RAM, Storage), NOT actual htop usage.
                                            Setting to <strong className="text-yellow-400">200%</strong> means allowing 2× oversubscription before blocking signups.
                                            Below this limit, signups succeed but admin gets a warning in logs.
                                        </p>
                                    </div>
                                </div>

                                {/* Currency Configuration */}
                                <div className="bg-gray-800 p-5 rounded-lg border border-blue-600/30">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="text-2xl">💱</span>
                                        <div>
                                            <h3 className="text-lg font-medium text-blue-400">Plan Display Currency</h3>
                                            <p className="text-sm text-gray-400">What currency users see on the billing page</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Display Currency</label>
                                            <select
                                                value={currencyConfig.displayCurrency}
                                                onChange={(e) => setCurrencyConfig({ ...currencyConfig, displayCurrency: e.target.value })}
                                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                            >
                                                <option value="usd">🇺🇸 USD ($)</option>
                                                <option value="pkr">🇵🇰 PKR (Rs)</option>
                                                <option value="eur">🇪🇺 EUR (€)</option>
                                                <option value="gbp">🇬🇧 GBP (£)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">USD → PKR Exchange Rate</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={currencyConfig.exchangeRates.usdToPkr}
                                                onChange={(e) => setCurrencyConfig({ ...currencyConfig, exchangeRates: { ...currencyConfig.exchangeRates, usdToPkr: parseFloat(e.target.value) || 278 } })}
                                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Plans already have fixed PKR pricing in database. Exchange rate is used for manual conversion display only.</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'payments' && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white">Payment Methods Configuration</h2>
                                <p className="text-sm text-gray-400">
                                    Toggle which payment methods are available to your users. Only enabled methods will appear on the billing page.
                                </p>

                                {/* Toggle: Paddle (Card/PayPal) */}
                                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-white font-medium text-lg">Paddle — Card / PayPal (Automatic)</p>
                                            <p className="text-sm text-gray-400">Merchant of Record. Handles taxes, chargebacks, Visa/MC/PayPal/Apple Pay. Auto-upgrade on payment.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={paymentConfig.paddle.enabled}
                                                onChange={(e) => setPaymentConfig({ ...paymentConfig, paddle: { ...paymentConfig.paddle, enabled: e.target.checked } })}
                                                className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                        </label>
                                    </div>
                                    {paymentConfig.paddle.enabled && (
                                        <div className="space-y-4 pt-2 border-t border-gray-700">
                                            {/* Test Mode Toggle */}
                                            <div className="flex items-center justify-between bg-gray-900 rounded-lg p-3">
                                                <div>
                                                    <p className="text-white font-medium text-sm">Test Mode (Sandbox)</p>
                                                    <p className="text-xs text-gray-400">ON = sandbox (fake payments), OFF = live (real charges)</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" checked={paymentConfig.paddle.testMode}
                                                        onChange={(e) => setPaymentConfig({ ...paymentConfig, paddle: { ...paymentConfig.paddle, testMode: e.target.checked } })}
                                                        className="sr-only peer" />
                                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
                                                </label>
                                            </div>

                                            {/* Sandbox Credentials */}
                                            <div className="space-y-2">
                                                <p className="text-sm font-medium text-yellow-400">Sandbox Credentials (Test Mode)</p>
                                                <p className="text-xs text-gray-500">Get these from sandbox-vendors.paddle.com &rarr; Developer Tools &rarr; Authentication</p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs text-gray-400 mb-1">Sandbox Seller ID</label>
                                                        <input type="text" value={paymentConfig.paddle.sandboxSellerId}
                                                            onChange={(e) => setPaymentConfig({ ...paymentConfig, paddle: { ...paymentConfig.paddle, sandboxSellerId: e.target.value } })}
                                                            placeholder="Seller ID" className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2 text-sm" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-400 mb-1">Sandbox API Key</label>
                                                        <input type="password" value={paymentConfig.paddle.sandboxApiKey}
                                                            onChange={(e) => setPaymentConfig({ ...paymentConfig, paddle: { ...paymentConfig.paddle, sandboxApiKey: e.target.value } })}
                                                            placeholder="pdl_sdbx_..." className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2 text-sm" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-400 mb-1">Sandbox Client Token</label>
                                                        <input type="text" value={paymentConfig.paddle.sandboxClientToken}
                                                            onChange={(e) => setPaymentConfig({ ...paymentConfig, paddle: { ...paymentConfig.paddle, sandboxClientToken: e.target.value } })}
                                                            placeholder="test_..." className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2 text-sm" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-400 mb-1">Sandbox Webhook Secret</label>
                                                        <input type="password" value={paymentConfig.paddle.sandboxWebhookSecret}
                                                            onChange={(e) => setPaymentConfig({ ...paymentConfig, paddle: { ...paymentConfig.paddle, sandboxWebhookSecret: e.target.value } })}
                                                            placeholder="pdl_ntfset_..." className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2 text-sm" />
                                                    </div>
                                                </div>
                                                {/* Sandbox validation */}
                                                <div className="flex flex-wrap gap-2 text-xs">
                                                    {paymentConfig.paddle.sandboxSellerId ? <span className="text-green-400">Seller ID set</span> : <span className="text-red-400">Seller ID missing</span>}
                                                    {paymentConfig.paddle.sandboxApiKey ? <span className="text-green-400">API Key set</span> : <span className="text-red-400">API Key missing</span>}
                                                    {paymentConfig.paddle.sandboxClientToken ? <span className="text-green-400">Client Token set</span> : <span className="text-red-400">Client Token missing</span>}
                                                    {paymentConfig.paddle.sandboxWebhookSecret ? <span className="text-green-400">Webhook Secret set</span> : <span className="text-red-400">Webhook Secret missing</span>}
                                                </div>
                                            </div>

                                            {/* Live Credentials */}
                                            <div className="space-y-2">
                                                <p className="text-sm font-medium text-red-400">Live Credentials (Production)</p>
                                                <p className="text-xs text-gray-500">Get these from vendors.paddle.com &rarr; Developer Tools &rarr; Authentication</p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs text-gray-400 mb-1">Live Seller ID</label>
                                                        <input type="text" value={paymentConfig.paddle.liveSellerId}
                                                            onChange={(e) => setPaymentConfig({ ...paymentConfig, paddle: { ...paymentConfig.paddle, liveSellerId: e.target.value } })}
                                                            placeholder="Seller ID" className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2 text-sm" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-400 mb-1">Live API Key</label>
                                                        <input type="password" value={paymentConfig.paddle.liveApiKey}
                                                            onChange={(e) => setPaymentConfig({ ...paymentConfig, paddle: { ...paymentConfig.paddle, liveApiKey: e.target.value } })}
                                                            placeholder="pdl_live_..." className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2 text-sm" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-400 mb-1">Live Client Token</label>
                                                        <input type="text" value={paymentConfig.paddle.liveClientToken}
                                                            onChange={(e) => setPaymentConfig({ ...paymentConfig, paddle: { ...paymentConfig.paddle, liveClientToken: e.target.value } })}
                                                            placeholder="live_..." className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2 text-sm" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-400 mb-1">Live Webhook Secret</label>
                                                        <input type="password" value={paymentConfig.paddle.liveWebhookSecret}
                                                            onChange={(e) => setPaymentConfig({ ...paymentConfig, paddle: { ...paymentConfig.paddle, liveWebhookSecret: e.target.value } })}
                                                            placeholder="pdl_ntfset_..." className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2 text-sm" />
                                                    </div>
                                                </div>
                                                {/* Live validation */}
                                                <div className="flex flex-wrap gap-2 text-xs">
                                                    {paymentConfig.paddle.liveSellerId ? <span className="text-green-400">Seller ID set</span> : <span className="text-gray-500">Seller ID not set</span>}
                                                    {paymentConfig.paddle.liveApiKey ? <span className="text-green-400">API Key set</span> : <span className="text-gray-500">API Key not set</span>}
                                                    {paymentConfig.paddle.liveClientToken ? <span className="text-green-400">Client Token set</span> : <span className="text-gray-500">Client Token not set</span>}
                                                    {paymentConfig.paddle.liveWebhookSecret ? <span className="text-green-400">Webhook Secret set</span> : <span className="text-gray-500">Webhook Secret not set</span>}
                                                </div>
                                            </div>

                                            {/* Fee Settings */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Processing Fee % (added to customer price)</label>
                                                    <input type="number" min="0" max="20" step="1" value={paymentConfig.paddle.processingFeePercent}
                                                        onChange={(e) => setPaymentConfig({ ...paymentConfig, paddle: { ...paymentConfig.paddle, processingFeePercent: parseInt(e.target.value) || 0 } })}
                                                        className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Crypto Discount % (discount for crypto payments)</label>
                                                    <input type="number" min="0" max="10" step="1" value={paymentConfig.paddle.cryptoDiscountPercent}
                                                        onChange={(e) => setPaymentConfig({ ...paymentConfig, paddle: { ...paymentConfig.paddle, cryptoDiscountPercent: parseInt(e.target.value) || 0 } })}
                                                        className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2 text-sm" />
                                                </div>
                                            </div>

                                            {/* Info */}
                                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
                                                <p className="font-medium mb-1">Webhook URL (set in Paddle dashboard):</p>
                                                <code className="bg-gray-900 px-2 py-1 rounded text-xs break-all">
                                                    {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/paddle
                                                </code>
                                                <p className="mt-2 text-gray-400">Configure payout frequency and minimum threshold in your Paddle dashboard (recommended: Monthly, $200+ minimum).</p>
                                                <p className="mt-1 text-gray-400">Price IDs for each plan are set in Admin &rarr; Plans.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Toggle: BTCPay Server (Crypto Automatic) */}
                                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-white font-medium text-lg">Crypto Payment - BTCPay Server (Automatic)</p>
                                            <p className="text-sm text-gray-400">Users pay with BTC/crypto via your self-hosted BTCPay Server. Blockchain verified, auto-upgrade.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={paymentConfig.btcpay.enabled}
                                                onChange={(e) => setPaymentConfig({ ...paymentConfig, btcpay: { ...paymentConfig.btcpay, enabled: e.target.checked } })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                        </label>
                                    </div>
                                    {paymentConfig.btcpay.enabled && (
                                        <div className="space-y-3 pt-2 border-t border-gray-700">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-sm text-gray-400 mb-1">BTCPay Server URL *</label>
                                                    <input type="text" value={paymentConfig.btcpay.serverUrl}
                                                        onChange={(e) => setPaymentConfig({ ...paymentConfig, btcpay: { ...paymentConfig.btcpay, serverUrl: e.target.value } })}
                                                        placeholder="https://pay.yourdomain.com" className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2.5 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-sm text-gray-400 mb-1">API Key *</label>
                                                    <input type="password" value={paymentConfig.btcpay.apiKey}
                                                        onChange={(e) => setPaymentConfig({ ...paymentConfig, btcpay: { ...paymentConfig.btcpay, apiKey: e.target.value } })}
                                                        placeholder="BTCPay API Key" className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2.5 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-sm text-gray-400 mb-1">Store ID *</label>
                                                    <input type="text" value={paymentConfig.btcpay.storeId}
                                                        onChange={(e) => setPaymentConfig({ ...paymentConfig, btcpay: { ...paymentConfig.btcpay, storeId: e.target.value } })}
                                                        placeholder="BTCPay Store ID" className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2.5 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="block text-sm text-gray-400 mb-1">Webhook Secret *</label>
                                                    <input type="password" value={paymentConfig.btcpay.webhookSecret}
                                                        onChange={(e) => setPaymentConfig({ ...paymentConfig, btcpay: { ...paymentConfig.btcpay, webhookSecret: e.target.value } })}
                                                        placeholder="BTCPay Webhook Secret" className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2.5 text-sm" />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" checked={paymentConfig.btcpay.testMode}
                                                    onChange={(e) => setPaymentConfig({ ...paymentConfig, btcpay: { ...paymentConfig.btcpay, testMode: e.target.checked } })}
                                                    className="rounded border-gray-600 bg-gray-900 text-purple-600" />
                                                <span className="text-sm text-gray-400">Test Mode (use Bitcoin Testnet — no real money)</span>
                                            </div>
                                            {paymentConfig.btcpay.testMode && (
                                                <p className="text-xs text-yellow-400">Testnet active — invoices use fake BTC. Switch off for production.</p>
                                            )}
                                            <p className="text-xs text-green-400">Webhook URL: <code className="bg-gray-900 px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/btcpay</code></p>
                                            <p className="text-xs text-gray-500">See PAYMENT-SETUP.md for BTCPay Server installation guide</p>
                                        </div>
                                    )}
                                </div>

                                {/* Toggle: JazzCash/EasyPaisa */}
                                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-white font-medium text-lg">📱 JazzCash / EasyPaisa (Automatic)</p>
                                            <p className="text-sm text-gray-400">Users pay via JazzCash or EasyPaisa mobile wallet. Plan upgrades automatically on successful payment.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={paymentConfig.jazzcashEasypaisa.enabled}
                                                onChange={(e) => setPaymentConfig({ ...paymentConfig, jazzcashEasypaisa: { enabled: e.target.checked } })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                        </label>
                                    </div>
                                    {paymentConfig.jazzcashEasypaisa.enabled && (
                                        <p className="text-xs text-green-400">✅ Active — Requires JAZZCASH & EASYPAISA env variables to be set</p>
                                    )}
                                </div>

                                {/* Toggle: Manual Bank Transfer */}
                                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-white font-medium text-lg">🏦 Manual Bank Transfer</p>
                                            <p className="text-sm text-gray-400">User sees your bank account details, sends money, uploads screenshot. You verify and upgrade manually.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={paymentConfig.manualBank.enabled}
                                                onChange={(e) => setPaymentConfig({ ...paymentConfig, manualBank: { ...paymentConfig.manualBank, enabled: e.target.checked } })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                        </label>
                                    </div>

                                    {paymentConfig.manualBank.enabled && (
                                        <div className="space-y-4 pt-2 border-t border-gray-700">
                                            <h4 className="text-white font-medium">Bank Accounts</h4>

                                            {/* Existing Accounts */}
                                            {paymentConfig.manualBank.accounts.length > 0 ? (
                                                <div className="space-y-2">
                                                    {paymentConfig.manualBank.accounts.map((acc, idx) => (
                                                        <div key={idx} className="flex items-center justify-between bg-gray-900 p-3 rounded-lg border border-gray-700">
                                                            <div>
                                                                <p className="text-white font-medium">{acc.bankName} <span className="text-xs text-blue-400 ml-1">({acc.currency || 'PKR'})</span></p>
                                                                <p className="text-sm text-gray-400">{acc.accountTitle} — {acc.accountNumber}</p>
                                                                {acc.iban && <p className="text-xs text-gray-500">IBAN: {acc.iban}</p>}
                                                            </div>
                                                            <button
                                                                onClick={() => removeBankAccount(idx)}
                                                                className="text-red-400 hover:text-red-300 p-1"
                                                            >
                                                                <TrashIcon className="h-5 w-5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-yellow-400 text-sm">⚠️ No bank accounts added yet. Add at least one account for users to see.</p>
                                            )}

                                            {/* Add New Account */}
                                            <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 space-y-3">
                                                <h5 className="text-gray-300 font-medium text-sm">Add Bank Account</h5>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <input
                                                        type="text"
                                                        placeholder="Bank Name (e.g. SadaPay, NayaPay, Meezan)"
                                                        value={newAccount.bankName}
                                                        onChange={(e) => setNewAccount({ ...newAccount, bankName: e.target.value })}
                                                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Account Title"
                                                        value={newAccount.accountTitle}
                                                        onChange={(e) => setNewAccount({ ...newAccount, accountTitle: e.target.value })}
                                                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Account Number"
                                                        value={newAccount.accountNumber}
                                                        onChange={(e) => setNewAccount({ ...newAccount, accountNumber: e.target.value })}
                                                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="IBAN (optional)"
                                                        value={newAccount.iban}
                                                        onChange={(e) => setNewAccount({ ...newAccount, iban: e.target.value })}
                                                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    />
                                                    <select
                                                        value={newAccount.currency}
                                                        onChange={(e) => setNewAccount({ ...newAccount, currency: e.target.value })}
                                                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    >
                                                        <option value="PKR">PKR (Pakistani Rupee)</option>
                                                        <option value="USD">USD (US Dollar)</option>
                                                        <option value="EUR">EUR (Euro)</option>
                                                        <option value="GBP">GBP (British Pound)</option>
                                                    </select>
                                                </div>
                                                <button
                                                    onClick={addBankAccount}
                                                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition"
                                                >
                                                    <PlusIcon className="h-4 w-4" /> Add Account
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Toggle: Crypto Payment */}
                                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-white font-medium text-lg">🪙 Crypto Payment (Manual)</p>
                                            <p className="text-sm text-gray-400">User sends crypto (USDT, USDC, BTC, etc.) to your wallet, uploads screenshot. You verify and upgrade manually.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={paymentConfig.crypto.enabled}
                                                onChange={(e) => setPaymentConfig({ ...paymentConfig, crypto: { ...paymentConfig.crypto, enabled: e.target.checked } })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                        </label>
                                    </div>

                                    {paymentConfig.crypto.enabled && (
                                        <div className="space-y-4 pt-2 border-t border-gray-700">
                                            <h4 className="text-white font-medium">Crypto Wallets</h4>

                                            {paymentConfig.crypto.wallets.length > 0 ? (
                                                <div className="space-y-2">
                                                    {paymentConfig.crypto.wallets.map((wallet, idx) => (
                                                        <div key={idx} className="flex items-center justify-between bg-gray-900 p-3 rounded-lg border border-gray-700">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-white font-medium">{wallet.coinName} <span className="text-xs text-orange-400">({wallet.network})</span></p>
                                                                <p className="text-sm text-gray-400 font-mono truncate">{wallet.walletAddress}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => removeCryptoWallet(idx)}
                                                                className="text-red-400 hover:text-red-300 p-1 ml-2 flex-shrink-0"
                                                            >
                                                                <TrashIcon className="h-5 w-5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-yellow-400 text-sm">⚠️ No wallets added yet. Add at least one wallet for users to see.</p>
                                            )}

                                            {/* Add New Wallet */}
                                            <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 space-y-3">
                                                <h5 className="text-gray-300 font-medium text-sm">Add Crypto Wallet</h5>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <select
                                                        value={newWallet.coinName}
                                                        onChange={(e) => setNewWallet({ ...newWallet, coinName: e.target.value })}
                                                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    >
                                                        <option value="">Select Coin</option>
                                                        <option value="USDT">USDT (Tether)</option>
                                                        <option value="USDC">USDC (USD Coin)</option>
                                                        <option value="BTC">BTC (Bitcoin)</option>
                                                        <option value="ETH">ETH (Ethereum)</option>
                                                        <option value="BNB">BNB (Binance Coin)</option>
                                                        <option value="TRX">TRX (Tron)</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                    <select
                                                        value={newWallet.network}
                                                        onChange={(e) => setNewWallet({ ...newWallet, network: e.target.value })}
                                                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    >
                                                        <option value="">Select Network</option>
                                                        <option value="TRC20">TRC20 (Tron)</option>
                                                        <option value="ERC20">ERC20 (Ethereum)</option>
                                                        <option value="BEP20">BEP20 (BSC)</option>
                                                        <option value="Bitcoin">Bitcoin</option>
                                                        <option value="Polygon">Polygon</option>
                                                        <option value="Solana">Solana</option>
                                                    </select>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Wallet Address"
                                                    value={newWallet.walletAddress}
                                                    onChange={(e) => setNewWallet({ ...newWallet, walletAddress: e.target.value })}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                />
                                                <button
                                                    onClick={addCryptoWallet}
                                                    className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm transition"
                                                >
                                                    <PlusIcon className="h-4 w-4" /> Add Wallet
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'email' && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-white">Email Settings</h2>
                                <p className="text-gray-500">This section is for future platform email configuration.</p>
                            </div>
                        )}

                        {/* Account Deletion Settings — always visible */}
                        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-4 mt-6">
                            <h2 className="text-xl font-semibold text-white">Account Deletion Policy</h2>
                            <p className="text-sm text-gray-400">Configure when suspended accounts are automatically deleted. If disabled, accounts are never auto-deleted.</p>
                            <div className="flex items-center justify-between bg-gray-800/50 p-4 rounded-xl">
                                <div>
                                    <p className="text-white font-medium">Auto-Delete Suspended Accounts</p>
                                    <p className="text-xs text-gray-500">Automatically delete data after suspension period</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={accountDeletion.enabled}
                                        onChange={(e) => setAccountDeletion({ ...accountDeletion, enabled: e.target.checked })}
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                                </label>
                            </div>
                            {accountDeletion.enabled && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-300 mb-2">Days After Suspension Before Deletion</label>
                                        <input
                                            type="number"
                                            min="7"
                                            max="365"
                                            value={accountDeletion.daysAfterSuspension}
                                            onChange={(e) => setAccountDeletion({ ...accountDeletion, daysAfterSuspension: parseInt(e.target.value) || 30 })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Minimum 7 days. Account & all data permanently deleted after this.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-300 mb-2">Start Warning Emails (Days Before Deletion)</label>
                                        <input
                                            type="number"
                                            min="3"
                                            max="30"
                                            value={accountDeletion.warningEmailDays}
                                            onChange={(e) => setAccountDeletion({ ...accountDeletion, warningEmailDays: parseInt(e.target.value) || 10 })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Warning emails sent every 3 days starting this many days before deletion.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end pt-6 border-t border-gray-800 mt-6">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
