import React, { useState, useEffect } from "react";
import { Boxes, Search, Filter, Download, ArrowUpDown, Warehouse, ShieldAlert, CheckCircle2 } from "lucide-react";
import { fetchStockBalances } from "../services/api";

export function StockBalancesPage() {
  const [balances, setBalances] = useState([]);
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");

  useEffect(() => {
    fetchStockBalances().then((res) => setBalances(res.results || []));
  }, []);

  const filtered = balances.filter((b) => {
    const matchesWh = warehouseFilter === "ALL" || b.warehouse_name === warehouseFilter;
    const matchesSearch =
      b.item_name.toLowerCase().includes(search.toLowerCase()) ||
      b.item_code.toLowerCase().includes(search.toLowerCase()) ||
      b.location_code?.toLowerCase().includes(search.toLowerCase());
    return matchesWh && matchesSearch;
  });

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Real-Time Stock Balances
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Multi-facility availability matrix: On-hand, Reserved (sales locks), Blocked (quarantine), and Free Available.
          </p>
        </div>

        <button
          onClick={() => alert("Exporting stock balances report to CSV...")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 shadow-xs cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Balance Sheet</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SKU, product name or location..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Facilities</option>
            <option value="Main Central Hub">Main Central Hub</option>
            <option value="East Coast Logistics Terminal">East Coast Logistics Terminal</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400">
                <th className="py-3 px-4 font-semibold">SKU Code</th>
                <th className="py-3 px-4 font-semibold">Product Description</th>
                <th className="py-3 px-4 font-semibold">Warehouse Hub</th>
                <th className="py-3 px-4 font-semibold">Location</th>
                <th className="py-3 px-4 font-semibold text-right">Physical On-Hand</th>
                <th className="py-3 px-4 font-semibold text-right">Reserved (Hold)</th>
                <th className="py-3 px-4 font-semibold text-right">Blocked (QC)</th>
                <th className="py-3 px-4 font-semibold text-right">Free Available</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                  <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                    {b.item_code}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                    {b.item_name}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">
                    {b.warehouse_name}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                    {b.location_code || "A3-RB"}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {b.on_hand_qty} {b.unit}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-purple-600 dark:text-purple-400">
                    {b.reserved_qty} {b.unit}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400">
                    {b.blocked_qty} {b.unit}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                    {b.available_qty} {b.unit}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                        b.available_qty <= 0
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                          : b.available_qty < 25
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                      }`}
                    >
                      {b.available_qty <= 0 ? "OUT OF STOCK" : b.available_qty < 25 ? "LOW STOCK" : "IN STOCK"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

