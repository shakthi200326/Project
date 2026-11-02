import React, { useState, useEffect } from "react";
import { TrendingUp, AlertTriangle, CheckCircle, Plus, Search, Filter, ShoppingBag, ArrowRight, CheckCircle2, BarChart2, Sparkles } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
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

  const chartData = criticalItems.slice(0, 6).map((p) => ({
    sku: p.sku,
    name: p.name,
    available: p.available,
    reorderPoint: p.reorder_point,
    suggestedQty: p.suggested_reorder,
    unitCost: p.unit_cost || 10,
    cost: (p.suggested_reorder * (p.unit_cost || 10)).toFixed(2),
  }));

  const handleBulkRequisition = () => {
    showToast(`Bulk requisition draft generated for ${criticalItems.length} critical SKUs.`);
  };

  const handleDraftSingleOrder = (p) => {
    showToast(`Requisition drafted for ${p.sku} (${p.suggested_reorder} ${p.unit || p.base_unit || "EA"}).`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white text-xs font-semibold shadow-2xl border border-slate-700/60 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Replenishment & Reorder Planning
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60">
              <Sparkles className="h-2.5 w-2.5" />
              Safety Buffer Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Automated reorder triggers, safety stock monitoring, lead time scheduling & replenishment requisitions.
          </p>
        </div>

        <button
          onClick={handleBulkRequisition}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs hover:shadow-blue-500/25 transition-all cursor-pointer"
        >
          <ShoppingBag className="h-4 w-4" />
          <span>Draft Bulk Requisition</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider text-[10px]">Below Safety Reorder Point</span>
            <div className="text-2xl font-bold tabular-nums text-rose-800 dark:text-rose-300 mt-1">
              {criticalItems.length} SKUs
            </div>
            <div className="text-[11px] text-rose-600/80 mt-0.5 font-medium">Reorder needed immediately</div>
          </div>
          <AlertTriangle className="h-8 w-8 text-rose-500 shrink-0" />
        </div>

        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider text-[10px]">Suggested Requisition PO Value</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
              $14,820.00
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Estimated procurement outlay</div>
          </div>
          <TrendingUp className="h-8 w-8 text-blue-500 shrink-0" />
        </div>

        <div className="p-5 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider text-[10px]">Stock Fulfillment Health</span>
            <div className="text-2xl font-bold tabular-nums text-emerald-800 dark:text-emerald-300 mt-1">
              94.2%
            </div>
            <div className="text-[11px] text-emerald-600/80 mt-0.5 font-medium">Catalog service level SLA</div>
          </div>
          <CheckCircle className="h-8 w-8 text-emerald-500 shrink-0" />
        </div>
      </div>

      {/* High-Configuration Replenishment Gap Analysis Chart */}
      {criticalItems.length > 0 && (
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-blue-500" />
                Deficit Gap: Available Stock vs Safety Reorder Point
              </h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Comparison of physical units free for dispatch vs safety buffer floor and recommended replenishment batch.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Available Stock
              </span>
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Recommended PO Batch
              </span>
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-500/20" /> Safety Reorder Floor
              </span>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="availBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#E11D48" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="reorderBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="sku" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(0, 0, 0, 0.03)" }}
                  contentStyle={{
                    backgroundColor: "rgba(24, 24, 27, 0.95)",
                    borderColor: "rgba(63, 63, 70, 0.5)",
                    borderRadius: "14px",
                    color: "#fff",
                    fontSize: "12px",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
                    backdropFilter: "blur(12px)",
                  }}
                  formatter={(val, name, entry) => [
                    `${val} units (${name === "suggestedQty" ? `~$${entry.payload.cost}` : ""})`,
                    name === "available" ? "Available Stock" : name === "suggestedQty" ? "Suggested Reorder Qty" : "Safety Reorder Floor",
                  ]}
                />
                <Bar dataKey="available" fill="url(#availBarGrad)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="suggestedQty" fill="url(#reorderBarGrad)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Line type="stepAfter" dataKey="reorderPoint" stroke="#F59E0B" strokeWidth={2.5} strokeDasharray="3 3" dot={{ r: 4, fill: "#F59E0B", stroke: "#fff" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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
