'use client';

import Link from 'next/link';

export default function RefundPage() {
    const platformName = 'DeployHub';
    const lastUpdated = 'April 7, 2026';
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
                            At {platformName}, we want you to be completely satisfied with our services.
                            This refund policy outlines the conditions under which we offer refunds for our
                            hosting and deployment services.
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
                        <h2 className="text-xl font-semibold text-white mb-3">3. Paid Subscriptions</h2>
                        <p className="mb-4">For paid plans, we offer refunds under the following conditions:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>
                                <strong className="text-white">Within 7 days of purchase:</strong> Full refund, no questions asked.
                                If you are not satisfied with our service within the first 7 days of your paid subscription,
                                contact us for a complete refund.
                            </li>
                            <li>
                                <strong className="text-white">After 7 days:</strong> Pro-rated refund for the unused portion
                                of your billing period may be available on a case-by-case basis.
                            </li>
                            <li>
                                <strong className="text-white">Annual plans:</strong> Refund requests for annual plans must be
                                made within 14 days of purchase. After 14 days, you may downgrade to a lower plan but
                                refunds are not available.
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">4. Non-Refundable Items</h2>
                        <p className="mb-4">The following are not eligible for refunds:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Domain registration fees (if applicable)</li>
                            <li>Setup or migration fees (if applicable)</li>
                            <li>Accounts suspended or terminated for violations of our Terms of Service</li>
                            <li>Partial months of service after the 7-day refund window</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">5. Cancellation</h2>
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
                        <h2 className="text-xl font-semibold text-white mb-3">6. How to Request a Refund</h2>
                        <p className="mb-4">To request a refund, you can:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Email us at <a href={`mailto:${contactEmail}`} className="text-blue-400 hover:text-blue-300">{contactEmail}</a></li>
                            <li>Include your account email and the reason for your refund request</li>
                        </ul>
                        <p className="mt-4">
                            We aim to process all refund requests within <strong className="text-white">5-10 business days</strong>.
                            Refunds will be issued to the original payment method used for the purchase.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">7. Chargebacks</h2>
                        <p>
                            If you have a billing concern, please contact us before initiating a chargeback
                            with your payment provider. We are committed to resolving any issues fairly
                            and promptly. Unauthorized chargebacks may result in account suspension.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">8. Changes to This Policy</h2>
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
