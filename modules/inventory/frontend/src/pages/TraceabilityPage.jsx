import { useState, useEffect, useCallback } from "react";
import {
  fetchForwardTraceability,
  fetchBackwardTraceability,
  fetchMovementTimeline,
  fetchBatchesFiltered,
  quarantineBatch,
  releaseBatch,
  fetchProductRecalls,
  createProductRecall,
  initiateRecall,
  quarantineRecallBatches,
  recordRecallReturn,
  closeRecall,
  fetchRecallActions,
  fetchItems,
} from "../services/api";
import { ScrollableTabs } from "../components/ScrollableTabs.jsx";

// ─── Shared Utilities ────────────────────────────────────────────────────────

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

function Badge({ label, color }) {
  const colorMap = {
    green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    orange: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    gray: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    slate: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  };
  return (
    <span
      className={classNames(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold",
        colorMap[color] || colorMap.gray
      )}
    >
      {label}
    </span>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center items-center py-10">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="text-center py-14 text-gray-400 dark:text-gray-500">
      <svg className="mx-auto mb-3 h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-6m3 6V9m3 8v-4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ErrorAlert({ message, onDismiss }) {
  return (
    <div className="rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 p-4 mb-4 flex items-start gap-3">
      <svg className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-5.25a.75.75 0 001.5 0V10a.75.75 0 00-1.5 0v2.75zm.75-6a.75.75 0 100 1.5.75.75 0 000-1.5z" clipRule="evenodd" />
      </svg>
      <p className="text-sm text-red-700 dark:text-red-300 flex-1">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-400 hover:text-red-600 dark:hover:text-red-200">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      )}
    </div>
  );
}

function SuccessAlert({ message, onDismiss }) {
  return (
    <div className="rounded-md bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 p-4 mb-4 flex items-start gap-3">
      <svg className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
      </svg>
      <p className="text-sm text-green-700 dark:text-green-300 flex-1">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="text-green-400 hover:text-green-600">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Modal Wrapper ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Input / Button Shared Styles ─────────────────────────────────────────────

const inputCls =
  "block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 dark:placeholder-gray-500";

const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 transition disabled:opacity-50 disabled:cursor-not-allowed";

const btnSecondary =
  "inline-flex items-center gap-2 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium px-4 py-2 transition disabled:opacity-50";

const btnDanger =
  "inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 transition disabled:opacity-50";

// ─── Tab 1: Forward Traceability ──────────────────────────────────────────────

function TransactionTypeBadge({ type }) {
  const isIn = String(type).toUpperCase() === "IN";
  return <Badge label={type} color={isIn ? "green" : "red"} />;
}

function TraceabilityStepCard({ step, index }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex-shrink-0">
          {index + 1}
        </div>
        <div className="w-0.5 flex-1 bg-indigo-200 dark:bg-indigo-700 mt-1" />
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-3 flex-1 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <TransactionTypeBadge type={step.transaction_type || step.movement_type || "—"} />
          <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(step.date || step.created_at)}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Reference: </span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{step.reference || step.document_number || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Warehouse: </span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{step.warehouse || step.warehouse_name || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Quantity: </span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{step.quantity ?? "—"}</span>
          </div>
          {step.notes && (
            <div className="col-span-2">
              <span className="text-gray-500 dark:text-gray-400">Notes: </span>
              <span className="text-gray-700 dark:text-gray-300">{step.notes}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ForwardTraceabilityTab() {
  const [mode, setMode] = useState("batch"); // "batch" | "serial"
  const [batchNumber, setBatchNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTrace = useCallback(async () => {
    const params = mode === "batch" ? { batch_number: batchNumber } : { serial_number: serialNumber };
    if (!params.batch_number && !params.serial_number) {
      setError("Please enter a value to trace.");
      return;
    }
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const data = await fetchForwardTraceability(params);
      setResults(Array.isArray(data) ? data : data?.results ?? []);
    } catch (err) {
      setError(err?.message || "Failed to fetch forward traceability data.");
    } finally {
      setLoading(false);
    }
  }, [mode, batchNumber, serialNumber]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Forward Traceability</h2>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { setMode("batch"); setResults(null); setError(""); }}
            className={classNames(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition",
              mode === "batch"
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            )}
          >
            Batch Number
          </button>
          <button
            onClick={() => { setMode("serial"); setResults(null); setError(""); }}
            className={classNames(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition",
              mode === "serial"
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            )}
          >
            Serial Number
          </button>
        </div>
        <div className="flex gap-3">
          {mode === "batch" ? (
            <input
              type="text"
              className={inputCls}
              placeholder="Enter batch number…"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTrace()}
            />
          ) : (
            <input
              type="text"
              className={inputCls}
              placeholder="Enter serial number…"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTrace()}
            />
          )}
          <button onClick={handleTrace} disabled={loading} className={btnPrimary}>
            {loading ? "Tracing…" : "Trace Forward"}
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError("")} />}
      {loading && <Spinner />}

      {results !== null && !loading && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
            Forward Chain — {results.length} step{results.length !== 1 ? "s" : ""}
          </h3>
          {results.length === 0 ? (
            <EmptyState message="No movements found for this batch / serial number." />
          ) : (
            <div className="pb-4">
              {results.map((step, idx) => (
                <TraceabilityStepCard key={idx} step={step} index={idx} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Backward Traceability ─────────────────────────────────────────────

function BackwardEntryCard({ entry, index }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs font-bold flex-shrink-0">
          {index + 1}
        </div>
        <div className="w-0.5 flex-1 bg-purple-200 dark:bg-purple-700 mt-1" />
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-3 flex-1 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge label={entry.movement_type || entry.transaction_type || "—"} color="blue" />
          <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(entry.date || entry.created_at)}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Reference: </span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{entry.reference || entry.document_number || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Ext. Reference: </span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{entry.external_reference || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Item: </span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{entry.item || entry.item_name || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Warehouse: </span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{entry.warehouse || entry.warehouse_name || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Quantity: </span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{entry.quantity ?? "—"}</span>
          </div>
          {entry.location && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">Location: </span>
              <span className="font-medium text-gray-800 dark:text-gray-200">{entry.location}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BackwardTraceabilityTab() {
  const [mode, setMode] = useState("batch");
  const [batchNumber, setBatchNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTrace = useCallback(async () => {
    const params = mode === "batch" ? { batch_number: batchNumber } : { serial_number: serialNumber };
    if (!params.batch_number && !params.serial_number) {
      setError("Please enter a value to trace.");
      return;
    }
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const data = await fetchBackwardTraceability(params);
      setResults(Array.isArray(data) ? data : data?.results ?? []);
    } catch (err) {
      setError(err?.message || "Failed to fetch backward traceability data.");
    } finally {
      setLoading(false);
    }
  }, [mode, batchNumber, serialNumber]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Backward Traceability</h2>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { setMode("batch"); setResults(null); setError(""); }}
            className={classNames(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition",
              mode === "batch"
                ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            )}
          >
            Batch Number
          </button>
          <button
            onClick={() => { setMode("serial"); setResults(null); setError(""); }}
            className={classNames(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition",
              mode === "serial"
                ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            )}
          >
            Serial Number
          </button>
        </div>
        <div className="flex gap-3">
          {mode === "batch" ? (
            <input
              type="text"
              className={inputCls}
              placeholder="Enter batch number…"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTrace()}
            />
          ) : (
            <input
              type="text"
              className={inputCls}
              placeholder="Enter serial number…"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTrace()}
            />
          )}
          <button onClick={handleTrace} disabled={loading} className={classNames(btnPrimary, "bg-purple-600 hover:bg-purple-700")}>
            {loading ? "Tracing…" : "Trace Backward"}
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError("")} />}
      {loading && <Spinner />}

      {results !== null && !loading && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
            Upstream Chain — {results.length} entr{results.length !== 1 ? "ies" : "y"}
          </h3>
          {results.length === 0 ? (
            <EmptyState message="No upstream chain found for this batch / serial number." />
          ) : (
            <div className="pb-4">
              {results.map((entry, idx) => (
                <BackwardEntryCard key={idx} entry={entry} index={idx} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Movement Timeline ─────────────────────────────────────────────────

function TimelineEvent({ event, isLast }) {
  const isIn = String(event.transaction_type || event.direction || "").toUpperCase() === "IN";
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={classNames(
            "w-4 h-4 rounded-full border-2 flex-shrink-0 mt-1",
            isIn
              ? "bg-green-400 border-green-600 dark:bg-green-500 dark:border-green-400"
              : "bg-red-400 border-red-600 dark:bg-red-500 dark:border-red-400"
          )}
        />
        {!isLast && <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 mt-1" />}
      </div>
      <div className="flex gap-4 pb-6 flex-1">
        <div className="text-xs text-gray-500 dark:text-gray-400 w-32 flex-shrink-0 pt-0.5">
          {formatDate(event.date || event.created_at)}
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex-1 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <TransactionTypeBadge type={event.transaction_type || event.direction || "—"} />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Reference: </span>
              <span className="font-medium text-gray-800 dark:text-gray-200">{event.reference || event.document_number || "—"}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Warehouse: </span>
              <span className="font-medium text-gray-800 dark:text-gray-200">{event.warehouse || event.warehouse_name || "—"}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Quantity: </span>
              <span className="font-medium text-gray-800 dark:text-gray-200">{event.quantity ?? "—"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MovementTimelineTab() {
  const [mode, setMode] = useState("batch");
  const [batchNumber, setBatchNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleView = useCallback(async () => {
    const params = mode === "batch" ? { batch_number: batchNumber } : { serial_number: serialNumber };
    if (!params.batch_number && !params.serial_number) {
      setError("Please enter a value to view timeline.");
      return;
    }
    setLoading(true);
    setError("");
    setTimeline(null);
    try {
      const data = await fetchMovementTimeline(params);
      setTimeline(Array.isArray(data) ? data : data?.results ?? []);
    } catch (err) {
      setError(err?.message || "Failed to fetch movement timeline.");
    } finally {
      setLoading(false);
    }
  }, [mode, batchNumber, serialNumber]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Movement Timeline</h2>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { setMode("batch"); setTimeline(null); setError(""); }}
            className={classNames(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition",
              mode === "batch"
                ? "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            )}
          >
            Batch Number
          </button>
          <button
            onClick={() => { setMode("serial"); setTimeline(null); setError(""); }}
            className={classNames(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition",
              mode === "serial"
                ? "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            )}
          >
            Serial Number
          </button>
        </div>
        <div className="flex gap-3">
          {mode === "batch" ? (
            <input
              type="text"
              className={inputCls}
              placeholder="Enter batch number…"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleView()}
            />
          ) : (
            <input
              type="text"
              className={inputCls}
              placeholder="Enter serial number…"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleView()}
            />
          )}
          <button onClick={handleView} disabled={loading} className={classNames(btnPrimary, "bg-teal-600 hover:bg-teal-700")}>
            {loading ? "Loading…" : "View Timeline"}
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError("")} />}
      {loading && <Spinner />}

      {timeline !== null && !loading && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">
            Chronological Timeline — {timeline.length} event{timeline.length !== 1 ? "s" : ""}
          </h3>
          {timeline.length === 0 ? (
            <EmptyState message="No timeline events found for this batch / serial number." />
          ) : (
            <div className="pl-2">
              {timeline.map((event, idx) => (
                <TimelineEvent key={idx} event={event} isLast={idx === timeline.length - 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab 4: Quarantine & Release ──────────────────────────────────────────────

const QUARANTINE_REASONS = [
  "Quality Issue",
  "Damage",
  "Expired / Near Expiry",
  "Contamination",
  "Regulatory Hold",
  "Customer Complaint",
  "Supplier Dispute",
  "Other",
];

function ReleaseModal({ batch, onClose, onSuccess }) {
  const [form, setForm] = useState({
    release_quantity: "",
    inspection_result: "Passed",
    release_reason: "",
    released_by: "",
    release_date: new Date().toISOString().slice(0, 10),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.release_quantity || Number(form.release_quantity) <= 0) {
      setError("Release quantity must be greater than 0.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await releaseBatch(batch.id, form);
      onSuccess();
    } catch (err) {
      setError(err?.message || "Failed to release batch.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Release Batch — ${batch.batch_number}`} onClose={onClose}>
      {error && <ErrorAlert message={error} onDismiss={() => setError("")} />}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Release Quantity <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="release_quantity"
            min="0.001"
            step="any"
            className={inputCls}
            value={form.release_quantity}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Inspection Result
          </label>
          <select name="inspection_result" className={inputCls} value={form.inspection_result} onChange={handleChange}>
            <option>Passed</option>
            <option>Failed</option>
            <option>Partially Passed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Release Reason
          </label>
          <input
            type="text"
            name="release_reason"
            className={inputCls}
            placeholder="Reason for release…"
            value={form.release_reason}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Released By
          </label>
          <input
            type="text"
            name="released_by"
            className={inputCls}
            placeholder="Name or ID of releaser…"
            value={form.released_by}
            onChange={handleChange}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Release Date
          </label>
          <input type="date" name="release_date" className={inputCls} value={form.release_date} onChange={handleChange} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={loading} className={btnPrimary}>
            {loading ? "Releasing…" : "Release Batch"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function QuarantineTab() {
  const [quarantinedBatches, setQuarantinedBatches] = useState([]);
  const [loadingQuarantined, setLoadingQuarantined] = useState(true);
  const [quarantinedError, setQuarantinedError] = useState("");
  const [releaseTarget, setReleaseTarget] = useState(null);
  const [releaseSuccess, setReleaseSuccess] = useState("");

  // Initiate Quarantine state
  const [batchLookup, setBatchLookup] = useState("");
  const [foundBatch, setFoundBatch] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [qForm, setQForm] = useState({
    quarantine_quantity: "",
    quarantine_reason: QUARANTINE_REASONS[0],
    quarantine_date: new Date().toISOString().slice(0, 10),
    remarks: "",
  });
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState("");
  const [qSuccess, setQSuccess] = useState("");

  const loadQuarantined = useCallback(async () => {
    setLoadingQuarantined(true);
    setQuarantinedError("");
    try {
      const data = await fetchBatchesFiltered({ batch_status: "Quarantined" });
      setQuarantinedBatches(Array.isArray(data) ? data : data?.results ?? []);
    } catch (err) {
      setQuarantinedError(err?.message || "Failed to load quarantined batches.");
    } finally {
      setLoadingQuarantined(false);
    }
  }, []);

  useEffect(() => { loadQuarantined(); }, [loadQuarantined]);

  const handleFindBatch = async () => {
    if (!batchLookup.trim()) return;
    setLookupLoading(true);
    setLookupError("");
    setFoundBatch(null);
    try {
      const data = await fetchBatchesFiltered({ batch_number: batchLookup.trim() });
      const list = Array.isArray(data) ? data : data?.results ?? [];
      if (list.length === 0) {
        setLookupError("No batch found with that number.");
      } else {
        setFoundBatch(list[0]);
        setQForm((f) => ({ ...f, quarantine_quantity: list[0].available_quantity || list[0].quantity || "" }));
      }
    } catch (err) {
      setLookupError(err?.message || "Failed to find batch.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleQChange = (e) => setQForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleQuarantine = async (e) => {
    e.preventDefault();
    if (!foundBatch) return;
    if (!qForm.quarantine_quantity || Number(qForm.quarantine_quantity) <= 0) {
      setQError("Quarantine quantity must be greater than 0.");
      return;
    }
    setQLoading(true);
    setQError("");
    setQSuccess("");
    try {
      await quarantineBatch(foundBatch.id, qForm);
      setQSuccess(`Batch ${foundBatch.batch_number} quarantined successfully.`);
      setFoundBatch(null);
      setBatchLookup("");
      setQForm({ quarantine_quantity: "", quarantine_reason: QUARANTINE_REASONS[0], quarantine_date: new Date().toISOString().slice(0, 10), remarks: "" });
      loadQuarantined();
    } catch (err) {
      setQError(err?.message || "Failed to quarantine batch.");
    } finally {
      setQLoading(false);
    }
  };

  const handleReleaseSuccess = () => {
    setReleaseTarget(null);
    setReleaseSuccess(`Batch ${releaseTarget?.batch_number} released successfully.`);
    loadQuarantined();
  };

  return (
    <div className="space-y-8">
      {/* Active Quarantines */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Active Quarantines</h2>
          <button onClick={loadQuarantined} className={btnSecondary} disabled={loadingQuarantined}>
            {loadingQuarantined ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {releaseSuccess && <div className="px-5 pt-4"><SuccessAlert message={releaseSuccess} onDismiss={() => setReleaseSuccess("")} /></div>}
        {quarantinedError && <div className="px-5 pt-4"><ErrorAlert message={quarantinedError} onDismiss={() => setQuarantinedError("")} /></div>}
        {loadingQuarantined ? (
          <Spinner />
        ) : quarantinedBatches.length === 0 ? (
          <EmptyState message="No quarantined batches." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  {["Batch #", "Item", "Warehouse", "Quarantined Qty", "Quarantine Date", "Reason", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {quarantinedBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                    <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900 dark:text-white">{b.batch_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{b.item_name || b.item || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{b.warehouse_name || b.warehouse || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{b.quarantined_quantity ?? b.quantity ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(b.quarantine_date || b.updated_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{b.quarantine_reason || "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setReleaseTarget(b)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60 transition"
                      >
                        Release
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Initiate Quarantine */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Initiate Quarantine</h2>
        {qSuccess && <SuccessAlert message={qSuccess} onDismiss={() => setQSuccess("")} />}
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            className={inputCls}
            placeholder="Enter batch number to look up…"
            value={batchLookup}
            onChange={(e) => setBatchLookup(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFindBatch()}
          />
          <button onClick={handleFindBatch} disabled={lookupLoading} className={btnPrimary}>
            {lookupLoading ? "Finding…" : "Find Batch"}
          </button>
        </div>
        {lookupError && <ErrorAlert message={lookupError} onDismiss={() => setLookupError("")} />}

        {foundBatch && (
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-4">
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                <div><span className="text-gray-500 dark:text-gray-400">Batch #: </span><span className="font-semibold text-gray-900 dark:text-white">{foundBatch.batch_number}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Item: </span><span className="font-medium text-gray-800 dark:text-gray-200">{foundBatch.item_name || foundBatch.item || "—"}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Warehouse: </span><span className="font-medium text-gray-800 dark:text-gray-200">{foundBatch.warehouse_name || foundBatch.warehouse || "—"}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Available Qty: </span><span className="font-medium text-gray-800 dark:text-gray-200">{foundBatch.available_quantity ?? foundBatch.quantity ?? "—"}</span></div>
              </div>
            </div>
            {qError && <ErrorAlert message={qError} onDismiss={() => setQError("")} />}
            <form onSubmit={handleQuarantine} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quarantine Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="quarantine_quantity"
                  min="0.001"
                  step="any"
                  className={inputCls}
                  value={qForm.quarantine_quantity}
                  onChange={handleQChange}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quarantine Reason
                </label>
                <select name="quarantine_reason" className={inputCls} value={qForm.quarantine_reason} onChange={handleQChange}>
                  {QUARANTINE_REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quarantine Date
                </label>
                <input type="date" name="quarantine_date" className={inputCls} value={qForm.quarantine_date} onChange={handleQChange} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Remarks
                </label>
                <input type="text" name="remarks" className={inputCls} placeholder="Additional remarks…" value={qForm.remarks} onChange={handleQChange} />
              </div>
              <div className="col-span-2 flex justify-end gap-3">
                <button type="button" onClick={() => { setFoundBatch(null); setBatchLookup(""); }} className={btnSecondary}>Cancel</button>
                <button type="submit" disabled={qLoading} className={classNames(btnPrimary, "bg-amber-600 hover:bg-amber-700")}>
                  {qLoading ? "Quarantining…" : "Quarantine Batch"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Release Modal */}
      {releaseTarget && (
        <ReleaseModal
          batch={releaseTarget}
          onClose={() => setReleaseTarget(null)}
          onSuccess={handleReleaseSuccess}
        />
      )}
    </div>
  );
}

// ─── Tab 5: Product Recall ────────────────────────────────────────────────────

const RECALL_TYPES = ["MANDATORY", "VOLUNTARY", "PRECAUTIONARY"];
const RECALL_PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

function priorityColor(p) {
  switch (String(p).toUpperCase()) {
    case "CRITICAL": return "red";
    case "HIGH": return "orange";
    case "MEDIUM": return "yellow";
    case "LOW": return "gray";
    default: return "gray";
  }
}

function statusColor(s) {
  switch (String(s).toUpperCase()) {
    case "DRAFT": return "gray";
    case "INITIATED": return "blue";
    case "IN PROGRESS":
    case "IN_PROGRESS": return "orange";
    case "RESOLVED": return "green";
    case "CLOSED": return "slate";
    default: return "gray";
  }
}

function QuarantineRecallModal({ recall, onClose, onSuccess }) {
  const [form, setForm] = useState({ quantity: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await quarantineRecallBatches(recall.id, form);
      onSuccess("Stock quarantined successfully.");
    } catch (err) {
      setError(err?.message || "Failed to quarantine recall stock.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal title={`Quarantine Stock — ${recall.recall_number || recall.title}`} onClose={onClose}>
      {error && <ErrorAlert message={error} onDismiss={() => setError("")} />}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
          <input type="number" name="quantity" min="0" step="any" className={inputCls} value={form.quantity} onChange={handleChange} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
          <textarea name="notes" rows={3} className={inputCls} placeholder="Notes…" value={form.notes} onChange={handleChange} />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={loading} className={classNames(btnPrimary, "bg-amber-600 hover:bg-amber-700")}>
            {loading ? "Quarantining…" : "Quarantine"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RecordReturnModal({ recall, onClose, onSuccess }) {
  const [form, setForm] = useState({ quantity: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await recordRecallReturn(recall.id, form);
      onSuccess("Return recorded successfully.");
    } catch (err) {
      setError(err?.message || "Failed to record return.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal title={`Record Return — ${recall.recall_number || recall.title}`} onClose={onClose}>
      {error && <ErrorAlert message={error} onDismiss={() => setError("")} />}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity Returned</label>
          <input type="number" name="quantity" min="0" step="any" className={inputCls} value={form.quantity} onChange={handleChange} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
          <textarea name="notes" rows={3} className={inputCls} placeholder="Notes…" value={form.notes} onChange={handleChange} />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={loading} className={btnPrimary}>
            {loading ? "Recording…" : "Record Return"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CloseRecallModal({ recall, onClose, onSuccess }) {
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await closeRecall(recall.id, { corrective_action: correctiveAction });
      onSuccess("Recall closed successfully.");
    } catch (err) {
      setError(err?.message || "Failed to close recall.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal title={`Close Recall — ${recall.recall_number || recall.title}`} onClose={onClose}>
      {error && <ErrorAlert message={error} onDismiss={() => setError("")} />}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Corrective Action <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={4}
            className={inputCls}
            placeholder="Describe the corrective action taken…"
            value={correctiveAction}
            onChange={(e) => setCorrectiveAction(e.target.value)}
            required
          />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={loading} className={classNames(btnPrimary, "bg-slate-600 hover:bg-slate-700")}>
            {loading ? "Closing…" : "Close Recall"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RecallActionsPanel({ recallId }) {
  const [actions, setActions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchRecallActions(recallId)
      .then((data) => setActions(Array.isArray(data) ? data : data?.results ?? []))
      .catch((err) => setError(err?.message || "Failed to load actions."))
      .finally(() => setLoading(false));
  }, [recallId]);

  if (loading) return <Spinner />;
  if (error) return <ErrorAlert message={error} />;
  if (!actions || actions.length === 0) return <EmptyState message="No actions recorded for this recall." />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            {["Action Type", "Description", "Performed By", "Date", "Notes"].map((h) => (
              <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {actions.map((a, idx) => (
            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{a.action_type || "—"}</td>
              <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{a.description || "—"}</td>
              <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{a.performed_by || "—"}</td>
              <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{formatDate(a.date || a.created_at)}</td>
              <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{a.notes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecallRow({ recall, onAction, onViewActions, expandedId }) {
  const isExpanded = expandedId === recall.id;
  return (
    <>
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
        <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900 dark:text-white">{recall.recall_number || "—"}</td>
        <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 max-w-xs truncate">{recall.title}</td>
        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{recall.item_name || recall.item || "—"}</td>
        <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">{recall.batch_number || "—"}</td>
        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{recall.recall_type || "—"}</td>
        <td className="px-4 py-3"><Badge label={recall.priority} color={priorityColor(recall.priority)} /></td>
        <td className="px-4 py-3"><Badge label={recall.status} color={statusColor(recall.status)} /></td>
        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(recall.initiated_date || recall.created_at)}</td>
        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{recall.affected_quantity ?? "—"}</td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {String(recall.status).toUpperCase() === "DRAFT" && (
              <button
                onClick={() => onAction("initiate", recall)}
                className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 font-medium transition"
              >
                Initiate
              </button>
            )}
            <button
              onClick={() => onAction("quarantine", recall)}
              className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 font-medium transition"
            >
              Quarantine Stock
            </button>
            <button
              onClick={() => onAction("return", recall)}
              className="text-xs px-2 py-1 rounded bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900/40 dark:text-teal-300 font-medium transition"
            >
              Record Return
            </button>
            <button
              onClick={() => onAction("close", recall)}
              className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 font-medium transition"
            >
              Close
            </button>
            <button
              onClick={() => onViewActions(recall.id)}
              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 font-medium transition"
            >
              {isExpanded ? "Hide Actions" : "View Actions"}
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={10} className="px-4 py-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700">
            <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <RecallActionsPanel recallId={recall.id} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function CreateRecallForm({ items, onSuccess, onCancel }) {
  const [form, setForm] = useState({
    title: "",
    item: "",
    recall_type: "MANDATORY",
    priority: "HIGH",
    reason: "",
    description: "",
    affected_quantity: "",
    batch_number: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError("Title is required."); return; }
    setLoading(true);
    setError("");
    try {
      const payload = { ...form };
      if (!payload.batch_number) delete payload.batch_number;
      await createProductRecall(payload);
      onSuccess("Product recall created successfully.");
    } catch (err) {
      setError(err?.message || "Failed to create product recall.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5">Create Product Recall</h2>
      {error && <ErrorAlert message={error} onDismiss={() => setError("")} />}
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input type="text" name="title" className={inputCls} placeholder="Recall title…" value={form.title} onChange={handleChange} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Item
          </label>
          <select name="item" className={inputCls} value={form.item} onChange={handleChange}>
            <option value="">— Select Item —</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{it.name || it.item_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Batch Number (optional)</label>
          <input type="text" name="batch_number" className={inputCls} placeholder="Batch number…" value={form.batch_number} onChange={handleChange} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recall Type</label>
          <select name="recall_type" className={inputCls} value={form.recall_type} onChange={handleChange}>
            {RECALL_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
          <select name="priority" className={inputCls} value={form.priority} onChange={handleChange}>
            {RECALL_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Affected Quantity</label>
          <input type="number" name="affected_quantity" min="0" step="any" className={inputCls} placeholder="0" value={form.affected_quantity} onChange={handleChange} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
          <textarea name="reason" rows={2} className={inputCls} placeholder="Reason for recall…" value={form.reason} onChange={handleChange} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea name="description" rows={3} className={inputCls} placeholder="Detailed description…" value={form.description} onChange={handleChange} />
        </div>
        <div className="col-span-2 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={loading} className={classNames(btnPrimary, "bg-red-600 hover:bg-red-700")}>
            {loading ? "Creating…" : "Create Recall"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProductRecallTab() {
  const [view, setView] = useState("list"); // "list" | "create"
  const [recalls, setRecalls] = useState([]);
  const [loadingRecalls, setLoadingRecalls] = useState(true);
  const [recallError, setRecallError] = useState("");
  const [items, setItems] = useState([]);
  const [recallSuccess, setRecallSuccess] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  // Action modals
  const [activeModal, setActiveModal] = useState(null); // { type: "quarantine"|"return"|"close", recall }

  const loadRecalls = useCallback(async () => {
    setLoadingRecalls(true);
    setRecallError("");
    try {
      const data = await fetchProductRecalls();
      setRecalls(Array.isArray(data) ? data : data?.results ?? []);
    } catch (err) {
      setRecallError(err?.message || "Failed to load product recalls.");
    } finally {
      setLoadingRecalls(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const data = await fetchItems();
      setItems(Array.isArray(data) ? data : data?.results ?? []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    loadRecalls();
    loadItems();
  }, [loadRecalls, loadItems]);

  const handleAction = async (type, recall) => {
    if (type === "initiate") {
      try {
        await initiateRecall(recall.id);
        setRecallSuccess(`Recall ${recall.recall_number || recall.title} initiated.`);
        loadRecalls();
      } catch (err) {
        setRecallError(err?.message || "Failed to initiate recall.");
      }
    } else {
      setActiveModal({ type, recall });
    }
  };

  const handleModalSuccess = (message) => {
    setActiveModal(null);
    setRecallSuccess(message);
    loadRecalls();
  };

  const handleViewActions = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleCreateSuccess = (message) => {
    setRecallSuccess(message);
    setView("list");
    loadRecalls();
  };

  if (view === "create") {
    return (
      <CreateRecallForm
        items={items}
        onSuccess={handleCreateSuccess}
        onCancel={() => setView("list")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Product Recalls</h2>
        <div className="flex gap-3">
          <button onClick={loadRecalls} disabled={loadingRecalls} className={btnSecondary}>
            {loadingRecalls ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={() => { setView("create"); setRecallSuccess(""); setRecallError(""); }}
            className={classNames(btnPrimary, "bg-red-600 hover:bg-red-700")}
          >
            + Create Recall
          </button>
        </div>
      </div>

      {recallSuccess && <SuccessAlert message={recallSuccess} onDismiss={() => setRecallSuccess("")} />}
      {recallError && <ErrorAlert message={recallError} onDismiss={() => setRecallError("")} />}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {loadingRecalls ? (
          <Spinner />
        ) : recalls.length === 0 ? (
          <EmptyState message="No product recalls found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  {["Recall #", "Title", "Item", "Batch", "Type", "Priority", "Status", "Initiated", "Affected Qty", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {recalls.map((recall) => (
                  <RecallRow
                    key={recall.id}
                    recall={recall}
                    onAction={handleAction}
                    onViewActions={handleViewActions}
                    expandedId={expandedId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Modals */}
      {activeModal?.type === "quarantine" && (
        <QuarantineRecallModal
          recall={activeModal.recall}
          onClose={() => setActiveModal(null)}
          onSuccess={handleModalSuccess}
        />
      )}
      {activeModal?.type === "return" && (
        <RecordReturnModal
          recall={activeModal.recall}
          onClose={() => setActiveModal(null)}
          onSuccess={handleModalSuccess}
        />
      )}
      {activeModal?.type === "close" && (
        <CloseRecallModal
          recall={activeModal.recall}
          onClose={() => setActiveModal(null)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "forward", label: "Forward Traceability" },
  { id: "backward", label: "Backward Traceability" },
  { id: "timeline", label: "Movement Timeline" },
  { id: "quarantine", label: "Quarantine & Release" },
  { id: "recall", label: "Product Recall" },
];

export function TraceabilityPage() {
  const [activeTab, setActiveTab] = useState("forward");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Traceability & Compliance</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track inventory movements, manage quarantines, and handle product recalls end-to-end.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <ScrollableTabs stripClassName="-mb-px flex gap-0" role="group">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={classNames(
                  "whitespace-nowrap py-3 px-5 border-b-2 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
                )}
              >
                {tab.label}
              </button>
            ))}
          </ScrollableTabs>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "forward" && <ForwardTraceabilityTab />}
          {activeTab === "backward" && <BackwardTraceabilityTab />}
          {activeTab === "timeline" && <MovementTimelineTab />}
          {activeTab === "quarantine" && <QuarantineTab />}
          {activeTab === "recall" && <ProductRecallTab />}
        </div>
      </div>
    </div>
  );
}
