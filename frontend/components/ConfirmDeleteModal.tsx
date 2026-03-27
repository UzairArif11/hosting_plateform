'use client';

import { useState, useEffect, useRef } from 'react';

interface ConfirmDeleteModalProps {
    isOpen: boolean;
    email: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmDeleteModal({ isOpen, email, onConfirm, onCancel }: ConfirmDeleteModalProps) {
    const [inputValue, setInputValue] = useState('');
    const [shake, setShake] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setInputValue('');
            setShake(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onCancel();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onCancel]);

    const handleSubmit = () => {
        if (inputValue.trim() === email) {
            onConfirm();
        } else {
            setShake(true);
            setTimeout(() => setShake(false), 500);
        }
    };

    if (!isOpen) return null;

    const isMatch = inputValue.trim() === email;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Overlay click to cancel */}
            <div className="absolute inset-0" onClick={onCancel} />

            {/* Modal */}
            <div className={`relative w-full max-w-md mx-4 bg-gray-900 border border-red-500/30 rounded-2xl shadow-2xl shadow-red-900/20 overflow-hidden ${shake ? 'animate-shake' : ''}`}>
                {/* Red gradient header */}
                <div className="bg-gradient-to-r from-red-600/20 via-red-500/10 to-transparent px-6 py-4 border-b border-red-500/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
                            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-red-400">Permanent Delete</h3>
                            <p className="text-xs text-red-300/60">This action cannot be undone</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <p className="text-sm text-gray-300 leading-relaxed">
                        This will <span className="text-red-400 font-semibold">permanently remove</span> the following:
                    </p>

                    <div className="bg-gray-800/60 rounded-lg p-3 space-y-1.5 border border-gray-700/50">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span className="text-red-400">✕</span> User record & credentials
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span className="text-red-400">✕</span> All projects & source code
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span className="text-red-400">✕</span> All deployments & history
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span className="text-red-400">✕</span> Docker container & server resources
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-400 mb-2">
                            Type <span className="text-white font-mono bg-gray-800 px-1.5 py-0.5 rounded">{email}</span> to confirm
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            placeholder="Enter email to confirm"
                            className={`w-full px-4 py-2.5 bg-gray-800 border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${
                                inputValue.length > 0 && !isMatch
                                    ? 'border-red-500/50 focus:ring-red-500/30'
                                    : isMatch
                                        ? 'border-green-500/50 focus:ring-green-500/30'
                                        : 'border-gray-700 focus:ring-purple-500/30'
                            }`}
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-800/30 border-t border-gray-800 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!isMatch}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                            isMatch
                                ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-lg shadow-red-900/30'
                                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                        Delete Permanently
                    </button>
                </div>
            </div>

            {/* Shake animation */}
            <style jsx>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                    20%, 40%, 60%, 80% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.5s ease-in-out;
                }
            `}</style>
        </div>
    );
}
