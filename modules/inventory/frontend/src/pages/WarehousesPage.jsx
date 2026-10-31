import React, { useState } from "react";
import { Building2, MapPin, Plus, Boxes, Layers, ChevronRight } from "lucide-react";

export function WarehousesPage() {
  const [warehouses] = useState([
    {
      id: "wh-01",
      code: "WH-MAIN",
      name: "Main Central Fulfillment Hub",
      location: "Chicago, IL - Sector 4",
      capacity_used: 78,
      zones_count: 5,
      locations_count: 142,
      total_skus: 840,
      status: "ACTIVE",
    },
    {
      id: "wh-02",
      code: "WH-EAST",
      name: "East Coast Logistics Terminal",
      location: "Newark, NJ - Pier 12",
      capacity_used: 64,
      zones_count: 4,
      locations_count: 98,
      total_skus: 420,
      status: "ACTIVE",
    },
    {
      id: "wh-03",
      code: "WH-COLD",
      name: "Cold Storage & Perishables Facility",
      location: "Dallas, TX - Zone B",
      capacity_used: 42,
      zones_count: 2,
      locations_count: 36,
      total_skus: 160,
      status: "ACTIVE",
    },
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Warehouses & Facilities
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Physical fulfillment centers, storage zones, aisles, racks, and bin hierarchies.
          </p>
        </div>

        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs">
          <Plus className="h-4 w-4" />
          <span>Add Warehouse</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {warehouses.map((wh) => (
          <div
            key={wh.id}
            className="p-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-4 hover:border-blue-500 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">{wh.name}</h2>
                  <span className="font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    {wh.code}
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                {wh.status}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              <span>{wh.location}</span>
            </div>

            {/* Capacity Bar */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-zinc-400">Capacity Occupancy</span>
                <span className="font-bold tabular-nums text-slate-900 dark:text-white">{wh.capacity_used}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    wh.capacity_used > 80 ? "bg-amber-500" : "bg-blue-600"
                  }`}
                  style={{ width: `${wh.capacity_used}%` }}
                />
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800 text-center text-xs">
              <div className="p-2 rounded bg-slate-50 dark:bg-zinc-800/40">
                <div className="font-bold text-slate-900 dark:text-white tabular-nums">{wh.zones_count}</div>
                <div className="text-[10px] text-slate-400">Zones</div>
              </div>
              <div className="p-2 rounded bg-slate-50 dark:bg-zinc-800/40">
                <div className="font-bold text-slate-900 dark:text-white tabular-nums">{wh.locations_count}</div>
                <div className="text-[10px] text-slate-400">Bins/Racks</div>
              </div>
              <div className="p-2 rounded bg-slate-50 dark:bg-zinc-800/40">
                <div className="font-bold text-slate-900 dark:text-white tabular-nums">{wh.total_skus}</div>
                <div className="text-[10px] text-slate-400">SKUs</div>
              </div>
            </div>

            <button className="w-full py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-blue-600 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center justify-center gap-1 transition-colors">
              <span>Inspect Bin Hierarchy</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
