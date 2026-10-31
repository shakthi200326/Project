import React, { useState } from "react";
import { FileSpreadsheet, Download, Search, Filter, ShieldCheck } from "lucide-react";

export function StockLedgerPage() {
  const [ledgerEntries] = useState([
    {
      id: "led-01",
      timestamp: "2026-10-26T08:18:46Z",
      doc_ref: "DEMO-INV-0006",
      tx_type: "RECEIPT",
      item_sku: "BRG-6205-2RS",
      item_name: "Industrial Ball Bearing 6205-2RS",
      warehouse: "Main Central Warehouse",
      location: "Aisle 3 - Rack B",
      delta: 36.0,
      balance_after: 450.0,
      unit_cost: 14.85,
      total_cost: 534.60,
      user: "warehouse.operator",
    },
    {
      id: "led-02",
      timestamp: "2026-10-25T14:22:10Z",
      doc_ref: "DEMO-INV-0005",
      tx_type: "ISSUE",
      item_sku: "HYD-SV-24V",
      item_name: "Hydraulic Solenoid Valve 24V DC",
      warehouse: "Main Central Warehouse",
      location: "Aisle 1 - Bin 4",
      delta: -5.0,
      balance_after: 18.0,
      unit_cost: 128.50,
      total_cost: -642.50,
      user: "assembly.supervisor",
    },
    {
      id: "led-03",
      timestamp: "2026-10-24T11:05:32Z",
      doc_ref: "DEMO-INV-0004",
      tx_type: "TRANSFER",
      item_sku: "BELT-T10-1200",
      item_name: "Polyurethane Timing Belt T10-1200",
      warehouse: "Main Central Warehouse",
      location: "Bay 2",
      delta: 25.0,
      balance_after: 280.0,
      unit_cost: 32.40,
      total_cost: 810.00,
      user: "logistics.coordinator",
    },
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Immutable Stock Ledger
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
              <ShieldCheck className="h-3 w-3" /> Append-Only
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Write-once, auditable financial and physical movement register with running balances.
          </p>
        </div>

        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 shadow-xs">
          <Download className="h-3.5 w-3.5" />
          <span>Export Ledger CSV</span>
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/40 text-slate-500 dark:text-zinc-400">
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Doc Ref</th>
                <th className="py-3 px-4 font-semibold">Item & SKU</th>
                <th className="py-3 px-4 font-semibold">Facility & Location</th>
                <th className="py-3 px-4 font-semibold text-right">Delta</th>
                <th className="py-3 px-4 font-semibold text-right">Running Balance</th>
                <th className="py-3 px-4 font-semibold text-right">Unit Cost</th>
                <th className="py-3 px-4 font-semibold text-right">Value Delta</th>
                <th className="py-3 px-4 font-semibold">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {ledgerEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-blue-600 dark:text-blue-400">
                    {entry.doc_ref}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900 dark:text-zinc-100">{entry.item_name}</div>
                    <div className="font-mono text-[10px] text-slate-400">{entry.item_sku}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-800 dark:text-zinc-200 font-medium">{entry.warehouse}</div>
                    <div className="text-[10px] text-slate-400">{entry.location}</div>
                  </td>
                  <td className={`py-3 px-4 text-right font-medium tabular-nums ${entry.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                  </td>
                  <td className="py-3 px-4 text-right font-bold tabular-nums text-slate-900 dark:text-zinc-100">
                    {entry.balance_after}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-zinc-400">
                    ${entry.unit_cost.toFixed(2)}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono tabular-nums ${entry.total_cost > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    ${entry.total_cost.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-zinc-400 font-mono text-[11px]">
                    {entry.user}
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

