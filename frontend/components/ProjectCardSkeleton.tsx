export default function ProjectCardSkeleton() {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-pulse">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <div className="bg-gray-800 h-10 w-10 rounded-lg"></div>
                    <div>
                        <div className="bg-gray-800 h-5 w-32 rounded mb-2"></div>
                        <div className="bg-gray-800 h-4 w-24 rounded"></div>
                    </div>
                </div>
                <div className="bg-gray-800 h-5 w-5 rounded"></div>
            </div>
            <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="bg-gray-800 h-4 w-20 rounded"></div>
                        <div className="bg-gray-800 h-4 w-12 rounded"></div>
                    </div>
                    <div className="bg-gray-800 h-4 w-24 rounded"></div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                    <div className="bg-gray-800 h-6 w-16 rounded-full"></div>
                    <div className="bg-gray-800 h-4 w-16 rounded"></div>
                </div>
            </div>
        </div>
    );
}
