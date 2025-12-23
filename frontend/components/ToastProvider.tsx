'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
}

interface ToastContextType {
    showToast: (type: Toast['type'], message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = (type: Toast['type'], message: string) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newToast = { id, type, message };

        setToasts(prev => [...prev, newToast]);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-50 space-y-2">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`px-6 py-4 rounded-lg shadow-lg border backdrop-blur-sm animate-slide-in ${toast.type === 'success'
                                ? 'bg-green-500/90 border-green-400 text-white'
                                : toast.type === 'error'
                                    ? 'bg-red-500/90 border-red-400 text-white'
                                    : toast.type === 'warning'
                                        ? 'bg-yellow-500/90 border-yellow-400 text-black'
                                        : 'bg-blue-500/90 border-blue-400 text-white'
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-semibold">{toast.message}</span>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="ml-4 text-white hover:text-gray-200"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}
