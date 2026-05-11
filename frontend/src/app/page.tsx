"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileUp, Image as ImageIcon, History, Shield,
  Zap, ArrowRight, GraduationCap, Star, CheckCircle2,
} from "lucide-react";

const fade = { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.1 } } };

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center bg-[#020617] overflow-hidden">

      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[650px] h-[650px] bg-indigo-600/12 rounded-full blur-[130px] animate-blob" />
        <div className="absolute top-[25%] -right-[15%] w-[550px] h-[550px] bg-violet-600/12 rounded-full blur-[110px] animate-blob-2" />
        <div className="absolute -bottom-[10%] left-[15%] w-[700px] h-[700px] bg-purple-700/8 rounded-full blur-[150px] animate-blob-3" />
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />
      </div>

      {/* Navigation */}
      <nav className="w-full h-16 glass fixed top-0 z-50 px-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <GraduationCap className="text-white w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight">
            Audit<span className="gradient-text">Pro</span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="#features" className="text-sm text-white/55 hover:text-white transition-colors font-medium">Features</Link>
          <Link href="/history" className="text-sm text-white/55 hover:text-white transition-colors font-medium">History</Link>
          <Link href="/auth/signin" className="btn-primary py-2 px-5 text-sm gap-1.5">
            Get Started <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-20 w-full relative z-10">
        <div className="container">
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="flex flex-col items-center text-center max-w-4xl mx-auto"
          >
            <motion.div variants={fade} transition={{ duration: 0.5 }}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-8 tracking-wide">
                <Star size={10} fill="currentColor" />
                Built for NSU Students · 100% Free
              </span>
            </motion.div>

            <motion.h1
              variants={fade}
              transition={{ duration: 0.6 }}
              className="text-6xl md:text-7xl font-extrabold mb-6 leading-[1.06] tracking-tight"
            >
              Know exactly where<br />
              you stand,{" "}
              <span className="gradient-text">always.</span>
            </motion.h1>

            <motion.p
              variants={fade}
              transition={{ duration: 0.6 }}
              className="text-lg text-white/45 mb-10 max-w-[480px] leading-relaxed"
            >
              Upload your NSU transcript — CSV or photo scan. Get your credits, CGPA, and every missing course in seconds.
            </motion.p>

            <motion.div variants={fade} transition={{ duration: 0.5 }} className="flex flex-wrap gap-4 justify-center">
              <Link href="/dashboard" className="btn-primary gap-2 py-3.5 px-8 text-[0.95rem]">
                <FileUp size={17} />
                Run Your Audit
              </Link>
              <Link
                href="#features"
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/18 transition-all font-medium text-sm text-white/65 hover:text-white"
              >
                See How It Works
              </Link>
            </motion.div>
          </motion.div>

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.6 }}
            className="mt-20 grid grid-cols-3 gap-5 max-w-2xl mx-auto"
          >
            {[
              { value: "130+", label: "Credits tracked per audit" },
              { value: "4.00", label: "Max CGPA calculated" },
              { value: "< 3s", label: "Average audit time" },
            ].map(s => (
              <div key={s.label} className="text-center py-5 px-4 glass rounded-2xl">
                <div className="text-3xl font-extrabold gradient-text mb-1">{s.value}</div>
                <div className="text-[11px] text-white/35 font-medium">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Dashboard mockup */}
      <section className="w-full container relative z-10 mb-28">
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="rounded-2xl overflow-hidden border border-white/8 shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
          style={{ background: 'rgba(13, 20, 38, 0.95)' }}
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400/65" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/65" />
              <div className="w-3 h-3 rounded-full bg-green-400/65" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-lg px-4 py-1 text-xs text-white/35 w-64 justify-center font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                audit-pro.nsu.edu/dashboard
              </div>
            </div>
            <div className="w-16" />
          </div>

          {/* Mock content */}
          <div className="p-7 grid md:grid-cols-3 gap-4">
            <div className="p-6 rounded-xl stat-card-green border flex flex-col gap-3">
              <p className="text-[10px] text-white/35 font-bold uppercase tracking-widest">Total Credits</p>
              <p className="text-4xl font-extrabold text-emerald-400">
                115<span className="text-white/25 text-xl font-normal"> /130</span>
              </p>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: '88%' }} />
              </div>
              <p className="text-xs text-white/35">88% complete · 15 credits remaining</p>
            </div>

            <div className="p-6 rounded-xl stat-card-blue border flex flex-col gap-3">
              <p className="text-[10px] text-white/35 font-bold uppercase tracking-widest">Cumulative GPA</p>
              <p className="text-4xl font-extrabold text-indigo-400">3.85</p>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400" style={{ width: '96%' }} />
              </div>
              <p className="text-xs text-indigo-300/60">Excellent Standing</p>
            </div>

            <div className="p-6 rounded-xl stat-card-amber border flex flex-col gap-3">
              <p className="text-[10px] text-white/35 font-bold uppercase tracking-widest">Missing Courses</p>
              <p className="text-4xl font-extrabold text-amber-400">5</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {["CSE499", "CSE465", "EEE101"].map(c => (
                  <span key={c} className="text-[10px] px-2 py-0.5 bg-amber-400/10 text-amber-300 border border-amber-400/20 rounded-md font-mono">{c}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="h-12 bg-gradient-to-t from-[#020617] to-transparent" />
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 container w-full relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-400/60 mb-3">What it does</p>
          <h2 className="text-4xl font-extrabold tracking-tight mb-4">Everything you need to graduate on time</h2>
          <p className="text-white/40 max-w-lg mx-auto text-base leading-relaxed">
            OCR scanning, CGPA calculation, waiver logic — all automated. No spreadsheets. No guesswork.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: <ImageIcon className="text-violet-400" size={20} />,
              bg: "from-violet-500/12 to-transparent border-violet-500/14",
              iconBg: "bg-violet-500/10 border-violet-500/18",
              title: "OCR Scanning",
              desc: "Just snap a photo of your transcript. The AI engine reads every course, grade, and credit — no manual entry needed.",
            },
            {
              icon: <Shield className="text-indigo-400" size={20} />,
              bg: "from-indigo-500/12 to-transparent border-indigo-500/14",
              iconBg: "bg-indigo-500/10 border-indigo-500/18",
              title: "NSU Rule Engine",
              desc: "Waivers, retakes, F-grade policies — all handled automatically against the latest NSU degree requirements.",
            },
            {
              icon: <History className="text-emerald-400" size={20} />,
              bg: "from-emerald-500/12 to-transparent border-emerald-500/14",
              iconBg: "bg-emerald-500/10 border-emerald-500/18",
              title: "Audit History",
              desc: "Every audit saved to the cloud. Track your progress semester by semester with full search and filter.",
            },
          ].map(f => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className={`rounded-2xl p-7 bg-gradient-to-br border transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/40 ${f.bg}`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 border ${f.iconBg}`}>
                {f.icon}
              </div>
              <h3 className="text-lg font-bold mb-2.5">{f.title}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="w-full container py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl p-12 md:p-16 text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12))',
            border: '1px solid rgba(99,102,241,0.18)',
          }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-64 bg-indigo-500/15 blur-[90px] rounded-full pointer-events-none" />
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/45 text-xs font-semibold mb-6">
              <CheckCircle2 size={11} className="text-emerald-400" /> No sign-up required to start
            </span>
            <h2 className="text-4xl font-extrabold mb-4 tracking-tight">Ready to audit your degree?</h2>
            <p className="text-white/45 mb-9 max-w-md mx-auto leading-relaxed">
              Stop guessing what courses you still need. Get a complete picture of your degree status in under a minute.
            </p>
            <Link href="/auth/signin" className="btn-primary py-4 px-10 text-[0.95rem] gap-2 inline-flex">
              <Zap size={17} />
              Start Free Audit
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="w-full mt-10 py-10 border-t border-white/5 text-center relative z-10">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="text-white w-3 h-3" />
          </div>
          <span className="text-sm font-bold">Audit<span className="gradient-text">Pro</span></span>
        </div>
        <p className="text-xs text-white/22">© 2026 Audit Pro — Built for NSU Excellence</p>
      </footer>
    </main>
  );
}
