import React, { useState, useEffect } from "react";
import {
  Link2,
  Plus,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Building2,
  User,
  Package,
  Layers,
  Briefcase,
  GitFork,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  fetchWarehouseMappings,
  createWarehouseMapping,
  deleteWarehouseMapping,
  fetchWarehouses,
} from "../services/api";

const MAPPING_TYPES = [
  { value: "ALL", label: "All Mapping Types" },
  { value: "USER", label: "User Mapping", icon: User },
  { value: "ROLE", label: "Role / Permission Group", icon: Briefcase },
  { value: "PRODUCT", label: "Product / SKU", icon: Package },
  { value: "CATEGORY", label: "Category", icon: Layers },
  { value: "BUSINESS_UNIT", label: "Business Unit", icon: Building2 },
  { value: "BRANCH", label: "Branch / Subsidiary", icon: GitFork },
];

export function WarehouseMappingPage() {
  const [mappings, setMappings] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    warehouse: "",
    mapping_type: "USER",
    entity_id: "",
    entity_name: "",
    is_default: false,
    is_receiving_default: false,
    status: "Active",
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [maps, whs] = await Promise.all([
        fetchWarehouseMappings(),
        fetchWarehouses(),
      ]);
      setMappings(maps);
      setWarehouses(whs);
      if (whs.length > 0 && !formData.warehouse) {
        setFormData((prev) => ({ ...prev, warehouse: whs[0].id }));
      }
    } catch (err) {
      setError("Failed to load warehouse mappings.");
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
      await createWarehouseMapping(formData);
      setIsModalOpen(false);
      setFormData({
        warehouse: warehouses[0]?.id || "",
        mapping_type: "USER",
        entity_id: "",
        entity_name: "",
        is_default: false,
        is_receiving_default: false,
        status: "Active",
      });
      loadData();
    } catch (err) {
      alert("Failed to save mapping: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this warehouse mapping rule?")) return;
    try {
      await deleteWarehouseMapping(id);
      setMappings((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      alert("Error deleting mapping: " + err.message);
    }
  };

  const filteredMappings = mappings.filter((m) => {
    const matchesSearch =
      (m.entity_name && m.entity_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.entity_id && m.entity_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.warehouse_name && m.warehouse_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === "ALL" || m.mapping_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">
              Warehouse Mapping & Assignments
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
              Multi-Entity Routing
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Map warehouses to users, operational roles, SKU catalogs, business divisions, and commercial branches.
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
            Add Mapping Rule
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search entities, SKUs, or warehouses..."
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
            {MAPPING_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-zinc-300">
            <thead className="bg-slate-50 dark:bg-zinc-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3.5">Assigned Warehouse</th>
                <th className="px-6 py-3.5">Mapping Type</th>
                <th className="px-6 py-3.5">Mapped Entity</th>
                <th className="px-6 py-3.5 text-center">Default WH</th>
                <th className="px-6 py-3.5 text-center">Receiving Gate</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading mapping records...
                  </td>
                </tr>
              ) : filteredMappings.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400 dark:text-zinc-500">
                    <AlertCircle className="h-6 w-6 mx-auto mb-2 text-slate-300 dark:text-zinc-600" />
                    No warehouse mappings found matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredMappings.map((map) => (
                  <tr key={map.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition">
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-zinc-100">
                      {map.warehouse_name || `Warehouse #${map.warehouse}`}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {map.mapping_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800 dark:text-zinc-200">{map.entity_name}</div>
                      <div className="text-xs text-slate-400 font-mono">{map.entity_id}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {map.is_default ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Primary
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {map.is_receiving_default ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                          Recv Inbound
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          map.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {map.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(map.id)}
                        className="text-slate-400 hover:text-rose-600 transition p-1"
                        title="Delete mapping"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                New Warehouse Mapping Rule
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
                  Target Warehouse *
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Mapping Category *
                </label>
                <select
                  required
                  value={formData.mapping_type}
                  onChange={(e) => setFormData({ ...formData, mapping_type: e.target.value })}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
                >
                  <option value="USER">User / Operator</option>
                  <option value="ROLE">Role / Permission Group</option>
                  <option value="PRODUCT">Product / SKU</option>
                  <option value="CATEGORY">Category</option>
                  <option value="BUSINESS_UNIT">Business Division</option>
                  <option value="BRANCH">Subsidiary / Branch</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Entity Identifier (ID / Code / Username) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. USR-042, SK-STEEL-BEAM, or DIV-MIDWEST"
                  value={formData.entity_id}
                  onChange={(e) => setFormData({ ...formData, entity_id: e.target.value })}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Entity Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins (Lead Supervisor)"
                  value={formData.entity_name}
                  onChange={(e) => setFormData({ ...formData, entity_name: e.target.value })}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Primary Default Facility
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_receiving_default}
                    onChange={(e) => setFormData({ ...formData, is_receiving_default: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Default Inbound Receiving Gate
                </label>
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
                  {submitting ? "Saving..." : "Create Mapping"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default WarehouseMappingPage;

