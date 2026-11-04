import React, { useState, useEffect } from "react";
import { IntegrationTabsHeader } from "../../components/IntegrationTabsHeader";
import {
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  X,
  Database,
  FileCode,
  Terminal,
} from "lucide-react";

export function FailedEventsPage() {
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [selectedError, setSelectedError] = useState(null);
  const [retryingId, setRetryingId] = useState(null);

  const fetchErrors = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/inventory/integrations/errors/");
      if (res.ok) {
        const json = await res.json();
        setErrors(json.results || json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, []);

  const handleRetry = async (id) => {
    setRetryingId(id);
    try {
      const res = await fetch(`/api/v1/inventory/integrations/errors/${id}/retry/`, { method: "POST" });
      if (res.ok) {
        await fetchErrors();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRetryingId(null);
    }
  };

  const handleResolve = async (id) => {
    try {
      const res = await fetch(`/api/v1/inventory/integrations/errors/${id}/resolve/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Resolved manually by operator from UI." }),
      });
      if (res.ok) {
        await fetchErrors();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const actions = (
    <button
      onClick={fetchErrors}
      className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
      title="Refresh DLQ"
    >
      <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
    </button>
  );

  const unresolvedCount = errors.filter((e) => e.status === "UNRESOLVED").length;

  return (
    <div className="space-y-6">
      <IntegrationTabsHeader
        title="Failed Events"
        subtitle="Dead-Letter Queue (DLQ) managing quarantined events, root-cause traces, and manual re-execution."
        icon={ShieldAlert}
        actions={actions}
      />

      {/* Alert Banner */}
      <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
        unresolvedCount > 0
          ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50"
          : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50"
      }`}>
        {unresolvedCount > 0 ? (
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        )}
        <div>
          <h4 className={`text-sm font-semibold ${unresolvedCount > 0 ? "text-rose-900 dark:text-rose-300" : "text-emerald-900 dark:text-emerald-300"}`}>
            {unresolvedCount > 0
              ? `${unresolvedCount} Unresolved Dead-Letter Queue Event(s)`
              : "Dead-Letter Queue Clean — No Unresolved Failures"}
          </h4>
          <p className={`text-xs mt-0.5 ${unresolvedCount > 0 ? "text-rose-700 dark:text-rose-300/80" : "text-emerald-700 dark:text-emerald-300/80"}`}>
            {unresolvedCount > 0
              ? "Quarantined events that exceeded max retry policies. Review root-cause traces below and trigger manual retry or mark resolved."
              : "All inbound and outgoing integration events have executed or published successfully without pipeline quarantine."}
          </p>
        </div>
      </div>

      {/* Errors Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs text-slate-700 dark:text-zinc-300">
            <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 uppercase font-semibold border-b border-slate-200 dark:border-zinc-800 text-[11px] whitespace-nowrap">
              <tr>
                <th className="p-3">Direction</th>
                <th className="p-3">Event Type</th>
                <th className="p-3">Error Reason</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Retries</th>
                <th className="p-3">Logged At</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 bg-white dark:bg-zinc-900/50">
              {errors.length > 0 ? (
                errors.map((err) => (
                  <tr key={err.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition">
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        err.direction === "INBOUND"
                          ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50"
                          : "bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/50"
                      }`}>
                        {err.direction}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-medium text-slate-900 dark:text-white">{err.event_type}</td>
                    <td className="p-3 text-rose-600 dark:text-rose-400 font-medium" title={err.error_message}>
                      <span className="block max-w-xs truncate">{err.error_message}</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        err.status === "UNRESOLVED"
                          ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50"
                          : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                      }`}>
                        {err.status}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums text-slate-600 dark:text-zinc-400">{err.retry_count}</td>
                    <td className="p-3 whitespace-nowrap tabular-nums text-slate-500 dark:text-zinc-400">{new Date(err.created_at).toLocaleString()}</td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedError(err)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-medium cursor-pointer transition inline-flex items-center gap-1"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Trace</span>
                      </button>
                      {err.status === "UNRESOLVED" && (
                        <>
                          <button
                            onClick={() => handleRetry(err.id)}
                            disabled={retryingId === err.id}
                            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium cursor-pointer transition inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${retryingId === err.id ? "animate-spin" : ""}`} />
                            <span>{retryingId === err.id ? "Retrying..." : "Retry"}</span>
                          </button>
                          <button
                            onClick={() => handleResolve(err.id)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-emerald-600 dark:text-emerald-400 text-xs font-medium cursor-pointer transition"
                          >
                            Resolve
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 dark:text-zinc-500 text-xs">
                    No failed events recorded in DLQ.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Error Trace & Payload Modal */}
      {selectedError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl max-w-3xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-zinc-800 pb-2">
              <h4 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" /> Error Stack Trace & Event Details
              </h4>
              <button
                onClick={() => setSelectedError(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Failure Message:</div>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 rounded-lg font-mono text-xs break-words">
                {selectedError.error_message}
              </div>
            </div>

            {selectedError.stack_trace && (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Stack Trace:</div>
                <pre className="bg-slate-950 p-3 rounded-lg font-mono text-[11px] text-slate-300 max-h-48 overflow-auto border border-slate-800">
                  {selectedError.stack_trace}
                </pre>
              </div>
            )}

            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Quarantined Payload:</div>
              <pre className="bg-slate-950 p-3 rounded-lg font-mono text-[11px] text-cyan-300 max-h-36 overflow-auto border border-slate-800">
                {JSON.stringify(selectedError.payload, null, 2)}
              </pre>
            </div>

            <div className="text-right">
              <button
                onClick={() => setSelectedError(null)}
                className="px-4 py-1.5 rounded bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-medium cursor-pointer"
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
export default FailedEventsPage;

