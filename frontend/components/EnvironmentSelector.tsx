'use client';

import { useState } from 'react';

interface EnvironmentSelectorProps {
    value: string;
    onChange: (env: string) => void;
    userPlan?: string;
}

export default function EnvironmentSelector({ value, onChange, userPlan = 'free' }: EnvironmentSelectorProps) {
    const environments = [
        { value: 'production', label: 'Production', plans: ['free', 'pro', 'enterprise'] },
        { value: 'preview', label: 'Preview', plans: ['pro', 'enterprise'] },
    ];

    const availableEnvs = environments.filter(env =>
        env.plans.includes(userPlan.toLowerCase())
    );

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
                Environment
            </label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
            >
                {availableEnvs.map(env => (
                    <option key={env.value} value={env.value}>
                        {env.label}
                    </option>
                ))}
            </select>
            {userPlan === 'free' && (
                <p className="text-xs text-gray-500">
                    Upgrade to Pro for staging/preview environments
                </p>
            )}
        </div>
    );
}
