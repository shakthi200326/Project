import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  History,
  Upload,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  ArrowRight,
  Eye,
} from "lucide-react";
import { fetchImportHistory } from "../services/api.js";

export function ProductImportHistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedBatch, setSelectedBatch] = useState(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchImportHistory();
      setHistory(data?.results || (Array.isArray(data) ? data : []));
    } catch (err) {
      console.error("Failed to load import history:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter((h) => {
    const q = search.toLowerCase();
    return (
      !search ||
      h.file_name?.toLowerCase().includes(q) ||
      h.batch_id?.toLowerCase().includes(q) ||
      h.imported_by?.toLowerCase().includes(q) ||
      h.status?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Product Import History & Diagnostics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Complete audit trail of all historical spreadsheet imports, row counts, execution results, and error logs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadHistory}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            to="/inventory/products/import"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import Items
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by file name, batch ID, user..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">Batch ID</th>
                <th className="py-3.5 px-4">Uploaded File</th>
                <th className="py-3.5 px-4 text-center">Total Rows</th>
                <th className="py-3.5 px-4 text-center">Created</th>
                <th className="py-3.5 px-4 text-center">Updated</th>
                <th className="py-3.5 px-4 text-center">Failed</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading import history...
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-500">
                    No import batches found.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                      {String(h.batch_id).slice(0, 8)}...
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="truncate max-w-[200px]">{h.file_name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold">{h.total_rows}</td>
                    <td className="py-3.5 px-4 text-center text-emerald-600 font-semibold">{h.created_count}</td>
                    <td className="py-3.5 px-4 text-center text-blue-600 font-semibold">{h.updated_count}</td>
                    <td className="py-3.5 px-4 text-center text-red-600 font-semibold">{h.failed_count}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          h.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                            : h.status === "FAILED"
                            ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-800"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                        }`}
                      >
                        {h.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">{h.imported_by}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(h.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedBatch(h)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch Diagnostics Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  Import Batch Diagnostics
                </h3>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  Batch: {selectedBatch.batch_id} &bull; File: {selectedBatch.file_name}
                </div>
              </div>
              <button
                onClick={() => setSelectedBatch(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-slate-400">Total Rows</div>
                <div className="text-base font-bold text-slate-900 dark:text-slate-100">{selectedBatch.total_rows}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <div className="text-emerald-600">Created</div>
                <div className="text-base font-bold text-emerald-700">{selectedBatch.created_count}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                <div className="text-blue-600">Updated</div>
                <div className="text-base font-bold text-blue-700">{selectedBatch.updated_count}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
                <div className="text-red-600">Failed</div>
                <div className="text-base font-bold text-red-700">{selectedBatch.failed_count}</div>
              </div>
            </div>

            {selectedBatch.error_log && selectedBatch.error_log.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Logged Diagnostic Errors
                </div>
                <div className="max-h-60 overflow-y-auto border border-red-200 dark:border-red-800 rounded-lg p-3 bg-red-50/30 dark:bg-red-950/20">
                  <pre className="text-xs text-red-800 dark:text-red-300 font-mono whitespace-pre-wrap">
                    {JSON.stringify(selectedBatch.error_log, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                No errors recorded for this batch. All lines ingested cleanly without validation errors.
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedBatch(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default ProductImportHistoryPage;

