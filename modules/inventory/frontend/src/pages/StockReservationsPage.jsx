import React, { useState } from "react";
import { BookmarkCheck, Clock, CheckCircle2, XCircle, AlertCircle, Download, ArrowRight } from "lucide-react";

export function StockReservationsPage() {
  const [reservations, setReservations] = useState([
    {
      id: "res-01",
      reference_doc: "SO-4011-NORTH",
      item_sku: "BRG-6205-2RS",
      item_name: "Industrial Ball Bearing 6205-2RS",
      warehouse: "Main Central Fulfillment Hub",
      quantity: 45,
      unit: "EA",
      status: "PENDING",
      expires_at: "2026-11-05T18:00:00Z",
    },
    {
      id: "res-02",
      reference_doc: "WO-9912-ASSEMBLY",
      item_sku: "HYD-SV-24V",
      item_name: "Hydraulic Solenoid Valve 24V DC",
      warehouse: "Main Central Fulfillment Hub",
      quantity: 6,
      unit: "EA",
      status: "PENDING",
      expires_at: "2026-11-02T12:00:00Z",
    },
    {
      id: "res-03",
      reference_doc: "SO-3980-EXP",
      item_sku: "BELT-T10-1200",
      item_name: "Polyurethane Timing Belt T10-1200",
      warehouse: "East Coast Logistics Terminal",
      quantity: 20,
      unit: "EA",
      status: "FULFILLED",
      expires_at: "2026-10-25T10:00:00Z",
    },
  ]);

  const handleRelease = (id) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "RELEASED" } : r))
    );
  };

  const handleFulfill = (id) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "FULFILLED" } : r))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Stock Reservations
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Committed stock allocations for pending sales orders, assembly jobs & inter-branch transfers.
          </p>
        </div>

        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 shadow-xs">
          <Download className="h-3.5 w-3.5" />
          <span>Export Allocations</span>
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-500">
                <th className="py-3 px-4 font-semibold">Reference Doc</th>
                <th className="py-3 px-4 font-semibold">Product Item</th>
                <th className="py-3 px-4 font-semibold">Facility</th>
                <th className="py-3 px-4 font-semibold text-right">Reserved Qty</th>
                <th className="py-3 px-4 font-semibold">Expires At</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {reservations.map((res) => (
                <tr key={res.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                  <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                    {res.reference_doc}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 dark:text-zinc-100">{res.item_name}</div>
                    <div className="font-mono text-[10px] text-slate-400">{res.item_sku}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">{res.warehouse}</td>
                  <td className="py-3 px-4 text-right font-bold tabular-nums text-purple-600 dark:text-purple-400">
                    {res.quantity} {res.unit}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {new Date(res.expires_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        res.status === "PENDING"
                          ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                          : res.status === "FULFILLED"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {res.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {res.status === "PENDING" ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleFulfill(res.id)}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors"
                        >
                          Fulfill
                        </button>
                        <button
                          onClick={() => handleRelease(res.id)}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-[11px] font-medium transition-colors"
                        >
                          Release
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px] font-medium">—</span>
                    )}
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

