import React, { useState, useEffect } from "react";
import {
  MapPin,
  Search,
  Filter,
  Warehouse,
  Scale,
  Box,
  Layers,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  ArrowUpDown,
} from "lucide-react";
import { fetchWarehouses, fetchLocationUtilization } from "../services/api";

export function LocationUtilizationPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [utilizationList, setUtilizationList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const whs = await fetchWarehouses();
        setWarehouses(whs);
        if (whs.length > 0) {
          const firstId = whs[0].id;
          setSelectedWarehouseId(firstId);
          const list = await fetchLocationUtilization(firstId);
          setUtilizationList(list);
        }
      } catch (e) {
        console.error(e);
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
      const list = await fetchLocationUtilization(whId);
      setUtilizationList(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredLocations = utilizationList.filter((loc) => {
    const matchesSearch =
      loc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "ALL" || loc.location_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">
              Location Utilization & Occupancy
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
              Granular Telemetry
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Real-time occupancy, SKU density, weight usage, and volume headroom across storage locations.
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
            title="Refresh utilization"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search locations by code or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-zinc-100"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 px-3 py-2 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Location Types</option>
            <option value="RECEIVING">Receiving Dock</option>
            <option value="INSPECTION">Inspection Bench</option>
            <option value="QUALITY_HOLD">Quality Hold</option>
            <option value="QUARANTINE">Quarantine Cage</option>
            <option value="STORAGE">Storage Bay</option>
            <option value="PICKING">Forward Picking</option>
            <option value="PACKING">Packing Station</option>
            <option value="DISPATCH">Dispatch Staging</option>
            <option value="RETURNS">Returns Area</option>
          </select>
        </div>
      </div>

      {/* Utilization Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-zinc-300">
            <thead className="bg-slate-50 dark:bg-zinc-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3.5">Location Code</th>
                <th className="px-6 py-3.5">Location Name</th>
                <th className="px-6 py-3.5">Type</th>
                <th className="px-6 py-3.5 text-center">SKU Density</th>
                <th className="px-6 py-3.5">Weight Load</th>
                <th className="px-6 py-3.5">Volume Load</th>
                <th className="px-6 py-3.5 text-center">Gates</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-10 text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-600" />
                    Calculating location metrics...
                  </td>
                </tr>
              ) : filteredLocations.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-slate-400 dark:text-zinc-500">
                    <AlertCircle className="h-6 w-6 mx-auto mb-2 text-slate-300 dark:text-zinc-600" />
                    No locations found for this facility.
                  </td>
                </tr>
              ) : (
                filteredLocations.map((loc) => {
                  const wColor =
                    loc.weight_pct > 90
                      ? "bg-rose-500"
                      : loc.weight_pct > 75
                      ? "bg-amber-500"
                      : "bg-blue-600";
                  const vColor =
                    loc.volume_pct > 90
                      ? "bg-rose-500"
                      : loc.volume_pct > 75
                      ? "bg-amber-500"
                      : "bg-indigo-600";

                  return (
                    <tr key={loc.location_id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-zinc-100">
                        {loc.code}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800 dark:text-zinc-200">
                        {loc.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                          {loc.location_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-slate-900 dark:text-zinc-100">
                          {loc.sku_count} SKUs
                        </span>
                        <div className="text-[11px] text-slate-400">
                          {Math.round(loc.total_quantity)} units
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-28 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-bold text-slate-800 dark:text-zinc-200">{loc.weight_pct}%</span>
                            <span className="text-slate-400 text-[10px]">{Math.round(loc.weight_used)} / {Math.round(loc.weight_max)} kg</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                            <div className={`h-1.5 rounded-full ${wColor}`} style={{ width: `${Math.min(100, loc.weight_pct)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-28 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-bold text-slate-800 dark:text-zinc-200">{loc.volume_pct}%</span>
                            <span className="text-slate-400 text-[10px]">{Math.round(loc.volume_used)} / {Math.round(loc.volume_max)} m³</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                            <div className={`h-1.5 rounded-full ${vColor}`} style={{ width: `${Math.min(100, loc.volume_pct)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded font-semibold ${loc.allow_receiving ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600"}`}>
                            Recv
                          </span>
                          <span className={`px-1.5 py-0.5 rounded font-semibold ${loc.allow_putaway ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300" : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600"}`}>
                            Put
                          </span>
                          <span className={`px-1.5 py-0.5 rounded font-semibold ${loc.allow_picking ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300" : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600"}`}>
                            Pick
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          {loc.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default LocationUtilizationPage;
