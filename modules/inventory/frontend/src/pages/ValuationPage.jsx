import React from "react";
import { DollarSign, Download, PieChart, TrendingUp, Info } from "lucide-react";

export function ValuationPage() {
  const valuationRows = [
    { category: "Mechanical Components", items_count: 520, on_hand_qty: 18450, total_value: 168420.0, avg_unit_cost: 9.13 },
    { category: "Hydraulics & Pneumatics", items_count: 240, on_hand_qty: 3820, total_value: 124800.0, avg_unit_cost: 32.67 },
    { category: "Sensors & Automation", items_count: 310, on_hand_qty: 4950, total_value: 84650.0, avg_unit_cost: 17.10 },
    { category: "Power Transmission", items_count: 180, on_hand_qty: 6200, total_value: 36240.0, avg_unit_cost: 5.85 },
    { category: "Chemicals & Fluids", items_count: 170, on_hand_qty: 18240, total_value: 14430.0, avg_unit_cost: 0.79 },
  ];

  const grandTotal = valuationRows.reduce((acc, r) => acc + r.total_value, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Inventory Valuation (Moving Weighted Average)
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Real-time balance sheet valuation by product classification & storage facility.
          </p>
        </div>

        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 shadow-xs">
          <Download className="h-3.5 w-3.5" />
          <span>Export Valuation Report</span>
        </button>
      </div>

      {/* Valuation Info Banner */}
      <div className="p-3 px-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 flex items-center gap-3 text-xs text-blue-900 dark:text-blue-300">
        <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <span>
          Valuation is recalculated dynamically upon every Goods Receipt using the Moving Weighted Average formula:{" "}
          <strong className="font-mono">WAV_new = (Q_curr * WAV_curr + Q_in * Cost_in) / (Q_curr + Q_in)</strong>.
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/40 text-slate-500 dark:text-zinc-400">
                <th className="py-3 px-4 font-semibold">Category Classification</th>
                <th className="py-3 px-4 font-semibold text-center">Active SKUs</th>
                <th className="py-3 px-4 font-semibold text-right">Total On-Hand Qty</th>
                <th className="py-3 px-4 font-semibold text-right">Avg Unit Cost</th>
                <th className="py-3 px-4 font-semibold text-right">Total Valuation (USD)</th>
                <th className="py-3 px-4 font-semibold text-right">% of Inventory</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {valuationRows.map((row) => (
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
                <td className="py-3 px-4 text-center">1,420</td>
                <td className="py-3 px-4 text-right">51,660</td>
                <td className="py-3 px-4 text-right">-</td>
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
