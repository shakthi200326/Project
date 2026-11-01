import React, { useState, useEffect } from "react";
import { TrendingUp, AlertTriangle, CheckCircle, Plus, Search, Filter, ShoppingBag, ArrowRight } from "lucide-react";
import { fetchProducts } from "../services/api";

export function ReplenishmentPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("CRITICAL");

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

  const criticalItems = items.filter((p) => p.available <= p.reorder_point);
  const displayedItems = filter === "CRITICAL" ? criticalItems : items;

  return (
    <div className="space-y-5">
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
          onClick={() => alert("Generating automated purchase requisition draft for critical items...")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs cursor-pointer transition-colors"
        >
          <ShoppingBag className="h-4 w-4" />
          <span>Draft Bulk Requisition</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">Below Reorder Point</span>
            <div className="text-2xl font-bold tabular-nums text-rose-800 dark:text-rose-300 mt-1">
              {criticalItems.length} SKUs
            </div>
          </div>
          <AlertTriangle className="h-8 w-8 text-rose-500" />
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Suggested Order Value</span>
            <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
              $14,820.00
            </div>
          </div>
          <TrendingUp className="h-8 w-8 text-blue-500" />
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Stock Health Index</span>
            <div className="text-2xl font-bold tabular-nums text-emerald-800 dark:text-emerald-300 mt-1">
              94.2%
            </div>
          </div>
          <CheckCircle className="h-8 w-8 text-emerald-500" />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-zinc-800 text-xs">
        <button
          onClick={() => setFilter("CRITICAL")}
          className={`px-3.5 py-2 font-medium border-b-2 transition-colors ${
            filter === "CRITICAL"
              ? "border-rose-600 text-rose-600 dark:text-rose-400 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Action Required ({criticalItems.length})
        </button>
        <button
          onClick={() => setFilter("ALL")}
          className={`px-3.5 py-2 font-medium border-b-2 transition-colors ${
            filter === "ALL"
              ? "border-blue-600 text-blue-600 dark:text-blue-400 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          All Catalog SKUs ({items.length})
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400">
                <th className="py-3 px-4 font-semibold">SKU</th>
                <th className="py-3 px-4 font-semibold">Item Name</th>
                <th className="py-3 px-4 font-semibold">Supplier OEM</th>
                <th className="py-3 px-4 font-semibold text-right">Available</th>
                <th className="py-3 px-4 font-semibold text-right">Reorder Point</th>
                <th className="py-3 px-4 font-semibold text-right">Suggested Qty</th>
                <th className="py-3 px-4 font-semibold text-right">Unit Cost</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {displayedItems.map((p) => {
                const isUnder = p.available <= p.reorder_point;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {p.sku}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                      {p.name}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">
                      {p.supplier}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${isUnder ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
                      {p.available} {p.unit || p.base_unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                      {p.reorder_point} {p.unit || p.base_unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-blue-600 dark:text-blue-400">
                      {p.suggested_reorder} {p.unit || p.base_unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-zinc-300">
                      ${p.unit_cost?.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => alert(`Creating draft requisition for ${p.sku}: ${p.suggested_reorder} ${p.unit || p.base_unit}`)}
                        className="px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 font-medium text-[11px] inline-flex items-center gap-1"
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

