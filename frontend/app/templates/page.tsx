'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store';
import TemplateCard from '../../components/TemplateCard';
import FeatureGuard from '@/components/FeatureGuard';

interface Template {
    _id: string;
    name: string;
    description: string;
    framework: string;
    previewImage: string;
    category: string;
    tags: string[];
    isPremium: boolean;
    minPlan?: 'free' | 'pro' | 'enterprise';
    previewUrl?: string;
    deployCount: number;
}

export default function TemplatesPage() {
    return (
        <FeatureGuard feature="templates">
            <TemplatesPageContent />
        </FeatureGuard>
    );
}

function TemplatesPageContent() {
    const { user } = useSelector((state: RootState) => state.auth);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');

    useEffect(() => {
        fetchTemplates();
    }, [search, category]);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (category !== 'all') params.append('category', category);

            // Fetch from backend
            const res = await fetch(`/api/templates?${params.toString()}`);
            const data = await res.json();

            if (data.success) {
                // Ensure previewUrl is included in templates
                setTemplates(data.templates.map((t: any) => ({
                    ...t,
                    previewUrl: t.previewUrl || undefined
                })));
            }
        } catch (error) {
            console.error('Failed to fetch templates:', error);
        } finally {
            setLoading(false);
        }
    };

    const categories = [
        { id: 'all', label: 'All Templates' },
        { id: 'ecommerce', label: 'E-Commerce' },
        { id: 'blog', label: 'Blog' },
        { id: 'starter', label: 'Starters' },
        { id: 'dashboard', label: 'Dashboards' },
    ];

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                            </Link>
                            <h1 className="text-xl font-bold">New Project from Template</h1>
                        </div>

                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            </span>
                            <input
                                type="text"
                                className="bg-gray-800 border-none rounded-lg py-2 pl-10 pr-4 w-64 text-sm text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:bg-gray-900 transition-all"
                                placeholder="Search templates..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Categories */}
                <div className="flex overflow-x-auto gap-2 pb-6 mb-2 no-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setCategory(cat.id)}
                            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${category === cat.id
                                ? 'bg-white text-black shadow-lg scale-105'
                                : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white border border-gray-800'
                                }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="bg-gray-900 rounded-xl h-80 border border-gray-800"></div>
                        ))}
                    </div>
                ) : (
                    <>
                        {templates.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {templates.map(template => (
                                    <TemplateCard
                                        key={template._id}
                                        template={template}
                                        userPlan={user?.plan?.name?.toLowerCase() || 'free'}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mb-4 text-gray-700">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                </div>
                                <h3 className="text-xl font-medium text-white mb-2">No templates found</h3>
                                <p className="text-gray-500 max-w-sm">
                                    We couldn't find any templates searching for "{search}". Try a different search term or category.
                                </p>
                                <button
                                    onClick={() => { setSearch(''); setCategory('all'); }}
                                    className="mt-6 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
