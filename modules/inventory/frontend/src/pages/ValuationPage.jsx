import React, { useState } from "react";
import { DollarSign, Download, PieChart, TrendingUp, Info, CheckCircle2, Search, Filter } from "lucide-react";

export function ValuationPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const valuationRows = [
    { category: "Mechanical Components", items_count: 520, on_hand_qty: 18450, total_value: 168420.0, avg_unit_cost: 9.13 },
    { category: "Hydraulics & Pneumatics", items_count: 240, on_hand_qty: 3820, total_value: 124800.0, avg_unit_cost: 32.67 },
    { category: "Sensors & Automation", items_count: 310, on_hand_qty: 4950, total_value: 84650.0, avg_unit_cost: 17.10 },
    { category: "Power Transmission", items_count: 180, on_hand_qty: 6200, total_value: 36240.0, avg_unit_cost: 5.85 },
    { category: "Chemicals & Fluids", items_count: 170, on_hand_qty: 18240, total_value: 14430.0, avg_unit_cost: 0.79 },
  ];

  const filteredRows = valuationRows.filter((r) =>
    r.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const grandTotal = valuationRows.reduce((acc, r) => acc + r.total_value, 0);
  const totalQty = valuationRows.reduce((acc, r) => acc + r.on_hand_qty, 0);
  const totalSkus = valuationRows.reduce((acc, r) => acc + r.items_count, 0);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleExportValuation = () => {
    const headers = ["Category Classification", "Active SKUs", "Total On-Hand Qty", "Avg Unit Cost (USD)", "Total Valuation (USD)", "% of Inventory"];
    const rows = filteredRows.map((r) => [
      `"${r.category}"`,
      r.items_count,
      r.on_hand_qty,
      r.avg_unit_cost.toFixed(2),
      r.total_value.toFixed(2),
      `${((r.total_value / grandTotal) * 100).toFixed(1)}%`,
    ]);

    rows.push([
      `"TOTAL VALUATION"`,
      totalSkus,
      totalQty,
      "-",
      grandTotal.toFixed(2),
      "100.0%",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `inventory_valuation_report_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Valuation report exported successfully as CSV.");
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 dark:bg-zinc-800 text-white text-xs font-medium shadow-xl border border-slate-700 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Inventory Valuation (Moving Weighted Average)
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Real-time balance sheet valuation by product classification & storage facility.
          </p>
        </div>

        <button
          onClick={handleExportValuation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Valuation Report</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Book Value</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight font-mono text-slate-900 dark:text-white tabular-nums">
            ${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
            <TrendingUp className="h-3 w-3" /> Moving Weighted Average (MWA)
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Active Catalog SKUs</span>
            <PieChart className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {totalSkus.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400">
            Across 5 primary classifications
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Units On-Hand</span>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {totalQty.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400">
            Total units across all warehouses
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Avg Blended Cost</span>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight font-mono text-slate-900 dark:text-white tabular-nums">
            ${(grandTotal / totalQty).toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400">
            Per physical unit in stock
          </div>
        </div>
      </div>

      {/* Valuation Info Banner */}
      <div className="p-4 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/25 flex items-center gap-3 text-xs text-blue-900 dark:text-blue-300 shadow-2xs">
        <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <span>
          Valuation is recalculated dynamically upon every Goods Receipt using the Moving Weighted Average formula:{" "}
          <strong className="font-mono">WAV_new = (Q_curr * WAV_curr + Q_in * Cost_in) / (Q_curr + Q_in)</strong>.
        </span>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        {/* Search Bar */}
        <div className="p-3.5 border-b border-slate-200/80 dark:border-zinc-800/80 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by category..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Showing {filteredRows.length} of {valuationRows.length} categories
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/40 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">Category Classification</th>
                <th className="py-3.5 px-4 font-semibold text-center">Active SKUs</th>
                <th className="py-3.5 px-4 font-semibold text-right">Total On-Hand Qty</th>
                <th className="py-3.5 px-4 font-semibold text-right">Avg Unit Cost</th>
                <th className="py-3.5 px-4 font-semibold text-right">Total Valuation (USD)</th>
                <th className="py-3.5 px-4 font-semibold text-right">% of Inventory</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredRows.map((row) => (
                <tr key={row.category} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-zinc-100">
                    {row.category}
                  </td>
                  <td className="py-3 px-4 text-center tabular-nums text-slate-600 dark:text-zinc-400">
                    {row.items_count}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-800 dark:text-zinc-200">
                    {row.on_hand_qty.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-zinc-400">
                    ${row.avg_unit_cost.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                    ${row.total_value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-medium tabular-nums text-blue-600 dark:text-blue-400">
                    {((row.total_value / grandTotal) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 font-bold">
                <td className="py-3 px-4 text-slate-900 dark:text-white">TOTAL VALUATION</td>
                <td className="py-3 px-4 text-center">{totalSkus.toLocaleString()}</td>
                <td className="py-3 px-4 text-right">{totalQty.toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-mono">${(grandTotal / totalQty).toFixed(2)}</td>
                <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                  ${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 text-right">100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
