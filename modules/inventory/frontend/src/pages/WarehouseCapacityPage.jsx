import React, { useState, useEffect } from "react";
import {
  Activity,
  Warehouse,
  Scale,
  Box,
  Layers,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  RefreshCw,
  TrendingUp,
  Sliders,
} from "lucide-react";
import { fetchWarehouses, fetchWarehouseCapacity } from "../services/api";

export function WarehouseCapacityPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [capacityData, setCapacityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const whs = await fetchWarehouses();
        setWarehouses(whs);
        if (whs.length > 0) {
          const firstId = whs[0].id;
          setSelectedWarehouseId(firstId);
          const cap = await fetchWarehouseCapacity(firstId);
          setCapacityData(cap);
        }
      } catch (err) {
        setError("Failed to load warehouse facilities.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleWarehouseChange = async (whId) => {
    setSelectedWarehouseId(whId);
    setLoading(true);
    try {
      const cap = await fetchWarehouseCapacity(whId);
      setCapacityData(cap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const cap = capacityData || {
    warehouse_code: "WH-DEMO",
    warehouse_name: "Regional Warehouse Facility",
    total_units_on_hand: 1420.0,
    weight: { used_kg: 18450.0, max_kg: 50000.0, available_kg: 31550.0, utilization_pct: 36.9 },
    volume: { used_m3: 385.5, max_m3: 1200.0, available_m3: 814.5, utilization_pct: 32.1 },
    pallet_positions: { occupied: 148, total: 400, available: 252, utilization_pct: 37.0 },
    capacity_status: "OPTIMAL",
  };

  const statusColor =
    cap.capacity_status === "CRITICAL"
      ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400"
      : cap.capacity_status === "WARNING"
      ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400"
      : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">
              Warehouse Physical Capacity
            </h1>
            <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${statusColor}`}>
              Status: {cap.capacity_status}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Independent physical metrics for structural weight, cubic volume, and pallet footprint.
          </p>
        </div>

        {/* Facility Selector */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Warehouse className="h-5 w-5 text-slate-400" />
          <select
            value={selectedWarehouseId}
            onChange={(e) => handleWarehouseChange(e.target.value)}
            className="w-full sm:w-64 text-sm font-semibold rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} - {w.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => handleWarehouseChange(selectedWarehouseId)}
            className="p-2 rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
            title="Refresh capacity"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Enterprise Capacity Standard:</strong> Weight capacity and cubic volume capacity are tracked as independent physical dimensions. A warehouse holding steel beams may hit 98% weight limit while remaining at 15% volume, whereas a facility storing lightweight foam may exhaust 95% volume while utilizing only 10% weight.
        </div>
      </div>

      {/* 3 Physical Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1: Structural Weight */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">
              Structural Weight
            </span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
              <Scale className="h-5 w-5" />
            </div>
          </div>

          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-zinc-100">
              {cap.weight.utilization_pct}%
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {cap.weight.used_kg.toLocaleString()} kg of {cap.weight.max_kg.toLocaleString()} kg
            </div>
          </div>

          <div className="w-full bg-slate-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                cap.weight.utilization_pct > 90
                  ? "bg-rose-600"
                  : cap.weight.utilization_pct > 80
                  ? "bg-amber-500"
                  : "bg-blue-600"
              }`}
              style={{ width: `${Math.min(100, cap.weight.utilization_pct)}%` }}
            />
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-between text-xs">
            <span className="text-slate-500">Available Headroom:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              +{cap.weight.available_kg.toLocaleString()} kg
            </span>
          </div>
        </div>

        {/* Metric 2: Cubic Volume */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">
              Cubic Volume Space
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
              <Box className="h-5 w-5" />
            </div>
          </div>

          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-zinc-100">
              {cap.volume.utilization_pct}%
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {cap.volume.used_m3.toLocaleString()} m³ of {cap.volume.max_m3.toLocaleString()} m³
            </div>
          </div>

          <div className="w-full bg-slate-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                cap.volume.utilization_pct > 90
                  ? "bg-rose-600"
                  : cap.volume.utilization_pct > 80
                  ? "bg-amber-500"
                  : "bg-indigo-600"
              }`}
              style={{ width: `${Math.min(100, cap.volume.utilization_pct)}%` }}
            />
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-between text-xs">
            <span className="text-slate-500">Available Space:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              +{cap.volume.available_m3.toLocaleString()} m³
            </span>
          </div>
        </div>

        {/* Metric 3: Pallet Footprint & Bins */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">
              Pallet Footprint (Bins)
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
              <Layers className="h-5 w-5" />
            </div>
          </div>

          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-zinc-100">
              {cap.pallet_positions.utilization_pct}%
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {cap.pallet_positions.occupied} occupied of {cap.pallet_positions.total} positions
            </div>
          </div>

          <div className="w-full bg-slate-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                cap.pallet_positions.utilization_pct > 90
                  ? "bg-rose-600"
                  : cap.pallet_positions.utilization_pct > 80
                  ? "bg-amber-500"
                  : "bg-emerald-600"
              }`}
              style={{ width: `${Math.min(100, cap.pallet_positions.utilization_pct)}%` }}
            />
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-between text-xs">
            <span className="text-slate-500">Available Bins:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              +{cap.pallet_positions.available} Spots
            </span>
          </div>
        </div>
      </div>

      {/* Facility Summary Table */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
          Telemetry Details: {cap.warehouse_name} ({cap.warehouse_code})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-sm">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50">
            <div className="text-xs text-slate-500 dark:text-zinc-400">Total Units On-Hand</div>
            <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
              {Math.round(cap.total_units_on_hand).toLocaleString()} EA
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50">
            <div className="text-xs text-slate-500 dark:text-zinc-400">Weight Used</div>
            <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
              {cap.weight.used_kg.toLocaleString()} kg
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50">
            <div className="text-xs text-slate-500 dark:text-zinc-400">Volume Used</div>
            <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
              {cap.volume.used_m3.toLocaleString()} m³
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50">
            <div className="text-xs text-slate-500 dark:text-zinc-400">Occupied Bins</div>
            <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
              {cap.pallet_positions.occupied} Bins
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default WarehouseCapacityPage;

