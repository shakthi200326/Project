import React, { useState, useEffect } from "react";
import { Boxes, Search, Filter, Download, ArrowUpDown, Warehouse, ShieldAlert, CheckCircle2 } from "lucide-react";
import { fetchStockBalances } from "../services/api";

export function StockBalancesPage() {
  const [balances, setBalances] = useState([]);
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    fetchStockBalances().then((res) => setBalances(res.results || []));
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filtered = balances.filter((b) => {
    const matchesWh = warehouseFilter === "ALL" || b.warehouse_name === warehouseFilter;
    const matchesSearch =
      b.item_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.item_code?.toLowerCase().includes(search.toLowerCase()) ||
      b.location_code?.toLowerCase().includes(search.toLowerCase());
    return matchesWh && matchesSearch;
  });

  const totalOnHand = filtered.reduce((acc, b) => acc + (b.on_hand_qty || 0), 0);
  const totalReserved = filtered.reduce((acc, b) => acc + (b.reserved_qty || 0), 0);
  const totalBlocked = filtered.reduce((acc, b) => acc + (b.blocked_qty || 0), 0);
  const totalAvailable = filtered.reduce((acc, b) => acc + (b.available_qty || 0), 0);

  const handleExportCSV = () => {
    const headers = [
      "SKU Code",
      "Product Description",
      "Warehouse Hub",
      "Location Code",
      "Physical On-Hand",
      "Reserved Qty",
      "Blocked (QC) Qty",
      "Free Available Qty",
      "Unit",
      "Status",
    ];

    const rows = filtered.map((b) => [
      `"${b.item_code}"`,
      `"${b.item_name}"`,
      `"${b.warehouse_name}"`,
      `"${b.location_code || "A3-RB"}"`,
      b.on_hand_qty,
      b.reserved_qty,
      b.blocked_qty,
      b.available_qty,
      b.unit,
      b.available_qty <= 0 ? "OUT OF STOCK" : b.available_qty < 25 ? "LOW STOCK" : "IN STOCK",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Stock_Balances_Report_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Stock balances report exported as CSV.");
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
            Real-Time Stock Balances
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Multi-facility availability matrix: On-hand, Reserved (sales locks), Blocked (quarantine), and Free Available.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Balance Sheet</span>
        </button>
      </div>

      {/* Balance Matrix Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Total Physical On-Hand
          </div>
          <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums mt-1">
            {totalOnHand.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Total units in storage</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Committed / Reserved
          </div>
          <div className="text-xl font-bold tracking-tight text-purple-700 dark:text-purple-400 tabular-nums mt-1">
            {totalReserved.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Allocated to customer orders</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Blocked (QC / Quarantine)
          </div>
          <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums mt-1">
            {totalBlocked.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Held for inspection</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Net Free Available
          </div>
          <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
            {totalAvailable.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            Immediately dispatchable
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SKU, product name or location..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Facilities</option>
            <option value="Main Central Hub">Main Central Hub</option>
            <option value="East Coast Logistics Terminal">East Coast Logistics Terminal</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">SKU Code</th>
                <th className="py-3.5 px-4 font-semibold">Product Description</th>
                <th className="py-3.5 px-4 font-semibold">Warehouse Hub</th>
                <th className="py-3.5 px-4 font-semibold">Location</th>
                <th className="py-3.5 px-4 font-semibold text-right">Physical On-Hand</th>
                <th className="py-3.5 px-4 font-semibold text-right">Reserved (Hold)</th>
                <th className="py-3.5 px-4 font-semibold text-right">Blocked (QC)</th>
                <th className="py-3.5 px-4 font-semibold text-right">Free Available</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40">
                      {b.item_code}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                    {b.item_name}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300 font-medium">
                    {b.warehouse_name}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                    {b.location_code || "A3-RB"}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {b.on_hand_qty} {b.unit}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-purple-600 dark:text-purple-400">
                    {b.reserved_qty} {b.unit}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-amber-600 dark:text-amber-400">
                    {b.blocked_qty} {b.unit}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                    {b.available_qty} {b.unit}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        b.available_qty <= 0
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
                          : b.available_qty < 25
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50"
                          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        b.available_qty <= 0 ? "bg-rose-500" : b.available_qty < 25 ? "bg-amber-500" : "bg-emerald-500"
                      }`} />
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
