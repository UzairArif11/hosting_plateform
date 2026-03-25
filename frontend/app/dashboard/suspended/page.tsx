'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ExclamationTriangleIcon, 
  ArrowUpCircleIcon, 
  EnvelopeIcon,
  ClockIcon,
  CreditCardIcon,
  TrashIcon,
  RocketLaunchIcon
} from '@heroicons/react/24/outline';
import api from '@/lib/api';

export default function SuspendedAccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [daysUntilDeletion, setDaysUntilDeletion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then(res => {
        const data = res.data;
        if (data.user) {
          setUser(data.user);
          computeDaysLeft(data.user.suspendedAt, data.user.resourcesDeleted);
        } else if (data.suspended) {
          const userData = {
            status: 'suspended',
            suspensionReason: data.suspensionReason || 'Account suspended',
            suspendedAt: data.suspendedAt,
            planType: data.planType,
            resourcesDeleted: data.resourcesDeleted || false,
            resourcesDeletedAt: data.resourcesDeletedAt || null
          };
          setUser(userData);
          computeDaysLeft(data.suspendedAt, data.resourcesDeleted);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        router.push('/login');
      });
  }, [router]);

  function computeDaysLeft(suspendedAt: string | undefined, resourcesDeleted: boolean) {
    if (!suspendedAt || resourcesDeleted) {
      setDaysUntilDeletion(0);
      return;
    }
    const suspendedDate = new Date(suspendedAt);
    const deletionDate = new Date(suspendedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    setDaysUntilDeletion(Math.max(0, Math.ceil((deletionDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!user || user.status !== 'suspended') {
    if (typeof window !== 'undefined') {
      router.push('/dashboard');
    }
    return null;
  }

  const resourcesDeleted = user.resourcesDeleted;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-gray-900 rounded-lg shadow-xl border border-red-500/30 overflow-hidden">
          {/* Header */}
          <div className={`p-6 text-center ${resourcesDeleted 
            ? 'bg-gradient-to-r from-gray-700 to-gray-800' 
            : 'bg-gradient-to-r from-red-600 to-red-700'}`}>
            {resourcesDeleted ? (
              <TrashIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            ) : (
              <ExclamationTriangleIcon className="h-16 w-16 text-white mx-auto mb-4" />
            )}
            <h1 className="text-3xl font-bold text-white mb-2">
              {resourcesDeleted ? 'Account Suspended — Data Removed' : 'Account Suspended'}
            </h1>
            <p className={resourcesDeleted ? 'text-gray-300' : 'text-red-100'}>
              {resourcesDeleted
                ? 'Your projects and deployments have been removed due to extended inactivity'
                : 'Your account access has been temporarily restricted'}
            </p>
          </div>

          {/* Content */}
          <div className="p-8 space-y-6">
            {/* Suspension Reason */}
            <div className={`border rounded-lg p-4 ${resourcesDeleted 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-red-950/50 border-red-800/50'}`}>
              <h3 className={`font-semibold mb-2 ${resourcesDeleted ? 'text-gray-200' : 'text-red-300'}`}>
                Suspension Reason:
              </h3>
              <p className={resourcesDeleted ? 'text-gray-400' : 'text-red-200'}>
                {user.suspensionReason || 'Account suspended by administrator'}
              </p>
              {user.suspendedAt && (
                <p className="text-sm text-gray-500 mt-2">
                  <ClockIcon className="h-4 w-4 inline mr-1" />
                  Suspended on: {new Date(user.suspendedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              )}
            </div>

            {/* Status Info */}
            <div className="space-y-3">
              <h3 className="font-semibold text-white text-lg">
                {resourcesDeleted ? 'Current status:' : 'What this means:'}
              </h3>
              <ul className="space-y-2 text-gray-400">
                {resourcesDeleted ? (
                  <>
                    <li className="flex items-start">
                      <span className="text-gray-500 mr-2">•</span>
                      <span>All projects, deployments, and containers have been removed</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gray-500 mr-2">•</span>
                      <span>Your account credentials and settings are still intact</span>
                    </li>
                    <li className="flex items-start text-green-400">
                      <span className="mr-2">✓</span>
                      <span>You can <strong>upgrade to a paid plan</strong> to reactivate your account with fresh resources</span>
                    </li>
                    <li className="flex items-start text-green-400">
                      <span className="mr-2">✓</span>
                      <span>Start new projects and deployments immediately after upgrading</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start">
                      <span className="text-red-500 mr-2">•</span>
                      <span>All deployments have been stopped</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-500 mr-2">•</span>
                      <span>You cannot create new projects or deployments</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">•</span>
                      <span>Your data is safely stored and will be restored upon reactivation</span>
                    </li>
                    {daysUntilDeletion !== null && daysUntilDeletion > 0 && (
                      <li className="flex items-start text-yellow-500">
                        <span className="mr-2">⚠️</span>
                        <span>Data will be permanently removed in <strong>{daysUntilDeletion} days</strong> if not reactivated</span>
                      </li>
                    )}
                  </>
                )}
              </ul>
            </div>

            {/* Reactivation Options */}
            <div className="border-t border-gray-800 pt-6">
              <h3 className="font-semibold text-white text-lg mb-4">
                {resourcesDeleted ? 'Get Started Again:' : 'Reactivate Your Account:'}
              </h3>
              
              <div className={`grid gap-4 ${resourcesDeleted ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
                {/* Upgrade Plan Option */}
                <button
                  onClick={() => router.push('/dashboard/billing')}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white p-6 rounded-lg text-left transition-all transform hover:scale-[1.02] shadow-lg hover:shadow-purple-900/30"
                >
                  {resourcesDeleted ? (
                    <RocketLaunchIcon className="h-8 w-8 mb-3" />
                  ) : (
                    <ArrowUpCircleIcon className="h-8 w-8 mb-3" />
                  )}
                  <h4 className="font-bold text-lg mb-1">
                    {resourcesDeleted ? 'Upgrade to Pro & Start Fresh' : 'Upgrade to a Paid Plan'}
                  </h4>
                  <p className="text-sm text-purple-100">
                    {resourcesDeleted
                      ? 'Choose Pro or Enterprise to reactivate your account and deploy new projects with fresh resources'
                      : 'Choose Pro or Enterprise to reactivate immediately — free plan users are auto-assigned'}
                  </p>
                  <div className="mt-4 text-xs text-purple-200">
                    {resourcesDeleted ? 'New container + resources allocated instantly' : 'Pro starts from $5/month'}
                  </div>
                </button>

                {/* Renew Plan Option - only show if resources NOT deleted */}
                {!resourcesDeleted && (
                  <button
                    onClick={() => router.push('/dashboard/billing')}
                    className="bg-gray-800 hover:bg-gray-750 border border-gray-700 text-white p-6 rounded-lg text-left transition-all transform hover:scale-[1.02]"
                  >
                    <CreditCardIcon className="h-8 w-8 mb-3 text-green-500" />
                    <h4 className="font-bold text-lg mb-1">Renew Subscription</h4>
                    <p className="text-sm text-gray-400">
                      Pay outstanding balance to continue your current plan
                    </p>
                    <div className="mt-4 text-xs text-gray-500">
                      Instant reactivation — all data restored
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Resources Deleted Info Banner */}
            {resourcesDeleted && user.resourcesDeletedAt && (
              <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
                <p className="text-sm text-yellow-300">
                  <strong>Note:</strong> Your previous projects and data were removed on{' '}
                  {new Date(user.resourcesDeletedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                  . Upgrading will give you a fresh start with new resources allocated to your account.
                </p>
              </div>
            )}

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
