import React, { useState } from "react";
import { CheckCircle2, Plus, Download, AlertTriangle, ShieldCheck, ArrowRight, Save, Check } from "lucide-react";

export function ReconciliationPage() {
  const [counts, setCounts] = useState([
    {
      id: "cnt-01",
      count_number: "COUNT-2026-Q4-01",
      warehouse: "Main Central Fulfillment Hub",
      status: "COMPLETED",
      items_counted: 45,
      variance_items: 2,
      created_at: "2026-10-28T09:00:00Z",
    },
    {
      id: "cnt-02",
      count_number: "COUNT-2026-OCT-EAST",
      warehouse: "East Coast Logistics Terminal",
      status: "RECONCILED",
      items_counted: 28,
      variance_items: 0,
      created_at: "2026-10-20T14:30:00Z",
    },
  ]);

  const [activeCountLines, setActiveCountLines] = useState([
    {
      id: "line-1",
      sku: "BRG-6205-2RS",
      item: "Industrial Ball Bearing 6205-2RS",
      location: "Aisle 3 - Rack B",
      snapshot_qty: 450,
      counted_qty: 448,
      unit: "EA",
      unit_cost: 14.85,
    },
    {
      id: "line-2",
      sku: "HYD-SV-24V",
      item: "Hydraulic Solenoid Valve 24V DC",
      location: "Aisle 1 - Bin 4",
      snapshot_qty: 18,
      counted_qty: 18,
      unit: "EA",
      unit_cost: 128.50,
    },
    {
      id: "line-3",
      sku: "BELT-T10-1200",
      item: "Polyurethane Timing Belt T10-1200",
      location: "Bay 2",
      snapshot_qty: 280,
      counted_qty: 282,
      unit: "EA",
      unit_cost: 32.40,
    },
  ]);

  const [reconciled, setReconciled] = useState(false);

  const handlePostReconciliation = () => {
    setReconciled(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Physical Stock Reconciliation
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Cycle count snapshot management, variance discovery, and audited adjustment posting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 shadow-xs">
            <Download className="h-3.5 w-3.5" />
            <span>Export Discrepancies</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs">
            <Plus className="h-4 w-4" />
            <span>Initiate New Count Cycle</span>
          </button>
        </div>
      </div>

      {/* Active Count Banner */}
      <div className="p-5 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  COUNT-2026-Q4-01
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {reconciled ? "RECONCILED" : "REVIEW & POST VARIANCE"}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-300">
                Facility: Main Central Fulfillment Hub • Snapshot taken on Oct 28
              </p>
            </div>
          </div>

          {!reconciled && (
            <button
              onClick={handlePostReconciliation}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>Post Audited Variance Adjustment</span>
            </button>
          )}

          {reconciled && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" /> Adjustments Posted to Immutable Ledger!
            </div>
          )}
        </div>

        {/* Lines Table */}
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-500">
                <th className="py-2.5 px-4 font-semibold">SKU & Item Name</th>
                <th className="py-2.5 px-4 font-semibold">Bin Location</th>
                <th className="py-2.5 px-4 font-semibold text-right">System Snapshot</th>
                <th className="py-2.5 px-4 font-semibold text-right">Physical Count</th>
                <th className="py-2.5 px-4 font-semibold text-right">Variance Qty</th>
                <th className="py-2.5 px-4 font-semibold text-right">Valuation Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {activeCountLines.map((line) => {
                const variance = line.counted_qty - line.snapshot_qty;
                const valueImpact = variance * line.unit_cost;

                return (
                  <tr key={line.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                    <td className="py-3 px-4">
                      <div className="font-mono text-[11px] font-semibold text-blue-600">{line.sku}</div>
                      <div className="font-medium text-slate-900 dark:text-zinc-100">{line.item}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-medium">{line.location}</td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-700 dark:text-zinc-300">
                      {line.snapshot_qty} {line.unit}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                      {line.counted_qty} {line.unit}
                    </td>
                    <td
                      className={`py-3 px-4 text-right tabular-nums font-bold ${
                        variance === 0
                          ? "text-slate-400"
                          : variance > 0
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }`}
                    >
                      {variance > 0 ? `+${variance}` : variance} {line.unit}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-medium ${
                        valueImpact === 0
                          ? "text-slate-400"
                          : valueImpact > 0
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }`}
                    >
                      ${valueImpact.toFixed(2)}
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

