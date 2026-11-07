import React, { useState, useEffect, useCallback } from "react";
import {
  fetchBatchesFiltered,
  createBatchRecord,
  updateBatchRecord,
  fetchBatchDetail,
  quarantineBatch,
  releaseBatch,
  fetchBatchMovements,
  fetchWarehouses,
  fetchItems,
  fetchVariants,
} from "../services/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateBatchNumber = () => {
  const yr = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `BCH-${yr}-${rand}`;
};

const today = () => new Date().toISOString().split("T")[0];

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium min-w-[260px] max-w-sm
            ${t.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
        >
          <span className="flex-1">{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="ml-2 opacity-70 hover:opacity-100">✕</button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  const removeToast = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  return { toasts, addToast, removeToast };
}

// ─── Status Badges ─────────────────────────────────────────────────────────────

const BATCH_STATUS_COLORS = {
  Released: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Quarantined: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  Rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  Pending: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  "Pending Inspection": "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
};

const EXPIRY_STATUS_COLORS = {
  Healthy: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Expiring Soon": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  Expired: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function StatusBadge({ value, colorMap }) {
  const cls = colorMap?.[value] || "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {value || "—"}
    </span>
  );
}

// ─── Shared Table ─────────────────────────────────────────────────────────────

function Table({ columns, rows, emptyText = "No records found." }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold select-none">
              {columns.map((col) => (
                <th key={col.key} className="py-3 px-4 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400 dark:text-zinc-500">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.id ?? i} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-zinc-300">
                      {col.render ? col.render(row) : row[col.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        ← Prev
      </button>
      <span className="text-sm text-gray-600 dark:text-gray-300">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        Next →
      </button>
    </div>
  );
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">✕</button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Form Helpers ─────────────────────────────────────────────────────────────

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const selectCls =
  "w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

// ─── Quarantine Modal ─────────────────────────────────────────────────────────

const QUARANTINE_REASONS = [
  "Quality Issue",
  "Contamination",
  "Damaged",
  "Near Expiry",
  "Regulatory Hold",
  "Inspection Required",
  "Other",
];

function QuarantineModal({ batch, onClose, onDone, addToast }) {
  const [form, setForm] = useState({
    quarantine_quantity: "",
    quarantine_reason: "",
    quarantine_date: today(),
    remarks: "",
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.quarantine_quantity || !form.quarantine_reason) {
      addToast("Quantity and reason are required.", "error");
      return;
    }
    setLoading(true);
    try {
      await quarantineBatch(batch.id, {
        quarantine_quantity: Number(form.quarantine_quantity),
        quarantine_reason: form.quarantine_reason,
        quarantine_date: form.quarantine_date,
        remarks: form.remarks,
      });
      addToast(`Batch ${batch.batch_number} quarantined successfully.`, "success");
      onDone();
    } catch (err) {
      addToast(err?.message || "Failed to quarantine batch.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Quarantine Batch — ${batch.batch_number}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Quarantine Quantity" required>
          <input
            type="number"
            min="1"
            max={batch.available_quantity ?? undefined}
            value={form.quarantine_quantity}
            onChange={(e) => set("quarantine_quantity", e.target.value)}
            className={inputCls}
            placeholder="Enter quantity"
          />
        </Field>
        <Field label="Quarantine Reason" required>
          <select value={form.quarantine_reason} onChange={(e) => set("quarantine_reason", e.target.value)} className={selectCls}>
            <option value="">Select reason…</option>
            {QUARANTINE_REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Quarantine Date">
          <input type="date" value={form.quarantine_date} onChange={(e) => set("quarantine_date", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Remarks">
          <textarea value={form.remarks} onChange={(e) => set("remarks", e.target.value)} rows={3} className={inputCls} placeholder="Optional remarks…" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-semibold disabled:opacity-60"
          >
            {loading ? "Processing…" : "Quarantine"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Release Modal ────────────────────────────────────────────────────────────

const INSPECTION_RESULTS = ["Passed", "Failed", "Partially Passed"];

function ReleaseModal({ batch, onClose, onDone, addToast }) {
  const [form, setForm] = useState({
    release_quantity: "",
    inspection_result: "",
    release_reason: "",
    released_by: "",
    release_date: today(),
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.release_quantity || !form.inspection_result || !form.release_reason) {
      addToast("Quantity, inspection result, and release reason are required.", "error");
      return;
    }
    setLoading(true);
    try {
      await releaseBatch(batch.id, {
        release_quantity: Number(form.release_quantity),
        inspection_result: form.inspection_result,
        release_reason: form.release_reason,
        released_by: form.released_by,
        release_date: form.release_date,
      });
      addToast(`Batch ${batch.batch_number} released successfully.`, "success");
      onDone();
    } catch (err) {
      addToast(err?.message || "Failed to release batch.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Release Batch — ${batch.batch_number}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Release Quantity" required>
          <input
            type="number"
            min="1"
            value={form.release_quantity}
            onChange={(e) => set("release_quantity", e.target.value)}
            className={inputCls}
            placeholder="Enter quantity"
          />
        </Field>
        <Field label="Inspection Result" required>
          <select value={form.inspection_result} onChange={(e) => set("inspection_result", e.target.value)} className={selectCls}>
            <option value="">Select result…</option>
            {INSPECTION_RESULTS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Release Reason" required>
          <input
            type="text"
            value={form.release_reason}
            onChange={(e) => set("release_reason", e.target.value)}
            className={inputCls}
            placeholder="Reason for release"
          />
        </Field>
        <Field label="Released By">
          <input
            type="text"
            value={form.released_by}
            onChange={(e) => set("released_by", e.target.value)}
            className={inputCls}
            placeholder="Name or ID"
          />
        </Field>
        <Field label="Release Date">
          <input type="date" value={form.release_date} onChange={(e) => set("release_date", e.target.value)} className={inputCls} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            {loading ? "Processing…" : "Release"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Batch List (shared for Tab 1 & Tab 3) ───────────────────────────────────

function BatchListTab({ trackingType, addToast, onViewDetails }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    warehouse: "",
    item: "",
    expiry_status: "",
    tracking_type: trackingType || "",
  });
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [quarantineTarget, setQuarantineTarget] = useState(null);
  const [releaseTarget, setReleaseTarget] = useState(null);

  const PAGE_SIZE = 10;

  const loadWarehouses = useCallback(async () => {
    try {
      const res = await fetchWarehouses();
      setWarehouses(Array.isArray(res) ? res : res?.results ?? []);
    } catch (_) {}
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const res = await fetchItems();
      setItems(Array.isArray(res) ? res : res?.results ?? []);
    } catch (_) {}
  }, []);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        page_size: PAGE_SIZE,
        ...(filters.status && { status: filters.status }),
        ...(filters.warehouse && { warehouse: filters.warehouse }),
        ...(filters.item && { item: filters.item }),
        ...(filters.expiry_status && { expiry_status: filters.expiry_status }),
        ...(filters.tracking_type && { tracking_type: filters.tracking_type }),
        ...(search && { search }),
      };
      const res = await fetchBatchesFiltered(params);
      const results = Array.isArray(res) ? res : res?.results ?? [];
      setBatches(results);
      const count = res?.count ?? results.length;
      setTotalPages(Math.max(1, Math.ceil(count / PAGE_SIZE)));
    } catch (err) {
      addToast("Failed to load batches.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, filters, search, addToast]);

  useEffect(() => { loadWarehouses(); }, [loadWarehouses]);
  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { loadBatches(); }, [loadBatches]);

  const setFilter = (k, v) => {
    setFilters((p) => ({ ...p, [k]: v }));
    setPage(1);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const columns = [
    { key: "batch_number", label: "Batch #" },
    { key: "item_name", label: "Item", render: (r) => r.item_name ?? r.item ?? "—" },
    { key: "sku", label: "SKU", render: (r) => r.sku ?? r.item_sku ?? "—" },
    { key: "variant_name", label: "Variant", render: (r) => r.variant_name ?? r.variant_sku ?? r.variant ?? "—" },
    { key: "warehouse_name", label: "Warehouse", render: (r) => r.warehouse_name ?? r.warehouse ?? "—" },
    { key: "tracking_type", label: "Tracking Type" },
    { key: "initial_quantity", label: "Initial Qty" },
    { key: "remaining_quantity", label: "Remaining Qty" },
    { key: "available_quantity", label: "Available Qty" },
    { key: "quarantined_quantity", label: "Quarantined Qty" },
    { key: "manufacturing_date", label: "Mfg Date" },
    { key: "received_date", label: "Received Date" },
    { key: "expiry_date", label: "Expiry Date" },
    {
      key: "expiry_status",
      label: "Expiry Status",
      render: (r) => <StatusBadge value={r.expiry_status} colorMap={EXPIRY_STATUS_COLORS} />,
    },
    {
      key: "status",
      label: "Batch Status",
      render: (r) => <StatusBadge value={r.status} colorMap={BATCH_STATUS_COLORS} />,
    },
    {
      key: "_actions",
      label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onViewDetails(r)}
            className="px-2 py-1 rounded text-xs bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 font-medium"
          >
            View
          </button>
          <button
            onClick={() => setQuarantineTarget(r)}
            className="px-2 py-1 rounded text-xs bg-yellow-50 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 font-medium"
          >
            Quarantine
          </button>
          <button
            onClick={() => setReleaseTarget(r)}
            className="px-2 py-1 rounded text-xs bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900 font-medium"
          >
            Release
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search</label>
          <input
            type="text"
            placeholder="Batch number, item, or SKU…"
            value={search}
            onChange={handleSearchChange}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option>Released</option>
            <option>Quarantined</option>
            <option>Rejected</option>
            <option value="Pending Inspection">Pending Inspection</option>
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Warehouse</label>
          <select
            value={filters.warehouse}
            onChange={(e) => setFilter("warehouse", e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Item</label>
          <select
            value={filters.item}
            onChange={(e) => setFilter("item", e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Items</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Expiry Status</label>
          <select
            value={filters.expiry_status}
            onChange={(e) => setFilter("expiry_status", e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Expiry Statuses</option>
            <option>Healthy</option>
            <option>Expiring Soon</option>
            <option>Expired</option>
          </select>
        </div>
        {!trackingType && (
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tracking Type</label>
            <select
              value={filters.tracking_type}
              onChange={(e) => setFilter("tracking_type", e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Batch &amp; Lot</option>
              <option value="BATCH">Batch</option>
              <option value="LOT">Lot</option>
            </select>
          </div>
        )}
        <button
          type="submit"
          className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-medium"
        >
          Search
        </button>
      </form>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <>
          <Table columns={columns} rows={batches} />
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}

      {quarantineTarget && (
        <QuarantineModal
          batch={quarantineTarget}
          onClose={() => setQuarantineTarget(null)}
          onDone={() => { setQuarantineTarget(null); loadBatches(); }}
          addToast={addToast}
        />
      )}
      {releaseTarget && (
        <ReleaseModal
          batch={releaseTarget}
          onClose={() => setReleaseTarget(null)}
          onDone={() => { setReleaseTarget(null); loadBatches(); }}
          addToast={addToast}
        />
      )}
    </div>
  );
}

// ─── Create Batch / Lot Form (shared for Tab 2 & Tab 4) ──────────────────────

function CreateBatchForm({ defaultTrackingType = "Batch", addToast }) {
  const [items, setItems] = useState([]);
  const [variants, setVariants] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);

  const blankForm = useCallback(() => ({
    batch_number: generateBatchNumber(),
    item: "",
    variant: "",
    warehouse: "",
    manufacturer: "",
    supplier: "",
    supplier_lot_number: "",
    goods_receipt_ref: "",
    manufacturing_date: "",
    received_date: today(),
    expiry_date: "",
    initial_quantity: "",
    status: "Pending Inspection",
    notes: "",
  }), [defaultTrackingType]);

  const [form, setForm] = useState(blankForm);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const [i, w] = await Promise.all([fetchItems(), fetchWarehouses()]);
        setItems(Array.isArray(i) ? i : i?.results ?? []);
        setWarehouses(Array.isArray(w) ? w : w?.results ?? []);
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    if (!form.item) {
      setVariants([]);
      set("variant", "");
      return;
    }
    fetchVariants({ item: form.item })
      .then((res) => {
        const rows = Array.isArray(res) ? res : res?.results ?? [];
        setVariants(rows);
      })
      .catch(() => setVariants([]));
  }, [form.item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.batch_number || !form.item || !form.warehouse || !form.initial_quantity) {
      addToast("Batch number, item, warehouse, and initial quantity are required.", "error");
      return;
    }
    if (!form.received_date) {
      addToast("Received date is required.", "error");
      return;
    }
    if (variants.length > 0 && !form.variant) {
      addToast("Variant is required for this item.", "error");
      return;
    }
    setLoading(true);
    try {
      await createBatchRecord({
        ...form,
        tracking_type: defaultTrackingType,
        initial_quantity: Number(form.initial_quantity),
      });
      addToast(`${defaultTrackingType} created successfully: ${form.batch_number}`, "success");
      setForm(blankForm());
    } catch (err) {
      addToast(err?.message || `Failed to create ${defaultTrackingType.toLowerCase()}.`, "error");
    } finally {
      setLoading(false);
    }
  };

  const isLot = defaultTrackingType === "Lot";

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl flex flex-col gap-5">
      <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200">
        {isLot ? "Create New Lot" : "Create New Batch"}
      </h2>

      {/* Batch or Lot Number */}
      <div className="grid grid-cols-1 gap-4">
        <Field label={isLot ? "Lot Number" : "Batch Number"} required hint="Format: BCH-YYYY-NNNN">
          <div className="flex gap-2">
            <input
              type="text"
              value={form.batch_number}
              onChange={(e) => set("batch_number", e.target.value)}
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => set("batch_number", generateBatchNumber())}
              className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 whitespace-nowrap"
            >
              Regenerate
            </button>
          </div>
        </Field>
      </div>

      {/* Item + Warehouse */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Item" required>
          <select value={form.item} onChange={(e) => set("item", e.target.value)} className={selectCls}>
            <option value="">Select item…</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{it.name ?? it.item_name ?? it.id}</option>
            ))}
          </select>
        </Field>
        <Field label="Variant">
          <select
            value={form.variant}
            onChange={(e) => set("variant", e.target.value)}
            className={selectCls}
            disabled={!form.item || variants.length === 0}
          >
            <option value="">Select variant…</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.variant_name ?? variant.name ?? variant.sku ?? `Variant ${variant.id}`}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Warehouse" required>
          <select value={form.warehouse} onChange={(e) => set("warehouse", e.target.value)} className={selectCls}>
            <option value="">Select warehouse…</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Supplier info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Manufacturer">
          <input type="text" value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} className={inputCls} placeholder="Manufacturer name" />
        </Field>
        <Field label="Supplier">
          <input type="text" value={form.supplier} onChange={(e) => set("supplier", e.target.value)} className={inputCls} placeholder="Supplier name" />
        </Field>
        <Field label={isLot ? "Supplier Lot Reference" : "Supplier Lot #"} hint={isLot ? "Primary lot tracking reference" : undefined}>
          <input type="text" value={form.supplier_lot_number} onChange={(e) => set("supplier_lot_number", e.target.value)} className={inputCls} placeholder="Supplier lot number" />
        </Field>
        <Field label="Goods Receipt Ref">
          <input type="text" value={form.goods_receipt_ref} onChange={(e) => set("goods_receipt_ref", e.target.value)} className={inputCls} placeholder="GRN/PO reference" />
        </Field>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Manufacturing Date">
          <input type="date" value={form.manufacturing_date} onChange={(e) => set("manufacturing_date", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Received Date" required>
          <input type="date" value={form.received_date} onChange={(e) => set("received_date", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Expiry Date">
          <input type="date" value={form.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} className={inputCls} />
        </Field>
      </div>

      {/* Qty + Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Initial Quantity" required>
          <input
            type="number"
            min="0"
            step="any"
            value={form.initial_quantity}
            onChange={(e) => set("initial_quantity", e.target.value)}
            className={inputCls}
            placeholder="0"
          />
        </Field>
        <Field label="Batch Status" required>
          <select value={form.status} onChange={(e) => set("status", e.target.value)} className={selectCls}>
            <option value="Pending Inspection">Pending Inspection</option>
            <option value="Released">Released</option>
            <option value="Quarantined">Quarantined</option>
          </select>
        </Field>
      </div>

      {/* Notes */}
      <Field label="Notes">
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          className={inputCls}
          placeholder="Optional notes…"
        />
      </Field>

      {/* Submit */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "Creating…" : `Create ${defaultTrackingType}`}
        </button>
        <button
          type="button"
          onClick={() => setForm(blankForm())}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Reset
        </button>
      </div>
    </form>
  );
}

// ─── Tab 5 — Batch-wise Stock ─────────────────────────────────────────────────

function BatchwiseStockTab({ addToast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchBatchesFiltered({ page_size: 50 });
      setRows(Array.isArray(res) ? res : res?.results ?? []);
    } catch (err) {
      addToast("Failed to load batch-wise stock.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { key: "batch_number", label: "Batch #" },
    { key: "item_name", label: "Item", render: (r) => r.item_name ?? r.item ?? "—" },
    { key: "sku", label: "SKU", render: (r) => r.sku ?? r.item_sku ?? "—" },
    { key: "variant_name", label: "Variant", render: (r) => r.variant_name ?? r.variant_sku ?? r.variant ?? "—" },
    { key: "warehouse_name", label: "Warehouse", render: (r) => r.warehouse_name ?? r.warehouse ?? "—" },
    { key: "location", label: "Location", render: (r) => r.location ?? r.bin_location ?? "—" },
    { key: "initial_quantity", label: "Initial Qty" },
    { key: "remaining_quantity", label: "Remaining Qty" },
    { key: "available_quantity", label: "Available Qty" },
    { key: "quarantined_quantity", label: "Quarantined Qty" },
    { key: "received_date", label: "Received Date" },
    { key: "expiry_date", label: "Expiry Date" },
    {
      key: "expiry_status",
      label: "Expiry Status",
      render: (r) => <StatusBadge value={r.expiry_status} colorMap={EXPIRY_STATUS_COLORS} />,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge value={r.status} colorMap={BATCH_STATUS_COLORS} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Read-only snapshot of batch-wise stock (up to 50 records).</p>
        <button onClick={load} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">
          Refresh
        </button>
      </div>
      {loading ? <div className="text-center py-12 text-gray-400">Loading…</div> : <Table columns={columns} rows={rows} />}
    </div>
  );
}

// ─── Tab 6 — Batch Details ────────────────────────────────────────────────────

function DetailRow({ label, value }) {
  return (
    <div className="flex gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="w-44 shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm text-gray-800 dark:text-gray-100 break-all">{value ?? "—"}</span>
    </div>
  );
}

function BatchDetailsTab({ initialBatch, addToast }) {
  const [searchInput, setSearchInput] = useState(initialBatch?.batch_number ?? "");
  const [batch, setBatch] = useState(initialBatch ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialBatch) {
      setBatch(initialBatch);
      setSearchInput(initialBatch.batch_number ?? "");
    }
  }, [initialBatch]);

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    setLoading(true);
    try {
      const res = await fetchBatchDetail(searchInput.trim());
      setBatch(res);
    } catch (err) {
      addToast("Batch not found or error loading details.", "error");
      setBatch(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Search */}
      <div className="flex gap-2 max-w-md">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Enter Batch Number…"
          className={inputCls}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60 whitespace-nowrap"
        >
          {loading ? "Loading…" : "Search"}
        </button>
      </div>

      {batch && (
        <>
          {/* Detail Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                {batch.batch_number}
              </h3>
              <div className="flex gap-2">
                <StatusBadge value={batch.status} colorMap={BATCH_STATUS_COLORS} />
                <StatusBadge value={batch.expiry_status} colorMap={EXPIRY_STATUS_COLORS} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <div>
                <DetailRow label="Batch Number" value={batch.batch_number} />
                <DetailRow label="Tracking Type" value={batch.tracking_type} />
                <DetailRow label="Item" value={batch.item_name ?? batch.item} />
                <DetailRow label="SKU" value={batch.sku ?? batch.item_sku} />
                <DetailRow label="Variant" value={batch.variant_name ?? batch.variant_sku ?? batch.variant} />
                <DetailRow label="Warehouse" value={batch.warehouse_name ?? batch.warehouse} />
                <DetailRow label="Location" value={batch.location ?? batch.bin_location} />
                <DetailRow label="Manufacturer" value={batch.manufacturer} />
                <DetailRow label="Supplier" value={batch.supplier} />
                <DetailRow label="Supplier Lot #" value={batch.supplier_lot_number} />
                <DetailRow label="Goods Receipt Ref" value={batch.goods_receipt_ref} />
              </div>
              <div>
                <DetailRow label="Manufacturing Date" value={batch.manufacturing_date} />
                <DetailRow label="Received Date" value={batch.received_date} />
                <DetailRow label="Expiry Date" value={batch.expiry_date} />
                <DetailRow label="Initial Qty" value={batch.initial_quantity} />
                <DetailRow label="Remaining Qty" value={batch.remaining_quantity} />
                <DetailRow label="Available Qty" value={batch.available_quantity} />
                <DetailRow label="Quarantined Qty" value={batch.quarantined_quantity} />
                <DetailRow label="Batch Status" value={batch.status} />
                <DetailRow label="Expiry Status" value={batch.expiry_status} />
                <DetailRow label="Notes" value={batch.notes} />
                <DetailRow label="Created At" value={batch.created_at} />
              </div>
            </div>
          </div>

          {/* Quarantine Records */}
          {Array.isArray(batch.quarantine_records) && batch.quarantine_records.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Quarantine History</h4>
              <Table
                columns={[
                  { key: "quarantine_date", label: "Date" },
                  { key: "quarantine_quantity", label: "Qty" },
                  { key: "quarantine_reason", label: "Reason" },
                  { key: "remarks", label: "Remarks" },
                  { key: "quarantined_by", label: "By" },
                ]}
                rows={batch.quarantine_records}
              />
            </div>
          )}

          {/* Serial Numbers */}
          {Array.isArray(batch.serial_numbers) && batch.serial_numbers.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Associated Serial Numbers</h4>
              <div className="flex flex-wrap gap-2">
                {batch.serial_numbers.map((sn, i) => (
                  <span key={i} className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-xs font-mono text-gray-700 dark:text-gray-200">
                    {typeof sn === "object" ? sn.serial_number ?? JSON.stringify(sn) : sn}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!batch && !loading && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">
          Enter a batch number above and click Search to view details.
        </div>
      )}
    </div>
  );
}

// ─── Tab 7 — Batch Movement History ──────────────────────────────────────────

function BatchMovementTab({ addToast }) {
  const [batchSearch, setBatchSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = batchSearch.trim() ? { batch_number: batchSearch.trim() } : {};
      const res = await fetchBatchMovements(params);
      setRows(Array.isArray(res) ? res : res?.results ?? []);
    } catch (err) {
      addToast("Failed to load batch movements.", "error");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: "date", label: "Date", render: (r) => r.date ?? r.created_at ?? "—" },
    { key: "transaction_type", label: "Transaction Type" },
    { key: "direction", label: "Direction" },
    { key: "reference", label: "Reference" },
    { key: "item_name", label: "Item", render: (r) => r.item_name ?? r.item ?? "—" },
    { key: "warehouse_name", label: "Warehouse", render: (r) => r.warehouse_name ?? r.warehouse ?? "—" },
    { key: "quantity", label: "Quantity" },
    { key: "batch_number", label: "Batch" },
    { key: "serial_number", label: "Serial" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 max-w-md">
        <input
          type="text"
          value={batchSearch}
          onChange={(e) => setBatchSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Filter by batch number…"
          className={inputCls}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "Loading…" : "Search"}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : searched ? (
        <Table columns={columns} rows={rows} emptyText="No movements found." />
      ) : (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">
          Enter a batch number and click Search to view movement history.
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "batch-list", label: "Batch List" },
  { id: "create-batch", label: "Create Batch" },
  { id: "lot-list", label: "Lot List" },
  { id: "create-lot", label: "Create Lot" },
  { id: "batch-stock", label: "Batch-wise Stock" },
  { id: "batch-details", label: "Batch Details" },
  { id: "batch-movements", label: "Batch Movement History" },
];

export function BatchManagementPage() {
  const [activeTab, setActiveTab] = useState("batch-list");
  const [detailsBatch, setDetailsBatch] = useState(null);
  const { toasts, addToast, removeToast } = useToast();

  const handleViewDetails = useCallback((batch) => {
    setDetailsBatch(batch);
    setActiveTab("batch-details");
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Page Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Batch &amp; Lot Management</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Manage batches, lots, stock levels, quarantine, and movement history.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === "batch-list" && (
          <BatchListTab addToast={addToast} onViewDetails={handleViewDetails} />
        )}
        {activeTab === "create-batch" && (
          <CreateBatchForm defaultTrackingType="Batch" addToast={addToast} />
        )}
        {activeTab === "lot-list" && (
          <BatchListTab trackingType="LOT" addToast={addToast} onViewDetails={handleViewDetails} />
        )}
        {activeTab === "create-lot" && (
          <CreateBatchForm defaultTrackingType="Lot" addToast={addToast} />
        )}
        {activeTab === "batch-stock" && (
          <BatchwiseStockTab addToast={addToast} />
        )}
        {activeTab === "batch-details" && (
          <BatchDetailsTab initialBatch={detailsBatch} addToast={addToast} />
        )}
        {activeTab === "batch-movements" && (
          <BatchMovementTab addToast={addToast} />
        )}
      </div>
    </div>
  );
}

export default BatchManagementPage;
