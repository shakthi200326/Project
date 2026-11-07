import { useState, useEffect, useCallback } from "react";
import {
  fetchSerialNumbers,
  createSerialNumbers,
  fetchSerialDetail,
  fetchSerialMovements,
  fetchWarehouses,
  fetchItems,
  fetchBatchesFiltered,
} from "../services/api";

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  Available:   "bg-green-100  text-green-800  dark:bg-green-900/40  dark:text-green-300",
  Reserved:    "bg-blue-100   text-blue-800   dark:bg-blue-900/40   dark:text-blue-300",
  Issued:      "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  "In Transit":"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  Returned:    "bg-gray-100   text-gray-700   dark:bg-gray-700/40   dark:text-gray-300",
  Quarantined: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  Blocked:     "bg-red-100    text-red-800    dark:bg-red-900/40    dark:text-red-300",
  Damaged:     "bg-red-100    text-red-800    dark:bg-red-900/40    dark:text-red-300",
  Scrapped:    "bg-slate-100  text-slate-700  dark:bg-slate-700/40  dark:text-slate-300",
};

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status || "—"}
    </span>
  );
}

function fmt(val) {
  if (!val) return "—";
  if (typeof val === "string" && val.includes("T")) return val.split("T")[0];
  return val;
}

function Spinner() {
  return (
    <div className="flex justify-center items-center py-10">
      <div className="animate-spin h-8 w-8 rounded-full border-4 border-indigo-500 border-t-transparent" />
    </div>
  );
}

function ErrorMsg({ msg }) {
  if (!msg) return null;
  return (
    <div className="rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 p-3 text-sm text-red-700 dark:text-red-300">
      {msg}
    </div>
  );
}

function SuccessMsg({ msg }) {
  if (!msg) return null;
  return (
    <div className="rounded-md bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 p-3 text-sm text-green-700 dark:text-green-300">
      {msg}
    </div>
  );
}

const TABS = [
  "Serial List",
  "Register Serials",
  "Serial-wise Stock",
  "Serial Details",
  "Serial Movement History",
];

// ─── Tab 1: Serial List ──────────────────────────────────────────────────────

function SerialListTab() {
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [search, setSearch]       = useState("");
  const [filterStatus, setFilterStatus]       = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("");
  const [filterItem, setFilterItem]           = useState("");
  const [page, setPage]           = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems]           = useState([]);

  const PAGE_SIZE = 10;

  useEffect(() => {
    fetchWarehouses().then((d) => setWarehouses(d?.results || d || [])).catch(() => {});
    fetchItems().then((d) => setItems(d?.results || d || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        page_size: PAGE_SIZE,
      };
      if (search)          params.search    = search;
      if (filterStatus)    params.status    = filterStatus;
      if (filterWarehouse) params.warehouse = filterWarehouse;
      if (filterItem)      params.item      = filterItem;

      const data = await fetchSerialNumbers(params);
      setRows(data?.results || data || []);
      setTotalCount(data?.count ?? (data?.results?.length ?? (data?.length ?? 0)));
    } catch (e) {
      setError(e?.message || "Failed to load serial numbers.");
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, filterWarehouse, filterItem]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleSearch = (e) => { e.preventDefault(); setPage(1); };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Serial number, notes…"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="min-w-[140px]">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            {Object.keys(STATUS_STYLES).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="min-w-[160px]">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Warehouse</label>
          <select
            value={filterWarehouse}
            onChange={(e) => { setFilterWarehouse(e.target.value); setPage(1); }}
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
            value={filterItem}
            onChange={(e) => { setFilterItem(e.target.value); setPage(1); }}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Items</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{it.name}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-medium"
        >
          Search
        </button>
      </form>

      <ErrorMsg msg={error} />

      {loading ? <Spinner /> : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {["Serial Number","Item","SKU","Batch Ref","Warehouse","Location","Status","Warranty Until","Last Seen","Notes"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                      No serial numbers found.
                    </td>
                  </tr>
                ) : rows.map((r) => (
                  <tr key={r.id ?? r.serial_number} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-900 dark:text-gray-100 whitespace-nowrap">{r.serial_number || "—"}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{r.item_name || r.item || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.sku || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.batch_ref || r.batch || "—"}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{r.warehouse_name || r.warehouse || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.location || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmt(r.warranty_until)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmt(r.last_seen)}</td>
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500 max-w-[180px] truncate">{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>
              Page {page} of {totalPages} &nbsp;·&nbsp; {totalCount} records
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab 2: Register Serials ─────────────────────────────────────────────────

const REGISTER_MODES = ["Single", "Bulk Range", "CSV Paste"];

function RegisterSerialsTab() {
  const [mode, setMode]         = useState("Single");
  const [items, setItems]       = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [batches, setBatches]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  // Single
  const [single, setSingle] = useState({
    serial_number: "", item: "", warehouse: "", batch: "",
    manufacturing_date: "", warranty_start_date: "", warranty_until: "", notes: "",
  });

  // Bulk Range
  const [bulk, setBulk] = useState({
    prefix: "", start: "", end: "", item: "", warehouse: "", batch: "", warranty_until: "",
  });
  const [bulkProgress, setBulkProgress] = useState(null); // { done, total }

  // CSV Paste
  const [csv, setCsv] = useState({
    text: "", item: "", warehouse: "", batch: "", warranty_until: "",
  });
  const [csvResults, setCsvResults] = useState([]); // [{serial, status}]

  // Shared item/warehouse for bulk/csv
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    fetchItems().then((d) => setItems(d?.results || d || [])).catch(() => {});
    fetchWarehouses().then((d) => setWarehouses(d?.results || d || [])).catch(() => {});
  }, []);

  // Fetch batches when item changes (for Single mode)
  useEffect(() => {
    if (single.item) {
      fetchBatchesFiltered({ item: single.item })
        .then((d) => setBatches(d?.results || d || []))
        .catch(() => setBatches([]));
    } else {
      setBatches([]);
    }
  }, [single.item]);

  // Fetch batches for bulk/csv by shared item
  const [bulkBatches, setBulkBatches] = useState([]);
  useEffect(() => {
    if (bulk.item) {
      fetchBatchesFiltered({ item: bulk.item })
        .then((d) => setBulkBatches(d?.results || d || []))
        .catch(() => setBulkBatches([]));
    } else {
      setBulkBatches([]);
    }
  }, [bulk.item]);

  const [csvBatches, setCsvBatches] = useState([]);
  useEffect(() => {
    if (csv.item) {
      fetchBatchesFiltered({ item: csv.item })
        .then((d) => setCsvBatches(d?.results || d || []))
        .catch(() => setCsvBatches([]));
    } else {
      setCsvBatches([]);
    }
  }, [csv.item]);

  function resetMessages() { setError(""); setSuccess(""); }

  // ── Single Submit ──
  async function handleSingleSubmit(e) {
    e.preventDefault();
    resetMessages();
    if (!single.serial_number.trim()) { setError("Serial Number is required."); return; }
    if (!single.item)                 { setError("Item is required.");          return; }
    if (!single.warehouse)            { setError("Warehouse is required.");     return; }
    setLoading(true);
    try {
      const payload = {
        serial_number:      single.serial_number.trim(),
        item:               single.item,
        warehouse:          single.warehouse,
        batch:              single.batch || undefined,
        manufacturing_date: single.manufacturing_date || undefined,
        warranty_start_date: single.warranty_start_date || undefined,
        warranty_until:     single.warranty_until || undefined,
        notes:              single.notes || undefined,
      };
      await createSerialNumbers(payload);
      setSuccess(`Serial "${single.serial_number.trim()}" registered successfully.`);
      setSingle({ serial_number: "", item: "", warehouse: "", batch: "", manufacturing_date: "", warranty_start_date: "", warranty_until: "", notes: "" });
    } catch (err) {
      setError(err?.message || "Failed to create serial number.");
    } finally {
      setLoading(false);
    }
  }

  // ── Bulk Range Submit ──
  async function handleBulkSubmit(e) {
    e.preventDefault();
    resetMessages();
    const start = parseInt(bulk.start, 10);
    const end   = parseInt(bulk.end,   10);
    if (!bulk.prefix)   { setError("Prefix is required.");         return; }
    if (isNaN(start))   { setError("Start Number is required.");   return; }
    if (isNaN(end))     { setError("End Number is required.");     return; }
    if (end < start)    { setError("End must be ≥ Start.");        return; }
    if (!bulk.item)     { setError("Item is required.");           return; }
    if (!bulk.warehouse){ setError("Warehouse is required.");      return; }
    const count = end - start + 1;
    setBulkProgress({ done: 0, total: count });
    setLoading(true);
    let done = 0;
    const errors = [];
    for (let i = start; i <= end; i++) {
      const serial_number = `${bulk.prefix}${i}`;
      try {
        await createSerialNumbers({
          serial_number,
          item:          bulk.item,
          warehouse:     bulk.warehouse,
          batch:         bulk.batch || undefined,
          warranty_until: bulk.warranty_until || undefined,
        });
        done++;
        setBulkProgress({ done, total: count });
      } catch (err) {
        errors.push(serial_number);
      }
    }
    setLoading(false);
    if (errors.length === 0) {
      setSuccess(`All ${count} serials registered successfully.`);
    } else {
      setSuccess(`${done} of ${count} registered. ${errors.length} failed: ${errors.slice(0,5).join(", ")}${errors.length > 5 ? "…" : ""}`);
    }
    setBulkProgress(null);
  }

  // ── CSV Submit ──
  async function handleCsvSubmit(e) {
    e.preventDefault();
    resetMessages();
    if (!csv.item)      { setError("Item is required.");      return; }
    if (!csv.warehouse) { setError("Warehouse is required."); return; }
    const lines = csv.text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const unique = [...new Set(lines)];
    if (unique.length === 0) { setError("No serial numbers found in input."); return; }
    setLoading(true);
    const results = [];
    for (const sn of unique) {
      try {
        await createSerialNumbers({
          serial_number: sn,
          item:          csv.item,
          warehouse:     csv.warehouse,
          batch:         csv.batch || undefined,
          warranty_until: csv.warranty_until || undefined,
        });
        results.push({ serial: sn, status: "Created", ok: true });
      } catch (err) {
        results.push({ serial: sn, status: err?.message || "Error", ok: false });
      }
    }
    setCsvResults(results);
    setLoading(false);
    const ok = results.filter((r) => r.ok).length;
    setSuccess(`${ok} of ${unique.length} serial(s) created.`);
  }

  const bulkCount =
    !isNaN(parseInt(bulk.start, 10)) && !isNaN(parseInt(bulk.end, 10))
      ? Math.max(0, parseInt(bulk.end, 10) - parseInt(bulk.start, 10) + 1)
      : 0;

  const inputCls =
    "w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1";

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Mode Selector */}
      <div className="flex gap-4">
        {REGISTER_MODES.map((m) => (
          <label key={m} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="register_mode"
              value={m}
              checked={mode === m}
              onChange={() => { setMode(m); resetMessages(); setCsvResults([]); setBulkProgress(null); }}
              className="accent-indigo-600"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{m}</span>
          </label>
        ))}
      </div>

      <ErrorMsg msg={error} />
      <SuccessMsg msg={success} />

      {/* ── Single ── */}
      {mode === "Single" && (
        <form onSubmit={handleSingleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Serial Number *</label>
              <input type="text" value={single.serial_number} onChange={(e) => setSingle({ ...single, serial_number: e.target.value })} className={inputCls} placeholder="e.g. SN-001234" required />
            </div>
            <div>
              <label className={labelCls}>Item *</label>
              <select value={single.item} onChange={(e) => setSingle({ ...single, item: e.target.value, batch: "" })} className={inputCls} required>
                <option value="">Select Item…</option>
                {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Warehouse *</label>
              <select value={single.warehouse} onChange={(e) => setSingle({ ...single, warehouse: e.target.value })} className={inputCls} required>
                <option value="">Select Warehouse…</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Batch Reference</label>
              <select value={single.batch} onChange={(e) => setSingle({ ...single, batch: e.target.value })} className={inputCls} disabled={!single.item}>
                <option value="">No Batch / Select…</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.batch_number || b.name || b.id}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Manufacturing Date</label>
              <input type="date" value={single.manufacturing_date} onChange={(e) => setSingle({ ...single, manufacturing_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Warranty Start Date</label>
              <input type="date" value={single.warranty_start_date} onChange={(e) => setSingle({ ...single, warranty_start_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Warranty Until Date</label>
              <input type="date" value={single.warranty_until} onChange={(e) => setSingle({ ...single, warranty_until: e.target.value })} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea value={single.notes} onChange={(e) => setSingle({ ...single, notes: e.target.value })} className={inputCls} rows={2} placeholder="Optional notes…" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2 text-sm font-medium">
            {loading ? "Saving…" : "Register Serial"}
          </button>
        </form>
      )}

      {/* ── Bulk Range ── */}
      {mode === "Bulk Range" && (
        <form onSubmit={handleBulkSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Prefix *</label>
              <input type="text" value={bulk.prefix} onChange={(e) => setBulk({ ...bulk, prefix: e.target.value })} className={inputCls} placeholder="e.g. SN-" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelCls}>Start Number *</label>
                <input type="number" min="0" value={bulk.start} onChange={(e) => setBulk({ ...bulk, start: e.target.value })} className={inputCls} />
              </div>
              <div className="flex-1">
                <label className={labelCls}>End Number *</label>
                <input type="number" min="0" value={bulk.end} onChange={(e) => setBulk({ ...bulk, end: e.target.value })} className={inputCls} />
              </div>
            </div>
          </div>

          {bulkCount > 0 && (
            <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
              Preview: {bulk.prefix}{bulk.start} → {bulk.prefix}{bulk.end} &nbsp;·&nbsp; <strong>{bulkCount}</strong> serial{bulkCount !== 1 ? "s" : ""}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Item *</label>
              <select value={bulk.item} onChange={(e) => setBulk({ ...bulk, item: e.target.value, batch: "" })} className={inputCls}>
                <option value="">Select Item…</option>
                {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Warehouse *</label>
              <select value={bulk.warehouse} onChange={(e) => setBulk({ ...bulk, warehouse: e.target.value })} className={inputCls}>
                <option value="">Select Warehouse…</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Batch Reference</label>
              <select value={bulk.batch} onChange={(e) => setBulk({ ...bulk, batch: e.target.value })} className={inputCls} disabled={!bulk.item}>
                <option value="">No Batch / Select…</option>
                {bulkBatches.map((b) => <option key={b.id} value={b.id}>{b.batch_number || b.name || b.id}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Warranty Until</label>
              <input type="date" value={bulk.warranty_until} onChange={(e) => setBulk({ ...bulk, warranty_until: e.target.value })} className={inputCls} />
            </div>
          </div>

          {bulkProgress && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Registering… {bulkProgress.done} / {bulkProgress.total}
              </p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.round((bulkProgress.done / bulkProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2 text-sm font-medium">
            {loading ? "Processing…" : `Register ${bulkCount || ""} Serials`}
          </button>
        </form>
      )}

      {/* ── CSV Paste ── */}
      {mode === "CSV Paste" && (
        <form onSubmit={handleCsvSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Serial Numbers (one per line) *</label>
            <textarea
              value={csv.text}
              onChange={(e) => setCsv({ ...csv, text: e.target.value })}
              className={`${inputCls} font-mono`}
              rows={8}
              placeholder={"SN-100001\nSN-100002\nSN-100003"}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Item *</label>
              <select value={csv.item} onChange={(e) => setCsv({ ...csv, item: e.target.value, batch: "" })} className={inputCls}>
                <option value="">Select Item…</option>
                {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Warehouse *</label>
              <select value={csv.warehouse} onChange={(e) => setCsv({ ...csv, warehouse: e.target.value })} className={inputCls}>
                <option value="">Select Warehouse…</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Batch Reference</label>
              <select value={csv.batch} onChange={(e) => setCsv({ ...csv, batch: e.target.value })} className={inputCls} disabled={!csv.item}>
                <option value="">No Batch / Select…</option>
                {csvBatches.map((b) => <option key={b.id} value={b.id}>{b.batch_number || b.name || b.id}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Warranty Until</label>
              <input type="date" value={csv.warranty_until} onChange={(e) => setCsv({ ...csv, warranty_until: e.target.value })} className={inputCls} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2 text-sm font-medium">
            {loading ? "Processing…" : "Register Serials"}
          </button>

          {csvResults.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Serial Number</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Result</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                  {csvResults.map((r) => (
                    <tr key={r.serial}>
                      <td className="px-4 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">{r.serial}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-medium ${r.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

// ─── Tab 3: Serial-wise Stock ────────────────────────────────────────────────

function SerialStockTab() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    setLoading(true);
    fetchSerialNumbers({ page_size: 50 })
      .then((d) => setRows(d?.results || d || []))
      .catch((e) => setError(e?.message || "Failed to load data."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">Read-only view of serial-level stock positions (up to 50 records).</p>
      <ErrorMsg msg={error} />
      {loading ? <Spinner /> : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {["Serial Number","Item","SKU","Batch Ref","Warehouse","Location","Status","Last Movement","Reference"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No data available.</td>
                </tr>
              ) : rows.map((r) => (
                <tr key={r.id ?? r.serial_number} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-900 dark:text-gray-100 whitespace-nowrap">{r.serial_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{r.item_name || r.item || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.sku || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.batch_ref || r.batch || "—"}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{r.warehouse_name || r.warehouse || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.location || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmt(r.last_movement_date || r.last_movement)}</td>
                  <td className="px-4 py-3 text-gray-400 dark:text-gray-500 whitespace-nowrap">{r.reference || r.last_reference || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab 4: Serial Details ───────────────────────────────────────────────────

function DetailRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="sm:w-52 shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-100 break-all">{fmt(value)}</span>
    </div>
  );
}

function SerialDetailsTab() {
  const [query, setQuery]     = useState("");
  const [detail, setDetail]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setDetail(null);
    try {
      const data = await fetchSerialDetail(query.trim());
      setDetail(data);
    } catch (err) {
      setError(err?.message || "Serial not found.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <form onSubmit={handleSearch} className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter Serial Number…"
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2 text-sm font-medium"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      <ErrorMsg msg={error} />

      {loading && <Spinner />}

      {detail && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 font-mono">
              {detail.serial_number}
            </h3>
            <StatusBadge status={detail.status} />
          </div>

          <DetailRow label="Item"                   value={detail.item_name || detail.item} />
          <DetailRow label="SKU"                    value={detail.sku} />
          <DetailRow label="Batch Reference"        value={detail.batch_ref || detail.batch} />
          <DetailRow label="Warehouse"              value={detail.warehouse_name || detail.warehouse} />
          <DetailRow label="Location"               value={detail.location} />
          <DetailRow label="Manufacturing Date"     value={detail.manufacturing_date} />
          <DetailRow label="Warranty Start Date"    value={detail.warranty_start_date} />
          <DetailRow label="Warranty Until"         value={detail.warranty_until} />
          <DetailRow label="Supplier Serial Ref"   value={detail.supplier_serial_reference} />
          <DetailRow label="Goods Receipt Ref"     value={detail.goods_receipt_ref} />
          <DetailRow label="Last Seen"             value={detail.last_seen} />
          <DetailRow label="Notes"                 value={detail.notes} />
          <DetailRow label="Created At"            value={detail.created_at} />
          <DetailRow label="Updated At"            value={detail.updated_at} />
        </div>
      )}
    </div>
  );
}

// ─── Tab 5: Serial Movement History ─────────────────────────────────────────

function MovementHistoryTab() {
  const [query, setQuery]       = useState("");
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [searched, setSearched] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setRows([]);
    setSearched(false);
    try {
      const data = await fetchSerialMovements({ serial_number: query.trim() });
      setRows(data?.results || data || []);
      setSearched(true);
    } catch (err) {
      setError(err?.message || "Failed to load movement history.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSearch} className="flex gap-3 max-w-xl">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter Serial Number…"
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2 text-sm font-medium"
        >
          {loading ? "Loading…" : "Load History"}
        </button>
      </form>

      <ErrorMsg msg={error} />
      {loading && <Spinner />}

      {searched && !loading && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {["Date","Transaction Type","Direction","Reference","Warehouse","Quantity","Notes"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    No movement records found for "{query}".
                  </td>
                </tr>
              ) : rows.map((r, idx) => {
                const direction = r.direction || r.movement_direction || "";
                const dirCls = direction === "IN"
                  ? "text-green-600 dark:text-green-400 font-semibold"
                  : direction === "OUT"
                    ? "text-red-600 dark:text-red-400 font-semibold"
                    : "text-gray-600 dark:text-gray-400";
                return (
                  <tr key={r.id ?? idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmt(r.date || r.movement_date || r.created_at)}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{r.transaction_type || r.type || "—"}</td>
                    <td className={`px-4 py-3 whitespace-nowrap ${dirCls}`}>{direction || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.reference || "—"}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{r.warehouse_name || r.warehouse || "—"}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-right">{r.quantity ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500 max-w-[200px] truncate">{r.notes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function SerialManagementPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Serial Number Management</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track, register, and audit individual serialized items across your inventory.
          </p>
        </div>

        {/* Tab Bar */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Tabs">
            {TABS.map((tab, idx) => (
              <button
                key={tab}
                onClick={() => setActiveTab(idx)}
                className={`
                  whitespace-nowrap py-3 px-4 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === idx
                    ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                  }
                `}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          {activeTab === 0 && <SerialListTab />}
          {activeTab === 1 && <RegisterSerialsTab />}
          {activeTab === 2 && <SerialStockTab />}
          {activeTab === 3 && <SerialDetailsTab />}
          {activeTab === 4 && <MovementHistoryTab />}
        </div>
      </div>
    </div>
  );
}

export default SerialManagementPage;
