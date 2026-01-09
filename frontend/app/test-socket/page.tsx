'use client';

// MINIMAL TEST PAGE - Shows immediately if new code is deployed
export default function SocketTest() {
    console.log('🧪 TEST PAGE LOADED - New code is active!');
    console.log('NEXT_PUBLIC_SOCKET_URL:', process.env.NEXT_PUBLIC_SOCKET_URL);
    console.log('Window origin:', typeof window !== 'undefined' ? window.location.origin : 'SSR');

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-2xl mx-auto space-y-6">
                <h1 className="text-3xl font-bold">🧪 Socket Test Page</h1>

                <div className="bg-gray-800 p-4 rounded space-y-2">
                    <p className="font-mono text-sm">
                        <strong>Environment Check:</strong>
                    </p>
                    <p className="font-mono text-xs text-green-400">
                        NEXT_PUBLIC_SOCKET_URL: {process.env.NEXT_PUBLIC_SOCKET_URL || 'NOT SET'}
                    </p>
                    <p className="font-mono text-xs text-green-400">
                        Window Origin: {typeof window !== 'undefined' ? window.location.origin : 'Server-side'}
                    </p>
                </div>

                <div className="bg-blue-900/50 p-4 rounded">
                    <p className="text-sm">
                        ✅ If you see this page, the new frontend code is deployed.
                    </p>
                    <p className="text-sm mt-2">
                        ⚠️ If NEXT_PUBLIC_SOCKET_URL shows "NOT SET", the environment variables aren't being read.
                    </p>
                </div>

                <div className="bg-gray-800 p-4 rounded">
                    <p className="text-sm font-semibold mb-2">Next Steps:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                        <li>Open browser console (F12)</li>
                        <li>Look for: "🧪 TEST PAGE LOADED"</li>
                        <li>Check the NEXT_PUBLIC_SOCKET_URL value</li>
                        <li>If it shows the URL, environment is correct</li>
                    </ol>
                </div>

                <a
                    href="/dashboard"
                    className="inline-block bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg"
                >
                    ← Back to Dashboard
                </a>
            </div>
        </div>
    );
}
