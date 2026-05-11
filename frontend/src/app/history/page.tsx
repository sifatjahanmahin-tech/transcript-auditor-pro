"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, Filter, Download, Eye, FileText,
  ChevronRight, TrendingUp, ChevronLeft, Loader2, Trash2, X,
  AlertCircle, BookOpen, Image as ImageIcon, GraduationCap,
} from "lucide-react";
import Link from "next/link";
import api, { getToken } from "@/lib/api";
import { useRouter } from "next/navigation";

interface AuditRecord {
  id: string;
  original_filename: string | null;
  created_at: string;
  cgpa: number;
  total_valid_credits: number;
  program_name: string;
  input_type: string;
}

interface FullAuditRecord extends AuditRecord {
  on_probation: boolean;
  credit_breakdown: Array<{
    course_code: string;
    course_name: string;
    grade: string | null;
    credits: number;
    semester: string;
    status: string;
    counted: boolean;
  }> | null;
  missing_courses: Record<string, string[]> | null;
}

interface Stats {
  total_audits: number;
  csv_audits: number;
  image_audits: number;
  average_cgpa: number;
  probation_warnings: number;
}

const PAGE_SIZE = 10;

export default function HistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<AuditRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "csv" | "image">("all");
  const [showFilter, setShowFilter] = useState(false);
  const [detailAudit, setDetailAudit] = useState<FullAuditRecord | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchHistory = useCallback(async (currentPage: number, type?: string) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page: currentPage, page_size: PAGE_SIZE };
      if (type && type !== "all") params.input_type = type;
      const [histRes, statsRes] = await Promise.all([
        api.get("/api/history", { params }),
        api.get("/api/history/stats/summary"),
      ]);
      setHistory(histRes.data.items);
      setTotal(histRes.data.total);
      setTotalPages(histRes.data.total_pages);
      setStats(statsRes.data);
    } catch {
      if (!getToken()) router.push("/auth/signin");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.push("/auth/signin"); return; }
    fetchHistory(page, filterType);
  }, [fetchHistory, page, filterType, router]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this audit record?")) return;
    setDeletingId(id);
    try {
      await api.delete(`/api/history/${id}`);
      if (detailAudit?.id === id) setDetailAudit(null);
      await fetchHistory(page, filterType);
    } catch {
      alert("Failed to delete record.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleView = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/api/history/${id}`);
      setDetailAudit(res.data);
    } catch {
      alert("Failed to load audit details.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDownload = (audit: FullAuditRecord) => {
    if (!audit.credit_breakdown) return;
    const headers = ["Course Code", "Course Name", "Grade", "Credits", "Semester", "Status", "Counted"];
    const rows = audit.credit_breakdown.map(item => [
      item.course_code, item.course_name, item.grade ?? "",
      String(item.credits), item.semester, item.status, item.counted ? "Yes" : "No",
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_${audit.original_filename?.replace(/\.[^/.]+$/, "") ?? audit.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = history.filter(a => {
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return (
      (a.original_filename ?? "").toLowerCase().includes(t) ||
      a.program_name.toLowerCase().includes(t) ||
      a.created_at.includes(t)
    );
  });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: "var(--background)" }}>
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard"
              className="p-2 rounded-xl transition-all"
              style={{ color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.06)" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "";
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)";
              }}
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
                <GraduationCap size={17} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Audit History</h1>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>
                  {total > 0 ? `${total} audit${total !== 1 ? "s" : ""} on record` : "No audits yet"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search */}
            <div
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <Search size={14} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search by filename or program..."
                className="bg-transparent border-none outline-none text-sm w-52 text-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter */}
            <div className="relative">
              <button
                onClick={() => setShowFilter(f => !f)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all"
                style={
                  showFilter || filterType !== "all"
                    ? { background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", color: "#818cf8" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)" }
                }
              >
                <Filter size={14} />
                {filterType !== "all" ? filterType.toUpperCase() : "Filter"}
              </button>
              <AnimatePresence>
                {showFilter && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    className="absolute right-0 top-11 z-30 rounded-xl p-1.5 min-w-[140px] shadow-2xl"
                    style={{ background: "#0c1525", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 40px rgba(0,0,0,0.6)" }}
                  >
                    {(["all", "csv", "image"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => { setFilterType(t); setPage(1); setShowFilter(false); }}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors font-medium"
                        style={filterType === t
                          ? { background: "rgba(99,102,241,0.15)", color: "#818cf8" }
                          : { color: "rgba(255,255,255,0.6)" }
                        }
                        onMouseEnter={e => { if (filterType !== t) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                        onMouseLeave={e => { if (filterType !== t) (e.currentTarget as HTMLElement).style.background = ""; }}
                      >
                        {t === "all" ? "All Types" : t === "csv" ? "CSV Only" : "Image Only"}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Audits", value: stats ? String(stats.total_audits) : "—", icon: <FileText size={15} />, variant: undefined as "green" | "blue" | "amber" | "purple" | undefined },
            { label: "Average GPA", value: stats ? stats.average_cgpa.toFixed(2) : "—", icon: <TrendingUp size={15} />, variant: "blue" as const },
            { label: "CSV Audits", value: stats ? String(stats.csv_audits) : "—", icon: <FileText size={15} />, variant: "green" as const },
            { label: "Image Scans", value: stats ? String(stats.image_audits) : "—", icon: <ImageIcon size={15} />, variant: "purple" as const },
          ].map(({ label, value, icon, variant }) => (
            <HistoryStat key={label} label={label} value={value} icon={icon} variant={variant} />
          ))}
        </div>

        {/* Table + Detail Panel */}
        <div className="flex gap-5">
          {/* Table */}
          <div
            className="flex-1 min-w-0 rounded-xl overflow-hidden transition-all"
            style={{ background: "var(--card)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {/* Table Header */}
            <div
              className="px-5 py-3.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className={`grid items-center gap-4 ${detailAudit ? "grid-cols-5" : "grid-cols-6"}`}>
                <div className="col-span-2 section-label">Source</div>
                <div className="section-label text-center">Date</div>
                <div className="section-label text-center">Credits</div>
                <div className="section-label text-center">GPA</div>
                {!detailAudit && <div className="section-label text-right">Actions</div>}
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader2 className="animate-spin" size={26} style={{ color: "var(--primary)" }} />
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>Loading history...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <FileText size={24} style={{ color: "rgba(255,255,255,0.15)" }} />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {history.length === 0 ? "No audits yet" : "No results found"}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {history.length === 0
                      ? "Upload a transcript from the dashboard to get started."
                      : "Try a different search term or filter."}
                  </p>
                </div>
                {history.length === 0 && (
                  <Link href="/dashboard" className="btn-primary text-xs py-2 px-4 mt-1">
                    Go to Dashboard
                  </Link>
                )}
              </div>
            ) : (
              <div>
                {filtered.map(audit => (
                  <HistoryRow
                    key={audit.id}
                    audit={audit}
                    selected={detailAudit?.id === audit.id}
                    onView={() => handleView(audit.id)}
                    onDelete={() => handleDelete(audit.id)}
                    deleting={deletingId === audit.id}
                    loading={loadingDetail && detailAudit?.id !== audit.id}
                    formatDate={formatDate}
                    compact={!!detailAudit}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div
                className="px-5 py-4 flex items-center justify-between"
                style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
              >
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg transition-all disabled:opacity-25"
                    style={{ background: "rgba(255,255,255,0.05)" }}>
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => Math.abs(p - page) <= 2)
                    .map(p => (
                      <button key={p} onClick={() => setPage(p)}
                        className="w-7 h-7 rounded-lg text-xs font-bold transition-all"
                        style={p === page
                          ? { background: "var(--primary)", color: "#fff" }
                          : { color: "rgba(255,255,255,0.55)" }
                        }
                        onMouseEnter={e => { if (p !== page) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                        onMouseLeave={e => { if (p !== page) (e.currentTarget as HTMLElement).style.background = ""; }}
                      >
                        {p}
                      </button>
                    ))}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg transition-all disabled:opacity-25"
                    style={{ background: "rgba(255,255,255,0.05)" }}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Detail Panel */}
          <AnimatePresence>
            {detailAudit && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="rounded-xl overflow-hidden shrink-0 flex flex-col"
                style={{
                  width: 400,
                  background: "var(--card)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  maxHeight: "calc(100vh - 200px)",
                }}
              >
                {/* Panel Header */}
                <div
                  className="px-5 py-4 flex items-start justify-between gap-3 shrink-0"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">
                      {detailAudit.original_filename ?? "Transcript"}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
                      {formatDate(detailAudit.created_at)} · {detailAudit.program_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleDownload(detailAudit)}
                      title="Download CSV"
                      className="p-2 rounded-lg transition-all"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}
                    >
                      <Download size={15} />
                    </button>
                    <button
                      onClick={() => setDetailAudit(null)}
                      className="p-2 rounded-lg transition-all"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {/* Panel Body */}
                <div className="overflow-y-auto flex-1">
                  {/* Stats Grid */}
                  <div className="p-4 grid grid-cols-2 gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {[
                      { label: "Credits", value: `${detailAudit.total_valid_credits} / 130` },
                      { label: "CGPA", value: detailAudit.cgpa.toFixed(2), highlight: true },
                      { label: "Standing", value: detailAudit.on_probation ? "Probation" : "Good Standing", color: detailAudit.on_probation ? "#f59e0b" : "#34d399" },
                      { label: "Type", value: detailAudit.input_type === "image" ? "Image Scan" : "CSV Export" },
                    ].map(({ label, value, highlight, color }) => (
                      <div
                        key={label}
                        className="rounded-lg p-3"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <p className="section-label mb-1.5">{label}</p>
                        <p
                          className="text-sm font-bold truncate tabular-nums"
                          style={{ color: color ?? (highlight ? "var(--primary)" : "#fff") }}
                        >
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Missing Courses */}
                  {detailAudit.missing_courses && Object.values(detailAudit.missing_courses).some(c => c.length > 0) && (
                    <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <div className="flex items-center gap-2 mb-3">
                        <AlertCircle size={13} style={{ color: "#f59e0b" }} />
                        <p className="section-label">Missing Courses</p>
                      </div>
                      <div className="space-y-3">
                        {Object.entries(detailAudit.missing_courses)
                          .filter(([, codes]) => codes.length > 0)
                          .map(([cat, codes]) => (
                            <div key={cat}>
                              <p className="section-label mb-1.5">{cat}</p>
                              <div className="flex flex-wrap gap-1">
                                {codes.map(code => (
                                  <span key={code}
                                    className="text-[11px] px-2 py-0.5 rounded-md font-mono font-medium"
                                    style={{ background: "rgba(245,158,11,0.1)", color: "rgba(251,191,36,0.85)", border: "1px solid rgba(245,158,11,0.2)" }}>
                                    {code}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Credit Breakdown */}
                  {detailAudit.credit_breakdown && detailAudit.credit_breakdown.length > 0 && (
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <BookOpen size={13} style={{ color: "var(--primary)" }} />
                        <p className="section-label">Credit Breakdown</p>
                      </div>
                      <div className="space-y-1">
                        {detailAudit.credit_breakdown.map(item => (
                          <div
                            key={item.course_code}
                            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors"
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}
                          >
                            <div
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: item.counted ? "#10b981" : "rgba(255,255,255,0.2)" }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate">{item.course_code}</p>
                              <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{item.course_name}</p>
                            </div>
                            <span className="text-xs font-bold tabular-nums shrink-0">{item.grade ?? "—"}</span>
                            <span className="text-[10px] shrink-0 tabular-nums" style={{ color: "rgba(255,255,255,0.38)" }}>
                              {item.credits}cr
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Panel Footer */}
                <div className="p-4 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <button
                    onClick={() => handleDownload(detailAudit)}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                    style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "var(--primary)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.18)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.1)"}
                  >
                    <Download size={15} /> Download CSV Report
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function HistoryStat({ label, value, icon, variant }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: "green" | "blue" | "amber" | "purple";
}) {
  return (
    <div className={`stat-card flex items-center gap-3 ${variant ? `stat-card-${variant}` : ""}`}
      style={!variant ? { background: "var(--card)", border: "1px solid rgba(255,255,255,0.06)" } : undefined}>
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {icon}
      </div>
      <div>
        <p className="section-label">{label}</p>
        <p className="text-xl font-black mt-0.5 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function HistoryRow({
  audit, selected, onView, onDelete, deleting, loading, formatDate, compact,
}: {
  audit: AuditRecord;
  selected: boolean;
  onView: () => void;
  onDelete: () => void;
  deleting: boolean;
  loading: boolean;
  formatDate: (s: string) => string;
  compact: boolean;
}) {
  const isImage = audit.input_type === "image";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`grid px-5 py-3.5 items-center cursor-pointer transition-all group ${compact ? "grid-cols-5" : "grid-cols-6"} gap-4`}
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: selected ? "rgba(99,102,241,0.06)" : "",
        borderLeft: selected ? "2px solid rgba(99,102,241,0.6)" : "2px solid transparent",
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = ""; }}
      onClick={onView}
    >
      <div className="col-span-2 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {isImage
            ? <ImageIcon size={14} style={{ color: "#a78bfa" }} />
            : <FileText size={14} style={{ color: "#34d399" }} />
          }
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate max-w-[160px]">
            {audit.original_filename ?? "Transcript"}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.32)" }}>
            {isImage ? "Image Scan" : "CSV Export"}
          </p>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>{formatDate(audit.created_at)}</p>
      </div>

      <div className="text-center">
        <span className="text-sm font-bold tabular-nums px-2.5 py-1 rounded-full"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {audit.total_valid_credits}
        </span>
      </div>

      <div className="text-center">
        <span className="text-sm font-bold tabular-nums" style={{ color: "var(--primary)" }}>
          {audit.cgpa.toFixed(2)}
        </span>
      </div>

      {!compact && (
        <div
          className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onView}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: "rgba(255,255,255,0.4)" }}
            title="View details"
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.1)"; (e.currentTarget as HTMLElement).style.color = "#818cf8"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg transition-all disabled:opacity-40"
            style={{ color: "rgba(255,255,255,0.4)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)"; (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; }}
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      )}
    </motion.div>
  );
}
