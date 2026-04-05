"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, ShieldCheck, Mail, Loader2 } from "lucide-react";

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
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="card glass p-8 md:p-10 text-center relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 blur-[80px] rounded-full" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-accent/20 blur-[80px] rounded-full" />

          <div className="flex justify-center mb-6">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 shadow-inner">
              <GraduationCap className="text-primary" size={40} strokeWidth={1.5} />
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome Back</h1>
          <p className="text-sm opacity-50 mb-10 max-w-[280px] mx-auto">
            Securely access your degree audit with your official student account.
          </p>

          <div className="space-y-4 relative z-10">
            {error && (
              <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
                {error}
              </p>
            )}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-4 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-white/90 transition-all active:scale-[0.98] shadow-lg shadow-white/5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin text-black" />
              ) : (
                <img
                  src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png"
                  alt="Google Logo"
                  className="w-6 h-6"
                />
              )}
              {loading ? "Redirecting..." : "Continue with Google"}
            </button>

            <p className="text-[11px] opacity-30 mt-8 px-4">
              By continuing, you agree to the Transcript Auditor Pro Terms of Service and Privacy Policy.
            </p>
          </div>

          <div className="mt-12 flex items-center justify-center gap-6 opacity-30 grayscale contrast-125 border-t border-white/5 pt-8">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
              <ShieldCheck size={14} /> Encrypted
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
              <Mail size={14} /> Cloud Sync
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
