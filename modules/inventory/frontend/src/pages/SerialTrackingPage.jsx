import React, { useState } from "react";
import { Cpu, Search, Download, CheckCircle, ShieldCheck, Tag, ExternalLink } from "lucide-react";

export function SerialTrackingPage() {
  const [serials] = useState([
    {
      id: "sn-01",
      serial_number: "SN-ENC-90812-001",
      sku: "ENC-OPT-1024",
      item_name: "Optical Rotary Encoder 1024 PPR",
      warehouse: "Main Central Fulfillment Hub",
      location: "Aisle 2 - Bin 01",
      status: "IN_STOCK",
      received_at: "2026-09-15T11:20:00Z",
    },
    {
      id: "sn-02",
      serial_number: "SN-ENC-90812-002",
      sku: "ENC-OPT-1024",
      item_name: "Optical Rotary Encoder 1024 PPR",
      warehouse: "Main Central Fulfillment Hub",
      location: "Aisle 2 - Bin 01",
      status: "IN_STOCK",
      received_at: "2026-09-15T11:20:00Z",
    },
    {
      id: "sn-03",
      serial_number: "SN-HYD-4410-098",
      sku: "HYD-SV-24V",
      item_name: "Hydraulic Solenoid Valve 24V DC",
      warehouse: "Main Central Fulfillment Hub",
      location: "DISPATCHED",
      status: "DISPATCHED",
      received_at: "2026-08-10T16:00:00Z",
    },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Serial Number Registry
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Individual piece-level serial tracking with complete lifecycle trace history.
          </p>
        </div>

        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 shadow-xs">
          <Download className="h-3.5 w-3.5" />
          <span>Export Serials CSV</span>
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-500">
                <th className="py-3 px-4 font-semibold">Serial Number</th>
                <th className="py-3 px-4 font-semibold">Item & SKU</th>
                <th className="py-3 px-4 font-semibold">Current Facility & Location</th>
                <th className="py-3 px-4 font-semibold">Registered Date</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 text-center">Trace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {serials.map((sn) => (
                <tr key={sn.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                  <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                    {sn.serial_number}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 dark:text-zinc-100">{sn.item_name}</div>
                    <div className="font-mono text-[10px] text-slate-400">{sn.sku}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800 dark:text-zinc-200">{sn.warehouse}</div>
                    <div className="text-[10px] text-slate-400">{sn.location}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {new Date(sn.received_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        sn.status === "IN_STOCK"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {sn.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button className="text-xs text-blue-600 hover:underline font-medium">
                      Inspect Audit Trail
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
