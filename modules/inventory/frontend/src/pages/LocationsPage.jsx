import React, { useState, useEffect } from "react";
import { MapPin, Plus, Search, Building2, Layers, CheckCircle2, AlertCircle } from "lucide-react";
import { fetchLocations } from "../services/api";

export function LocationsPage() {
  const [locations, setLocations] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("ALL");

  useEffect(() => {
    fetchLocations().then(setLocations);
  }, []);

  const filtered = locations.filter((loc) => {
    const matchesWh = selectedWarehouse === "ALL" || loc.warehouse === selectedWarehouse;
    const matchesSearch =
      loc.name.toLowerCase().includes(search.toLowerCase()) ||
      loc.code.toLowerCase().includes(search.toLowerCase()) ||
      loc.zone.toLowerCase().includes(search.toLowerCase());
    return matchesWh && matchesSearch;
  });

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Storage Locations & Bins
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Hierarchical mapping of zones, aisles, high-bays, racks, and picking bin addresses.
          </p>
        </div>

        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs cursor-pointer transition-colors">
          <Plus className="h-4 w-4" />
          <span>Add Location</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search locations by code, aisle or zone..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Warehouses</option>
            <option value="WH-MAIN">WH-MAIN (Main Central Hub)</option>
            <option value="WH-EAST">WH-EAST (East Coast Terminal)</option>
          </select>
        </div>
      </div>

      {/* Locations Table */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400">
                <th className="py-3 px-4 font-semibold">Location Code</th>
                <th className="py-3 px-4 font-semibold">Location Name</th>
                <th className="py-3 px-4 font-semibold">Warehouse</th>
                <th className="py-3 px-4 font-semibold">Zone</th>
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">Capacity</th>
                <th className="py-3 px-4 font-semibold">Occupancy</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filtered.map((loc) => (
                <tr key={loc.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                  <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                    {loc.code}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                    {loc.name}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 dark:text-zinc-300">
                    {loc.warehouse}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">
                    {loc.zone}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      {loc.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {loc.capacity}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            loc.occupied > 80 ? "bg-amber-500" : "bg-blue-600"
                          }`}
                          style={{ width: `${loc.occupied}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] tabular-nums text-slate-700 dark:text-zinc-300">
                        {loc.occupied}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3 w-3" /> Ready
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

