import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Layers,
  Plus,
  Search,
  Filter,
  Warehouse,
  Box,
  Trash2,
  RefreshCw,
  AlertCircle,
  Archive,
} from "lucide-react";
import {
  fetchWarehouses,
  fetchWarehouseZones,
} from "../services/api";

export function WarehouseRacksPage() {
  const [racks, setRacks] = useState([
    { id: 1, code: "RCK-A1", name: "Aisle 1 Heavy Pallet Rack", warehouse_id: 1, warehouse_name: "Central Regional Distribution Center", zone_id: 1, zone_code: "ZN-AMBIENT-01", rack_type: "STANDARD_PALLET", total_levels: 5, max_weight: 15000.0, max_volume: 120.0, status: "Active" },
    { id: 2, code: "RCK-A2", name: "Aisle 2 Heavy Pallet Rack", warehouse_id: 1, warehouse_name: "Central Regional Distribution Center", zone_id: 1, zone_code: "ZN-AMBIENT-01", rack_type: "STANDARD_PALLET", total_levels: 5, max_weight: 15000.0, max_volume: 120.0, status: "Active" },
    { id: 3, code: "RCK-C1", name: "Cantilever Pipe & Timber Rack", warehouse_id: 1, warehouse_name: "Central Regional Distribution Center", zone_id: 1, zone_code: "ZN-AMBIENT-01", rack_type: "CANTILEVER", total_levels: 4, max_weight: 20000.0, max_volume: 150.0, status: "Active" },
    { id: 4, code: "RCK-COLD-01", name: "Cold Storage Flow Rack 1", warehouse_id: 1, warehouse_name: "Central Regional Distribution Center", zone_id: 2, zone_code: "ZN-COLD-01", rack_type: "CARTON_FLOW", total_levels: 3, max_weight: 6000.0, max_volume: 45.0, status: "Active" },
  ]);
  const [warehouses, setWarehouses] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [whFilter, setWhFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    rack_type: "STANDARD_PALLET",
    total_levels: 4,
    max_weight: 10000,
    max_volume: 80,
  });

  useEffect(() => {
    async function loadMeta() {
      try {
        const [wList, zList] = await Promise.all([
          fetchWarehouses(),
          fetchWarehouseZones(),
        ]);
        setWarehouses(wList);
        setZones(zList);
      } catch (e) {
        console.error(e);
      }
    }
    loadMeta();
  }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    const newRack = {
      id: Date.now(),
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      warehouse_id: 1,
      warehouse_name: warehouses[0]?.name || "Main Warehouse",
      zone_id: 1,
      zone_code: "ZN-AMBIENT-01",
      rack_type: formData.rack_type,
      total_levels: parseInt(formData.total_levels, 10),
      max_weight: parseFloat(formData.max_weight),
      max_volume: parseFloat(formData.max_volume),
      status: "Active",
    };
    setRacks((prev) => [newRack, ...prev]);
    setIsModalOpen(false);
    setFormData({
      code: "",
      name: "",
      rack_type: "STANDARD_PALLET",
      total_levels: 4,
      max_weight: 10000,
      max_volume: 80,
    });
  };

  const filteredRacks = racks.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">
              Racks & Shelving Systems
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
              Tier 3 Structure
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Manage multi-tier structural racking, cantilever systems, flow racks, and shelf levels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/inventory/bins"
            className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
          >
            Manage Bins &rarr;
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            Add Rack
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search racks by code or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-zinc-100"
          />
        </div>
      </div>

      {/* Racks Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm text-slate-600 dark:text-zinc-300">
          <thead className="bg-slate-50 dark:bg-zinc-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
            <tr>
              <th className="px-6 py-3.5">Rack Code</th>
              <th className="px-6 py-3.5">Rack Description</th>
              <th className="px-6 py-3.5">Zone</th>
              <th className="px-6 py-3.5">Rack Type</th>
              <th className="px-6 py-3.5 text-center">Shelf Levels</th>
              <th className="px-6 py-3.5">Max Weight</th>
              <th className="px-6 py-3.5">Max Volume</th>
              <th className="px-6 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
            {filteredRacks.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition">
                <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-zinc-100">
                  {r.code}
                </td>
                <td className="px-6 py-4 font-medium text-slate-800 dark:text-zinc-200">
                  {r.name}
                </td>
                <td className="px-6 py-4">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                    {r.zone_code}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  {r.rack_type}
                </td>
                <td className="px-6 py-4 text-center font-bold text-slate-900 dark:text-zinc-100">
                  {r.total_levels} Levels
                </td>
                <td className="px-6 py-4 font-mono text-xs">
                  {r.max_weight.toLocaleString()} kg
                </td>
                <td className="px-6 py-4 font-mono text-xs">
                  {r.max_volume} m³
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                Add Structural Rack
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Rack Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RCK-B3"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 font-mono text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Rack Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Heavy Duty Pallet Rack Bay 3"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Rack Architecture
                  </label>
                  <select
                    value={formData.rack_type}
                    onChange={(e) => setFormData({ ...formData, rack_type: e.target.value })}
                    className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
                  >
                    <option value="STANDARD_PALLET">Standard Pallet</option>
                    <option value="DRIVE_IN">Drive-In</option>
                    <option value="CANTILEVER">Cantilever</option>
                    <option value="CARTON_FLOW">Carton Flow</option>
                    <option value="MEZZANINE">Mezzanine</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Shelf Levels
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.total_levels}
                    onChange={(e) => setFormData({ ...formData, total_levels: e.target.value })}
                    className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Max Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={formData.max_weight}
                    onChange={(e) => setFormData({ ...formData, max_weight: e.target.value })}
                    className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Max Volume (m³)
                  </label>
                  <input
                    type="number"
                    value={formData.max_volume}
                    onChange={(e) => setFormData({ ...formData, max_volume: e.target.value })}
                    className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Create Rack
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default WarehouseRacksPage;

