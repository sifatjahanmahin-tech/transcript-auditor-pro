"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FileUp, Image as ImageIcon, History, Shield, Zap, CheckCircle } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center">
      {/* Navigation */}
      <nav className="w-full h-20 glass fixed top-0 z-50 px-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
            <Zap className="text-white w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tighter text-white">AUDIT PRO</span>
        </div>
        <div className="flex items-center gap-8">
          <Link href="#features" className="text-sm font-medium opacity-70 hover:opacity-100">Features</Link>
          <Link href="#features" className="text-sm font-medium opacity-70 hover:opacity-100">Features</Link>
          <Link href="/auth/signin" className="btn-primary">Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-48 pb-20 w-full flex flex-col items-center container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl"
        >
          <span className="px-4 py-2 bg-primary-light text-primary rounded-full text-xs font-bold uppercase tracking-wider mb-6 inline-block border border-primary/20">
            Now for NSU Students
          </span>
          <h1 className="text-6xl md:text-7xl mb-8 leading-tight">
            The Smartest Way to <br />
            <span className="gradient-text">Audit Your Degree.</span>
          </h1>
          <p className="text-xl opacity-60 mb-12 max-w-2xl mx-auto leading-relaxed">
            Upload your official NSU transcript scan or CSV. Our AI-powered engine 
            calculates credits, CGPA, and missing courses in seconds.
          </p>
          <div className="flex flex-wrap gap-6 justify-center">
            <Link href="/dashboard" className="btn-primary gap-2">
              <FileUp size={18} />
              Start Audit Now
            </Link>
            <Link href="#features" className="px-8 py-3 rounded-xl border border-white/10 glass hover:border-white/20 transition-all font-medium flex items-center gap-2">
              Learn More
            </Link>
          </div>
        </motion.div>

        {/* Visual Decoration */}
        <div className="relative mt-24 w-full h-[500px] card glass overflow-hidden rounded-[2rem] shadow-2xl animate-fade-in group">
          <div className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
          <div className="absolute top-0 left-0 w-full p-6 border-b border-white/5 flex items-center justify-between z-20 glass">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="text-xs opacity-50 bg-white/5 px-4 py-1 rounded-full border border-white/5">
              audit-pro.nsu.edu/dashboard
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors pointer-events-none">
                <CheckCircle size={16} className="text-success" />
              </div>
            </div>
          </div>
          
          {/* Mockup Content */}
          <div className="pt-24 px-12 grid grid-cols-1 md:grid-cols-2 gap-12 z-0 relative">
            <div className="p-8 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-4 group-hover:scale-[1.02] transition-transform">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Credit Summary</h3>
                <span className="text-xs py-1 px-3 bg-success/20 text-success rounded-full border border-success/20">Valid</span>
              </div>
              <div className="text-4xl font-bold">115 / 130</div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div className="w-[88%] h-full bg-primary" />
              </div>
              <p className="text-sm opacity-50">15 credits remaining across 5 mandatory courses.</p>
            </div>
            <div className="p-8 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-4 group-hover:scale-[1.02] transition-transform">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Cumulative GPA</h3>
                <span className="text-xs py-1 px-3 bg-primary/20 text-primary rounded-full border border-primary/20">Active</span>
              </div>
              <div className="text-4xl font-bold">3.85</div>
              <p className="text-sm opacity-50">Maintained high academic standing for 4 semesters.</p>
            </div>
          </div>

          {/* Background Glows */}
          <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-primary/20 blur-[120px] -z-10 rounded-full" />
          <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-accent/20 blur-[100px] -z-10 rounded-full" />
          <div className="absolute -bottom-1/4 left-1/2 w-[500px] h-[500px] bg-secondary/10 blur-[150px] -z-10 rounded-full" />
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 container w-full">
        <h2 className="text-4xl text-center mb-16 tracking-tight">Powerful Capabilities</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="card glass">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 border border-primary/20">
              <ImageIcon className="text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-4">OCR Scan</h3>
            <p className="opacity-60">Simple photo/scan upload. No manual entry needed. AI parses all text automatically.</p>
          </div>
          <div className="card glass">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-6 border border-accent/20">
              <Shield className="text-accent" />
            </div>
            <h3 className="text-xl font-bold mb-4">Official NSU Rules</h3>
            <p className="opacity-60">Always up-to-date with department requirements, waiver logic, and retake policies.</p>
          </div>
          <div className="card glass">
            <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center mb-6 border border-success/20">
              <History className="text-success" />
            </div>
            <h3 className="text-xl font-bold mb-4">Audit History</h3>
            <p className="opacity-60">Keep track of your academic progress over time with a cloud-synced audit history.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-12 border-t border-white/5 opacity-50 text-sm flex flex-col items-center">
        <p>© 2026 Audit Pro — Built for NSU Excellence</p>
      </footer>
    </main>
  );
}
