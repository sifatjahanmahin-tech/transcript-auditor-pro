"use client";

import React, { useState, useRef, useEffect } from "react";
import { Upload, X, FileText, Image as ImageIcon, Loader2, ChevronDown } from "lucide-react";
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
      // Fallback to known programs if fetch fails
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
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const submitFile = () => {
    if (!file) return;
    const ext = file.name.slice(((file.name.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase();
    const uploadType = ext === "csv" ? "csv" : "image";
    onUpload(file, uploadType, programName);
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      {!file ? (
        <div className="flex flex-col gap-4">
          {/* Program selector */}
          <div className="relative">
            <select
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary transition-all cursor-pointer pr-10"
            >
              {programs.map((p) => (
                <option key={p.id} value={p.name} className="bg-[#0f1729] text-white">
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
          </div>

          <div
            className={`relative border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
              dragActive ? "border-primary bg-primary/5 scale-[1.02]" : "border-white/10 hover:border-white/20"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".csv,.png,.jpg,.jpeg,.tiff,.bmp"
              onChange={handleChange}
            />
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-2">
              <Upload className="text-primary w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold mb-1">Upload your transcript</p>
              <p className="text-sm opacity-50">CSV, PNG, JPG, TIFF, or BMP</p>
            </div>
            <div className="flex gap-4 mt-4 opacity-40">
              <FileText size={20} />
              <ImageIcon size={20} />
            </div>
          </div>
        </div>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card glass p-8 flex flex-col items-center gap-6"
          >
            <div className="w-full flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                  {file.name.endsWith(".csv") ? <FileText className="text-primary" /> : <ImageIcon className="text-primary" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                  <span className="text-xs opacity-40">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              </div>
              <button
                onClick={removeFile}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="w-full text-xs opacity-50 text-center">
              Program: <span className="text-white font-medium">{programName}</span>
            </div>

            <button
              onClick={submitFile}
              disabled={isLoading}
              className="btn-primary w-full py-4 text-lg gap-3 disabled:opacity-50 disabled:translate-y-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Processing Transcript...
                </>
              ) : (
                "Run Degree Audit"
              )}
            </button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
