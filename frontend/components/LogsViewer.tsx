'use client';

import { useState } from 'react';

interface LogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'success';
    message: string;
}

interface LogsViewerProps {
    logs: LogEntry[];
}

export default function LogsViewer({ logs }: LogsViewerProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [levelFilter, setLevelFilter] = useState<string>('all');

    const filteredLogs = logs.filter(log => {
        const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
        return matchesSearch && matchesLevel;
    });

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'error': return 'text-red-400';
            case 'warn': return 'text-yellow-400';
            case 'success': return 'text-green-400';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="space-y-4">
            {/* Search and Filter */}
            <div className="flex gap-4 items-center">
                <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                />

                <div className="flex gap-2">
                    {['all', 'info', 'warn', 'error', 'success'].map(level => (
                        <button
                            key={level}
                            onClick={() => setLevelFilter(level)}
                            className={`px-3 py-1 rounded text-sm transition-colors ${levelFilter === level
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                        >
                            {level}
                        </button>
                    ))}
                </div>
            </div>

            {/* Logs Display */}
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 max-h-96 overflow-y-auto font-mono text-sm">
                {filteredLogs.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                        No logs {searchTerm || levelFilter !== 'all' ? 'matching filter' : 'available'}
                    </div>
                ) : (
                    filteredLogs.map((log, i) => (
                        <div key={i} className="py-1 hover:bg-gray-800/50">
                            <span className="text-gray-600 mr-2">
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={`mr-2 font-bold uppercase text-xs ${getLevelColor(log.level)}`}>
                                [{log.level}]
                            </span>
                            <span className="text-gray-300">{log.message}</span>
                        </div>
                    ))
                )}
            </div>

            <div className="text-xs text-gray-500">
                Showing {filteredLogs.length} of {logs.length} logs
            </div>
        </div>
    );
}
