import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  MapPin,
  Plus,
  Boxes,
  Layers,
  ChevronRight,
  Search,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
  Power,
  RefreshCw,
  SlidersHorizontal,
  Compass,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  fetchWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "../services/api";

const FACILITY_RADAR_DATA = [
  { metric: "Space Density", WH_MAIN: 78, WH_EAST: 64, WH_COLD: 42, fullMark: 100 },
  { metric: "Pick SLA Rate", WH_MAIN: 88, WH_EAST: 74, WH_COLD: 62, fullMark: 100 },
  { metric: "Accuracy %", WH_MAIN: 96, WH_EAST: 94, WH_COLD: 98, fullMark: 100 },
  { metric: "Buffer Safety", WH_MAIN: 82, WH_EAST: 90, WH_COLD: 85, fullMark: 100 },
  { metric: "Dock Velocity", WH_MAIN: 72, WH_EAST: 84, WH_COLD: 68, fullMark: 100 },
];

export function WarehousesPage() {
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    address: "",
    capacity_used: 25,
    is_active: true,
  });

  useEffect(() => {
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    setLoading(true);
    try {
      const data = await fetchWarehouses();
      setWarehouses(data || []);
    } catch (e) {
      console.error("Failed to load warehouses", e);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenCreateModal = () => {
    setEditingWarehouse(null);
    setFormData({
      code: `WH-${Math.floor(100 + Math.random() * 900)}`,
      name: "",
      address: "",
      capacity_used: 15,
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (wh) => {
    setEditingWarehouse(wh);
    setFormData({
      code: wh.code,
      name: wh.name,
      address: wh.address || wh.location || "",
      capacity_used: wh.capacity_used || 50,
      is_active: wh.is_active !== false,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      showToast("Facility code and name are required.");
      return;
    }
    setSubmitting(true);
    try {
      if (editingWarehouse) {
        await updateWarehouse(editingWarehouse.id, formData);
        setWarehouses((prev) =>
          prev.map((item) =>
            item.id === editingWarehouse.id ? { ...item, ...formData } : item
          )
        );
        showToast(`Facility "${formData.name}" updated successfully.`);
      } else {
        const created = await createWarehouse({
          ...formData,
          zones_count: 3,
          locations_count: 45,
          total_skus: 120,
        });
        setWarehouses((prev) => [created, ...prev]);
        showToast(`New facility "${formData.name}" provisioned.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Operation failed. Please verify facility data.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to decommission facility "${name}"? Active stock allocations will be held.`)) {
      try {
        await deleteWarehouse(id);
        setWarehouses((prev) => prev.filter((item) => item.id !== id));
        showToast(`Facility "${name}" decommissioned.`);
      } catch (err) {
        console.error(err);
        showToast("Cannot delete facility with active ledger balances.");
      }
    }
  };

  const handleToggleStatus = async (wh) => {
    const nextStatus = wh.is_active !== false ? false : true;
    try {
      await updateWarehouse(wh.id, { ...wh, is_active: nextStatus });
      setWarehouses((prev) =>
        prev.map((item) =>
          item.id === wh.id ? { ...item, is_active: nextStatus } : item
        )
      );
      showToast(`Facility "${wh.name}" ${nextStatus ? "activated" : "paused"}.`);
    } catch (err) {
      console.error(err);
      showToast("Failed to toggle facility status.");
    }
  };

  const filteredWarehouses = warehouses.filter((wh) => {
    const matchesSearch =
      wh.name?.toLowerCase().includes(search.toLowerCase()) ||
      wh.code?.toLowerCase().includes(search.toLowerCase()) ||
      (wh.address || wh.location || "")
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL"
        ? true
        : statusFilter === "ACTIVE"
        ? wh.is_active !== false && wh.status !== "INACTIVE"
        : wh.is_active === false || wh.status === "INACTIVE";

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 dark:bg-zinc-800 text-white text-xs font-medium shadow-xl border border-slate-700 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Warehouses & Distribution Facilities
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
              Multi-Facility Topology
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Physical fulfillment centers, storage zones, logistics terminals, and capacity management.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs hover:shadow-blue-500/25 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Add Warehouse</span>
        </button>
      </div>

      {/* High-Configuration Multi-Facility Operational Radar Chart */}
      <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Compass className="h-4 w-4 text-indigo-500" />
                Multi-Facility Operational Capability Radar
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200/60">
                5-Axis Benchmark
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
              Comprehensive performance radar comparing facility storage density, pick velocity SLA, accuracy %, safety buffers, and dock turnaround.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> WH-MAIN (Chicago)
            </span>
            <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> WH-EAST (Newark)
            </span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> WH-COLD (Dallas)
            </span>
          </div>
        </div>

        <div className="h-68 w-full pt-1 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={FACILITY_RADAR_DATA}>
              <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" opacity={0.6} />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(24, 24, 27, 0.95)",
                  borderColor: "rgba(63, 63, 70, 0.5)",
                  borderRadius: "14px",
                  color: "#fff",
                  fontSize: "12px",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
                  backdropFilter: "blur(12px)",
                }}
                formatter={(val, name) => [
                  `${val}% Score`,
                  name === "WH_MAIN" ? "WH-MAIN Hub" : name === "WH_EAST" ? "WH-EAST Terminal" : "WH-COLD Facility",
                ]}
              />
              <Radar name="WH_MAIN" dataKey="WH_MAIN" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.25} />
              <Radar name="WH_EAST" dataKey="WH_EAST" stroke="#6366F1" fill="#6366F1" fillOpacity={0.25} />
              <Radar name="WH_COLD" dataKey="WH_COLD" stroke="#10B981" fill="#10B981" fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Toolbar / Search Filters */}
      <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search facilities by name, code, or city..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { key: "ALL", label: "All Facilities" },
            { key: "ACTIVE", label: "Active" },
            { key: "INACTIVE", label: "Inactive" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab.key
                  ? "bg-slate-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs"
                  : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Warehouse Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {filteredWarehouses.map((wh) => (
          <div
            key={wh.id}
            className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4 hover:shadow-md hover:border-blue-400/60 dark:hover:border-blue-700/60 transition-all flex flex-col justify-between group"
          >
            <div className="space-y-3.5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {wh.name}
                    </h2>
                    <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                      {wh.code}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleStatus(wh)}
                    title={wh.is_active !== false ? "Deactivate facility" : "Activate facility"}
                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                      wh.is_active !== false
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "border-slate-200 bg-slate-50 text-slate-400 dark:border-zinc-800 dark:bg-zinc-800"
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(wh)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="Edit facility parameters"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(wh.id, wh.name)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Decommission facility"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{wh.address || wh.location || "Central Hub Location"}</span>
              </div>

              {/* Capacity Progress Meter */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-zinc-400 font-medium">Capacity Utilization</span>
                  <span className="font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                    {wh.capacity_used || 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (wh.capacity_used || 0) > 80
                        ? "bg-rose-500"
                        : (wh.capacity_used || 0) > 60
                        ? "bg-amber-500"
                        : "bg-gradient-to-r from-blue-600 to-cyan-500"
                    }`}
                    style={{ width: `${Math.min(wh.capacity_used || 0, 100)}%` }}
                  />
                </div>
              </div>

              {/* Quick Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800 text-center">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/50">
                  <span className="text-[10px] text-slate-400 font-medium block">Zones</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                    {wh.zones_count || 3}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/50">
                  <span className="text-[10px] text-slate-400 font-medium block">Locations</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                    {wh.locations_count || 48}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/50">
                  <span className="text-[10px] text-slate-400 font-medium block">Active SKUs</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                    {wh.total_skus || 120}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  wh.is_active !== false && wh.status !== "INACTIVE"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50"
                    : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${wh.is_active !== false && wh.status !== "INACTIVE" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                {wh.is_active !== false && wh.status !== "INACTIVE" ? "Operational" : "Offline"}
              </span>

              <button
                onClick={() => navigate(`/locations?warehouse=${wh.code}`)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
              >
                Inspect Bins <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Warehouse Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {editingWarehouse ? "Edit Facility Parameters" : "Provision New Facility"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Facility Code *
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g. WH-NORTH"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Facility Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Northern Regional Logistics Terminal"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Physical Address / Geographic Zone
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Minneapolis, MN - Dock 4"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Initial Capacity Utilization (%): {formData.capacity_used}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.capacity_used}
                  onChange={(e) => setFormData({ ...formData, capacity_used: parseInt(e.target.value, 10) })}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="activeCheck" className="text-slate-700 dark:text-zinc-300 font-medium cursor-pointer">
                  Facility is Active and accepts stock postings
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingWarehouse ? "Save Changes" : "Create Facility"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
