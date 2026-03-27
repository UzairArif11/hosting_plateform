'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExclamationTriangleIcon, ArrowUpCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '@/lib/api';

interface SuspensionInfo {
  suspended: boolean;
  suspensionReason?: string;
  suspendedAt?: string;
  planType?: string;
}

export default function SuspendedAccountBanner() {
  const [suspensionInfo, setSuspensionInfo] = useState<SuspensionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    api.get('/auth/me')
      .then(res => {
        const data = res.data;
        if (data.user?.status === 'suspended') {
          setSuspensionInfo({
            suspended: true,
            suspensionReason: data.user.suspensionReason || 'Account suspended',
            suspendedAt: data.user.suspendedAt,
            planType: data.user.planType
          });
        } else if (data.suspended) {
          setSuspensionInfo({
            suspended: true,
            suspensionReason: data.suspensionReason || 'Account suspended',
            suspendedAt: data.suspendedAt,
            planType: data.planType
          });
        }
      })
      .catch(() => {
        // Ignore errors
      });
  }, []);

  if (!suspensionInfo?.suspended || dismissed) {
    return null;
  }

  const handleUpgrade = () => {
    router.push('/dashboard/billing');
  };

  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-red-400 hover:text-red-600"
      >
        <XMarkIcon className="h-5 w-5" />
      </button>

      <div className="flex items-start">
        <div className="flex-shrink-0">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            Account Suspended
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p><strong>Reason:</strong> {suspensionInfo.suspensionReason}</p>
            {suspensionInfo.suspendedAt && (
              <p className="mt-1 text-xs text-red-600">
                Suspended on: {new Date(suspensionInfo.suspendedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="mt-4">
            <button
              onClick={handleUpgrade}
              className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              <ArrowUpCircleIcon className="h-5 w-5 mr-2" />
              Upgrade to Reactivate Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
