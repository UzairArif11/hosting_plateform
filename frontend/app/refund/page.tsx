'use client';

import Link from 'next/link';

export default function RefundPage() {
    const platformName = 'DeployHub';
    const lastUpdated = 'April 8, 2026';
    const contactEmail = 'support@deployhub.com';

    return (
        <div className="min-h-screen bg-gray-950 text-gray-300">
            {/* Header */}
            <header className="border-b border-gray-800">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="text-white font-bold text-lg hover:text-blue-400 transition-colors">
                        ← Back to Home
                    </Link>
                    <div className="flex gap-4">
                        <Link href="/pricing" className="text-gray-400 hover:text-white text-sm transition-colors">Pricing</Link>
                        <Link href="/terms" className="text-gray-400 hover:text-white text-sm transition-colors">Terms</Link>
                        <Link href="/privacy" className="text-gray-400 hover:text-white text-sm transition-colors">Privacy</Link>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-12">
                <h1 className="text-4xl font-bold text-white mb-2">Refund Policy</h1>
                <p className="text-gray-500 mb-10">Last updated: {lastUpdated}</p>

                <div className="space-y-8 leading-relaxed">
                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">1. Overview</h2>
                        <p>
                            At {platformName}, your satisfaction is our priority. We offer a straightforward,
                            no-questions-asked refund policy for all paid subscriptions.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">2. Free Trial</h2>
                        <p>
                            All new accounts receive a <strong className="text-white">30-day free trial</strong> with
                            no credit card required. During this period, you can fully evaluate our platform
                            at no cost. Since the trial is free, no refund is applicable for the trial period.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">3. Refund Policy</h2>
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
                            <p className="text-lg text-white font-medium mb-2">14-Day Money-Back Guarantee</p>
                            <p>
                                If you are not satisfied with our service for any reason, you can request a
                                full refund within <strong className="text-white">14 days</strong> of your purchase.
                                No questions asked.
                            </p>
                        </div>
                        <p>This applies to all paid plans — monthly and annual subscriptions alike. If you request
                            a refund within 14 days of purchase, you will receive a <strong className="text-white">complete refund</strong> of
                            the amount charged.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">4. Cancellation</h2>
                        <p>
                            You can cancel your subscription at any time from your dashboard. When you cancel:
                        </p>
                        <ul className="list-disc list-inside space-y-2 ml-4 mt-3">
                            <li>Your service continues until the end of your current billing period</li>
                            <li>No further charges will be made</li>
                            <li>Your projects and data will be preserved for 30 days after the subscription ends</li>
                            <li>After 30 days, your data may be permanently deleted</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">5. How to Request a Refund</h2>
                        <p className="mb-4">To request a refund, simply:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Email us at <a href={`mailto:${contactEmail}`} className="text-blue-400 hover:text-blue-300">{contactEmail}</a></li>
                            <li>Include your account email address</li>
                        </ul>
                        <p className="mt-4">
                            We aim to process all refund requests within <strong className="text-white">5-10 business days</strong>.
                            Refunds will be issued to the original payment method used for the purchase.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">6. Chargebacks</h2>
                        <p>
                            If you have a billing concern, please contact us before initiating a chargeback
                            with your payment provider. We are committed to resolving any issues fairly
                            and promptly.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">7. Changes to This Policy</h2>
                        <p>
                            We may update this refund policy from time to time. Any changes will be posted
                            on this page with an updated revision date. Continued use of our services after
                            changes constitutes acceptance of the revised policy.
                        </p>
                    </section>

                    <section className="pt-6 border-t border-gray-800">
                        <h2 className="text-xl font-semibold text-white mb-3">Contact Us</h2>
                        <p>
                            If you have questions about this refund policy, contact us at{' '}
                            <a href={`mailto:${contactEmail}`} className="text-blue-400 hover:text-blue-300">{contactEmail}</a>.
                        </p>
                    </section>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-gray-800 mt-16">
                <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between text-sm text-gray-500">
                    <p>&copy; {new Date().getFullYear()} {platformName}. All rights reserved.</p>
                    <div className="flex gap-4">
                        <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
                        <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
                        <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                        <Link href="/refund" className="text-blue-400">Refund</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
