"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, History, Settings, LogOut, Bell, Search, User as UserIcon,
  ChevronRight, TrendingUp, AlertCircle, CheckCircle2, Clock, Loader2,
  X, BookOpen, Award, Target, GraduationCap, BarChart3,
} from "lucide-react";
import FileUpload from "@/components/FileUpload";
import Link from "next/link";
import Image from "next/image";
import api, { clearToken, getToken } from "@/lib/api";
import { useRouter } from "next/navigation";

interface Program {
  id: string;
  name: string;
  total_required_credits: number;
}

interface CreditBreakdownItem {
  course_code: string;
  course_name: string;
  grade: string | null;
  credits: number;
  semester: string;
  status: string;
  counted: boolean;
}

interface AuditResult {
  id: string;
  program_name: string;
  original_filename: string | null;
  total_valid_credits: number;
  cgpa: number;
  on_probation: boolean;
  credit_breakdown: CreditBreakdownItem[] | null;
  missing_courses: Record<string, string[]> | null;
  completed_courses: string[] | null;
  created_at: string;
  input_type: string;
}

interface HistoryItem {
  id: string;
  original_filename: string | null;
  created_at: string;
  cgpa: number;
}

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  created_at: string;
}

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16 } },
};

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [latestAudit, setLatestAudit] = useState<AuditResult | null>(null);
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);

  const fetchDashboardData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [histRes, userRes] = await Promise.allSettled([
        api.get("/api/history", { params: { page: 1, page_size: 5 } }),
        api.get("/api/auth/me"),
      ]);
      if (histRes.status === "fulfilled") {
        const items: AuditResult[] = histRes.value.data.items;
        if (items.length > 0) {
          setLatestAudit(items[0]);
          setRecentHistory(items.slice(0, 4));
        }
      }
      if (userRes.status === "fulfilled") {
        setUser(userRes.value.data);
      }
    } catch {
      if (!getToken()) router.push("/auth/signin");
    } finally {
      setLoadingData(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.push("/auth/signin"); return; }
    fetchDashboardData();
    api.get("/api/programs").then(res => setPrograms(res.data.programs ?? [])).catch(() => {});
  }, [fetchDashboardData, router]);

  const handleUpload = async (file: File, type: "csv" | "image", programName: string) => {
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("program_name", programName);
    formData.append("waived_courses", "");
    try {
      const endpoint = type === "csv" ? "/api/audit/csv" : "/api/audit/image";
      await api.post(endpoint, formData, { headers: { "Content-Type": "multipart/form-data" } });
      setUploadSuccess(true);
      await fetchDashboardData();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setUploadError(typeof detail === "string" ? detail : "Audit failed. Please check your file and try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = () => { clearToken(); router.push("/auth/signin"); };

  const missingCount = latestAudit?.missing_courses
    ? Object.values(latestAudit.missing_courses).reduce((s, a) => s + a.length, 0)
    : null;

  const requiredCredits = latestAudit
    ? (programs.find(p => p.name === latestAudit.program_name)?.total_required_credits ?? 130)
    : 130;

  const creditPercent = latestAudit
    ? Math.min(Math.round((latestAudit.total_valid_credits / requiredCredits) * 100), 100)
    : null;

  const filteredBreakdown = latestAudit?.credit_breakdown?.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.course_code.toLowerCase().includes(q) ||
      item.course_name.toLowerCase().includes(q) ||
      (item.grade ?? "").toLowerCase().includes(q) ||
      item.semester.toLowerCase().includes(q)
    );
  }) ?? [];

  const navItems = [
    { id: "overview", icon: <LayoutDashboard size={16} />, label: "Overview" },
    { id: "progress", icon: <BarChart3 size={16} />, label: "Progress" },
    { id: "settings", icon: <Settings size={16} />, label: "Settings" },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)" }}>

      {/* ── Sidebar ── */}
      <aside
        className="w-60 shrink-0 flex flex-col sticky top-0 h-screen z-30"
        style={{
          background: "var(--sidebar-bg)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-16 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 12px rgba(99,102,241,0.4)" }}>
            <GraduationCap size={15} className="text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight">
            Audit<span className="gradient-text">Pro</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
          <p className="section-label px-2 py-2 mt-1">Navigation</p>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`nav-item ${activeTab === item.id ? "active" : ""}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <Link href="/history" className="nav-item mt-0.5">
            <History size={16} />
            Audit History
          </Link>

          <div className="my-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} />

          {/* Credit Progress (only when audit data exists) */}
          {latestAudit && creditPercent !== null && (
            <div className="mx-1 my-1 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex justify-between items-center mb-2">
                <p className="section-label">Credit Progress</p>
                <span className="text-xs font-bold tabular-nums" style={{ color: "#6366f1" }}>{creditPercent}%</span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${creditPercent}%`,
                    background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                  }}
                />
              </div>
              <p className="text-xs mt-1.5 tabular-nums" style={{ color: "rgba(255,255,255,0.35)" }}>
                {latestAudit.total_valid_credits} / {requiredCredits} credits
              </p>
            </div>
          )}
        </nav>

        {/* Sign Out */}
        <div className="p-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <button
            onClick={handleSignOut}
            className="nav-item w-full"
            style={{ color: "rgba(248,113,113,0.7)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#f87171"; (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.08)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(248,113,113,0.7)"; (e.currentTarget as HTMLElement).style.background = ""; }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header
          className="h-16 px-6 flex items-center justify-between shrink-0 sticky top-0 z-20"
          style={{ background: "rgba(6,14,29,0.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="flex items-center gap-2.5 rounded-xl px-3.5 py-2 w-72"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <Search size={14} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search courses, audits..."
              className="bg-transparent border-none outline-none text-sm w-full"
              style={{ color: "#fff", caretColor: "#6366f1" }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="transition-opacity shrink-0"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              className="p-2 rounded-xl transition-all"
              style={{ color: "rgba(255,255,255,0.45)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}
            >
              <Bell size={17} />
            </button>

            <div
              className="flex items-center gap-2.5 pl-3"
              style={{ borderLeft: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold leading-tight">{user?.name ?? "My Account"}</p>
                <p
                  className="text-xs leading-tight truncate max-w-[130px]"
                  style={{ color: "rgba(255,255,255,0.38)" }}
                >
                  {user?.email ?? ""}
                </p>
              </div>
              {user?.picture ? (
                <Image
                  src={user.picture}
                  alt="Profile"
                  width={36}
                  height={36}
                  className="rounded-xl object-cover"
                  style={{ boxShadow: "0 0 0 2px rgba(99,102,241,0.3)" }}
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                >
                  <UserIcon size={16} className="text-white" />
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <AnimatePresence mode="wait">
            {loadingData ? (
              <motion.div key="loading" variants={pageVariants} initial="initial" animate="animate" exit="exit"
                className="flex flex-col items-center justify-center py-40 gap-4">
                <Loader2 className="animate-spin" size={32} style={{ color: "var(--primary)" }} />
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.38)" }}>Loading your data...</p>
              </motion.div>
            ) : activeTab === "overview" ? (
              <motion.div key="overview" variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <OverviewTab
                  latestAudit={latestAudit}
                  recentHistory={recentHistory}
                  uploading={uploading}
                  uploadError={uploadError}
                  uploadSuccess={uploadSuccess}
                  onUpload={handleUpload}
                  searchQuery={searchQuery}
                  filteredBreakdown={filteredBreakdown}
                  creditPercent={creditPercent}
                  missingCount={missingCount}
                  requiredCredits={requiredCredits}
                />
              </motion.div>
            ) : activeTab === "progress" ? (
              <motion.div key="progress" variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <ProgressTab
                  latestAudit={latestAudit}
                  creditPercent={creditPercent}
                  requiredCredits={requiredCredits}
                />
              </motion.div>
            ) : (
              <motion.div key="settings" variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <SettingsTab user={user} latestAudit={latestAudit} onSignOut={handleSignOut} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  latestAudit, recentHistory, uploading, uploadError, uploadSuccess,
  onUpload, searchQuery, filteredBreakdown, creditPercent, missingCount, requiredCredits,
}: {
  latestAudit: AuditResult | null;
  recentHistory: HistoryItem[];
  uploading: boolean;
  uploadError: string | null;
  uploadSuccess: boolean;
  onUpload: (f: File, t: "csv" | "image", p: string) => void;
  searchQuery: string;
  filteredBreakdown: CreditBreakdownItem[];
  creditPercent: number | null;
  missingCount: number | null;
  requiredCredits: number;
}) {
  return (
    <div className="space-y-6 max-w-[1100px]">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {latestAudit ? "Degree Overview" : "Dashboard"}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>
            {latestAudit
              ? `${latestAudit.program_name} · Last audited ${new Date(latestAudit.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
              : "Upload a transcript to get started."}
          </p>
        </div>
        {latestAudit?.on_probation && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b" }}>
            <AlertCircle size={12} /> Academic Probation
          </span>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Total Credits"
          value={latestAudit ? `${latestAudit.total_valid_credits}` : null}
          suffix={latestAudit ? ` / ${requiredCredits}` : undefined}
          sub={creditPercent !== null ? `${creditPercent}% of degree complete` : "Upload a transcript to begin"}
          icon={<CheckCircle2 size={18} style={{ color: "#10b981" }} />}
          progress={creditPercent ?? undefined}
          progressColor="from-emerald-500 to-teal-400"
          variant="green"
        />
        <StatCard
          title="Cumulative GPA"
          value={latestAudit ? latestAudit.cgpa.toFixed(2) : null}
          sub={latestAudit
            ? latestAudit.cgpa >= 3.5 ? "Excellent Standing"
              : latestAudit.cgpa >= 3.0 ? "Very Good Standing"
              : latestAudit.cgpa >= 2.5 ? "Good Standing"
              : "Needs Improvement"
            : "Upload a transcript to begin"}
          icon={<TrendingUp size={18} style={{ color: "#818cf8" }} />}
          progress={latestAudit ? Math.round((latestAudit.cgpa / 4.0) * 100) : undefined}
          progressColor="from-indigo-500 to-violet-400"
          variant="blue"
        />
        <StatCard
          title="Remaining Courses"
          value={missingCount !== null ? String(missingCount) : null}
          sub={latestAudit ? `courses still required for graduation` : "Upload a transcript to begin"}
          icon={<AlertCircle size={18} style={{ color: "#f59e0b" }} />}
          variant="amber"
        />
      </div>

      {/* Main content row */}
      <div className="flex gap-5">
        {/* Left: Upload + Breakdown */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Upload Card */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <h2 className="text-sm font-bold">New Degree Audit</h2>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
                Upload a CSV export or scanned image of your transcript
              </p>
            </div>

            <div className="p-5">
              <AnimatePresence>
                {uploadSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2.5 rounded-xl px-4 py-3 mb-4 text-sm font-medium"
                    style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#34d399" }}
                  >
                    <CheckCircle2 size={16} />
                    Audit completed successfully! Your results are updated above.
                  </motion.div>
                )}
                {uploadError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2.5 rounded-xl px-4 py-3 mb-4 text-sm"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
                  >
                    <AlertCircle size={16} className="shrink-0" />
                    {uploadError}
                  </motion.div>
                )}
              </AnimatePresence>
              <FileUpload onUpload={onUpload} isLoading={uploading} />
            </div>
          </div>

          {/* Course Breakdown */}
          {latestAudit?.credit_breakdown && latestAudit.credit_breakdown.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex items-center gap-2">
                  <BookOpen size={15} style={{ color: "var(--primary)" }} />
                  <h2 className="text-sm font-bold">
                    Credit Breakdown
                    {searchQuery && (
                      <span className="ml-2 text-xs font-normal" style={{ color: "rgba(255,255,255,0.4)" }}>
                        ({filteredBreakdown.length} results)
                      </span>
                    )}
                  </h2>
                </div>
                <Link href="/history"
                  className="flex items-center gap-1 text-xs font-semibold transition-colors"
                  style={{ color: "var(--primary)" }}>
                  Full History <ChevronRight size={12} />
                </Link>
              </div>
              <div className="p-2 max-h-64 overflow-y-auto">
                {filteredBreakdown.length === 0 ? (
                  <p className="text-center text-sm py-8" style={{ color: "rgba(255,255,255,0.35)" }}>
                    No courses match your search.
                  </p>
                ) : (
                  filteredBreakdown.slice(0, 10).map(item => (
                    <BreakdownRow key={item.course_code} item={item} />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: History + Missing */}
        <div className="w-72 shrink-0 space-y-4">
          {/* Recent History */}
          <div className="rounded-xl" style={{ background: "var(--card)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 px-4 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <Clock size={14} style={{ color: "var(--primary)" }} />
              <h2 className="text-sm font-bold">Recent History</h2>
            </div>

            {recentHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-1"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <Clock size={18} style={{ color: "rgba(255,255,255,0.2)" }} />
                </div>
                <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>No audits yet</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.22)" }}>
                  Upload your transcript to see history here
                </p>
              </div>
            ) : (
              <div className="p-2">
                {recentHistory.map(item => <RecentItem key={item.id} item={item} />)}
              </div>
            )}

            <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <Link href="/history"
                className="flex items-center justify-center gap-1 text-xs font-semibold w-full"
                style={{ color: "var(--primary)" }}>
                View All Audits <ChevronRight size={12} />
              </Link>
            </div>
          </div>

          {/* Missing Courses */}
          {latestAudit?.missing_courses && Object.values(latestAudit.missing_courses).some(a => a.length > 0) && (
            <div className="rounded-xl" style={{ background: "var(--card)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2 px-4 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <AlertCircle size={14} style={{ color: "#f59e0b" }} />
                <h2 className="text-sm font-bold">Missing Courses</h2>
                <span className="ml-auto text-xs font-bold tabular-nums px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>
                  {Object.values(latestAudit.missing_courses).reduce((s, a) => s + a.length, 0)}
                </span>
              </div>
              <div className="p-4 space-y-3 max-h-56 overflow-y-auto">
                {Object.entries(latestAudit.missing_courses)
                  .filter(([, codes]) => codes.length > 0)
                  .map(([cat, codes]) => (
                    <div key={cat}>
                      <p className="section-label mb-1.5">{cat}</p>
                      <div className="flex flex-wrap gap-1">
                        {codes.map(code => (
                          <span key={code}
                            className="text-[11px] px-2 py-0.5 rounded-md font-mono font-medium"
                            style={{ background: "rgba(245,158,11,0.1)", color: "rgba(251,191,36,0.85)", border: "1px solid rgba(245,158,11,0.18)" }}>
                            {code}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Progress Tab ─────────────────────────────────────────────────────────────

function ProgressTab({
  latestAudit, creditPercent, requiredCredits,
}: {
  latestAudit: AuditResult | null;
  creditPercent: number | null;
  requiredCredits: number;
}) {
  if (!latestAudit) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <BarChart3 size={28} style={{ color: "rgba(255,255,255,0.18)" }} />
        </div>
        <p className="font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>No audit data yet</p>
        <p className="text-sm max-w-xs" style={{ color: "rgba(255,255,255,0.28)" }}>
          Upload a transcript from the Overview tab to see your full degree progress.
        </p>
      </div>
    );
  }

  const cgpaPercent = Math.min(Math.round((latestAudit.cgpa / 4.0) * 100), 100);
  const totalMissing = latestAudit.missing_courses
    ? Object.values(latestAudit.missing_courses).reduce((s, a) => s + a.length, 0)
    : 0;
  const completedCount = latestAudit.completed_courses?.length ?? 0;

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Degree Progress</h1>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>
          {latestAudit.program_name} · Last updated{" "}
          {new Date(latestAudit.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* Ring Charts */}
      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-xl p-8 flex flex-col items-center gap-4"
          style={{ background: "var(--card)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="relative">
            <ProgressRing percent={creditPercent ?? 0} size={152} strokeWidth={11} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black tabular-nums">{creditPercent ?? 0}%</span>
              <span className="section-label mt-1">Credits</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold tabular-nums">
              {latestAudit.total_valid_credits}
              <span className="text-sm font-normal ml-1" style={{ color: "rgba(255,255,255,0.35)" }}>/ {requiredCredits}</span>
            </p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Total Valid Credits</p>
          </div>
          {latestAudit.on_probation && (
            <div className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b" }}>
              <AlertCircle size={11} /> Academic Probation
            </div>
          )}
        </div>

        <div className="rounded-xl p-8 flex flex-col items-center gap-4"
          style={{ background: "var(--card)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="relative">
            <ProgressRing percent={cgpaPercent} size={152} strokeWidth={11} color1="#8b5cf6" color2="#ec4899" gradientId="cgpa-grad" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black tabular-nums">{latestAudit.cgpa.toFixed(2)}</span>
              <span className="section-label mt-1">CGPA</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">
              {latestAudit.cgpa >= 3.5 ? "Excellent" : latestAudit.cgpa >= 3.0 ? "Very Good" : latestAudit.cgpa >= 2.5 ? "Good" : latestAudit.cgpa >= 2.0 ? "Satisfactory" : "Below Standard"}
            </p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Academic Standing</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Courses Completed", value: completedCount, icon: <CheckCircle2 size={17} style={{ color: "#10b981" }} />, variant: "green" as const },
          { label: "Courses Remaining", value: totalMissing, icon: <AlertCircle size={17} style={{ color: "#f59e0b" }} />, variant: "amber" as const },
          { label: "Credits Remaining", value: Math.max(0, requiredCredits - latestAudit.total_valid_credits), icon: <Target size={17} style={{ color: "#818cf8" }} />, variant: "blue" as const },
        ].map(({ label, value, icon, variant }) => (
          <div key={label} className={`stat-card stat-card-${variant} flex items-center gap-4`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {icon}
            </div>
            <div>
              <p className="text-2xl font-black tabular-nums">{value}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Missing Courses by Category */}
      {latestAudit.missing_courses && Object.keys(latestAudit.missing_courses).length > 0 && (
        <div>
          <h2 className="text-base font-bold mb-3">Required Courses by Category</h2>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(latestAudit.missing_courses).map(([cat, codes]) => (
              <div key={cat} className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm">{cat}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
                      {codes.length} course{codes.length !== 1 ? "s" : ""} remaining
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-lg font-bold shrink-0 ml-3 tabular-nums"
                    style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>
                    {codes.length} left
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {codes.map(code => (
                    <span key={code}
                      className="text-[11px] px-2 py-1 rounded-md font-mono font-medium"
                      style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Course Table */}
      {latestAudit.credit_breakdown && latestAudit.credit_breakdown.length > 0 && (
        <div>
          <h2 className="text-base font-bold mb-3">All Courses</h2>
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <tr>
                    {["Course", "Grade", "Credits", "Semester", "Status"].map((h, i) => (
                      <th key={h} className={`section-label py-3 font-bold ${i === 0 ? "text-left px-5" : i === 4 ? "text-right px-5" : "text-center px-3"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {latestAudit.credit_breakdown.map(item => (
                    <tr key={item.course_code}
                      className="transition-colors"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}
                    >
                      <td className="px-5 py-3">
                        <p className="font-semibold text-xs">{item.course_code}</p>
                        <p className="text-xs truncate max-w-[180px]" style={{ color: "rgba(255,255,255,0.38)" }}>{item.course_name}</p>
                      </td>
                      <td className="text-center px-3 py-3">
                        <span className={`grade-badge ${gradeColorClass(item.grade)}`}>{item.grade ?? "—"}</span>
                      </td>
                      <td className="text-center px-3 py-3 text-sm font-medium tabular-nums">{item.credits}</td>
                      <td className="text-center px-3 py-3 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{item.semester}</td>
                      <td className="text-right px-5 py-3">
                        <span className="text-[10px] px-2 py-1 rounded-full font-bold border"
                          style={item.counted
                            ? { background: "rgba(16,185,129,0.1)", color: "#34d399", borderColor: "rgba(16,185,129,0.2)" }
                            : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.07)" }
                          }>
                          {item.counted ? "Counted" : "Excluded"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ user, latestAudit, onSignOut }: {
  user: UserProfile | null;
  latestAudit: AuditResult | null;
  onSignOut: () => void;
}) {
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>Manage your account and preferences.</p>
      </div>

      {/* Profile */}
      <div className="rounded-xl p-5 flex items-center gap-5"
        style={{ background: "var(--card)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {user?.picture ? (
          <Image src={user.picture} alt="Profile" width={72} height={72}
            className="rounded-2xl object-cover shrink-0"
            style={{ boxShadow: "0 0 0 2px rgba(99,102,241,0.25)" }} />
        ) : (
          <div className="w-18 h-18 rounded-2xl flex items-center justify-center shrink-0"
            style={{ width: 72, height: 72, background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            <UserIcon size={28} className="text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold truncate">{user?.name ?? "Student"}</p>
          <p className="text-sm truncate" style={{ color: "rgba(255,255,255,0.45)" }}>{user?.email ?? "—"}</p>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.28)" }}>
            Member since {user ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}
          </p>
        </div>
        <span className="text-xs px-3 py-1.5 rounded-lg font-bold shrink-0"
          style={{ background: "rgba(99,102,241,0.1)", color: "var(--primary)", border: "1px solid rgba(99,102,241,0.2)" }}>
          Student
        </span>
      </div>

      {/* Academic Info */}
      {latestAudit && (
        <div className="rounded-xl overflow-hidden"
          style={{ background: "var(--card)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <BookOpen size={15} style={{ color: "var(--primary)" }} />
            <h2 className="text-sm font-bold">Academic Info</h2>
          </div>
          <div className="p-5 space-y-0">
            {[
              { label: "Program", value: latestAudit.program_name },
              { label: "Credits Completed", value: `${latestAudit.total_valid_credits} / 130` },
              { label: "Current CGPA", value: latestAudit.cgpa.toFixed(2) },
              {
                label: "Academic Standing",
                value: latestAudit.on_probation ? "Academic Probation" : "Good Standing",
                color: latestAudit.on_probation ? "#f59e0b" : "#34d399",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</span>
                <span className="text-sm font-semibold" style={{ color: color ?? "#fff" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auth Provider */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <Award size={15} style={{ color: "var(--primary)" }} />
          <h2 className="text-sm font-bold">Authentication</h2>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3 p-4 rounded-xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold">Google Account</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>{user?.email ?? "Connected"}</p>
            </div>
            <span className="ml-auto text-xs font-bold" style={{ color: "#34d399" }}>Connected</span>
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid rgba(239,68,68,0.12)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(239,68,68,0.08)" }}>
          <h2 className="text-sm font-bold" style={{ color: "#f87171" }}>Danger Zone</h2>
        </div>
        <div className="p-5">
          <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.42)" }}>
            You will be signed out and redirected to the sign-in page.
          </p>
          <button
            onClick={onSignOut}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.14)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)"; }}
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Components ─────────────────────────────────────────────────────────

function StatCard({
  title, value, suffix, sub, icon, progress, progressColor = "from-emerald-500 to-teal-400", variant,
}: {
  title: string;
  value: string | null;
  suffix?: string;
  sub: string;
  icon: React.ReactNode;
  progress?: number;
  progressColor?: string;
  variant: "green" | "blue" | "amber";
}) {
  return (
    <div className={`stat-card stat-card-${variant}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {icon}
        </div>
      </div>
      <p className="section-label mb-2">{title}</p>
      {value !== null ? (
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-3xl font-black tabular-nums tracking-tight">{value}</span>
          {suffix && <span className="text-base font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>{suffix}</span>}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-8 h-1 rounded-full animate-pulse-glow" style={{ background: "rgba(255,255,255,0.12)" }} />
          <div className="w-5 h-1 rounded-full animate-pulse-glow" style={{ background: "rgba(255,255,255,0.07)", animationDelay: "0.2s" }} />
        </div>
      )}
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>{sub}</p>
      {progress !== undefined && (
        <div className="mt-4 w-full rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.06)" }}>
          <div
            className={`h-full rounded-full bg-gradient-to-r ${progressColor} transition-all duration-1000`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function gradeColorClass(grade: string | null): string {
  if (!grade) return "grade-w";
  const g = grade.toUpperCase();
  if (g === "A" || g === "A+" || g === "A-") return "grade-a";
  if (g.startsWith("B")) return "grade-b";
  if (g.startsWith("C")) return "grade-c";
  if (g.startsWith("D")) return "grade-d";
  if (g === "F") return "grade-f";
  return "grade-w";
}

function BreakdownRow({ item }: { item: CreditBreakdownItem }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-default"
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}>
      <div className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: item.counted ? "#10b981" : "rgba(255,255,255,0.15)" }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold">{item.course_code}</p>
        <p className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.32)" }}>{item.course_name}</p>
      </div>
      <span className={`grade-badge ${gradeColorClass(item.grade)} shrink-0`}>{item.grade ?? "—"}</span>
      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0"
        style={item.counted
          ? { background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.18)" }
          : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.07)" }
        }>
        {item.counted ? `${item.credits}cr` : "N/A"}
      </span>
    </div>
  );
}

function RecentItem({ item }: { item: HistoryItem }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.18)" }}>
          <Clock size={12} style={{ color: "#818cf8" }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate max-w-[140px]">
            {item.original_filename ?? "Transcript"}
          </p>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
            {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            {" · "}
            <span className="tabular-nums">GPA {item.cgpa.toFixed(2)}</span>
          </p>
        </div>
      </div>
      <ChevronRight size={12} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
    </div>
  );
}

function ProgressRing({
  percent, size, strokeWidth,
  color1 = "#6366f1", color2 = "#8b5cf6",
  gradientId = "prog-grad",
}: {
  percent: number; size: number; strokeWidth: number;
  color1?: string; color2?: string; gradientId?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={`url(#${gradientId})`} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
      />
    </svg>
  );
}
