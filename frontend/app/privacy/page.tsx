'use client';

import Link from 'next/link';

export default function PrivacyPage() {
    const platformName = 'CloudHost Platform';
    const lastUpdated = 'March 3, 2026';
    const contactEmail = 'support@cloudhost.com';

    return (
        <div className="min-h-screen bg-gray-950 text-gray-300">
            {/* Header */}
            <header className="border-b border-gray-800">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="text-white font-bold text-lg hover:text-blue-400 transition-colors">
                        ← Back to Home
                    </Link>
                    <Link href="/terms" className="text-gray-400 hover:text-white text-sm transition-colors">
                        ← Terms of Service
                    </Link>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-12">
                <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
                <p className="text-gray-500 mb-10">Last updated: {lastUpdated}</p>

                <div className="space-y-8 leading-relaxed">
                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
                        <p className="mb-3">We collect the following information when you use {platformName}:</p>

                        <h3 className="text-lg font-medium text-gray-200 mb-2 mt-4">Account Information</h3>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Name and email address (from GitHub OAuth login)</li>
                            <li>GitHub profile information (username, avatar)</li>
                            <li>Account preferences and settings</li>
                        </ul>

                        <h3 className="text-lg font-medium text-gray-200 mb-2 mt-4">Usage Data</h3>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Deployment logs and build information</li>
                            <li>Resource usage (CPU, RAM, bandwidth)</li>
                            <li>Pages visited and features used</li>
                        </ul>

                        <h3 className="text-lg font-medium text-gray-200 mb-2 mt-4">Payment Information</h3>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Payment is processed by Payoneer — we do <strong className="text-white">NOT</strong> store credit card numbers</li>
                            <li>We store: plan type, billing cycle, and payment status</li>
                            <li>Transaction IDs for record-keeping</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong className="text-white">To provide the service:</strong> Deploy your sites, manage your account, process payments.</li>
                            <li><strong className="text-white">To improve the Platform:</strong> Understand usage patterns to improve features and performance.</li>
                            <li><strong className="text-white">To communicate:</strong> Send service updates, billing notifications, and support responses.</li>
                            <li><strong className="text-white">To ensure security:</strong> Detect and prevent abuse, fraud, and unauthorized access.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">3. Information We Do NOT Do</h2>
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-2">
                            <p>❌ We do <strong className="text-white">NOT</strong> sell your personal data to third parties.</p>
                            <p>❌ We do <strong className="text-white">NOT</strong> share your data with advertisers.</p>
                            <p>❌ We do <strong className="text-white">NOT</strong> store credit card or payment card numbers.</p>
                            <p>❌ We do <strong className="text-white">NOT</strong> track you across other websites.</p>
                            <p>❌ We do <strong className="text-white">NOT</strong> use your deployed site content for any purpose.</p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">4. Data Storage & Security</h2>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Your data is stored on secure servers with encrypted connections (HTTPS/TLS).</li>
                            <li>Passwords are hashed and never stored in plain text.</li>
                            <li>Access to user data is restricted to authorized personnel only.</li>
                            <li>We use industry-standard security practices to protect your data.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">5. Third-Party Services</h2>
                        <p className="mb-3">We use the following third-party services:</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border border-gray-800 rounded-lg overflow-hidden">
                                <thead className="bg-gray-900">
                                    <tr>
                                        <th className="text-left px-4 py-2 text-gray-400 font-medium">Service</th>
                                        <th className="text-left px-4 py-2 text-gray-400 font-medium">Purpose</th>
                                        <th className="text-left px-4 py-2 text-gray-400 font-medium">Data Shared</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    <tr>
                                        <td className="px-4 py-2 text-white">GitHub</td>
                                        <td className="px-4 py-2">Authentication & repository access</td>
                                        <td className="px-4 py-2">OAuth tokens</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-2 text-white">Payoneer</td>
                                        <td className="px-4 py-2">Payment processing</td>
                                        <td className="px-4 py-2">Email, plan details, amounts</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">6. Cookies</h2>
                        <p>
                            We use essential cookies only — for authentication sessions and user preferences.
                            We do not use tracking cookies or third-party advertising cookies.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">7. Your Rights</h2>
                        <p className="mb-3">You have the right to:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong className="text-white">Access:</strong> Request a copy of your personal data.</li>
                            <li><strong className="text-white">Correct:</strong> Update or correct inaccurate information.</li>
                            <li><strong className="text-white">Delete:</strong> Request deletion of your account and associated data.</li>
                            <li><strong className="text-white">Export:</strong> Download your data in a portable format.</li>
                            <li><strong className="text-white">Withdraw consent:</strong> Opt out of non-essential communications.</li>
                        </ul>
                        <p className="mt-3">
                            To exercise these rights, contact us at{' '}
                            <a href={`mailto:${contactEmail}`} className="text-blue-400 hover:text-blue-300">{contactEmail}</a>
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">8. Data Retention</h2>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Account data is kept as long as your account is active.</li>
                            <li>After account deletion, data is permanently removed within 30 days.</li>
                            <li>Deployment logs are retained for 90 days for troubleshooting.</li>
                            <li>Payment records are kept for 7 years as required by tax regulations.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">9. Children&apos;s Privacy</h2>
                        <p>
                            The Platform is not intended for children under 13. We do not knowingly collect
                            personal information from children under 13. If you believe a child has provided
                            us data, contact us and we will delete it.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">10. Changes to This Policy</h2>
                        <p>
                            We may update this Privacy Policy from time to time. We will notify you of significant
                            changes via email or a notice on the Platform. Your continued use after changes
                            constitutes acceptance.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">11. Contact Us</h2>
                        <p>
                            For privacy-related questions or requests, contact us at{' '}
                            <a href={`mailto:${contactEmail}`} className="text-blue-400 hover:text-blue-300">
                                {contactEmail}
                            </a>
                        </p>
                    </section>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-gray-800 mt-16">
                <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between text-sm text-gray-500">
                    <p>© {new Date().getFullYear()} {platformName}. All rights reserved.</p>
                    <div className="flex gap-4">
                        <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
                        <Link href="/privacy" className="text-blue-400">Privacy</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
