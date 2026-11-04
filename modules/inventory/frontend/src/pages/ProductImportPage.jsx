import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  History,
} from "lucide-react";
import { downloadImportTemplate, previewProductImport, commitProductImport } from "../services/api.js";

export function ProductImportPage() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setPreviewData(null);
      setErrorMsg("");
      setCommitResult(null);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setValidating(true);
    setErrorMsg("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await previewProductImport(formData);
      setPreviewData(res);
      setStep(2);
    } catch (err) {
      setErrorMsg(err.message || "Spreadsheet validation failed.");
    } finally {
      setValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!file) return;
    setCommitting(true);
    setErrorMsg("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await commitProductImport(formData);
      setCommitResult(res);
      setStep(3);
    } catch (err) {
      setErrorMsg(err.message || "Failed to commit import.");
    } finally {
      setCommitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setFile(null);
    setPreviewData(null);
    setCommitResult(null);
    setErrorMsg("");
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Upload className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Bulk Item & Product Import
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enterprise batch ingest with dry-run validation, row-by-row error diagnostics, and atomic commits.
          </p>
        </div>
        <Link
          to="/inventory/products/import-history"
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <History className="w-4 h-4" />
          View Import History
        </Link>
      </div>

      {/* Progress Steps */}
      <div className="grid grid-cols-3 gap-3">
        <div
          className={`p-3.5 rounded-xl border text-center transition-all ${
            step >= 1
              ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200"
              : "border-slate-200 dark:border-slate-800 text-slate-500"
          }`}
        >
          <div className="text-xs font-bold uppercase tracking-wider">Step 1</div>
          <div className="text-sm font-bold mt-0.5">Template & Upload</div>
        </div>

        <div
          className={`p-3.5 rounded-xl border text-center transition-all ${
            step >= 2
              ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200"
              : "border-slate-200 dark:border-slate-800 text-slate-500"
          }`}
        >
          <div className="text-xs font-bold uppercase tracking-wider">Step 2</div>
          <div className="text-sm font-bold mt-0.5">Dry-Run Preview</div>
        </div>

        <div
          className={`p-3.5 rounded-xl border text-center transition-all ${
            step === 3
              ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
              : "border-slate-200 dark:border-slate-800 text-slate-500"
          }`}
        >
          <div className="text-xs font-bold uppercase tracking-wider">Step 3</div>
          <div className="text-sm font-bold mt-0.5">Execution & Results</div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-sm flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Import Processing Error</div>
            <div>{errorMsg}</div>
          </div>
        </div>
      )}

      {/* Step 1: Upload & Template */}
      {step === 1 && (
        <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" /> Download Pre-Formatted Template
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Standard headers: <code>code, name, category, brand, base_unit, standard_cost, list_price, item_type</code>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadImportTemplate("csv")}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200"
              >
                Download CSV
              </button>
              <button
                type="button"
                onClick={() => downloadImportTemplate("xlsx")}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Download Excel (.xlsx)
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
              Select CSV or Excel File to Import *
            </label>
            <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center bg-slate-50/50 dark:bg-slate-800/30">
              <input
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
              />
              {file && (
                <div className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Ready to validate: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!file || validating}
              onClick={handlePreview}
              className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm flex items-center gap-2"
            >
              {validating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running Dry-Run Validation...
                </>
              ) : (
                <>
                  Validate & Preview Rows
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Validation Preview */}
      {step === 2 && previewData && (
        <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center">
              <div className="text-xs text-slate-500 uppercase">Total Rows</div>
              <div className="text-xl font-bold mt-1 text-slate-900 dark:text-slate-100">{previewData.total_rows}</div>
            </div>
            <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-center">
              <div className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-semibold">Valid Rows</div>
              <div className="text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-300">{previewData.valid_rows_count}</div>
            </div>
            <div className="p-3.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-center">
              <div className="text-xs text-blue-600 dark:text-blue-400 uppercase font-semibold">New / Updates</div>
              <div className="text-xl font-bold mt-1 text-blue-700 dark:text-blue-300">
                {previewData.new_count} / {previewData.update_count}
              </div>
            </div>
            <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-center">
              <div className="text-xs text-red-600 dark:text-red-400 uppercase font-semibold">Invalid Rows</div>
              <div className="text-xl font-bold mt-1 text-red-700 dark:text-red-300">{previewData.error_rows_count}</div>
            </div>
          </div>

          {/* Error Table if Any */}
          {previewData.errors && previewData.errors.length > 0 && (
            <div className="p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30 space-y-3">
              <div className="text-sm font-bold text-red-800 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Row-Level Validation Errors Detected ({previewData.errors.length})
              </div>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
                      <th className="py-1.5 px-2">Row #</th>
                      <th className="py-1.5 px-2">Item Code</th>
                      <th className="py-1.5 px-2">Invalid Field</th>
                      <th className="py-1.5 px-2">Failure Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100 dark:divide-red-900/40 text-red-800 dark:text-red-300">
                    {previewData.errors.map((err, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 px-2 font-mono">{err.row}</td>
                        <td className="py-1.5 px-2 font-mono font-bold">{err.code || "—"}</td>
                        <td className="py-1.5 px-2 font-semibold">{err.field}</td>
                        <td className="py-1.5 px-2">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Valid Preview Table */}
          {previewData.preview && previewData.preview.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Sample Valid Rows (First {previewData.preview.length})
              </div>
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2 px-3">Code</th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3">Brand</th>
                      <th className="py-2 px-3">UOM</th>
                      <th className="py-2 px-3">Cost</th>
                      <th className="py-2 px-3">Price</th>
                      <th className="py-2 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {previewData.preview.map((r, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 font-mono font-bold">{r.code}</td>
                        <td className="py-2 px-3">{r.name}</td>
                        <td className="py-2 px-3">{r.category}</td>
                        <td className="py-2 px-3">{r.brand || "—"}</td>
                        <td className="py-2 px-3">{r.base_unit}</td>
                        <td className="py-2 px-3">${r.cost}</td>
                        <td className="py-2 px-3">${r.price}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.action === "UPDATE"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                            }`}
                          >
                            {r.action}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
            >
              &larr; Re-upload File
            </button>
            <button
              type="button"
              disabled={committing || previewData.valid_rows_count === 0}
              onClick={handleCommit}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-sm flex items-center gap-2"
            >
              {committing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Committing Rows Atomically...
                </>
              ) : (
                `Commit ${previewData.valid_rows_count} Valid Items`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Success Execution */}
      {step === 3 && commitResult && (
        <div className="p-8 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Import Completed Successfully</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            {commitResult.message ||
              `Created ${commitResult.created_count} products and updated ${commitResult.updated_count} existing items.`}
          </p>

          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
            >
              Import Another File
            </button>
            <Link
              to="/inventory/products"
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              View In Catalog &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
export default ProductImportPage;

