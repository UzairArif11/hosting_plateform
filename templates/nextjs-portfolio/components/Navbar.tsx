import Link from 'next/link';
import { Ghost, Layers, Github } from 'lucide-react';

export default function Navbar() {
    return (
        <nav className="border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
                    <Layers className="w-6 h-6" />
                    <span>SmartPortfolio</span>
                </Link>

                <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
                    <Link href="#features" className="hover:text-primary transition-colors">Features</Link>
                    <Link href="#showcase" className="hover:text-primary transition-colors">Showcase</Link>
                    <Link href="#pricing" className="hover:text-primary transition-colors">Pricing</Link>
                </div>

                <div className="flex items-center gap-4">
                    <a href="https://github.com" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-900 transition-colors">
                        <Github className="w-5 h-5" />
                    </a>
                    <button className="bg-primary text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-blue-600 transition-colors">
                        Get Started
                    </button>
                </div>
            </div>
        </nav>
    );
}
