'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store';
import { 
  ExclamationTriangleIcon, 
  ArrowUpCircleIcon, 
  EnvelopeIcon,
  ClockIcon,
  CreditCardIcon
} from '@heroicons/react/24/outline';

export default function SuspendedAccountPage() {
  const router = useRouter();
  const { user } = useSelector((state: RootState) => state.auth);
  const [daysUntilDeletion, setDaysUntilDeletion] = useState<number | null>(null);

  useEffect(() => {
    // Calculate days until account deletion (30 days after suspension)
    if (user?.suspendedAt) {
      const suspendedDate = new Date(user.suspendedAt);
      const deletionDate = new Date(suspendedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const now = new Date();
      const daysLeft = Math.max(0, Math.ceil((deletionDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
      setDaysUntilDeletion(daysLeft);
    }
  }, [user]);

  if (user?.status !== 'suspended') {
    router.push('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Warning Card */}
        <div className="bg-gray-900 rounded-lg shadow-xl border border-red-500/30 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-center">
            <ExclamationTriangleIcon className="h-16 w-16 text-white mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">
              Account Suspended
            </h1>
            <p className="text-red-100">
              Your account access has been temporarily restricted
            </p>
          </div>

          {/* Content */}
          <div className="p-8 space-y-6">
            {/* Suspension Reason */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-900 mb-2">Suspension Reason:</h3>
              <p className="text-red-800">
                {user.suspensionReason || 'Account suspended by administrator'}
              </p>
              {user.suspendedAt && (
                <p className="text-sm text-red-600 mt-2">
                  <ClockIcon className="h-4 w-4 inline mr-1" />
                  Suspended on: {new Date(user.suspendedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              )}
            </div>

            {/* What This Means */}
            <div className="space-y-3">
              <h3 className="font-semibold text-white text-lg">What this means:</h3>
              <ul className="space-y-2 text-gray-400">
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">•</span>
                  <span>All deployments have been stopped</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">•</span>
                  <span>You cannot create new projects or deployments</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2">•</span>
                  <span>Your data is safely stored and will be restored upon reactivation</span>
                </li>
                {daysUntilDeletion !== null && daysUntilDeletion > 0 && (
                  <li className="flex items-start text-yellow-500">
                    <span className="mr-2">⚠️</span>
                    <span>Account will be permanently deleted in <strong>{daysUntilDeletion} days</strong> if not reactivated</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Reactivation Options */}
            <div className="border-t border-gray-800 pt-6">
              <h3 className="font-semibold text-white text-lg mb-4">Reactivate Your Account:</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                {/* Upgrade Plan Option */}
                <button
                  onClick={() => router.push('/dashboard/billing')}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white p-6 rounded-lg text-left transition-all transform hover:scale-105"
                >
                  <ArrowUpCircleIcon className="h-8 w-8 mb-3" />
                  <h4 className="font-bold text-lg mb-1">Upgrade Plan</h4>
                  <p className="text-sm text-purple-100">
                    Subscribe to a paid plan to reactivate immediately
                  </p>
                  <div className="mt-4 text-xs text-purple-200">
                    Starting from $5/month
                  </div>
                </button>

                {/* Renew Plan Option */}
                <button
                  onClick={() => router.push('/dashboard/billing')}
                  className="bg-gray-800 hover:bg-gray-750 border border-gray-700 text-white p-6 rounded-lg text-left transition-all transform hover:scale-105"
                >
                  <CreditCardIcon className="h-8 w-8 mb-3 text-green-500" />
                  <h4 className="font-bold text-lg mb-1">Renew Subscription</h4>
                  <p className="text-sm text-gray-400">
                    Pay outstanding balance to continue your current plan
                  </p>
                  <div className="mt-4 text-xs text-gray-500">
                    Instant reactivation
                  </div>
                </button>
              </div>
            </div>

            {/* Contact Support */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
              <EnvelopeIcon className="h-6 w-6 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                Have questions? Contact our support team at{' '}
                <a href="mailto:support@foodpanda.site" className="text-purple-400 hover:text-purple-300 underline">
                  support@foodpanda.site
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Back to Dashboard (Read-only) */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-white text-sm"
          >
            ← Back to Dashboard (Read-only)
          </button>
        </div>
      </div>
    </div>
  );
}
