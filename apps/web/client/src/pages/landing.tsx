import { ChevronRight } from "lucide-react";
import { Link } from "wouter";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Background effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-conic from-cyan-500/20 via-transparent to-transparent opacity-30 blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-conic from-lime-500/20 via-transparent to-transparent opacity-30 blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-lime-400 rounded-lg flex items-center justify-center font-bold text-sm">
            PH
          </div>
          <span className="text-xl font-bold">PymeHub</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="hover:text-cyan-400 transition">
            Features
          </a>
          <a href="#capabilities" className="hover:text-cyan-400 transition">
            Capabilities
          </a>
          <a href="#pricing" className="hover:text-cyan-400 transition">
            Pricing
          </a>
          <button className="px-6 py-2 bg-gradient-to-r from-cyan-400 to-lime-400 text-slate-950 rounded-full font-semibold hover:shadow-lg hover:shadow-cyan-400/50 transition">
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 text-center">
        {/* Badge */}
        <div className="inline-block mb-6">
          <div className="px-4 py-2 rounded-full border border-cyan-500/50 bg-cyan-500/10 backdrop-blur-sm">
            <span className="text-sm text-cyan-300">
              ✨ Introducing PymeHub 2.0
            </span>
          </div>
        </div>

        {/* Main Heading */}
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-300 to-lime-300">
          CRM that grows with your business.
        </h1>

        {/* Subheading */}
        <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 to-lime-300 italic font-light">
            Intelligence that converts.
          </span>
          <br className="hidden md:block" />
          Manage conversations, invoices, and pipelines in one unified platform.
        </p>

        {/* Description */}
        <p className="text-slate-400 max-w-2xl mx-auto mb-10 text-lg">
          PymeHub is the all-in-one business management platform built for SMEs in Latin America.
          Deploy in minutes, scale with confidence, integrate with your favorite tools.
        </p>

        {/* CTA Button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button className="px-8 py-3 bg-gradient-to-r from-cyan-400 to-lime-400 text-slate-950 rounded-full font-semibold flex items-center gap-2 hover:shadow-xl hover:shadow-cyan-400/50 transition group">
            Start Building Now
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </button>
          <p className="text-slate-500 text-sm">✓ No credit card required</p>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-800/50 to-transparent backdrop-blur-sm hover:border-cyan-500/50 transition group">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center mb-4 group-hover:shadow-lg group-hover:shadow-cyan-400/50 transition">
              <svg className="w-6 h-6 text-slate-950" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" />
                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h6v-1a1 1 0 011-1h2a1 1 0 011 1v1h2a1 1 0 011 1v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6zM14 15a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Conversation Management</h3>
            <p className="text-slate-400 text-sm">
              Unified inbox for email, WhatsApp and more. Never miss a customer message.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-800/50 to-transparent backdrop-blur-sm hover:border-lime-500/50 transition group">
            <div className="w-12 h-12 bg-gradient-to-br from-lime-400 to-lime-600 rounded-lg flex items-center justify-center mb-4 group-hover:shadow-lg group-hover:shadow-lime-400/50 transition">
              <svg className="w-6 h-6 text-slate-950" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Invoice & Billing</h3>
            <p className="text-slate-400 text-sm">
              Send invoices, track payments, and automate reminders. Integrate with local tax systems.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-800/50 to-transparent backdrop-blur-sm hover:border-purple-500/50 transition group">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center mb-4 group-hover:shadow-lg group-hover:shadow-purple-400/50 transition">
              <svg className="w-6 h-6 text-slate-950" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">AI-Powered Insights</h3>
            <p className="text-slate-400 text-sm">
              Get monthly insights in Spanish. Identify trends, optimize workflows, grow faster.
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid md:grid-cols-3 gap-8 mt-20 pt-16 border-t border-slate-800">
          <div className="text-center">
            <div className="text-4xl font-bold text-cyan-400 mb-2">500+</div>
            <p className="text-slate-400">SMEs in Latin America</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-lime-400 mb-2">10M+</div>
            <p className="text-slate-400">Messages managed</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-400 mb-2">99.9%</div>
            <p className="text-slate-400">Uptime SLA</p>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="relative z-10 mt-20 text-center pb-20">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">
          Ready to transform your business?
        </h2>
        <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
          Join hundreds of businesses already using PymeHub to streamline their operations.
        </p>
        <Link href="/login">
          <a className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-400 to-lime-400 text-slate-950 rounded-full font-semibold hover:shadow-xl hover:shadow-cyan-400/50 transition group">
            Get Started Free
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </a>
        </Link>
      </div>

      {/* Brand Trust Section */}
      <div className="relative z-10 border-t border-slate-800 mt-20 py-16">
        <p className="text-center text-slate-500 text-sm mb-8 uppercase tracking-wide">
          Trusted by innovative teams across Latin America
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 px-6">
          <div className="text-slate-600 font-semibold">🏢 Startups</div>
          <div className="text-slate-600 font-semibold">📊 Agencies</div>
          <div className="text-slate-600 font-semibold">🛍️ E-commerce</div>
          <div className="text-slate-600 font-semibold">🏪 Retailers</div>
          <div className="text-slate-600 font-semibold">⚙️ Manufacturers</div>
        </div>
      </div>
    </div>
  );
}
