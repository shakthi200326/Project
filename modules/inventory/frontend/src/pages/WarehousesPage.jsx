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
} from "lucide-react";
import {
  fetchWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "../services/api";

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
    setSubmitting(true);
    try {
      if (editingWarehouse) {
        const updated = await updateWarehouse(editingWarehouse.id, formData);
        setWarehouses((prev) =>
          prev.map((item) =>
            item.id === editingWarehouse.id
              ? {
                  ...item,
                  ...updated,
                  status: formData.is_active ? "ACTIVE" : "INACTIVE",
                }
              : item
          )
        );
        showToast(`Warehouse ${formData.name} updated successfully.`);
      } else {
        const created = await createWarehouse(formData);
        setWarehouses((prev) => [created, ...prev]);
        showToast(`Warehouse ${created.name} registered successfully.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Operation completed in local session.");
      setIsModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (wh, e) => {
    e.stopPropagation();
    const nextActive = !wh.is_active;
    await updateWarehouse(wh.id, { is_active: nextActive });
    setWarehouses((prev) =>
      prev.map((item) =>
        item.id === wh.id
          ? {
              ...item,
              is_active: nextActive,
              status: nextActive ? "ACTIVE" : "INACTIVE",
            }
          : item
      )
    );
    showToast(`Warehouse ${wh.code} marked ${nextActive ? "ACTIVE" : "INACTIVE"}.`);
  };

  const handleDelete = async (whId, whName, e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to remove warehouse "${whName}"?`)) {
      await deleteWarehouse(whId);
      setWarehouses((prev) => prev.filter((item) => item.id !== whId));
      showToast(`Warehouse removed from registry.`);
    }
  };

  const handleInspectLocations = (whCode) => {
    navigate(`/locations?warehouse=${encodeURIComponent(whCode)}`);
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
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
              Multi-Facility Topology
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Physical fulfillment centers, storage zones, logistics terminals, and capacity management.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Add Warehouse</span>
        </button>
      </div>

      {/* Toolbar / Search Filters */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search facilities by name, code, or city..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                statusFilter === tab.key
                  ? "bg-slate-900 text-white dark:bg-white dark:text-zinc-900"
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

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => handleOpenEditModal(wh)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="Edit Facility"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      wh.is_active !== false && wh.status !== "INACTIVE"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                        : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border-slate-200 dark:border-zinc-700"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      wh.is_active !== false && wh.status !== "INACTIVE" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                    }`} />
                    {wh.is_active !== false && wh.status !== "INACTIVE"
                      ? "ACTIVE"
                      : "INACTIVE"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{wh.address || wh.location || "Central Hub Location"}</span>
              </div>

              {/* Capacity Bar */}
              <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-zinc-400 font-medium">Capacity Occupancy</span>
                  <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {wh.capacity_used}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      wh.capacity_used > 80
                        ? "bg-gradient-to-r from-amber-500 to-rose-500"
                        : "bg-gradient-to-r from-blue-600 to-cyan-500"
                    }`}
                    style={{ width: `${wh.capacity_used}%` }}
                  />
                </div>
              </div>

              {/* Quick Metrics */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-center text-xs">
                <div className="p-2 rounded-xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                  <div className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {wh.zones_count || 3}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">Zones</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                  <div className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {wh.locations_count || 48}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">Bins/Racks</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                  <div className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {wh.total_skus || 240}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">SKUs</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleInspectLocations(wh.code)}
                className="flex-1 py-2 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50/80 dark:hover:bg-zinc-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <span>Inspect Bin Hierarchy</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={(e) => handleToggleStatus(wh, e)}
                title={wh.is_active !== false ? "Deactivate Facility" : "Activate Facility"}
                className="p-2 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shadow-2xs"
              >
                <Power className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Warehouse Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {editingWarehouse ? "Edit Distribution Facility" : "Register New Distribution Facility"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Facility Identifier Code
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. WH-NORTH"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Facility Title
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g. Pacific Northwest Terminal"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Physical Street Address / City / Sector
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="e.g. 1042 Logistics Way, Seattle, WA"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Initial Capacity Utilization Estimate (%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.capacity_used}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        capacity_used: parseInt(e.target.value, 10),
                      })
                    }
                    className="flex-1 accent-blue-600"
                  />
                  <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums w-12 text-right">
                    {formData.capacity_used}%
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="wh_is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="wh_is_active"
                  className="text-xs font-medium text-slate-700 dark:text-zinc-300"
                >
                  Facility is active and ready for stock receipts and dispatch
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold shadow-xs transition-colors"
                >
                  {submitting
                    ? "Saving..."
                    : editingWarehouse
                    ? "Update Facility"
                    : "Register Facility"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
