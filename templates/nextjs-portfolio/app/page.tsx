import Link from 'next/link';

export default function Home() {
    return (
        <div className="flex flex-col min-h-screen">
            <section className="py-24 px-4 text-center bg-gradient-to-b from-blue-50 to-white">
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-6">
                    Showcase Your Work <br />
                    <span className="text-primary">Beautifully</span>
                </h1>
                <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10">
                    A high-performance portfolio template built for developers and designers.
                    Includes modern animations, responsive layout, and SEO optimization.
                </p>
                <div className="flex items-center justify-center gap-4">
                    <Link href="/projects" className="bg-slate-900 text-white px-8 py-3 rounded-full font-medium hover:bg-slate-800 transition-all">
                        View Projects
                    </Link>
                    <Link href="/contact" className="bg-white text-slate-900 border border-slate-200 px-8 py-3 rounded-full font-medium hover:bg-slate-50 transition-all">
                        Contact Me
                    </Link>
                </div>
            </section>

            <section className="py-24 px-4 container mx-auto" id="features">
                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        { title: "Fast Performance", desc: "Built on Next.js 14 for incredible speed and SEO." },
                        { title: "Modern Design", desc: "Clean aesthetic using Tailwind CSS and Framer Motion." },
                        { title: "CMS Ready", desc: "Easily connect to your favorite headless CMS." }
                    ].map((feature, i) => (
                        <div key={i} className="p-8 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
                            <h3 className="text-xl font-bold mb-3 text-slate-900">{feature.title}</h3>
                            <p className="text-slate-600">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
