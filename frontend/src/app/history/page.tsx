"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, Filter, Download, Eye, Calendar, FileText,
  ChevronRight, TrendingUp, ChevronLeft, Loader2, Trash2, X,
  CheckCircle2, AlertCircle, BookOpen, Image as ImageIcon,
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
      item.course_code,
      item.course_name,
      item.grade ?? "",
      String(item.credits),
      item.semester,
      item.status,
      item.counted ? "Yes" : "No",
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

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "Just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="min-h-screen bg-[#020617] p-8 md:p-10">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <Link href="/dashboard"
              className="p-2 hover:bg-white/5 rounded-xl transition-all text-white/50 hover:text-white">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Audit History</h1>
              <p className="text-sm opacity-50 mt-0.5">
                {total > 0 ? `${total} audit${total !== 1 ? "s" : ""} on record` : "No audits yet"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/5 border border-white/5 flex items-center px-4 py-2.5 rounded-xl focus-within:border-primary transition-all">
              <Search size={16} className="opacity-30 mr-3 shrink-0" />
              <input
                type="text"
                placeholder="Search by filename or program..."
                className="bg-transparent border-none outline-none text-sm w-56 text-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setShowFilter(f => !f)}
                className={`p-2.5 border rounded-xl transition-all text-white/70 flex items-center gap-2 text-sm px-4 ${
                  showFilter || filterType !== "all"
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-white/5 border-white/5 hover:bg-white/10"
                }`}>
                <Filter size={16} />
                {filterType !== "all" ? filterType.toUpperCase() : "Filter"}
              </button>
              <AnimatePresence>
                {showFilter && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    className="absolute right-0 top-12 z-20 glass border border-white/10 rounded-xl p-2 min-w-[140px] shadow-xl"
                  >
                    {(["all", "csv", "image"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => { setFilterType(t); setPage(1); setShowFilter(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          filterType === t ? "bg-primary text-white" : "hover:bg-white/5 text-white/70"
                        }`}
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

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <HistoryStat label="Total Audits" value={stats ? String(stats.total_audits) : "—"} icon={<FileText size={15} />} />
          <HistoryStat label="Average GPA" value={stats ? stats.average_cgpa.toFixed(2) : "—"} icon={<TrendingUp size={15} />} color="text-primary" />
          <HistoryStat label="CSV Audits" value={stats ? String(stats.csv_audits) : "—"} icon={<FileText size={15} />} color="text-emerald-400" />
          <HistoryStat label="Image Scans" value={stats ? String(stats.image_audits) : "—"} icon={<ImageIcon size={15} />} color="text-accent" />
        </div>

        {/* Table + Detail Panel */}
        <div className="flex gap-6">
          {/* Table */}
          <div className={`card glass overflow-hidden transition-all duration-300 ${detailAudit ? "flex-1" : "w-full"}`}>
            <div className="grid grid-cols-6 px-6 py-4 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest opacity-40">
              <div className="col-span-2">Source</div>
              <div className="text-center">Date</div>
              <div className="text-center">Credits</div>
              <div className="text-center">GPA</div>
              <div className="text-right">Actions</div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center p-20 gap-4">
                <Loader2 className="animate-spin text-primary" size={28} />
                <p className="opacity-40 text-sm">Loading history...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 gap-4">
                <FileText size={40} className="opacity-10" />
                <p className="opacity-40 text-sm">
                  {history.length === 0 ? "No audits yet. Upload a transcript from the dashboard." : "No results match."}
                </p>
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
                    loading={loadingDetail}
                    formatDate={formatDate}
                    compact={!!detailAudit}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
                <p className="text-xs opacity-40">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                    <ChevronLeft size={15} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => Math.abs(p - page) <= 2)
                    .map(p => (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                          p === page ? "bg-primary text-white" : "hover:bg-white/5"
                        }`}>
                        {p}
                      </button>
                    ))}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Detail Panel */}
          <AnimatePresence>
            {detailAudit && (
              <motion.div
                initial={{ opacity: 0, x: 24, width: 0 }}
                animate={{ opacity: 1, x: 0, width: 420 }}
                exit={{ opacity: 0, x: 24, width: 0 }}
                className="card glass overflow-hidden shrink-0"
                style={{ minWidth: 0 }}
              >
                <div className="p-5 border-b border-white/5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">
                      {detailAudit.original_filename ?? "Transcript"}
                    </p>
                    <p className="text-xs opacity-40 mt-0.5">{formatDate(detailAudit.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDownload(detailAudit)}
                      title="Download CSV"
                      className="p-2 hover:bg-white/5 rounded-lg text-white/50 hover:text-white transition-all">
                      <Download size={16} />
                    </button>
                    <button onClick={() => setDetailAudit(null)}
                      className="p-2 hover:bg-white/5 rounded-lg text-white/50 hover:text-white transition-all">
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div className="overflow-y-auto max-h-[calc(100vh-320px)]">
                  {/* Summary */}
                  <div className="p-5 grid grid-cols-2 gap-3 border-b border-white/5">
                    {[
                      { label: "Credits", value: `${detailAudit.total_valid_credits} / 130` },
                      { label: "CGPA", value: detailAudit.cgpa.toFixed(2), color: "text-primary" },
                      { label: "Program", value: detailAudit.program_name.replace("& Computer", "& CS").replace("Engineering", "Eng.") },
                      {
                        label: "Standing",
                        value: detailAudit.on_probation ? "Probation" : "Good",
                        color: detailAudit.on_probation ? "text-amber-400" : "text-emerald-400",
                      },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-white/3 rounded-xl p-3">
                        <p className="text-[10px] opacity-40 uppercase tracking-wider font-bold mb-1">{label}</p>
                        <p className={`text-sm font-bold truncate ${color ?? ""}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Missing Courses */}
                  {detailAudit.missing_courses && Object.keys(detailAudit.missing_courses).length > 0 && (
                    <div className="p-5 border-b border-white/5">
                      <p className="text-xs font-bold opacity-40 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <AlertCircle size={12} className="text-amber-400" /> Missing Courses
                      </p>
                      <div className="space-y-3">
                        {Object.entries(detailAudit.missing_courses)
                          .filter(([, codes]) => codes.length > 0)
                          .map(([cat, codes]) => (
                            <div key={cat}>
                              <p className="text-[10px] opacity-40 uppercase font-bold tracking-wider mb-1.5">{cat}</p>
                              <div className="flex flex-wrap gap-1">
                                {codes.map(code => (
                                  <span key={code}
                                    className="text-[10px] px-2 py-0.5 bg-amber-400/10 text-amber-300 border border-amber-400/20 rounded font-mono">
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
                    <div className="p-5">
                      <p className="text-xs font-bold opacity-40 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <BookOpen size={12} className="text-primary" /> Credit Breakdown
                      </p>
                      <div className="space-y-1.5">
                        {detailAudit.credit_breakdown.map(item => (
                          <div key={item.course_code}
                            className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.counted ? "bg-emerald-400" : "bg-white/20"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate">{item.course_code}</p>
                              <p className="text-[10px] opacity-40 truncate">{item.course_name}</p>
                            </div>
                            <span className="text-xs font-bold shrink-0">{item.grade ?? "—"}</span>
                            <span className="text-[10px] opacity-40 shrink-0">{item.credits}cr</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Download footer */}
                <div className="p-4 border-t border-white/5">
                  <button
                    onClick={() => handleDownload(detailAudit)}
                    className="w-full py-2.5 bg-primary/10 border border-primary/20 text-primary rounded-xl text-sm font-semibold hover:bg-primary/20 transition-all flex items-center justify-center gap-2">
                    <Download size={15} /> Download CSV
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

function HistoryStat({ label, value, icon, color = "text-white" }: {
  label: string; value: string; icon: React.ReactNode; color?: string;
}) {
  return (
    <div className="card glass p-4 flex items-center gap-3">
      <div className={`w-9 h-9 bg-white/5 rounded-xl border border-white/5 flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase font-bold tracking-widest opacity-40">{label}</div>
        <div className={`text-lg font-bold ${color}`}>{value}</div>
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
      className={`grid px-6 py-4 items-center border-b border-white/5 hover:bg-white/[0.02] transition-all group cursor-pointer ${
        compact ? "grid-cols-5" : "grid-cols-6"
      } ${selected ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
      onClick={onView}
    >
      <div className="col-span-2 flex items-center gap-3">
        <div className={`w-9 h-9 bg-white/5 rounded-lg border border-white/5 flex items-center justify-center shrink-0`}>
          {isImage
            ? <ImageIcon size={16} className="text-accent" />
            : <FileText size={16} className="text-emerald-400" />
          }
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate max-w-[160px]">
            {audit.original_filename ?? "Transcript"}
          </p>
          <p className="text-[10px] opacity-40 uppercase font-bold tracking-tight">
            {isImage ? "Image Scan" : "CSV Export"}
          </p>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm">{formatDate(audit.created_at)}</p>
      </div>
      <div className="text-center">
        <span className="text-sm font-bold bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
          {audit.total_valid_credits}
        </span>
      </div>
      <div className="text-center font-bold text-sm text-primary">{audit.cgpa.toFixed(2)}</div>
      {!compact && (
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all"
          onClick={e => e.stopPropagation()}>
          <button onClick={onView}
            className="p-1.5 hover:bg-primary/10 rounded-lg text-white/50 hover:text-primary transition-all"
            title="View details">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
          </button>
          <button onClick={() => onDelete()}
            disabled={deleting}
            className="p-1.5 hover:bg-red-500/10 rounded-lg text-white/50 hover:text-red-400 transition-all disabled:opacity-40">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      )}
    </motion.div>
  );
}
