"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, ShieldCheck, Database, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SignInPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/google/login`);
      if (!res.ok) throw new Error("Failed to get sign-in URL");
      const data = await res.json();
      window.location.href = data.auth_url;
    } catch {
      setError("Could not connect to the server. Is the backend running?");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#020617]">

      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-[30%] -left-[20%] w-[700px] h-[700px] bg-indigo-600/10 rounded-full blur-[160px] animate-blob" />
        <div className="absolute -bottom-[20%] -right-[15%] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[130px] animate-blob-2" />
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm relative z-10"
      >
        <div
          className="rounded-3xl p-8 relative overflow-hidden"
          style={{
            background: 'rgba(13, 20, 40, 0.92)',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(99,102,241,0.08)',
          }}
        >
          {/* Top glow line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-44 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mb-5 shadow-2xl shadow-indigo-500/35">
              <GraduationCap className="text-white" size={30} strokeWidth={1.5} />
            </div>
            <h1 className="text-[1.6rem] font-bold tracking-tight mb-2">Welcome to Audit Pro</h1>
            <p className="text-sm text-white/38 text-center leading-relaxed max-w-[200px]">
              Sign in with your student Google account to continue
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Google sign-in */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3.5 bg-white text-gray-900 font-semibold rounded-xl flex items-center justify-center gap-3 hover:bg-gray-50 active:scale-[0.98] transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed text-sm"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin text-gray-500" />
            ) : (
              <Image
                src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png"
                alt="Google"
                width={20}
                height={20}
              />
            )}
            {loading ? "Redirecting..." : "Continue with Google"}
          </button>

          {/* Trust indicators */}
          <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-center gap-6">
            {[
              { icon: <ShieldCheck size={12} />, text: "End-to-end encrypted" },
              { icon: <Database size={12} />, text: "Cloud synced" },
            ].map(f => (
              <div key={f.text} className="flex items-center gap-1.5 text-[10px] text-white/22 font-medium">
                {f.icon} {f.text}
              </div>
            ))}
          </div>

          <p className="text-[10px] text-white/18 text-center mt-4 leading-relaxed">
            By continuing you agree to our Terms of Service and Privacy Policy
          </p>
        </div>

        <p className="text-center mt-5 text-xs text-white/28">
          <Link href="/" className="hover:text-white/55 transition-colors">← Back to home</Link>
        </p>
      </motion.div>
    </div>
  );
}
