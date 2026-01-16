import Link from 'next/link';
import Image from 'next/image';

interface TemplateProps {
    template: {
        _id: string;
        name: string;
        description: string;
        framework: string;
        previewImage: string;
        category: string;
        tags: string[];
        isPremium: boolean;
        deployCount: number;
    };
}

export default function TemplateCard({ template }: TemplateProps) {
    return (
        <Link href={`/templates/${template._id}`} className="group block h-full">
            <div className="relative h-full bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-900/10 transition-all duration-300">
                {/* Image Container */}
                <div className="relative h-48 w-full bg-gray-800 overflow-hidden">
                    {/* Premium Badge */}
                    {template.isPremium && (
                        <div className="absolute top-3 right-3 z-10 px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold rounded-full shadow-lg">
                            PREMIUM
                        </div>
                    )}

                    {/* Fallback pattern if no image, though we expect one */}
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-gray-700">
                        <svg className="w-12 h-12 opacity-20" fill="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    </div>

                    {template.previewImage && (
                        <img
                            src={template.previewImage}
                            alt={template.name}
                            className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                        />
                    )}

                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <span className="px-5 py-2 bg-white text-black font-medium rounded-full transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                            Use Template
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col h-[calc(100%-12rem)]">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            {/* Framework Icon Placeholder - could map framework string to icon */}
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 capitalize">
                                {template.framework}
                            </span>
                        </div>
                        <div className="flex items-center text-xs text-gray-500">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                            {template.deployCount}
                        </div>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
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
    );
}
