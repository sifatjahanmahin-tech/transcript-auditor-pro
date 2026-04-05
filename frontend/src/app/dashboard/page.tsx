"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, History, Settings, LogOut, Bell, Search, User as UserIcon,
  ChevronRight, TrendingUp, AlertCircle, CheckCircle2, Clock, Loader2,
  X, BookOpen, Award, Target,
} from "lucide-react";
import FileUpload from "@/components/FileUpload";
import Link from "next/link";
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

const tabVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
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
          setRecentHistory(items.slice(0, 3));
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

  return (
    <div className="min-h-screen flex bg-[#020617]">
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/5 flex flex-col p-6 gap-8 glass sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/30">
            <LayoutDashboard className="text-white w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">Audit Pro</span>
        </div>

        <nav className="flex flex-col gap-1">
          <SidebarItem icon={<LayoutDashboard size={18} />} label="Overview"
            active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
          <Link href="/history" className="block">
            <SidebarItem icon={<History size={18} />} label="Audit History"
              active={false} onClick={() => {}} />
          </Link>
          <SidebarItem icon={<TrendingUp size={18} />} label="Progress"
            active={activeTab === "progress"} onClick={() => setActiveTab("progress")} />
          <div className="my-3 border-t border-white/5" />
          <SidebarItem icon={<Settings size={18} />} label="Settings"
            active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
        </nav>

        {latestAudit && (
          <div className="mt-2 p-4 rounded-xl bg-white/3 border border-white/5">
            <p className="text-[10px] opacity-40 uppercase tracking-widest font-bold mb-2">Last Audit</p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs opacity-60">Credits</span>
              <span className="text-xs font-bold">{latestAudit.total_valid_credits} / {requiredCredits}</span>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-700"
                style={{ width: `${creditPercent}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-auto">
          <button onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl hover:bg-white/5 text-sm transition-all text-red-400/80 hover:text-red-400">
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 border-b border-white/5 px-10 flex items-center justify-between glass shrink-0">
          <div className="flex items-center gap-3 bg-white/5 px-4 py-2.5 rounded-xl border border-white/5 w-80">
            <Search size={16} className="opacity-40 shrink-0" />
            <input
              type="text"
              placeholder="Search courses, audits..."
              className="bg-transparent border-none outline-none text-sm w-full placeholder:opacity-40 text-white"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}
                className="opacity-40 hover:opacity-100 transition-opacity shrink-0">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2.5 hover:bg-white/5 rounded-xl transition-all text-white/60 hover:text-white">
              <Bell size={18} />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-white/5">
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold">{user?.name ?? "My Account"}</span>
                <span className="text-[10px] opacity-40 uppercase tracking-wider font-bold truncate max-w-[140px]">
                  {user?.email ?? "—"}
                </span>
              </div>
              {user?.picture ? (
                <img src={user.picture} alt="Profile"
                  className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/10" />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-tr from-primary to-accent rounded-xl flex items-center justify-center">
                  <UserIcon size={18} className="text-white" />
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-10">
          <AnimatePresence mode="wait">
            {loadingData ? (
              <motion.div key="loading" {...tabVariants}
                className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="animate-spin text-primary" size={36} />
                <p className="text-sm opacity-40">Loading your data...</p>
              </motion.div>
            ) : activeTab === "overview" ? (
              <motion.div key="overview" {...tabVariants}>
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
              <motion.div key="progress" {...tabVariants}>
                <ProgressTab latestAudit={latestAudit} creditPercent={creditPercent} requiredCredits={requiredCredits} />
              </motion.div>
            ) : (
              <motion.div key="settings" {...tabVariants}>
                <SettingsTab user={user} latestAudit={latestAudit} onSignOut={handleSignOut} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────

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
    <div className="space-y-10">
      {/* Greeting */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold mb-1">Dashboard</h2>
          <p className="opacity-50 text-sm">
            {latestAudit ? "Here's your latest degree progress." : "Upload a transcript to get started."}
          </p>
        </div>
        {latestAudit && (
          <div className="text-right">
            <div className="text-xs opacity-40 mb-0.5">Last Audit</div>
            <div className="text-sm font-medium">
              {new Date(latestAudit.created_at).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric",
              })}
            </div>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-6">
        <StatCard
          title="Total Credits"
          value={latestAudit ? `${latestAudit.total_valid_credits} / ${requiredCredits}` : "—"}
          subValue={creditPercent !== null ? `${creditPercent}% completed` : "No audit yet"}
          icon={<CheckCircle2 size={20} className="text-emerald-400" />}
          badge={latestAudit?.on_probation ? "Probation" : latestAudit ? "Good Standing" : undefined}
          badgeColor={latestAudit?.on_probation ? "text-amber-400 bg-amber-400/10 border-amber-400/20" : "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"}
          progress={creditPercent ?? undefined}
        />
        <StatCard
          title="Cumulative GPA"
          value={latestAudit ? latestAudit.cgpa.toFixed(2) : "—"}
          subValue={latestAudit
            ? latestAudit.cgpa >= 3.5 ? "Excellent Standing"
              : latestAudit.cgpa >= 2.5 ? "Good Standing"
              : "Needs Improvement"
            : "No audit yet"}
          icon={<TrendingUp size={20} className="text-primary" />}
          progress={latestAudit ? Math.round((latestAudit.cgpa / 4) * 100) : undefined}
          progressColor="from-primary to-accent"
        />
        <StatCard
          title="Remaining Courses"
          value={missingCount !== null ? String(missingCount) : "—"}
          subValue={latestAudit ? "courses still needed" : "No audit yet"}
          icon={<AlertCircle size={20} className="text-amber-400" />}
        />
      </div>

      {/* Main Row: Upload + Sidebar */}
      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-8">
          {/* Upload Zone */}
          <div className="card glass p-8 flex flex-col items-center">
            <h3 className="text-lg font-bold mb-1">New Degree Audit</h3>
            <p className="text-xs opacity-40 mb-6">Upload a CSV export or scanned image of your transcript</p>
            {uploadSuccess && (
              <div className="w-full mb-5 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm text-center flex items-center justify-center gap-2">
                <CheckCircle2 size={16} /> Audit completed successfully!
              </div>
            )}
            {uploadError && (
              <div className="w-full mb-5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                {uploadError}
              </div>
            )}
            <FileUpload onUpload={onUpload} isLoading={uploading} />
          </div>

          {/* Course Breakdown (searchable) */}
          {latestAudit?.credit_breakdown && latestAudit.credit_breakdown.length > 0 && (
            <div className="card glass overflow-hidden">
              <div className="flex justify-between items-center mb-5 px-6 pt-6">
                <h3 className="text-base font-bold">
                  Credit Breakdown
                  {searchQuery && (
                    <span className="ml-2 text-xs font-normal opacity-50">
                      ({filteredBreakdown.length} results)
                    </span>
                  )}
                </h3>
                <Link href="/history"
                  className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
                  Full History <ChevronRight size={12} />
                </Link>
              </div>
              <div className="px-6 pb-6 space-y-2 max-h-72 overflow-y-auto">
                {filteredBreakdown.length === 0 ? (
                  <p className="text-center text-sm opacity-40 py-6">No courses match your search.</p>
                ) : (
                  filteredBreakdown.slice(0, 8).map(item => (
                    <BreakdownRow key={item.course_code} item={item} />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Recent History */}
          <div className="card glass">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-primary" />
              <h3 className="font-bold text-sm">Recent History</h3>
            </div>
            {recentHistory.length === 0 ? (
              <p className="text-xs opacity-40 text-center py-6">No audits yet.</p>
            ) : (
              <div className="space-y-2">
                {recentHistory.map(item => <RecentItem key={item.id} item={item} />)}
              </div>
            )}
            <Link href="/history"
              className="mt-4 flex items-center justify-center gap-1 text-xs text-primary hover:underline font-semibold">
              View All <ChevronRight size={12} />
            </Link>
          </div>

          {/* Missing Courses */}
          {latestAudit?.missing_courses && Object.keys(latestAudit.missing_courses).length > 0 && (
            <div className="card glass bg-gradient-to-br from-indigo-500/8 to-purple-500/8 border-indigo-500/10">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-400" /> Missing Courses
              </h3>
              <div className="space-y-3">
                {Object.entries(latestAudit.missing_courses)
                  .filter(([, codes]) => codes.length > 0)
                  .map(([cat, codes]) => (
                    <div key={cat}>
                      <p className="text-[10px] opacity-40 uppercase font-bold tracking-wider mb-1">{cat}</p>
                      <div className="flex flex-wrap gap-1">
                        {codes.map(code => (
                          <span key={code}
                            className="text-[10px] px-2 py-0.5 bg-white/5 border border-white/10 rounded-md font-mono">
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

// ─── Progress Tab ────────────────────────────────────────────────────────────

function ProgressTab({
  latestAudit, creditPercent, requiredCredits,
}: {
  latestAudit: AuditResult | null;
  creditPercent: number | null;
  requiredCredits: number;
}) {
  if (!latestAudit) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-2">
          <TrendingUp size={28} className="opacity-20" />
        </div>
        <p className="font-semibold opacity-60">No audit data yet</p>
        <p className="text-sm opacity-30 max-w-xs">
          Upload a transcript from the Overview tab to see your degree progress.
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
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl font-bold mb-1">Degree Progress</h2>
        <p className="opacity-50 text-sm">
          {latestAudit.program_name} · Last updated{" "}
          {new Date(latestAudit.created_at).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
          })}
        </p>
      </div>

      {/* Progress Rings */}
      <div className="grid grid-cols-2 gap-6">
        <div className="card glass p-8 flex flex-col items-center gap-4">
          <div className="relative">
            <ProgressRing percent={creditPercent ?? 0} size={160} strokeWidth={12} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{creditPercent ?? 0}%</span>
              <span className="text-[10px] opacity-40 uppercase tracking-widest">Credits</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">
              {latestAudit.total_valid_credits} <span className="opacity-40 text-sm font-normal">/ {requiredCredits}</span>
            </p>
            <p className="text-xs opacity-50 mt-1">Total Valid Credits</p>
          </div>
          {latestAudit.on_probation && (
            <div className="px-3 py-1.5 bg-amber-400/10 border border-amber-400/20 rounded-lg text-amber-400 text-xs font-bold">
              ⚠ Academic Probation
            </div>
          )}
        </div>

        <div className="card glass p-8 flex flex-col items-center gap-4">
          <div className="relative">
            <ProgressRing
              percent={cgpaPercent}
              size={160}
              strokeWidth={12}
              color1="#8b5cf6"
              color2="#ec4899"
              gradientId="cgpa-grad"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{latestAudit.cgpa.toFixed(2)}</span>
              <span className="text-[10px] opacity-40 uppercase tracking-widest">CGPA</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">
              {latestAudit.cgpa >= 3.5 ? "Excellent" : latestAudit.cgpa >= 3.0 ? "Very Good" : latestAudit.cgpa >= 2.5 ? "Good" : latestAudit.cgpa >= 2.0 ? "Satisfactory" : "Below Standard"}
            </p>
            <p className="text-xs opacity-50 mt-1">Academic Standing</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Courses Completed", value: completedCount, icon: <CheckCircle2 size={18} className="text-emerald-400" /> },
          { label: "Courses Remaining", value: totalMissing, icon: <AlertCircle size={18} className="text-amber-400" /> },
          { label: "Credits Remaining", value: Math.max(0, requiredCredits - latestAudit.total_valid_credits), icon: <Target size={18} className="text-primary" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="card glass p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shrink-0">{icon}</div>
            <div>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-[11px] opacity-40">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Missing Courses by Category */}
      {latestAudit.missing_courses && Object.keys(latestAudit.missing_courses).length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-4">Required Courses by Category</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(latestAudit.missing_courses).map(([cat, codes]) => (
              <div key={cat} className="card glass p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm">{cat}</p>
                    <p className="text-[11px] opacity-40">{codes.length} course{codes.length !== 1 ? "s" : ""} remaining</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20 font-bold shrink-0 ml-2">
                    {codes.length} left
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {codes.map(code => (
                    <span key={code}
                      className="text-[11px] px-2 py-1 bg-white/5 border border-white/10 rounded-md font-mono text-white/70">
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Category Check */}
      {latestAudit.missing_courses && (
        <div>
          <h3 className="text-lg font-bold mb-4">Course Breakdown</h3>
          <div className="card glass overflow-hidden">
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-white/5">
                  <tr className="text-[10px] uppercase tracking-widest opacity-40 font-bold">
                    <th className="text-left px-6 py-4">Course</th>
                    <th className="text-center px-4 py-4">Grade</th>
                    <th className="text-center px-4 py-4">Credits</th>
                    <th className="text-center px-4 py-4">Semester</th>
                    <th className="text-right px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {latestAudit.credit_breakdown?.map(item => (
                    <tr key={item.course_code}
                      className="border-b border-white/3 hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3">
                        <p className="font-semibold text-xs">{item.course_code}</p>
                        <p className="text-[11px] opacity-40 truncate max-w-[160px]">{item.course_name}</p>
                      </td>
                      <td className="text-center px-4 py-3 font-bold text-sm">{item.grade ?? "—"}</td>
                      <td className="text-center px-4 py-3 text-sm">{item.credits}</td>
                      <td className="text-center px-4 py-3 text-xs opacity-60">{item.semester}</td>
                      <td className="text-right px-6 py-3">
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold border ${
                          item.counted
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-white/5 text-white/40 border-white/10"
                        }`}>
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

// ─── Settings Tab ─────────────────────────────────────────────────────────

function SettingsTab({
  user, latestAudit, onSignOut,
}: {
  user: UserProfile | null;
  latestAudit: AuditResult | null;
  onSignOut: () => void;
}) {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-1">Settings</h2>
        <p className="opacity-50 text-sm">Manage your account and preferences.</p>
      </div>

      {/* Profile Card */}
      <div className="card glass p-6 flex items-center gap-6">
        {user?.picture ? (
          <img src={user.picture} alt="Profile"
            className="w-20 h-20 rounded-2xl object-cover ring-2 ring-white/10 shrink-0" />
        ) : (
          <div className="w-20 h-20 bg-gradient-to-tr from-primary to-accent rounded-2xl flex items-center justify-center shrink-0">
            <UserIcon size={32} className="text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xl font-bold truncate">{user?.name ?? "Student"}</p>
          <p className="text-sm opacity-50 truncate">{user?.email ?? "—"}</p>
          <p className="text-xs opacity-30 mt-1">
            Member since {user ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}
          </p>
        </div>
        <span className="text-xs px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg font-bold shrink-0">
          Student
        </span>
      </div>

      {/* Academic Info */}
      {latestAudit && (
        <div className="card glass p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <BookOpen size={16} className="text-primary" /> Academic Info
          </h3>
          <div className="space-y-3">
            {[
              { label: "Program", value: latestAudit.program_name },
              { label: "Credits Completed", value: `${latestAudit.total_valid_credits} / 130` },
              { label: "Current CGPA", value: latestAudit.cgpa.toFixed(2) },
              {
                label: "Standing",
                value: latestAudit.on_probation ? "Academic Probation" : "Good Standing",
                color: latestAudit.on_probation ? "text-amber-400" : "text-emerald-400",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className="text-sm opacity-50">{label}</span>
                <span className={`text-sm font-semibold ${color ?? ""}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auth Provider */}
      <div className="card glass p-6">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Award size={16} className="text-primary" /> Authentication
        </h3>
        <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/5">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold">Google Account</p>
            <p className="text-xs opacity-40">{user?.email ?? "Connected"}</p>
          </div>
          <span className="ml-auto text-xs text-emerald-400 font-bold">Connected</span>
        </div>
      </div>

      {/* Sign Out */}
      <div className="card glass p-6 border-red-500/10">
        <h3 className="font-bold mb-2 text-red-400/80">Sign Out</h3>
        <p className="text-sm opacity-50 mb-4">You will be redirected to the sign-in page.</p>
        <button
          onClick={onSignOut}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/20 transition-all">
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function SidebarItem({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all w-full ${
        active
          ? "bg-primary text-white shadow-lg shadow-primary/20"
          : "text-white/60 hover:bg-white/5 hover:text-white"
      }`}>
      {icon} {label}
    </button>
  );
}

function StatCard({ title, value, subValue, icon, badge, badgeColor, progress, progressColor = "from-emerald-500 to-teal-400" }: {
  title: string; value: string; subValue: string;
  icon: React.ReactNode; badge?: string; badgeColor?: string;
  progress?: number; progressColor?: string;
}) {
  return (
    <div className="card glass p-6 flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">{icon}</div>
        {badge && (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>
      <div>
        <div className="text-[10px] opacity-40 font-bold uppercase tracking-wider mb-1">{title}</div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-[11px] opacity-40 mt-0.5">{subValue}</div>
      </div>
      {progress !== undefined && (
        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${progressColor} rounded-full transition-all duration-700`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function BreakdownRow({ item }: { item: CreditBreakdownItem }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.counted ? "bg-emerald-400" : "bg-white/20"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold">{item.course_code}</p>
        <p className="text-[11px] opacity-40 truncate">{item.course_name}</p>
      </div>
      <span className="text-xs font-bold opacity-60 shrink-0">{item.grade ?? "—"}</span>
      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold shrink-0 ${
        item.counted
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-white/5 text-white/30 border-white/10"
      }`}>
        {item.counted ? `${item.credits}cr` : "N/A"}
      </span>
    </div>
  );
}

function RecentItem({ item }: { item: HistoryItem }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 transition-all">
      <div>
        <p className="text-xs font-semibold truncate max-w-[140px]">
          {item.original_filename ?? "Transcript"}
        </p>
        <p className="text-[10px] opacity-40">
          {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          {" · "}GPA: {item.cgpa.toFixed(2)}
        </p>
      </div>
      <ChevronRight size={12} className="opacity-20" />
    </div>
  );
}

function ProgressRing({
  percent, size, strokeWidth, color1 = "#6366f1", color2 = "#8b5cf6", gradientId = "prog-grad",
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
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
    </svg>
  );
}
