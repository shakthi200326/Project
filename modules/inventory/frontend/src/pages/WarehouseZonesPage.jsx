import React, { useState, useEffect } from "react";
import {
  Layers,
  Plus,
  Search,
  Filter,
  Warehouse,
  ShieldAlert,
  ThermometerSnowflake,
  Lock,
  Box,
  Trash2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  fetchWarehouseZones,
  createWarehouseZone,
  updateWarehouseZone,
  deleteWarehouseZone,
  fetchWarehouses,
} from "../services/api";

const ZONE_TYPES = [
  { value: "ALL", label: "All Zone Types" },
  { value: "STANDARD", label: "Standard Ambient Storage" },
  { value: "REFRIGERATED", label: "Cold Storage (2°C to 8°C)" },
  { value: "FROZEN", label: "Deep Freeze (-20°C)" },
  { value: "HAZMAT", label: "Hazardous Materials / Chemicals" },
  { value: "HIGH_SECURITY", label: "High-Security Vault / Bonded" },
];

export function WarehouseZonesPage() {
  const [zones, setZones] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [whFilter, setWhFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    warehouse: "",
    code: "",
    name: "",
    zone_type: "STANDARD",
    description: "",
    temperature_min: "",
    temperature_max: "",
    security_level: "STANDARD",
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [zList, wList] = await Promise.all([
        fetchWarehouseZones(),
        fetchWarehouses(),
      ]);
      setZones(zList);
      setWarehouses(wList);
      if (wList.length > 0 && !formData.warehouse) {
        setFormData((prev) => ({ ...prev, warehouse: wList[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        warehouse: formData.warehouse,
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        zone_type: formData.zone_type,
        description: formData.description,
        temperature_min: formData.temperature_min ? parseFloat(formData.temperature_min) : null,
        temperature_max: formData.temperature_max ? parseFloat(formData.temperature_max) : null,
        security_level: formData.security_level,
        is_active: formData.is_active,
      };
      await createWarehouseZone(payload);
      setIsModalOpen(false);
      setFormData({
        warehouse: warehouses[0]?.id || "",
        code: "",
        name: "",
        zone_type: "STANDARD",
        description: "",
        temperature_min: "",
        temperature_max: "",
        security_level: "STANDARD",
        is_active: true,
      });
      loadData();
    } catch (err) {
      alert("Failed to create zone: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this warehouse zone?")) return;
    try {
      await deleteWarehouseZone(id);
      setZones((prev) => prev.filter((z) => z.id !== id));
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const filteredZones = zones.filter((z) => {
    const matchesSearch =
      (z.name && z.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (z.code && z.code.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === "ALL" || z.zone_type === typeFilter;
    const matchesWh = whFilter === "ALL" || String(z.warehouse) === String(whFilter);
    return matchesSearch && matchesType && matchesWh;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">
              Zones & Storage Sections
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              Physical Partitions
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Configure climate-controlled, hazardous, high-security, and bulk storage zones across warehouse facilities.
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
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            Add New Zone
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search zones by code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-zinc-100"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={whFilter}
            onChange={(e) => setWhFilter(e.target.value)}
            className="text-sm rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 px-3 py-2 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} - {w.name}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 px-3 py-2 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ZONE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of Zones */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
          Loading warehouse zones...
        </div>
      ) : filteredZones.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
          <AlertCircle className="h-6 w-6 mx-auto mb-2 text-slate-300 dark:text-zinc-600" />
          No zones found matching the criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredZones.map((z) => {
            const isCold = z.zone_type === "REFRIGERATED" || z.zone_type === "FROZEN";
            const isHazmat = z.zone_type === "HAZMAT";
            const isSecure = z.zone_type === "HIGH_SECURITY";

            return (
              <div
                key={z.id}
                className="p-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4 hover:border-slate-300 dark:hover:border-zinc-700 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-600 dark:text-zinc-300">
                        {z.code}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                        {z.name}
                      </h3>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(z.id)}
                    className="text-slate-400 hover:text-rose-600 transition"
                    title="Delete Zone"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="text-xs text-slate-500 dark:text-zinc-400">
                  {z.description || "General active storage partition."}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-zinc-400">Warehouse:</span>
                    <span className="font-medium text-slate-800 dark:text-zinc-200">
                      {z.warehouse_name || `WH #${z.warehouse}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-zinc-400">Classification:</span>
                    <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      {z.zone_type}
                    </span>
                  </div>

                  {isCold && (
                    <div className="flex justify-between items-center text-cyan-600 dark:text-cyan-400">
                      <span className="flex items-center gap-1">
                        <ThermometerSnowflake className="h-3.5 w-3.5" /> Temp Bounds:
                      </span>
                      <span className="font-mono font-medium">
                        {z.temperature_min ?? 2}°C to {z.temperature_max ?? 8}°C
                      </span>
                    </div>
                  )}

                  {isHazmat && (
                    <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                      <span className="flex items-center gap-1">
                        <ShieldAlert className="h-3.5 w-3.5" /> Safety Protocol:
                      </span>
                      <span className="font-medium">OSHA Hazmat Rating</span>
                    </div>
                  )}

                  {isSecure && (
                    <div className="flex justify-between items-center text-purple-600 dark:text-purple-400">
                      <span className="flex items-center gap-1">
                        <Lock className="h-3.5 w-3.5" /> Security Clearance:
                      </span>
                      <span className="font-medium">{z.security_level || "Biometric / High"}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                      z.is_active !== false
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {z.is_active !== false ? "Active" : "Disabled"}
                  </span>
                  <a
                    href={`/inventory/racks?zone=${z.id}`}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    View Racks &rarr;
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal to Create Zone */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                Create Storage Zone
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
                  Warehouse Facility *
                </label>
                <select
                  required
                  value={formData.warehouse}
                  onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} - {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Zone Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ZN-COLD-01"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 font-mono text-slate-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Zone Type *
                  </label>
                  <select
                    required
                    value={formData.zone_type}
                    onChange={(e) => setFormData({ ...formData, zone_type: e.target.value })}
                    className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
                  >
                    <option value="STANDARD">Standard Ambient</option>
                    <option value="REFRIGERATED">Refrigerated (Cold)</option>
                    <option value="FROZEN">Deep Freeze</option>
                    <option value="HAZMAT">Hazmat / Dangerous</option>
                    <option value="HIGH_SECURITY">High-Security Vault</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Zone Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cold Chain Perishables Room A"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Description
                </label>
                <textarea
                  rows="2"
                  placeholder="Optional details on climate parameters, physical partition boundaries..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
                />
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
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Create Zone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default WarehouseZonesPage;

