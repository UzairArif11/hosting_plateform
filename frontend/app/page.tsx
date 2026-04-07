'use client';

import { useState } from 'react';

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          background: #000;
          color: #fff;
          min-height: 100vh;
          overflow-x: hidden;
        }

        .page-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        /* Animated Background */
        .bg-orbs {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 0;
          overflow: hidden;
        }

        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.15;
          animation: float 20s ease-in-out infinite;
        }

        .orb-1 {
          width: 500px;
          height: 500px;
          background: linear-gradient(135deg, #9333ea, #ec4899);
          top: -100px;
          left: -100px;
          animation-delay: 0s;
        }

        .orb-2 {
          width: 400px;
          height: 400px;
          background: linear-gradient(135deg, #ec4899, #f97316);
          top: -50px;
          right: -50px;
          animation-delay: 7s;
        }

        .orb-3 {
          width: 600px;
          height: 600px;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          bottom: -150px;
          left: 50%;
          transform: translateX(-50%);
          animation-delay: 14s;
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(50px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-50px, 50px) scale(0.9);
          }
        }

        .grid-pattern {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 50px 50px;
          z-index: 1;
        }

        .content {
          position: relative;
          z-index: 10;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        /* Navbar */
        .navbar {
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding: 1.25rem 2rem;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .navbar-content {
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo-container {
          display: flex;
          align-items: center;
          gap: 1rem;
          cursor: pointer;
          transition: transform 0.3s ease;
        }

        .logo-container:hover {
          transform: scale(1.05);
        }

        .logo-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #9333ea, #ec4899);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 30px rgba(147, 51, 234, 0.5);
          position: relative;
        }

        .logo-icon::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 12px;
          padding: 2px;
          background: linear-gradient(135deg, #9333ea, #ec4899);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0.5;
        }

        .logo-text h1 {
          font-size: 1.5rem;
          font-weight: 700;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0;
        }

        .logo-text p {
          font-size: 0.75rem;
          color: #9ca3af;
          margin: 0;
        }

        .nav-links {
          display: flex;
          gap: 2rem;
          align-items: center;
        }

        .nav-link {
          color: #d1d5db;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.3s ease;
          position: relative;
        }

        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 2px;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          transition: width 0.3s ease;
        }

        .nav-link:hover {
          color: #fff;
        }

        .nav-link:hover::after {
          width: 100%;
        }

        .cta-button {
          padding: 0.75rem 2rem;
          background: linear-gradient(135deg, #9333ea, #ec4899);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(147, 51, 234, 0.4);
          position: relative;
          overflow: hidden;
        }

        .cta-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.5s ease;
        }

        .cta-button:hover::before {
          left: 100%;
        }

        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 30px rgba(147, 51, 234, 0.6);
        }

        /* Hero Section */
        .hero {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          text-align: center;
        }

        .hero-content {
          max-width: 1000px;
          animation: fadeInUp 1s ease;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 9999px;
          padding: 0.75rem 1.5rem;
          margin-bottom: 2.5rem;
          font-size: 0.875rem;
          backdrop-filter: blur(10px);
          animation: fadeInUp 1s ease 0.2s both;
        }

        .badge-icon {
          color: #a855f7;
        }

        .badge-highlight {
          background: linear-gradient(135deg, #a855f7, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 700;
        }

        .main-heading {
          font-size: 5rem;
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 2rem;
          animation: fadeInUp 1s ease 0.4s both;
        }

        .gradient-text {
          background: linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f97316 100%);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradientShift 4s ease infinite;
        }

        @keyframes gradientShift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        .description {
          font-size: 1.375rem;
          color: #9ca3af;
          margin-bottom: 3rem;
          line-height: 1.7;
          max-width: 800px;
          margin-left: auto;
          margin-right: auto;
          animation: fadeInUp 1s ease 0.6s both;
        }

        .buttons {
          display: flex;
          gap: 1.25rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 2.5rem;
          animation: fadeInUp 1s ease 0.8s both;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 1rem;
          padding: 1.125rem 2.5rem;
          border-radius: 14px;
          font-size: 1.125rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
          text-decoration: none;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .btn::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          transform: translate(-50%, -50%);
          transition: width 0.6s ease, height 0.6s ease;
        }

        .btn:hover::before {
          width: 300px;
          height: 300px;
        }

        .btn-github {
          background: #1f2937;
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .btn-github:hover {
          background: #374151;
          transform: translateY(-3px);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
        }

        .btn-google {
          background: #fff;
          color: #1f2937;
          box-shadow: 0 4px 20px rgba(255, 255, 255, 0.2);
        }

        .btn-google:hover {
          background: #f9fafb;
          transform: translateY(-3px);
          box-shadow: 0 8px 30px rgba(255, 255, 255, 0.3);
        }

        .btn svg {
          position: relative;
          z-index: 1;
        }

        .btn span {
          position: relative;
          z-index: 1;
        }

        .trust-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          color: #6b7280;
          font-size: 0.875rem;
          animation: fadeInUp 1s ease 1s both;
        }

        .check-icon {
          color: #10b981;
        }

        /* Features Section */
        .features {
          background: rgba(17, 24, 39, 0.5);
          backdrop-filter: blur(10px);
          padding: 6rem 2rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .features-grid {
          max-width: 1280px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 2rem;
        }

        .feature-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 2.5rem;
          transition: all 0.4s ease;
          position: relative;
          overflow: hidden;
        }

        .feature-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(147, 51, 234, 0.1), rgba(236, 72, 153, 0.1));
          opacity: 0;
          transition: opacity 0.4s ease;
        }

        .feature-card:hover::before {
          opacity: 1;
        }

        .feature-card:hover {
          transform: translateY(-8px);
          border-color: rgba(147, 51, 234, 0.3);
          box-shadow: 0 20px 40px rgba(147, 51, 234, 0.2);
        }

        .feature-icon {
          font-size: 3rem;
          margin-bottom: 1.5rem;
          display: block;
          position: relative;
          z-index: 1;
        }

        .feature-card h3 {
          font-size: 1.5rem;
          margin-bottom: 1rem;
          position: relative;
          z-index: 1;
        }

        .feature-card p {
          color: #9ca3af;
          line-height: 1.7;
          position: relative;
          z-index: 1;
        }

        /* Stats Section */
        .stats {
          padding: 6rem 2rem;
        }

        .stats-grid {
          max-width: 1280px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 4rem;
          text-align: center;
        }

        .stat-value {
          font-size: 4.5rem;
          font-weight: 800;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 1rem;
          transition: transform 0.3s ease;
        }

        .stat-value:hover {
          transform: scale(1.1);
        }

        .stat-label {
          color: #9ca3af;
          font-size: 1.25rem;
          font-weight: 500;
        }

        /* Footer */
        footer {
          background: rgba(17, 24, 39, 0.5);
          backdrop-filter: blur(10px);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding: 3rem 2rem;
          text-align: center;
        }

        footer p {
          color: #9ca3af;
          margin: 0.5rem 0;
        }

        .heart {
          color: #ef4444;
          animation: heartbeat 1.5s ease infinite;
        }

        @keyframes heartbeat {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }

        /* Mobile Nav */
        .mobile-nav {
          display: none;
          background: rgba(17, 24, 39, 0.95);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding: 1rem 2rem;
          position: sticky;
          top: 73px;
          z-index: 99;
        }

        .mobile-nav a {
          display: block;
          color: #d1d5db;
          text-decoration: none;
          padding: 0.75rem 0;
          font-weight: 500;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          transition: color 0.3s ease;
        }

        .mobile-nav a:last-child {
          border-bottom: none;
        }

        .mobile-nav a:hover {
          color: #fff;
        }

        .mobile-nav .mobile-cta {
          display: block;
          text-align: center;
          margin-top: 0.75rem;
          padding: 0.75rem;
          background: linear-gradient(135deg, #9333ea, #ec4899);
          border-radius: 12px;
          color: #fff;
          font-weight: 600;
          text-decoration: none;
        }

        .hamburger {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem;
        }

        .hamburger svg {
          stroke: #d1d5db;
        }

        /* Footer links responsive */
        .footer-links {
          display: flex;
          justify-content: center;
          gap: 2rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .main-heading {
            font-size: 3rem;
          }
          .nav-links {
            display: none;
          }
          .hamburger {
            display: block;
          }
          .mobile-nav.open {
            display: block;
          }
          .buttons {
            flex-direction: column;
            width: 100%;
          }
          .btn {
            width: 100%;
            justify-content: center;
          }
          .footer-links {
            gap: 1rem;
            font-size: 0.8rem;
          }
        }
      `}} />

      <div className="page-wrapper">
        <div className="bg-orbs">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>
        <div className="grid-pattern"></div>

        <div className="content">
          {/* Navbar */}
          <nav className="navbar">
            <div className="navbar-content">
              <div className="logo-container">
                <div className="logo-icon">
                  <svg width="28" height="28" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="logo-text">
                  <h1>DeployHub</h1>
                  <p>Cloud Platform</p>
                </div>
              </div>
              <div className="nav-links">
                <a href="#features" className="nav-link">Features</a>
                <a href="/pricing" className="nav-link">Pricing</a>
                <a href="/terms" className="nav-link">Terms</a>
                <a href="/privacy" className="nav-link">Privacy</a>
                <a href="/refund" className="nav-link">Refund</a>
                <a href="/login" className="cta-button" style={{ textDecoration: 'none' }}>Get Started</a>
              </div>
              <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
                <svg width="28" height="28" fill="none" strokeWidth="2" viewBox="0 0 24 24">
                  {menuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </nav>
          {/* Mobile Navigation */}
          <div className={`mobile-nav ${menuOpen ? 'open' : ''}`}>
            <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="/pricing">Pricing</a>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/refund">Refund</a>
            <a href="/login" className="mobile-cta">Get Started</a>
          </div>

          {/* Hero */}
          <section className="hero">
            <div className="hero-content">
              <div className="badge">
                <svg className="badge-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span>Introducing DeployHub v2.0</span>
                <span className="badge-highlight">Now Live →</span>
              </div>

              <h1 className="main-heading">
                Deploy with<br />
                <span className="gradient-text">Confidence</span>
              </h1>

              <p className="description">
                The ultimate platform for developers. Deploy your projects with GitHub integration,
                real-time builds, and smart resource allocation powered by Oracle Cloud.
              </p>

              <div className="buttons">
                <a href={`${process.env.NEXT_PUBLIC_API_URL || 'https://foodpanda.site'}/api/auth/github`} className="btn btn-github">
                  <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span>Continue with GitHub</span>
                </a>

                <a href={`${process.env.NEXT_PUBLIC_API_URL || 'https://foodpanda.site'}/api/auth/google`} className="btn btn-google">
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Continue with Google</span>
                </a>
              </div>

              <div className="trust-badge">
                <svg className="check-icon" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Start your 30-day free trial. No credit card required.</span>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="features" id="features">
            <div className="features-grid">
              <div className="feature-card">
                <span className="feature-icon">🚀</span>
                <h3>Deploy in Seconds</h3>
                <p>Connect your GitHub repo and deploy automatically with every push. Zero configuration required.</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">⚡</span>
                <h3>Lightning Fast</h3>
                <p>Optimized builds with framework auto-detection and intelligent caching for maximum speed.</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">💻</span>
                <h3>Smart Resources</h3>
                <p>Dynamic resource allocation powered by Oracle Cloud Infrastructure for optimal performance.</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">💰</span>
                <h3>Flexible Pricing</h3>
                <p>Start free, pay as you grow. Multi-currency support with transparent pricing.</p>
              </div>
            </div>
          </section>

          {/* Stats */}
          <section className="stats">
            <div className="stats-grid">
              <div>
                <div className="stat-value">99.9%</div>
                <div className="stat-label">Uptime Guarantee</div>
              </div>
              <div>
                <div className="stat-value">&lt;30s</div>
                <div className="stat-label">Average Deploy Time</div>
              </div>
              <div>
                <div className="stat-value">24/7</div>
                <div className="stat-label">Expert Support</div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer>
            <div className="footer-links">
              <a href="/pricing" className="nav-link" style={{ fontSize: '0.875rem' }}>Pricing</a>
              <a href="/terms" className="nav-link" style={{ fontSize: '0.875rem' }}>Terms of Service</a>
              <a href="/privacy" className="nav-link" style={{ fontSize: '0.875rem' }}>Privacy Policy</a>
              <a href="/refund" className="nav-link" style={{ fontSize: '0.875rem' }}>Refund Policy</a>
            </div>
            <p>&copy; 2025 DeployHub. Built with <span className="heart">&hearts;</span> for developers.</p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>Powered by Oracle Cloud Infrastructure</p>
          </footer>
        </div>
      </div>
    </>
  );
}
