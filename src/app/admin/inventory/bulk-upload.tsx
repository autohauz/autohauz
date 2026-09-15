"use client";

import { useState } from "react";
import { UploadCloud, FileSpreadsheet, X, CheckCircle2, AlertCircle } from "lucide-react";

// Uses the dedicated API route instead of a Server Action so that Vercel's
// 4.5 MB Server Action body limit does not block large spreadsheets.
const BULK_UPLOAD_API = "/api/admin/bulk-upload";
const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_UPLOAD_SIZE_MB = MAX_UPLOAD_SIZE_BYTES / 1024 / 1024;
const ACCEPTED_UPLOAD_TYPES = ".csv,.xlsx,.xls";

export function BulkUpload() {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{ success?: number; errors?: string[] } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const extension = selectedFile.name.split(".").pop()?.toLowerCase();

      if (!extension || !["csv", "xlsx", "xls"].includes(extension)) {
        setFile(null);
        setResult({ errors: ["Please upload a CSV or Excel spreadsheet (.csv, .xlsx, or .xls)."] });
        e.target.value = "";
        return;
      }

      if (selectedFile.size > MAX_UPLOAD_SIZE_BYTES) {
        setFile(null);
        setResult({ errors: [`Please upload a file smaller than ${MAX_UPLOAD_SIZE_MB} MB.`] });
        e.target.value = "";
        return;
      }

      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(BULK_UPLOAD_API, {
        method: "POST",
        body: formData,
        // Do NOT set Content-Type — browser sets it automatically with the
        // correct multipart boundary when body is FormData.
      });

      const json = await res.json();

      if (json.success) {
        setResult({ success: json.count, skipped: json.skipped ?? 0 });
        setFile(null);
      } else if (json.errors) {
        setResult({ errors: json.errors });
      } else {
        setResult({ errors: [json.error || "Upload failed. Please try again."] });
      }
    } catch (error) {
      console.error("Bulk upload request failed:", error);
      setResult({
        errors: ["Could not reach the server. Please check your connection and try again."],
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm hover:bg-muted transition-colors"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          Bulk Upload
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm mb-6 relative">
      <button 
        onClick={() => setIsOpen(false)}
        className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100/50 shrink-0">
          <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-foreground">Bulk Upload Vehicles</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your inventory spreadsheet. We support CSV and Excel formats. Ensure your columns match: Stock ID, Make, Model, Year, Price, etc.{" "}
            <a href="/templates/vehicle-upload-template.csv" download className="text-emerald-600 font-semibold hover:underline">
              Download the template here.
            </a>
          </p>

          <form onSubmit={handleUpload} className="mt-6 space-y-4 max-w-xl">
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-foreground">Inventory File</label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-border border-dashed rounded-xl cursor-pointer bg-card hover:bg-muted transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <UploadCloud className="w-8 h-8 mb-3 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground">
                      <span className="font-semibold text-emerald-600">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">CSV, XLSX, or XLS up to {MAX_UPLOAD_SIZE_MB} MB</p>
                  </div>
                  <input type="file" className="hidden" accept={ACCEPTED_UPLOAD_TYPES} onChange={handleFileChange} required />
                </label>
              </div>
              {file && <p className="text-sm font-medium text-emerald-600 mt-1 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> {file.name} selected</p>}
            </div>

            {result?.success !== undefined && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 flex gap-3 text-emerald-700">
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Successfully imported {result.success} vehicle{result.success !== 1 ? "s" : ""}!</p>
                  {result.skipped != null && result.skipped > 0 && (
                    <p className="mt-1 text-emerald-600/80">
                      {result.skipped} row{result.skipped !== 1 ? "s were" : " was"} skipped (missing required fields like Stock ID, Make, Model, or Price).
                    </p>
                  )}
                </div>
              </div>
            )}

            {result?.errors && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-destructive">
                <div className="flex gap-2 items-center font-bold mb-2">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  Import Failed
                </div>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {result.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}

            <button
              type="submit"
              disabled={!file || isUploading}
              className="mt-2 flex w-full justify-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isUploading ? "Processing..." : "Import Vehicles"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
