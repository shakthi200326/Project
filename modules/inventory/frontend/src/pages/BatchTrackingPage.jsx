import React, { useState } from "react";
import { Hash, Calendar, AlertTriangle, CheckCircle, Clock, ShieldAlert, Download, Search } from "lucide-react";

export function BatchTrackingPage() {
  const [batches] = useState([
    {
      id: "b-01",
      batch_number: "BATCH-2026-X1",
      item_sku: "BRG-6205-2RS",
      item_name: "Industrial Ball Bearing 6205-2RS",
      warehouse: "Main Central Fulfillment Hub",
      mfg_date: "2026-04-15",
      expiry_date: "2027-10-31",
      quantity: 450,
      days_remaining: 365,
      status: "HEALTHY",
    },
    {
      id: "b-02",
      batch_number: "BATCH-2025-L9",
      item_sku: "LUB-SYN-VG46",
      item_name: "Synthetic Compressor Lubricant ISO VG 46",
      warehouse: "Main Central Fulfillment Hub",
      mfg_date: "2025-11-01",
      expiry_date: "2026-11-15",
      quantity: 250,
      days_remaining: 15,
      status: "EXPIRING_SOON",
    },
    {
      id: "b-03",
      batch_number: "BATCH-2024-Q1",
      item_sku: "LUB-SYN-VG46",
      item_name: "Synthetic Compressor Lubricant ISO VG 46",
      warehouse: "East Coast Logistics Terminal",
      mfg_date: "2024-05-10",
      expiry_date: "2026-05-10",
      quantity: 30,
      days_remaining: -170,
      status: "EXPIRED",
    },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Batch & Lot Tracking
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Lifecycle monitoring, manufacturing lot registration, and automated expiry horizon watches.
          </p>
        </div>

        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 shadow-xs">
          <Download className="h-3.5 w-3.5" />
          <span>Export Batch Register</span>
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-500">
                <th className="py-3 px-4 font-semibold">Batch / Lot No.</th>
                <th className="py-3 px-4 font-semibold">Product SKU & Title</th>
                <th className="py-3 px-4 font-semibold">Facility</th>
                <th className="py-3 px-4 font-semibold">Mfg Date</th>
                <th className="py-3 px-4 font-semibold">Expiry Date</th>
                <th className="py-3 px-4 font-semibold text-right">Remaining Stock</th>
                <th className="py-3 px-4 font-semibold text-center">Expiry Watch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {batches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                  <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                    {b.batch_number}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 dark:text-zinc-100">{b.item_name}</div>
                    <div className="font-mono text-[10px] text-slate-400">{b.item_sku}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">{b.warehouse}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">{b.mfg_date}</td>
                  <td className="py-3 px-4 font-mono text-slate-800 dark:text-zinc-200 font-medium">
                    {b.expiry_date}
                  </td>
                  <td className="py-3 px-4 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                    {b.quantity} EA
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        b.status === "HEALTHY"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : b.status === "EXPIRING_SOON"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                      }`}
                    >
                      {b.status === "HEALTHY" && <CheckCircle className="h-3 w-3" />}
                      {b.status === "EXPIRING_SOON" && <Clock className="h-3 w-3" />}
                      {b.status === "EXPIRED" && <ShieldAlert className="h-3 w-3" />}
                      {b.days_remaining > 0
                        ? `${b.days_remaining} Days Left`
                        : `Expired (${Math.abs(b.days_remaining)}d ago)`}
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

