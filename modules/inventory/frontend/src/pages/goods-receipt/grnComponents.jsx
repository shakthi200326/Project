import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Paperclip,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  attachmentDownloadUrl,
  deleteAttachment,
  fetchAttachments,
  fetchGrnContext,
  uploadAttachment,
} from "../../services/goodsReceiptApi";

// ------------------------------------------------------------------ context
let contextPromise = null;

export function invalidateGrnContext() {
  contextPromise = null;
}

/** Current user, permissions and the active configuration of every submodule. */
export function useGrnContext() {
  const [state, setState] = useState({ ctx: null, loading: true, error: null });
  const load = useCallback((force = false) => {
    if (force || !contextPromise) contextPromise = fetchGrnContext();
    setState((s) => ({ ...s, loading: true, error: null }));
    contextPromise
      .then((ctx) => setState({ ctx, loading: false, error: null }))
      .catch((error) => {
        contextPromise = null;
        setState({ ctx: null, loading: false, error });
      });
  }, []);
  useEffect(() => load(), [load]);

  const helpers = useMemo(() => {
    const ctx = state.ctx;
    const isAdmin = (ctx?.roles || []).some((r) => r === "platform.admin" || r === "inventory.admin");
    const hasPerm = (code) => !!ctx && (isAdmin || (ctx.permissions || []).includes(code));
    const settings = (sub) => ctx?.settings?.[sub] || {};
    const can = (sub, key = "required_permission") => !!ctx && settings(sub).enabled && hasPerm(settings(sub)[key]);
    return { hasPerm, settings, can, username: ctx?.username || "" };
  }, [state.ctx]);

  return { ...state, ...helpers, reload: () => load(true) };
}

// --------------------------------------------------------------- formatting
export const fmtQty = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(v);
};
export const fmtDate = (v) => (v ? String(v).slice(0, 10) : "—");
export const fmtDateTime = (v) => (v ? new Date(v).toLocaleString() : "—");
export const today = () => new Date().toISOString().slice(0, 10);

export const inputCls =
  "w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-500 dark:disabled:bg-zinc-800/60";
export const errorInputCls = "border-red-400 dark:border-red-500/70 focus:ring-red-500";
export const btnPrimary =
  "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition-all cursor-pointer";
export const btnSecondary =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition-all cursor-pointer";
export const btnDanger =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50 text-xs font-semibold transition-all cursor-pointer";

// ------------------------------------------------------------------- layout
export function GrnPage({ title, subtitle, icon: Icon, actions, children }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
            {Icon && <Icon className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
                Goods Receipt & Inspection
              </span>
            </div>
            {subtitle && <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, actions, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-zinc-800/60">
          {title && <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>}
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

/** Wraps a page in the context load + enable/permission gate for one submodule. */
export function SubmoduleGate({ grn, submodule, children }) {
  if (grn.loading) return <LoadingBlock label="Loading configuration…" />;
  if (grn.error) return <ErrorBanner error={grn.error} onRetry={grn.reload} />;
  const cfg = grn.settings(submodule);
  if (!cfg.enabled) {
    return (
      <Notice icon={ShieldAlert} title="This screen is disabled">
        It has been switched off in{" "}
        <Link className="underline font-semibold" to="/inventory/configuration/goods-receipt">
          Goods Receipt & Inspection settings
        </Link>
        .
      </Notice>
    );
  }
  if (!grn.can(submodule)) {
    return (
      <Notice icon={ShieldAlert} title="Access denied">
        You need the <code className="font-mono">{cfg.required_permission}</code> permission to open this screen.
      </Notice>
    );
  }
  return children;
}

export function Notice({ icon: Icon = AlertTriangle, title, children, tone = "amber" }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
    red: "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
    blue: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300",
  };
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-xs ${tones[tone]}`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        {title && <div className="font-bold mb-0.5">{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  const errors = error.errors ? Object.entries(error.errors) : [];
  return (
    <Notice icon={AlertTriangle} tone="red" title={error.message || String(error)}>
      {errors.length > 1 && (
        <ul className="list-disc ml-4 mt-1 space-y-0.5">
          {errors.map(([k, v]) => (
            <li key={k}>
              <span className="font-mono">{k}</span>: {Array.isArray(v) ? v.join(" ") : String(v)}
            </li>
          ))}
        </ul>
      )}
      {onRetry && (
        <button onClick={onRetry} className="mt-2 inline-flex items-center gap-1 font-semibold underline cursor-pointer">
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      )}
    </Notice>
  );
}

export function LoadingBlock({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500 dark:text-zinc-400">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

// ------------------------------------------------------------------- status
const STATUS_TONES = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  SUBMITTED: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-900/50",
  APPROVED: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-900/50",
  UNDER_INSPECTION: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/50",
  ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/50",
  PARTIALLY_ACCEPTED: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-900/50",
  REJECTED: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/50",
  PUTAWAY_PENDING: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-900/50",
  READY_TO_POST: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/50",
  POSTED: "bg-emerald-600 text-white border-emerald-600",
  REVERSED: "bg-slate-700 text-white border-slate-700",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200 line-through dark:bg-zinc-800 dark:text-zinc-500",
  // line / record level
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/50",
  PARTIAL: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-900/50",
  PASSED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/50",
  FAILED: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/50",
  NOT_REQUIRED: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/50",
  NOT_APPLICABLE: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700",
  PASS: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/50",
  CONDITIONAL: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/50",
  FAIL: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/50",
  OPEN: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/50",
  UNDER_REVIEW: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-900/50",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/50",
  CLOSED: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
};
const LABELS = {
  UNDER_INSPECTION: "Under Inspection",
  PARTIALLY_ACCEPTED: "Partially Accepted",
  PUTAWAY_PENDING: "Putaway Pending",
  READY_TO_POST: "Ready to Post",
  NOT_REQUIRED: "Not Required",
  NOT_APPLICABLE: "N/A",
  UNDER_REVIEW: "Under Review",
  PASSED: "Accepted",
  FAILED: "Rejected",
  PARTIAL: "Partial",
};
export const statusLabel = (s) =>
  LABELS[s] || (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ") : "—");

export function StatusBadge({ status, label }) {
  if (!status) return <span className="text-slate-400">—</span>;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold border ${
        STATUS_TONES[status] || STATUS_TONES.DRAFT
      }`}
    >
      {label || statusLabel(status)}
    </span>
  );
}

export const RECEIPT_STATUSES = [
  "DRAFT", "SUBMITTED", "APPROVED", "UNDER_INSPECTION", "ACCEPTED", "PARTIALLY_ACCEPTED", "REJECTED",
  "PUTAWAY_PENDING", "READY_TO_POST", "POSTED", "REVERSED", "CANCELLED",
];

// --------------------------------------------------------------- data hooks
/**
 * Filters and page live in the URL so a refresh or a shared link reopens
 * the same view. `fetcher(params)` must return a DRF paginated payload.
 */
export function usePagedQuery(fetcher, filterKeys, defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => {
    const out = {};
    [...filterKeys, "page"].forEach((k) => {
      const v = searchParams.get(k);
      out[k] = v !== null ? v : defaults[k] ?? "";
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchRef
      .current({ ...filters, page: filters.page || 1 })
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => {
        // A page beyond the end (e.g. after filtering) returns 404: fall back to page 1.
        if (alive && error.status === 404 && Number(filters.page) > 1) {
          setFilter("page", "");
          return;
        }
        if (alive) setState({ data: null, loading: false, error });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, tick]);

  const setFilter = useCallback(
    (key, value) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === "" || value === null || value === undefined) next.delete(key);
          else next.set(key, value);
          if (key !== "page") next.delete("page");
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return { ...state, filters, setFilter, reload: () => setTick((t) => t + 1) };
}

export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const show = useCallback((message, tone = "success") => {
    clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);
  const node = toast ? (
    <div className="fixed top-4 right-4 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-zinc-800/95 text-white text-xs font-medium shadow-2xl border border-slate-700/60 max-w-md">
      {toast.tone === "error" ? (
        <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
      ) : (
        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
      )}
      <span>{toast.message}</span>
    </div>
  ) : null;
  return [node, show];
}

// ------------------------------------------------------------------- tables
export function FilterBar({ children, count }) {
  return (
    <div className="grn-filter-bar">
      <div className="grn-filter-controls">{children}</div>
      {count !== undefined && (
        <span className="grn-filter-count">{count} records</span>
      )}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  const [text, setText] = useState(value || "");
  useEffect(() => setText(value || ""), [value]);
  return (
    <form
      className="grn-filter-search relative"
      onSubmit={(e) => {
        e.preventDefault();
        onChange(text.trim());
      }}
    >
      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() !== (value || "") && onChange(text.trim())}
        placeholder={placeholder}
        className={`${inputCls} h-9 pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-800`}
      />
    </form>
  );
}

export function SelectFilter({ value, onChange, options, allLabel }) {
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={`grn-filter-select ${inputCls} h-9 w-full py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-800 font-semibold`}>
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function DateRange({ from, to, onFrom, onTo }) {
  return (
    <div className="grn-filter-date flex items-center gap-1.5 shrink-0">
      <input
        type="date"
        value={from || ""}
        onChange={(e) => onFrom(e.target.value)}
        className={`${inputCls} !w-[130px] shrink-0 text-xs`}
        aria-label="From date"
      />
      <span className="text-xs text-slate-400 shrink-0">to</span>
      <input
        type="date"
        value={to || ""}
        onChange={(e) => onTo(e.target.value)}
        className={`${inputCls} !w-[130px] shrink-0 text-xs`}
        aria-label="To date"
      />
    </div>
  );
}

export function DataTable({
  columns,
  rows,
  loading,
  error,
  onRetry,
  empty = "No records found.",
  rowKey = "id",
  onRowClick,
  selectedKey,
  minWidth,
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
      {error ? (
        <div className="p-4">
          <ErrorBanner error={error} onRetry={onRetry} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" style={minWidth ? { minWidth } : undefined}>
            <thead>
              <tr className="whitespace-nowrap border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                {columns.map((c) => (
                  <th key={c.key} className={`py-3 px-3 font-semibold ${c.align === "right" ? "text-right" : ""}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {loading && !rows?.length ? (
                <tr>
                  <td colSpan={columns.length}>
                    <LoadingBlock />
                  </td>
                </tr>
              ) : !rows?.length ? (
                <tr>
                  <td colSpan={columns.length} className="py-10 text-center text-slate-400 dark:text-zinc-500">
                    {empty}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r[rowKey]}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                    className={`transition-colors ${onRowClick ? "cursor-pointer" : ""} ${
                      selectedKey !== undefined && selectedKey === r[rowKey]
                        ? "bg-emerald-50/70 dark:bg-emerald-950/30"
                        : "hover:bg-slate-50/70 dark:hover:bg-zinc-800/40"
                    } ${loading ? "opacity-60" : ""}`}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={`py-2.5 px-3 align-top ${c.align === "right" ? "text-right font-mono tabular-nums whitespace-nowrap" : ""}`}>
                        {c.render ? c.render(r) : r[c.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function Pagination({ data, page, onPage, pageSize }) {
  if (!data || !data.count) return null;
  const current = Number(page) || 1;
  const size = pageSize || data.results?.length || 25;
  const pages = Math.max(1, Math.ceil(data.count / Math.max(size, 1)));
  return (
    <div className="flex items-center justify-end gap-2 text-xs text-slate-500 dark:text-zinc-400">
      <span>
        Page {current} of {data.next || data.previous ? pages : 1}
      </span>
      <button className={btnSecondary} disabled={!data.previous} onClick={() => onPage(current - 1)} aria-label="Previous page">
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <button className={btnSecondary} disabled={!data.next} onClick={() => onPage(current + 1)} aria-label="Next page">
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ReceiptLink({ id, number }) {
  return (
    <Link
      to={`/inventory/goods-receipt/receipts/${id}`}
      onClick={(e) => e.stopPropagation()}
      className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-900/40 hover:underline whitespace-nowrap"
    >
      {number}
    </Link>
  );
}

// -------------------------------------------------------------------- forms
export function Field({ label, required, error, hint, children, className = "" }) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {error ? (
        <span className="block text-[11px] text-red-600 dark:text-red-400">{error}</span>
      ) : hint ? (
        <span className="block text-[11px] text-slate-400 dark:text-zinc-500">{hint}</span>
      ) : null}
    </label>
  );
}

export function ReadOnly({ label, value, mono }) {
  return (
    <div className="space-y-1">
      <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">{label}</span>
      <div className={`text-xs text-slate-900 dark:text-zinc-100 ${mono ? "font-mono" : ""}`}>{value ?? "—"}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={`w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl`}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-zinc-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer" aria-label="Close">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-slate-100 dark:border-zinc-800">{footer}</div>}
      </div>
    </div>
  );
}

/** Confirmation dialog that optionally collects a mandatory reason. */
export function ConfirmModal({ title, message, requireReason, confirmLabel = "Confirm", danger, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async () => {
    if (requireReason && !reason.trim()) {
      setError({ message: "A reason is required." });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={title}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button className={btnSecondary} onClick={onClose} disabled={busy}>
            Back
          </button>
          <button className={danger ? btnDanger : btnPrimary} onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-xs text-slate-600 dark:text-zinc-300">{message}</p>
      {requireReason && (
        <Field label="Reason" required>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} autoFocus />
        </Field>
      )}
      <ErrorBanner error={error} />
    </Modal>
  );
}

// -------------------------------------------------------------- attachments
const ALLOWED_TYPES = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.csv,.xlsx,.xls,.doc,.docx,.txt";
const MAX_BYTES = 25 * 1024 * 1024;

export function Attachments({ ownerType, ownerId, canEdit, uploadedBy, title = "Attachments" }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const load = useCallback(() => {
    if (!ownerId) return;
    fetchAttachments(ownerType, ownerId).then(setFiles).catch(setError);
  }, [ownerType, ownerId]);
  useEffect(load, [load]);

  const onPick = async (e) => {
    const picked = [...(e.target.files || [])];
    e.target.value = "";
    const tooBig = picked.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      setError({ message: `${tooBig.name} exceeds the 25 MB limit.` });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const f of picked) await uploadAttachment(ownerType, ownerId, f, uploadedBy);
      load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300 flex items-center gap-1">
          <Paperclip className="h-3.5 w-3.5" /> {title} ({files.length})
        </span>
        {canEdit && (
          <>
            <input ref={inputRef} type="file" multiple accept={ALLOWED_TYPES} className="hidden" onChange={onPick} />
            <button type="button" className={btnSecondary} onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload
            </button>
          </>
        )}
      </div>
      <ErrorBanner error={error} />
      {files.length > 0 && (
        <ul className="divide-y divide-slate-100 dark:divide-zinc-800 rounded-xl border border-slate-200/80 dark:border-zinc-800">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <a href={attachmentDownloadUrl(f.id)} target="_blank" rel="noreferrer" className="truncate text-emerald-700 dark:text-emerald-400 hover:underline">
                {f.file_name}
              </a>
              <span className="text-slate-400 shrink-0">{Math.ceil((f.file_size || 0) / 1024)} KB</span>
              {canEdit && (
                <button
                  type="button"
                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                  aria-label={`Remove ${f.file_name}`}
                  onClick={() => deleteAttachment(f.id).then(load).catch(setError)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
