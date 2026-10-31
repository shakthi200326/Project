import React, { useState, useEffect } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  SlidersHorizontal,
  BookmarkCheck,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  Warehouse,
  RotateCcw,
} from "lucide-react";
import { fetchStockMovements } from "../services/api";

export function StockMovementsPage() {
  const [movements, setMovements] = useState([]);
  const [activeTab, setActiveTab] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchStockMovements().then((data) => setMovements(data.results || []));
  }, []);

  const filteredMovements = movements.filter((m) => {
    const matchesTab = activeTab === "ALL" || m.type === activeTab;
    const matchesSearch =
      m.document_number.toLowerCase().includes(search.toLowerCase()) ||
      m.item.toLowerCase().includes(search.toLowerCase()) ||
      m.warehouse.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Stock Operations & Movements
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Post goods receipts, issues, inter-warehouse transfers, cycle adjustments & reversals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 shadow-xs">
            <Download className="h-3.5 w-3.5" />
            <span>Export Register</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs">
            <Plus className="h-4 w-4" />
            <span>New Operation</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-zinc-800 text-xs">
        {[
          { key: "ALL", label: "All Movements" },
          { key: "RECEIPT", label: "Goods Receipts (In)" },
          { key: "ISSUE", label: "Stock Issues (Out)" },
          { key: "TRANSFER", label: "Warehouse Transfers" },
          { key: "ADJUSTMENT", label: "Cycle Adjustments" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3.5 py-2 font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by transaction doc, item or warehouse..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Movements Table */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/40 text-slate-500 dark:text-zinc-400">
                <th className="py-3 px-4 font-semibold">Document No.</th>
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">Item & Details</th>
                <th className="py-3 px-4 font-semibold">Warehouse & Location</th>
                <th className="py-3 px-4 font-semibold text-right">Quantity</th>
                <th className="py-3 px-4 font-semibold text-right">Unit Cost</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredMovements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-zinc-100">
                    {m.document_number}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                        m.type === "RECEIPT"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : m.type === "ISSUE"
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                          : "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                      }`}
                    >
                      {m.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-zinc-200">
                    {m.item}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800 dark:text-zinc-200">{m.warehouse}</div>
                    <div className="text-[10px] text-slate-400 dark:text-zinc-500">{m.location}</div>
                  </td>
                  <td className={`py-3 px-4 text-right font-medium tabular-nums ${m.quantity > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-zinc-200"}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity} {m.unit}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300">
                    ${m.unit_cost.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      {m.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      View Details
                    </button>
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
