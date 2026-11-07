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
  Edit2,
  X,
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

export function WarehouseZonesPage({
  externalSearch,
  externalWarehouse,
  externalStatus,
  onRegisterActions,
  compact = false,
}) {
  const [zones, setZones] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [whFilter, setWhFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState(null);

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

  useEffect(() => {
    if (externalSearch !== undefined) setSearchTerm(externalSearch);
  }, [externalSearch]);

  useEffect(() => {
    if (externalWarehouse !== undefined && externalWarehouse !== "ALL") {
      const warehouse = warehouses.find(
        (item) => String(item.code) === String(externalWarehouse) || String(item.id) === String(externalWarehouse)
      );
      setWhFilter(warehouse ? String(warehouse.id) : externalWarehouse);
    } else if (externalWarehouse === "ALL") {
      setWhFilter("ALL");
    }
  }, [externalWarehouse, warehouses]);

  useEffect(() => {
    if (externalStatus === "ALL") return;
    if (externalStatus === "Inactive") {
      setZones((current) => current);
    }
  }, [externalStatus]);

  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({ openCreate: handleOpenCreate, refresh: loadData });
    }
    return () => {
      if (onRegisterActions) onRegisterActions(null);
    };
  }, [onRegisterActions, warehouses]);

  const handleOpenCreate = () => {
    setEditingZone(null);
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
    setIsModalOpen(true);
  };

  const handleOpenEdit = (zone) => {
    setEditingZone(zone);
    setFormData({
      warehouse: zone.warehouse?.id || zone.warehouse || warehouses[0]?.id || "",
      code: zone.code || "",
      name: zone.name || "",
      zone_type: zone.zone_type || "STANDARD",
      description: zone.description || "",
      temperature_min: zone.temperature_min ?? "",
      temperature_max: zone.temperature_max ?? "",
      security_level: zone.security_level || "STANDARD",
      is_active: zone.is_active !== false,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
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
      if (editingZone?.id) {
        await updateWarehouseZone(editingZone.id, payload);
      } else {
        await createWarehouseZone(payload);
      }
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
      alert(`Failed to ${editingZone ? "update" : "create"} zone: ` + err.message);
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
    const matchesStatus =
      externalStatus === undefined ||
      externalStatus === "ALL" ||
      (externalStatus === "Active"
        ? z.is_active !== false
        : z.is_active === false);
    return matchesSearch && matchesType && matchesWh && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Zones table */}
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
        <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">
                  <th className="py-3 px-4">Zone Code</th>
                  <th className="py-3 px-4">Zone Name</th>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4">Zone Type</th>
                  <th className="py-3 px-4">Temperature</th>
                  <th className="py-3 px-4">Security</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {filteredZones.map((z) => {
                  const warehouseName = z.warehouse_name || warehouses.find((w) => String(w.id) === String(z.warehouse))?.name || `WH #${z.warehouse}`;
                  const isCold = z.zone_type === "REFRIGERATED" || z.zone_type === "FROZEN";
                  return (
                    <tr key={z.id || z.code} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-900/40">
                          {z.code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">{z.name}</td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300">
                        <div className="flex items-center gap-1.5"><Warehouse className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span>{warehouseName}</span></div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">{z.zone_type?.replace("_", " ") || "Standard"}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-zinc-300">
                        {isCold && (z.temperature_min !== null || z.temperature_max !== null)
                          ? `${z.temperature_min ?? "2"}°C to ${z.temperature_max ?? "8"}°C`
                          : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300">{z.security_level || "Standard"}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${z.is_active !== false ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40" : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700"}`}>
                          {z.is_active !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => handleOpenEdit(z)} className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-blue-600 hover:border-blue-200 dark:hover:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer" title="Edit zone"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDelete(z.id)} className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer" title="Delete zone"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredZones.length === 0 && (
              <div className="text-center py-12 p-8">
                <Layers className="h-10 w-10 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">No zones found</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Try adjusting your filters or click "+ Add New Zone".</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal to Create Zone */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                {editingZone ? "Edit Zone" : "Create Storage Zone"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Active
              </label>

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
                  {submitting ? "Saving..." : editingZone ? "Update Zone" : "Create Zone"}
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
