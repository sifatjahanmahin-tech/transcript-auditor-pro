"use client";

import React, { useState, useRef, useEffect } from "react";
import { Upload, X, FileText, Image as ImageIcon, Loader2, ChevronDown, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";

interface Program {
  id: string;
  name: string;
  total_required_credits: number;
}

interface FileUploadProps {
  onUpload: (file: File, type: "csv" | "image", programName: string) => void;
  isLoading?: boolean;
  onProgramsLoaded?: (programs: Program[]) => void;
}

export default function FileUpload({ onUpload, isLoading, onProgramsLoaded }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programName, setProgramName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get("/api/programs").then((res) => {
      const list: Program[] = res.data.programs ?? [];
      setPrograms(list);
      if (list.length > 0) setProgramName(list[0].name);
      onProgramsLoaded?.(list);
    }).catch(() => {
      const fallback: Program[] = [
        { id: "1", name: "Computer Science & Engineering", total_required_credits: 130 },
        { id: "2", name: "Electrical & Computer Engineering", total_required_credits: 132 },
      ];
      setPrograms(fallback);
      setProgramName(fallback[0].name);
      onProgramsLoaded?.(fallback);
    });
  }, [onProgramsLoaded]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const removeFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const submitFile = () => {
    if (!file) return;
    const ext = file.name.slice(((file.name.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase();
    onUpload(file, ext === "csv" ? "csv" : "image", programName);
  };

  const isCSV = file?.name.toLowerCase().endsWith(".csv");

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex flex-col gap-4"
          >
            {/* Program selector */}
            <div>
              <label className="section-label block mb-2">Degree Program</label>
              <div className="relative">
                <select
                  value={programName}
                  onChange={e => setProgramName(e.target.value)}
                  className="input-field appearance-none pr-10 cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
                >
                  {programs.map(p => (
                    <option key={p.id} value={p.name} style={{ background: "#0c1525", color: "#fff" }}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                />
              </div>
            </div>

            {/* Drop zone */}
            <div
              role="button"
              tabIndex={0}
              className="relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-4 outline-none"
              style={{
                borderColor: dragActive ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)",
                background: dragActive ? "rgba(99,102,241,0.05)" : "rgba(255,255,255,0.015)",
                transform: dragActive ? "scale(1.01)" : "scale(1)",
              }}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              onKeyDown={e => e.key === "Enter" && inputRef.current?.click()}
              onMouseEnter={e => {
                if (!dragActive) {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)";
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)";
                }
              }}
              onMouseLeave={e => {
                if (!dragActive) {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)";
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.015)";
                }
              }}
            >
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept=".csv,.png,.jpg,.jpeg,.tiff,.bmp"
                onChange={handleChange}
              />

              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-all"
                style={{
                  background: dragActive ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${dragActive ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                <Upload
                  className="w-6 h-6 transition-colors"
                  style={{ color: dragActive ? "#818cf8" : "rgba(255,255,255,0.35)" }}
                />
              </div>

              <div className="text-center">
                <p className="text-sm font-semibold mb-1" style={{ color: dragActive ? "#fff" : "rgba(255,255,255,0.8)" }}>
                  {dragActive ? "Drop your file here" : "Upload your transcript"}
                </p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.32)" }}>
                  Drag & drop or click to browse
                </p>
              </div>

              <div className="flex items-center gap-2">
                {[
                  { icon: <FileText size={11} />, label: "CSV" },
                  { icon: <ImageIcon size={11} />, label: "PNG / JPG / TIFF" },
                ].map(t => (
                  <div
                    key={t.label}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.38)" }}
                  >
                    {t.icon} {t.label}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex flex-col gap-3"
          >
            {/* File preview */}
            <div
              className="flex items-center gap-4 p-4 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={isCSV
                  ? { background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }
                  : { background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }
                }
              >
                {isCSV
                  ? <FileText size={18} style={{ color: "#34d399" }} />
                  : <ImageIcon size={18} style={{ color: "#a78bfa" }} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{file.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {(file.size / 1024).toFixed(1)} KB · {isCSV ? "CSV Export" : "Image Scan"}
                </p>
              </div>
              <button
                onClick={removeFile}
                className="p-1.5 rounded-lg transition-all shrink-0"
                style={{ color: "rgba(255,255,255,0.35)" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "";
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)";
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Program confirmation */}
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
              style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}
            >
              <CheckCircle2 size={13} style={{ color: "#818cf8", flexShrink: 0 }} />
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                Program:{" "}
                <span className="font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>{programName}</span>
              </p>
            </div>

            {/* Submit */}
            <button
              onClick={submitFile}
              disabled={isLoading}
              className="btn-primary w-full py-3.5 text-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={17} />
                  Processing Transcript...
                </>
              ) : (
                <>
                  <CheckCircle2 size={17} />
                  Run Degree Audit
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
