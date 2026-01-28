import Link from 'next/link';
import { LockClosedIcon, GlobeAltIcon, SparklesIcon, PhotoIcon } from '@heroicons/react/24/solid';

interface TemplateProps {
    template: {
        _id: string;
        name: string;
        displayName?: string;
        description: string;
        framework: string;
        previewImage: string;
        previewUrl?: string;
        demoDeploymentUrl?: string; // Admin-deployed demo URL
        category: string;
        tags: string[];
        isPremium: boolean;
        minPlan?: 'free' | 'pro' | 'enterprise';
        deployCount: number;
    };
    userPlan?: string;
}

const PLAN_LEVELS: Record<string, number> = { 'free': 0, 'pro': 1, 'enterprise': 2 };

export default function TemplateCard({ template, userPlan = 'free' }: TemplateProps) {
    const minPlan = template.minPlan || (template.isPremium ? 'pro' : 'free');
    const userLevel = PLAN_LEVELS[userPlan] || 0;
    const requiredLevel = PLAN_LEVELS[minPlan] || 0;
    const isLocked = userLevel < requiredLevel;

    // Badge Styles
    const getBadge = () => {
        switch (minPlan) {
            case 'pro':
                return (
                    <span className="px-2 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-bold rounded-full shadow-lg flex items-center gap-1">
                        <SparklesIcon className="w-3 h-3" /> PRO
                    </span>
                );
            case 'enterprise':
                return (
                    <span className="px-2 py-1 bg-gradient-to-r from-slate-700 to-slate-900 text-white text-[10px] font-bold rounded-full shadow-lg border border-slate-600">
                        ENTERPRISE
                    </span>
                );
            default: // Free
                return (
                    <span className="px-2 py-1 bg-gray-700/80 backdrop-blur text-gray-300 text-[10px] font-bold rounded-full shadow-lg border border-gray-600">
                        FREE
                    </span>
                );
        }
    };

    return (
        <div className="group h-full relative">
            <Link
                href={isLocked ? '/dashboard/billing' : `/templates/${template._id}`}
                className="block h-full"
            >
                <div className={`relative h-full bg-gray-900 border ${isLocked ? 'border-gray-800' : 'border-gray-800 hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-900/10'} rounded-xl overflow-hidden transition-all duration-300`}>

                    {/* Image Container */}
                    <div className="relative h-48 w-full bg-gray-800 overflow-hidden">

                        {/* Top Bar: Badge + Live Preview */}
                        <div className="absolute top-3 left-3 right-3 z-20 flex justify-between items-start pointer-events-none">
                            <div className="pointer-events-auto">
                                {getBadge()}
                            </div>

                            {template.demoDeploymentUrl && (
                                <a
                                    href={template.demoDeploymentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-xs font-medium text-white transition-all hover:scale-105"
                                >
                                    <GlobeAltIcon className="w-3.5 h-3.5 text-blue-400" />
                                    <span>Live Demo</span>
                                </a>
                            )}
                            {!template.demoDeploymentUrl && template.previewImage && (
                                <span className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/60 backdrop-blur-md border border-gray-700/50 rounded-full text-xs font-medium text-gray-400">
                                    <PhotoIcon className="w-3.5 h-3.5" />
                                    <span>Preview Only</span>
                                </span>
                            )}
                        </div>

                        {template.previewImage ? (
                            <img
                                src={template.previewImage}
                                alt={template.name}
                                className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${isLocked ? 'grayscale opacity-40' : 'group-hover:scale-105'}`}
                                loading="lazy"
                            />
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
                        )}

                        {/* Locked Overlay */}
                        {isLocked && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-4 text-center">
                                <div className="w-12 h-12 bg-gray-900/80 backdrop-blur rounded-full flex items-center justify-center mb-2 shadow-xl border border-gray-700">
                                    <LockClosedIcon className="w-6 h-6 text-gray-400" />
                                </div>
                                <span className="text-sm font-bold text-white bg-black/50 px-3 py-1 rounded-full backdrop-blur">
                                    Unlock with {minPlan.charAt(0).toUpperCase() + minPlan.slice(1)}
                                </span>
                            </div>
                        )}

                        {/* Hover Overlay (Unlock or Use) */}
                        {!isLocked && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10">
                                <span className="px-5 py-2 bg-white text-black font-bold rounded-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-xl">
                                    Deploy Template
                                </span>
                            </div>
                        )}
                        {isLocked && (
                            <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10">
                                <span className="px-5 py-2 bg-purple-600 text-white font-bold rounded-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-xl border border-purple-400">
                                    Upgrade to Use
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="p-5 flex flex-col h-[calc(100%-12rem)]">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 capitalize">
                                {template.framework}
                            </span>
                            <div className="flex items-center text-xs text-gray-500">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                {template.deployCount}
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-purple-400 transition-colors truncate">
                            {template.displayName || template.name}
                        </h3>

                        <p className="text-sm text-gray-400 line-clamp-2 mb-4 flex-grow">
                            {template.description}
                        </p>

                        <div className="flex flex-wrap gap-2 mt-auto">
                            {template.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="text-[10px] uppercase font-semibold text-gray-500 bg-gray-800/50 px-2 py-1 rounded">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </Link>
        </div>
    );
}
