import React, { useState, useEffect, useMemo } from "react";
import {
  SlidersHorizontal,
  Search,
  Plus,
  Filter,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Warehouse as WarehouseIcon,
  Layers,
  RefreshCw,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  fetchReorderRules,
  createReorderRule,
  updateReorderRule,
  deleteReorderRule,
  fetchProducts,
  fetchWarehouses,
} from "@/services/api";

export function ReorderRulesPage() {
  const [rules, setRules] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form State - Exactly the 7 Phase 6 fields
  const [formData, setFormData] = useState({
    product: "",
    sku: "",
    warehouse: "",
    reorder_point: 20,
    reorder_quantity: 50,
    lead_time_days: 7,
    status: "Active",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [rRes, pRes, wRes] = await Promise.all([
        fetchReorderRules(),
        fetchProducts(),
        fetchWarehouses(),
      ]);
      setRules(rRes.results || rRes || []);
      setProducts(pRes.results || pRes || []);
      setWarehouses(wRes.results || wRes || []);
    } catch (err) {
      console.error("Failed to load reorder rules", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProductChange = (e) => {
    const prodId = e.target.value;
    const prod = products.find((p) => String(p.id) === String(prodId));
    setFormData((prev) => ({
      ...prev,
      product: prodId,
      sku: prod ? prod.sku || prod.code || "" : "",
    }));
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      product: products[0]?.id || "",
      sku: products[0]?.sku || products[0]?.code || "",
      warehouse: warehouses[0]?.id || "",
      reorder_point: 20,
      reorder_quantity: 50,
      lead_time_days: 7,
      status: "Active",
    });
    setErrorMsg("");
    setShowModal(true);
  };

  const openEditModal = (rule) => {
    setEditingId(rule.id);
    setFormData({
      product: rule.product,
      sku: rule.sku || "",
      warehouse: rule.warehouse,
      reorder_point: rule.reorder_point,
      reorder_quantity: rule.reorder_quantity,
      lead_time_days: rule.lead_time_days || 0,
      status: rule.status || "Active",
    });
    setErrorMsg("");
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.product) {
      setErrorMsg("Product is required.");
      return;
    }
    if (!formData.warehouse) {
      setErrorMsg("Warehouse is required.");
      return;
    }
    if (Number(formData.reorder_point) < 0 || Number(formData.reorder_quantity) <= 0) {
      setErrorMsg("Reorder Point must be ≥ 0 and Reorder Quantity must be > 0.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      const payload = {
        product: formData.product,
        sku: formData.sku,
        warehouse: formData.warehouse,
        reorder_point: Number(formData.reorder_point),
        reorder_quantity: Number(formData.reorder_quantity),
        lead_time_days: Number(formData.lead_time_days || 0),
        status: formData.status,
      };

      if (editingId) {
        await updateReorderRule(editingId, payload);
      } else {
        await createReorderRule(payload);
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      setErrorMsg(err.message || "Failed to save reorder rule.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this reorder rule?")) return;
    try {
      await deleteReorderRule(id);
      loadData();
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const toggleRuleStatus = async (rule) => {
    const nextStatus = rule.status === "Active" ? "Inactive" : "Active";
    try {
      await updateReorderRule(rule.id, { status: nextStatus });
      loadData();
    } catch (err) {
      console.error("Toggle status failed", err);
    }
  };

  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        (r.product_name && r.product_name.toLowerCase().includes(q)) ||
        (r.sku && r.sku.toLowerCase().includes(q));

      const matchProduct = !productFilter || String(r.product) === String(productFilter) || r.product_name === productFilter;
      const matchWarehouse = !warehouseFilter || String(r.warehouse) === String(warehouseFilter) || r.warehouse_name === warehouseFilter;
      const matchStatus = !statusFilter || r.status === statusFilter;

      return matchSearch && matchProduct && matchWarehouse && matchStatus;
    });
  }, [rules, searchTerm, productFilter, warehouseFilter, statusFilter]);

  // KPIs
  const totalCount = rules.length;
  const activeCount = rules.filter((r) => r.status === "Active" || r.status === "ACTIVE").length;
  const inactiveCount = rules.filter((r) => r.status === "Inactive" || r.status === "INACTIVE").length;
  const avgLeadTime = totalCount
    ? Math.round(rules.reduce((sum, r) => sum + Number(r.lead_time_days || 0), 0) / totalCount)
    : 0;

  const exportCSV = () => {
    const headers = [
      "Product Name",
      "SKU",
      "Warehouse",
      "Reorder Point",
      "Reorder Quantity",
      "Lead Time (Days)",
      "Status",
    ];
    const rows = filteredRules.map((r) => [
      r.product_name || "",
      r.sku || "",
      r.warehouse_name || r.warehouse || "",
      r.reorder_point || 0,
      r.reorder_quantity || 0,
      r.lead_time_days || 0,
      r.status || "Active",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map(x => `"${x}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reorder_rules_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Reorder Rules
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Policy Automation
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Define automated stock replenishment thresholds and reorder batch sizes per facility.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Reorder Rule
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Rules</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{totalCount}</span>
            <span className="text-xs text-slate-400">Policies</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Active Rules</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{activeCount}</span>
            <span className="text-xs text-slate-400">Live monitoring</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Inactive Rules</span>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-700 dark:text-zinc-300 tabular-nums">{inactiveCount}</span>
            <span className="text-xs text-slate-400">Paused</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Avg Lead Time</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{avgLeadTime}</span>
            <span className="text-xs text-slate-400">Days</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search product or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.name || p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.name || w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Warehouse</th>
                <th className="py-3 px-4 text-right">Reorder Point</th>
                <th className="py-3 px-4 text-right">Reorder Quantity</th>
                <th className="py-3 px-4 text-right">Lead Time (Days)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading reorder rules...
                  </td>
                </tr>
              ) : filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    No reorder rules configured yet. Click "Create Reorder Rule" to add one.
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {rule.product_name || "Product"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                      {rule.sku || "N/A"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300">
                      {rule.warehouse_name || rule.warehouse || "Warehouse"}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold text-amber-600 dark:text-amber-400">
                      {Number(rule.reorder_point || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold text-blue-600 dark:text-blue-400">
                      {Number(rule.reorder_quantity || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-slate-600 dark:text-zinc-400">
                      {rule.lead_time_days ? `${rule.lead_time_days} d` : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => toggleRuleStatus(rule)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                          rule.status === "Active" || rule.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                            : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700"
                        }`}
                      >
                        {rule.status === "Active" || rule.status === "ACTIVE" ? (
                          <>
                            <CheckCircle className="h-3 w-3" /> Active
                          </>
                        ) : (
                          "Inactive"
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(rule)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title="Edit rule"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Delete rule"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Reorder Rule Form (Exact 7 Phase 6 fields) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingId ? "Edit Reorder Rule" : "Create Reorder Rule Form"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Set reorder triggers and replenishment lot size.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-4">
                {/* 1. Product (Dropdown, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Product <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.product}
                    onChange={handleProductChange}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku || p.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. SKU (Auto-filled, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    SKU (Auto-filled) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    readOnly
                    placeholder="Product SKU"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-100/70 dark:bg-zinc-800/30 text-slate-600 dark:text-zinc-400 font-mono cursor-not-allowed"
                  />
                </div>

                {/* 3. Warehouse (Dropdown, Required) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Warehouse <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.warehouse}
                    onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select warehouse...</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 4. Reorder Point (Number, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Reorder Point <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.reorder_point}
                      onChange={(e) => setFormData({ ...formData, reorder_point: e.target.value })}
                      required
                      placeholder="e.g. 10"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-slate-400">Trigger threshold</span>
                  </div>

                  {/* 5. Reorder Quantity (Number, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Reorder Quantity <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.reorder_quantity}
                      onChange={(e) => setFormData({ ...formData, reorder_quantity: e.target.value })}
                      required
                      placeholder="e.g. 50"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-slate-400">Replenishment lot</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 6. Lead Time (Days) (Number, Optional) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Lead Time (Days)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.lead_time_days}
                      onChange={(e) => setFormData({ ...formData, lead_time_days: e.target.value })}
                      placeholder="e.g. 7"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* 7. Status (Dropdown, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Status <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingId ? "Update Rule" : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default ReorderRulesPage;
