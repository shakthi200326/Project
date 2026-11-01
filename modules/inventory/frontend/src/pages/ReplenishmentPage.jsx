import React, { useState, useEffect } from "react";
import { TrendingUp, AlertTriangle, CheckCircle, Plus, Search, Filter, ShoppingBag, ArrowRight, CheckCircle2 } from "lucide-react";
import { fetchProducts } from "../services/api";

export function ReplenishmentPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("CRITICAL");
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    fetchProducts().then((res) => {
      const data = (res.results || []).map((p) => ({
        ...p,
        suggested_reorder: Math.max(0, (p.reorder_point * 2) - p.available),
        lead_time_days: 14,
        supplier: p.brand || "Preferred OEM",
      }));
      setItems(data);
    });
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const criticalItems = items.filter((p) => p.available <= p.reorder_point);
  const displayedItems = filter === "CRITICAL" ? criticalItems : items;

  const handleBulkRequisition = () => {
    showToast(`Bulk requisition draft generated for ${criticalItems.length} critical SKUs.`);
  };

  const handleDraftSingleOrder = (p) => {
    showToast(`Requisition drafted for ${p.sku} (${p.suggested_reorder} ${p.unit || p.base_unit || "EA"}).`);
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white text-xs font-medium shadow-2xl border border-slate-700/60 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Replenishment & Reorder Planning
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Automated reorder triggers, safety stock monitoring, lead time scheduling & replenishment requisitions.
          </p>
        </div>

        <button
          onClick={handleBulkRequisition}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs shadow-blue-500/25 transition-all active:scale-[0.98] cursor-pointer"
        >
          <ShoppingBag className="h-4 w-4" />
          <span>Draft Bulk Requisition</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider text-[10px]">Below Reorder Point</span>
            <div className="text-2xl font-bold tabular-nums text-rose-800 dark:text-rose-300 mt-1">
              {criticalItems.length} SKUs
            </div>
            <div className="text-[11px] text-rose-600/80 mt-0.5 font-medium">Reorder needed immediately</div>
          </div>
          <AlertTriangle className="h-8 w-8 text-rose-500 shrink-0" />
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider text-[10px]">Suggested Order Value</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
              $14,820.00
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Estimated procurement PO cost</div>
          </div>
          <TrendingUp className="h-8 w-8 text-blue-500 shrink-0" />
        </div>

        <div className="p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider text-[10px]">Stock Health Index</span>
            <div className="text-2xl font-bold tabular-nums text-emerald-800 dark:text-emerald-300 mt-1">
              94.2%
            </div>
            <div className="text-[11px] text-emerald-600/80 mt-0.5 font-medium">Catalog service level score</div>
          </div>
          <CheckCircle className="h-8 w-8 text-emerald-500 shrink-0" />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200/80 dark:border-zinc-800/80 text-xs">
        <button
          onClick={() => setFilter("CRITICAL")}
          className={`px-3.5 py-2 font-medium border-b-2 transition-all cursor-pointer ${
            filter === "CRITICAL"
              ? "border-rose-600 text-rose-600 dark:text-rose-400 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Action Required ({criticalItems.length})
        </button>
        <button
          onClick={() => setFilter("ALL")}
          className={`px-3.5 py-2 font-medium border-b-2 transition-all cursor-pointer ${
            filter === "ALL"
              ? "border-blue-600 text-blue-600 dark:text-blue-400 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          All Catalog SKUs ({items.length})
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">SKU</th>
                <th className="py-3.5 px-4 font-semibold">Item Name</th>
                <th className="py-3.5 px-4 font-semibold">Supplier OEM</th>
                <th className="py-3.5 px-4 font-semibold text-right">Available</th>
                <th className="py-3.5 px-4 font-semibold text-right">Reorder Point</th>
                <th className="py-3.5 px-4 font-semibold text-right">Suggested Qty</th>
                <th className="py-3.5 px-4 font-semibold text-right">Unit Cost</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {displayedItems.map((p) => {
                const isUnder = p.available <= p.reorder_point;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {p.sku}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {p.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300 font-medium">
                      {p.supplier}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-mono tabular-nums font-bold ${isUnder ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
                      {p.available} {p.unit || p.base_unit}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-500">
                      {p.reorder_point} {p.unit || p.base_unit}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-blue-600 dark:text-blue-400">
                      {p.suggested_reorder} {p.unit || p.base_unit}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-zinc-400 font-medium">
                      ${p.unit_cost?.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDraftSingleOrder(p)}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        Order <ArrowRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
