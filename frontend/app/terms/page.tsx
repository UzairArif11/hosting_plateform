'use client';

import Link from 'next/link';

export default function TermsPage() {
    const platformName = 'DeployHub';
    const lastUpdated = 'March 3, 2026';
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
                        <Link href="/privacy" className="text-gray-400 hover:text-white text-sm transition-colors">Privacy</Link>
                        <Link href="/refund" className="text-gray-400 hover:text-white text-sm transition-colors">Refund</Link>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-12">
                <h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
                <p className="text-gray-500 mb-10">Last updated: {lastUpdated}</p>

                <div className="space-y-8 leading-relaxed">
                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
                        <p>
                            By accessing or using {platformName} (&quot;the Platform&quot;), you agree to be bound by these Terms of Service.
                            If you do not agree to these terms, do not use the Platform. These terms apply to all users,
                            including free and paid subscribers.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
                        <p>
                            {platformName} is a web hosting platform that allows users to deploy websites and web applications.
                            We provide hosting infrastructure, templates, deployment tools, and related services. The Platform
                            is similar to services like Vercel, Netlify, and Heroku.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">3. User Accounts</h2>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>You must provide accurate information when creating an account.</li>
                            <li>You are responsible for maintaining the security of your account credentials.</li>
                            <li>You must be at least 13 years old to use the Platform.</li>
                            <li>One person or organization may not maintain more than one free account.</li>
                            <li>You are responsible for all activity that occurs under your account.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">4. Acceptable Use</h2>
                        <p className="mb-3">You agree NOT to use the Platform to:</p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Host illegal content or content that violates any applicable law.</li>
                            <li>Distribute malware, viruses, or harmful code.</li>
                            <li>Send spam or unsolicited communications.</li>
                            <li>Engage in phishing, fraud, or deceptive practices.</li>
                            <li>Mine cryptocurrency or run computationally abusive workloads.</li>
                            <li>Infringe on the intellectual property rights of others.</li>
                            <li>Attempt to gain unauthorized access to other accounts or systems.</li>
                            <li>Violate the privacy of others or collect personal data without consent.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">5. Content Ownership</h2>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong className="text-white">Your Content:</strong> You retain ownership of all content you upload, deploy, or create on the Platform (code, images, text, data).</li>
                            <li><strong className="text-white">Our Templates:</strong> Templates provided by the Platform are licensed for your use on our Platform. You may not redistribute or resell template source code separately.</li>
                            <li><strong className="text-white">Platform IP:</strong> The Platform&apos;s design, branding, and infrastructure remain our intellectual property.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">6. Paid Plans & Billing</h2>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Paid subscriptions are billed monthly or annually as selected.</li>
                            <li>Payments are processed securely through our payment provider (Payoneer). We do not store credit card information.</li>
                            <li>You may cancel your subscription at any time. Access continues until the end of the billing period.</li>
                            <li>Refunds are handled on a case-by-case basis. Contact support for refund requests.</li>
                            <li>We reserve the right to change pricing with 30 days advance notice.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">7. Service Availability</h2>
                        <p>
                            We strive for high uptime but do not guarantee 100% availability. The Platform may be
                            temporarily unavailable for maintenance, updates, or unforeseen issues. We are not liable
                            for any damages arising from service interruptions.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">8. Account Suspension & Termination</h2>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>We may suspend or terminate accounts that violate these terms.</li>
                            <li>We may suspend accounts for non-payment of paid services.</li>
                            <li>Upon termination, your deployed sites will be taken offline.</li>
                            <li>You may request an export of your data within 30 days of termination.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">9. Limitation of Liability</h2>
                        <p>
                            The Platform is provided &quot;as is&quot; without warranties of any kind. We are not liable for any
                            indirect, incidental, or consequential damages arising from your use of the Platform.
                            Our total liability is limited to the amount you paid us in the 12 months preceding the claim.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">10. Changes to Terms</h2>
                        <p>
                            We may update these terms from time to time. Significant changes will be communicated via
                            email or a notice on the Platform. Continued use after changes constitutes acceptance
                            of the updated terms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-white mb-3">11. Contact</h2>
                        <p>
                            For questions about these terms, contact us at{' '}
                            <a href={`mailto:${contactEmail}`} className="text-blue-400 hover:text-blue-300">
                                {contactEmail}
                            </a>
                        </p>
                    </section>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-gray-800 mt-16">
                <div className="max-w-4xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
                    <p>&copy; {new Date().getFullYear()} {platformName}. All rights reserved.</p>
                    <div className="flex gap-4">
                        <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
                        <Link href="/terms" className="text-blue-400">Terms</Link>
                        <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                        <Link href="/refund" className="hover:text-white transition-colors">Refund</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
