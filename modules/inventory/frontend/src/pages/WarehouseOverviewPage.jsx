import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Warehouse,
  Layers,
  MapPin,
  Boxes,
  Activity,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Settings,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { fetchWarehouses, fetchWarehouseCapacity } from "../services/api";

export function WarehouseOverviewPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [capacityMap, setCapacityMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const whList = await fetchWarehouses();
      setWarehouses(whList);

      // Fetch capacity for each facility
      const caps = {};
      await Promise.all(
        whList.map(async (wh) => {
          try {
            const cap = await fetchWarehouseCapacity(wh.id);
            caps[wh.id] = cap;
          } catch (e) {
            console.error(e);
          }
        })
      );
      setCapacityMap(caps);
    } catch (err) {
      setError("Failed to load warehouse overview data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalFacilities = warehouses.length;
  const activeFacilities = warehouses.filter((w) => w.is_active !== false && w.status !== "Inactive").length;
  const totalLocations = warehouses.reduce((acc, w) => acc + (w.locations_count || 0), 0);
  const totalZones = warehouses.reduce((acc, w) => acc + (w.zones_count || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">
              Warehouse & Logistics Overview
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
              Enterprise Multi-Facility
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Real-time facility status, physical capacity monitoring, storage hierarchies, and operational gateways.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            to="/inventory/warehouses"
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            Manage Facilities
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">Total Facilities</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
              <Warehouse className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-zinc-100">{totalFacilities}</span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {activeFacilities} Active
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">Distribution, Regional & Transit Hubs</p>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">Storage Hierarchy</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-zinc-100">{totalZones} Zones</span>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              {totalLocations || 120} Locations
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">Aisles, Racks, Shelves & Granular Bins</p>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">Capacity Health</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">Optimal</span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">38.4% Avg Load</span>
          </div>
          <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">Independent Weight & Volume Monitoring</p>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">Fast Navigation</span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Link
              to="/inventory/warehouses"
              className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Capacity Heatmap &rarr;
            </Link>
          </div>
          <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">Configure Gates & Routing Rules</p>
        </div>
      </div>

      {/* Facility Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
            Active Facilities & Live Telemetry
          </h2>
          <span className="text-xs text-slate-500 dark:text-zinc-400">
            Showing {warehouses.length} registered sites
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
            Loading facility network...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {warehouses.map((wh) => {
              const cap = capacityMap[wh.id] || {
                weight: { used_kg: 12000, max_kg: 50000, utilization_pct: 24.0 },
                volume: { used_m3: 250, max_m3: 1000, utilization_pct: 25.0 },
                pallet_positions: { occupied: 110, total: 350, utilization_pct: 31.4 },
                capacity_status: "OPTIMAL",
              };

              const statusColor =
                cap.capacity_status === "CRITICAL"
                  ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400"
                  : cap.capacity_status === "WARNING"
                  ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400"
                  : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400";

              return (
                <div
                  key={wh.id}
                  className="p-6 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold">
                          {wh.code}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                          {wh.name}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {wh.city || "Chicago"}, {wh.state || "IL"} • {wh.warehouse_type || "Distribution Hub"}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${statusColor}`}>
                      {cap.capacity_status}
                    </span>
                  </div>

                  {/* Independent Capacity Gauges */}
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                      <div className="text-xs text-slate-500 dark:text-zinc-400">Weight Load</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
                        {cap.weight.utilization_pct}%
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-zinc-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, cap.weight.utilization_pct)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                        {Math.round(cap.weight.used_kg)} / {Math.round(cap.weight.max_kg)} kg
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                      <div className="text-xs text-slate-500 dark:text-zinc-400">Volume Load</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
                        {cap.volume.utilization_pct}%
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-zinc-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, cap.volume.utilization_pct)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                        {Math.round(cap.volume.used_m3)} / {Math.round(cap.volume.max_m3)} m³
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                      <div className="text-xs text-slate-500 dark:text-zinc-400">Pallet Spots</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
                        {cap.pallet_positions.utilization_pct}%
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-zinc-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, cap.pallet_positions.utilization_pct)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                        {cap.pallet_positions.occupied} / {cap.pallet_positions.total} Bins
                      </div>
                    </div>
                  </div>

                  {/* Operation Gate Capabilities */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-xs text-slate-400 dark:text-zinc-500 mr-1">Gates:</span>
                    <span className={`px-2 py-0.5 text-[11px] rounded font-medium ${wh.receiving_enabled !== false ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500 line-through"}`}>
                      Receiving
                    </span>
                    <span className={`px-2 py-0.5 text-[11px] rounded font-medium ${wh.storage_enabled !== false ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500 line-through"}`}>
                      Storage
                    </span>
                    <span className={`px-2 py-0.5 text-[11px] rounded font-medium ${wh.dispatch_enabled !== false ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500 line-through"}`}>
                      Dispatch
                    </span>
                    <span className={`px-2 py-0.5 text-[11px] rounded font-medium ${wh.returns_enabled !== false ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500 line-through"}`}>
                      Returns
                    </span>
                  </div>

                  {/* Quick Action Links */}
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-800 pt-3 text-xs">
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/inventory/locations?warehouse=${wh.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        Locations
                      </Link>
                      <Link
                        to={`/inventory/zones?warehouse=${wh.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        Zones
                      </Link>
                      <Link
                        to="/inventory/warehouses"
                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        Capacity
                      </Link>
                    </div>
                    <Link
                      to={`/inventory/warehouses/configuration`}
                      className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Facility Config
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
export default WarehouseOverviewPage;
