import React, { useState, useEffect, useCallback } from "react";
import {
  fetchAllocationRecords,
  fetchAllocationPreview,
  createAllocation,
  fetchItems,
  fetchWarehouses,
  fetchBatchesFiltered,
} from "../services/api";

// ─── Helpers & Micro Components ─────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center items-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
    </div>
  );
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="mb-4 p-4 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm flex items-center justify-between">
      <span>{message}</span>
    </div>
  );
}

function KpiCard({ label, value, subtext, color = "emerald" }) {
  const colorMap = {
    emerald: "border-emerald-500/30 bg-emerald-950/20 text-emerald-400",
    blue: "border-blue-500/30 bg-blue-950/20 text-blue-400",
    amber: "border-amber-500/30 bg-amber-950/20 text-amber-400",
    purple: "border-purple-500/30 bg-purple-950/20 text-purple-400",
  };
  return (
    <div className={`p-4 rounded-xl border backdrop-blur-sm ${colorMap[color] || colorMap.emerald}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-white">{value}</p>
      {subtext && <p className="mt-1 text-xs text-neutral-400">{subtext}</p>}
    </div>
  );
}

function StrategyBadge({ strategy }) {
  if (strategy === "FEFO") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-900/40 text-amber-300 border border-amber-700/50">
        FEFO (First Expired)
      </span>
    );
  }
  if (strategy === "FIFO") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-900/40 text-blue-300 border border-blue-700/50">
        FIFO (First In)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
      {strategy || "MANUAL"}
    </span>
  );
}

// ─── TAB 1: Allocation Strategy Overview ────────────────────────────────────

function AllocationStrategyTab({ onSwitchToPreview }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
        <h3 className="text-lg font-semibold text-white">Stock Allocation Strategies Overview</h3>
        <p className="mt-1 text-sm text-neutral-400">
          The allocation engine decides which inventory batches or serials are earmarked first when fulfilling customer orders,
          production work orders, or stock issues.
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                FIFO — First In, First Out
              </h4>
              <StrategyBadge strategy="FIFO" />
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Prioritizes stock by earliest receipt date or registration time. Best suited for non-perishable goods,
              hardware components, general fasteners, packaging materials, and items where physical turnover is standard practice.
            </p>
            <div className="pt-2 text-xs text-neutral-300 space-y-1 border-t border-neutral-800/80">
              <div className="flex justify-between">
                <span className="text-neutral-500">Sorting Key:</span>
                <span className="font-mono text-neutral-200">received_date ASC, created_at ASC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Tie-Breaking:</span>
                <span className="font-mono text-neutral-200">Batch ID ascending</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Industry:</span>
                <span>Manufacturing, Hardware, Textiles</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                FEFO — First Expired, First Out
              </h4>
              <StrategyBadge strategy="FEFO" />
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Prioritizes stock with the earliest expiration date, regardless of when it arrived at the warehouse.
              Mandatory for pharmaceuticals, food & beverage, chemicals, adhesives, and temperature-sensitive biologicals.
            </p>
            <div className="pt-2 text-xs text-neutral-300 space-y-1 border-t border-neutral-800/80">
              <div className="flex justify-between">
                <span className="text-neutral-500">Sorting Key:</span>
                <span className="font-mono text-neutral-200">expiry_date ASC (earliest first)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Tie-Breaking:</span>
                <span className="font-mono text-neutral-200">received_date ASC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Industry:</span>
                <span>Pharma, Food & Beverage, Chemicals</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => onSwitchToPreview("preview")}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-emerald-900/30"
          >
            Launch Live Allocation Preview &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TAB 2: FIFO Configuration ──────────────────────────────────────────────

function FifoConfigTab() {
  const [config, setConfig] = useState({
    enabled: true,
    allowPartialBatches: true,
    lotPreservationPreference: true,
    strictWarehouseBoundary: true,
    autoSuggestAlternateLocation: true,
  });
  const [saved, setSaved] = useState(false);

  function handleSave(e) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">FIFO Allocation Parameters</h3>
        <p className="text-sm text-neutral-400 mt-1">
          Configure rule priorities and allocation heuristics when resolving FIFO transactions.
        </p>
      </div>

      {saved && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-700/50 text-emerald-300 text-sm rounded-lg">
          FIFO configuration parameters saved successfully.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4 max-w-2xl">
        <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-800 bg-neutral-950/40 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-white">Enable FIFO Engine</p>
            <p className="text-xs text-neutral-400">Allow standard issues and sales orders to use FIFO sorting by default</p>
          </div>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            className="rounded border-neutral-700 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
          />
        </label>

        <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-800 bg-neutral-950/40 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-white">Allow Splitting Across Multiple Batches</p>
            <p className="text-xs text-neutral-400">If the oldest batch does not have sufficient quantity, draw remaining from subsequent batch</p>
          </div>
          <input
            type="checkbox"
            checked={config.allowPartialBatches}
            onChange={(e) => setConfig({ ...config, allowPartialBatches: e.target.checked })}
            className="rounded border-neutral-700 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
          />
        </label>

        <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-800 bg-neutral-950/40 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-white">Strict Warehouse Boundary</p>
            <p className="text-xs text-neutral-400">Only allocate batches located within the transaction's specified warehouse</p>
          </div>
          <input
            type="checkbox"
            checked={config.strictWarehouseBoundary}
            onChange={(e) => setConfig({ ...config, strictWarehouseBoundary: e.target.checked })}
            className="rounded border-neutral-700 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
          />
        </label>

        <div className="pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Save FIFO Configuration
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── TAB 3: FEFO Configuration ──────────────────────────────────────────────

function FefoConfigTab() {
  const [config, setConfig] = useState({
    nearExpiryWarningDays: 30,
    disallowExpiredAllocation: true,
    minRemainingShelfLifeDays: 15,
    quarantineNearExpiryTolerance: false,
  });
  const [saved, setSaved] = useState(false);

  function handleSave(e) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">FEFO Expiry Rules & Thresholds</h3>
        <p className="text-sm text-neutral-400 mt-1">
          Define critical expiry protection safeguards to prevent dispatching expired or near-expired items.
        </p>
      </div>

      {saved && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-700/50 text-emerald-300 text-sm rounded-lg">
          FEFO configuration updated successfully.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4 max-w-2xl">
        <div className="p-4 rounded-lg border border-neutral-800 bg-neutral-950/40 space-y-3">
          <label className="block text-sm font-medium text-white">Near Expiry Warning Threshold (Days)</label>
          <input
            type="number"
            value={config.nearExpiryWarningDays}
            onChange={(e) => setConfig({ ...config, nearExpiryWarningDays: parseInt(e.target.value, 10) || 0 })}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
          />
          <p className="text-xs text-neutral-400">Batches with days remaining &le; this value trigger highlight warnings during allocation.</p>
        </div>

        <div className="p-4 rounded-lg border border-neutral-800 bg-neutral-950/40 space-y-3">
          <label className="block text-sm font-medium text-white">Minimum Remaining Shelf Life for Dispatch (Days)</label>
          <input
            type="number"
            value={config.minRemainingShelfLifeDays}
            onChange={(e) => setConfig({ ...config, minRemainingShelfLifeDays: parseInt(e.target.value, 10) || 0 })}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
          />
          <p className="text-xs text-neutral-400">Batches with less than this remaining shelf life cannot be allocated to customer sales.</p>
        </div>

        <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-800 bg-neutral-950/40 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-white">Strict Block on Expired Stock</p>
            <p className="text-xs text-neutral-400">Completely exclude expired batches from allocation candidate pool</p>
          </div>
          <input
            type="checkbox"
            checked={config.disallowExpiredAllocation}
            onChange={(e) => setConfig({ ...config, disallowExpiredAllocation: e.target.checked })}
            className="rounded border-neutral-700 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
          />
        </label>

        <div className="pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Save FEFO Configuration
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── TAB 4: Allocation Preview (Live Simulation) ─────────────────────────────

function AllocationPreviewTab({ items, warehouses, onAllocationCommitted }) {
  const [selectedItem, setSelectedItem] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [quantity, setQuantity] = useState("10");
  const [strategy, setStrategy] = useState("FEFO");
  const [loading, setLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [error, setError] = useState(null);
  const [commitLoading, setCommitLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  async function handleSimulate(e) {
    if (e) e.preventDefault();
    if (!selectedItem) {
      setError("Please select an item for simulation.");
      return;
    }
    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError("Please enter a valid positive quantity.");
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await fetchAllocationPreview({
        item: selectedItem,
        warehouse: selectedWarehouse || undefined,
        quantity: qtyNum,
        strategy,
      });
      setPreviewResult(res);
    } catch (err) {
      setError(err?.message || "Failed to generate allocation simulation.");
      setPreviewResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommitAllocation() {
    if (!previewResult || !selectedItem || !selectedWarehouse) {
      setError("Warehouse and simulated allocation are required to commit.");
      return;
    }
    setCommitLoading(true);
    setError(null);
    try {
      const res = await createAllocation({
        item: selectedItem,
        warehouse: selectedWarehouse,
        quantity: parseFloat(quantity),
        strategy,
      });
      setSuccessMsg(res.message || "Allocation successfully recorded.");
      setPreviewResult(null);
      if (onAllocationCommitted) onAllocationCommitted();
    } catch (err) {
      setError(err?.message || "Failed to commit allocation.");
    } finally {
      setCommitLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
        <h3 className="text-lg font-semibold text-white">Live Stock Allocation Simulation</h3>
        <p className="text-sm text-neutral-400 mt-1">
          Test and preview how the allocation engine fulfills a requested quantity across active batches under FIFO or FEFO rules.
        </p>

        <form onSubmit={handleSimulate} className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-1">Item / Product *</label>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
              required
            >
              <option value="">Select Item...</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.code} — {it.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-1">Warehouse</label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.code} — {wh.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-1">Quantity Needed *</label>
            <input
              type="number"
              step="any"
              min="0.0001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-1">Strategy *</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="FEFO">FEFO (First Expired First Out)</option>
              <option value="FIFO">FIFO (First In First Out)</option>
            </select>
          </div>

          <div className="md:col-span-4 flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {loading ? "Simulating..." : "Run Allocation Simulation"}
            </button>
          </div>
        </form>
      </div>

      <ErrorBanner message={error} />

      {successMsg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-700/50 text-emerald-300 text-sm rounded-lg flex justify-between items-center">
          <span>{successMsg}</span>
        </div>
      )}

      {loading && <Spinner />}

      {previewResult && !loading && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
            <div>
              <h4 className="text-base font-semibold text-white">Simulation Results: {previewResult.item_code}</h4>
              <p className="text-xs text-neutral-400">{previewResult.item_name}</p>
            </div>
            <div className="flex items-center gap-3">
              <StrategyBadge strategy={previewResult.strategy} />
              <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                previewResult.is_fully_allocated
                  ? "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50"
                  : "bg-amber-900/40 text-amber-300 border border-amber-700/50"
              }`}>
                {previewResult.is_fully_allocated ? "100% Fulfilled" : `Shortage: ${previewResult.unallocated_quantity} units`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800">
              <p className="text-xs text-neutral-500 uppercase font-semibold">Requested Quantity</p>
              <p className="text-lg font-bold text-white mt-0.5">{previewResult.requested_quantity}</p>
            </div>
            <div className="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800">
              <p className="text-xs text-neutral-500 uppercase font-semibold">Allocated Quantity</p>
              <p className="text-lg font-bold text-emerald-400 mt-0.5">{previewResult.allocated_quantity}</p>
            </div>
            <div className="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800">
              <p className="text-xs text-neutral-500 uppercase font-semibold">Remaining Shortage</p>
              <p className="text-lg font-bold text-red-400 mt-0.5">{previewResult.unallocated_quantity}</p>
            </div>
          </div>

          {previewResult.lines && previewResult.lines.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-neutral-800">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-neutral-950 text-neutral-400 uppercase font-semibold text-[11px] border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-3">Batch Number</th>
                    <th className="px-4 py-3">Warehouse / Loc</th>
                    <th className="px-4 py-3">Expiry Date</th>
                    <th className="px-4 py-3">Days Remaining</th>
                    <th className="px-4 py-3 text-right">Available Stock</th>
                    <th className="px-4 py-3 text-right text-emerald-400">Allocated</th>
                    <th className="px-4 py-3 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 bg-neutral-900/40">
                  {previewResult.lines.map((ln) => (
                    <tr key={ln.batch_id} className="hover:bg-neutral-800/40">
                      <td className="px-4 py-3 font-mono font-medium text-white">{ln.batch_number}</td>
                      <td className="px-4 py-3">
                        <div>{ln.warehouse_name || "—"}</div>
                        <div className="text-[10px] text-neutral-500">{ln.location_code}</div>
                      </td>
                      <td className="px-4 py-3 font-mono">{ln.expiry_date || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          ln.days_remaining <= 0
                            ? "bg-red-900/40 text-red-300"
                            : ln.days_remaining <= 30
                            ? "bg-amber-900/40 text-amber-300"
                            : "bg-emerald-900/40 text-emerald-300"
                        }`}>
                          {ln.days_remaining} d
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{ln.available_quantity}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                        {ln.allocated_quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-neutral-400">{ln.remaining_after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-400 text-sm">
              No eligible batches found in stock for this item with status "Released".
            </div>
          )}

          {previewResult.lines && previewResult.lines.length > 0 && selectedWarehouse && (
            <div className="flex justify-end pt-2">
              <button
                onClick={handleCommitAllocation}
                disabled={commitLoading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-emerald-900/30"
              >
                {commitLoading ? "Committing..." : "Commit Allocation Records"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TAB 5: Allocation History ──────────────────────────────────────────────

function AllocationHistoryTab({ records, loading, onRefresh }) {
  const [search, setSearch] = useState("");
  const [filterStrategy, setFilterStrategy] = useState("ALL");

  const filtered = records.filter((r) => {
    const term = search.toLowerCase();
    const matchTerm =
      !search ||
      (r.item_code && r.item_code.toLowerCase().includes(term)) ||
      (r.item_name && r.item_name.toLowerCase().includes(term)) ||
      (r.batch_number && r.batch_number.toLowerCase().includes(term)) ||
      (r.transaction_ref && r.transaction_ref.toLowerCase().includes(term));
    const matchStrat = filterStrategy === "ALL" || r.strategy === filterStrategy;
    return matchTerm && matchStrat;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <input
            type="text"
            placeholder="Search by transaction ref, batch, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterStrategy}
            onChange={(e) => setFilterStrategy(e.target.value)}
            className="bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">All Strategies</option>
            <option value="FIFO">FIFO Only</option>
            <option value="FEFO">FEFO Only</option>
            <option value="MANUAL">Manual Only</option>
          </select>
          <button
            onClick={onRefresh}
            className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-medium rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-12 text-center text-neutral-400 text-sm">
          No allocation records found matching your filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/40">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-neutral-950 text-neutral-400 uppercase font-semibold text-[11px] border-b border-neutral-800">
              <tr>
                <th className="px-4 py-3">Alloc ID</th>
                <th className="px-4 py-3">Txn Ref</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Item / SKU</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3">Batch Number</th>
                <th className="px-4 py-3">Strategy</th>
                <th className="px-4 py-3 text-right">Allocated Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {filtered.map((rec) => (
                <tr key={rec.id} className="hover:bg-neutral-800/30">
                  <td className="px-4 py-3 font-mono text-neutral-400">#{rec.id}</td>
                  <td className="px-4 py-3 font-mono text-white font-medium">{rec.transaction_ref || "—"}</td>
                  <td className="px-4 py-3 text-neutral-400">
                    {rec.created_at ? new Date(rec.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{rec.item_name}</div>
                    <div className="text-[10px] font-mono text-neutral-400">{rec.item_code}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-300">{rec.warehouse_name || "—"}</td>
                  <td className="px-4 py-3 font-mono text-emerald-400">{rec.batch_number || "—"}</td>
                  <td className="px-4 py-3">
                    <StrategyBadge strategy={rec.strategy} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-white">
                    {rec.allocated_quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export function StockAllocationPage() {
  const [activeTab, setActiveTab] = useState("strategy");
  const [records, setRecords] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [recs, itms, whs] = await Promise.all([
        fetchAllocationRecords(),
        fetchItems(),
        fetchWarehouses(),
      ]);
      setRecords(recs);
      setItems(itms.results || itms);
      setWarehouses(whs.results || whs);
    } catch (err) {
      setError(err?.message || "Failed to load stock allocation data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute KPI counts
  const totalAllocations = records.length;
  const fifoCount = records.filter((r) => r.strategy === "FIFO").length;
  const fefoCount = records.filter((r) => r.strategy === "FEFO").length;
  const totalAllocQty = records.reduce((acc, r) => acc + parseFloat(r.allocated_quantity || 0), 0);

  const TABS = [
    { id: "strategy", label: "Allocation Strategy" },
    { id: "fifo", label: "FIFO Configuration" },
    { id: "fefo", label: "FEFO Configuration" },
    { id: "preview", label: "Allocation Preview" },
    { id: "history", label: "Allocation History" },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            <span>07. Batch, Lot & Serial Tracking</span>
            <span>/</span>
            <span className="text-emerald-400">Stock Allocation</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Stock Allocation Engine</h1>
          <p className="mt-0.5 text-sm text-neutral-400">
            Automated batch allocation strategies (FIFO & FEFO), order simulation, and reservation audit history.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Allocations" value={totalAllocations} subtext="Lifetime records" color="emerald" />
        <KpiCard label="Total Units Earmarked" value={totalAllocQty.toFixed(1)} subtext="Across all strategies" color="blue" />
        <KpiCard label="FEFO Transactions" value={fefoCount} subtext="Expiry-first allocations" color="amber" />
        <KpiCard label="FIFO Transactions" value={fifoCount} subtext="Receipt-first allocations" color="purple" />
      </div>

      <ErrorBanner message={error} />

      {/* Tab Bar */}
      <div className="border-b border-neutral-800">
        <nav className="flex space-x-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-emerald-500 text-emerald-400 bg-neutral-900/40"
                    : "border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === "strategy" && <AllocationStrategyTab onSwitchToPreview={(t) => setActiveTab(t)} />}
        {activeTab === "fifo" && <FifoConfigTab />}
        {activeTab === "fefo" && <FefoConfigTab />}
        {activeTab === "preview" && (
          <AllocationPreviewTab
            items={items}
            warehouses={warehouses}
            onAllocationCommitted={() => {
              loadData();
              setActiveTab("history");
            }}
          />
        )}
        {activeTab === "history" && (
          <AllocationHistoryTab records={records} loading={loading} onRefresh={loadData} />
        )}
      </div>
    </div>
  );
}

export default StockAllocationPage;

