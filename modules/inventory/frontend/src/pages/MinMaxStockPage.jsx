import React, { useState, useEffect, useMemo } from "react";
import {
  Layers,
  Search,
  Plus,
  Filter,
  Download,
  CheckCircle,
  AlertTriangle,
  X,
  Warehouse as WarehouseIcon,
  RefreshCw,
  Edit2,
  Trash2,
  TrendingDown,
  ShieldAlert,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  fetchStockLevels,
  createStockLevel,
  updateStockLevel,
  deleteStockLevel,
  fetchProducts,
  fetchWarehouses,
} from "@/services/api";

export function MinMaxStockPage() {
  const [stockLevels, setStockLevels] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form State - Exactly the 5 Phase 6 fields
  const [formData, setFormData] = useState({
    product: "",
    warehouse: "",
    min_stock: 10,
    max_stock: 100,
    safety_stock: 5,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [lRes, pRes, wRes] = await Promise.all([
        fetchStockLevels(),
        fetchProducts(),
        fetchWarehouses(),
      ]);
      setStockLevels(lRes.results || lRes || []);
      setProducts(pRes.results || pRes || []);
      setWarehouses(wRes.results || wRes || []);
    } catch (err) {
      console.error("Failed to load stock levels", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      product: products[0]?.id || "",
      warehouse: warehouses[0]?.id || "",
      min_stock: 10,
      max_stock: 100,
      safety_stock: 5,
    });
    setErrorMsg("");
    setShowModal(true);
  };

  const openEditModal = (level) => {
    setEditingId(level.id);
    setFormData({
      product: level.product,
      warehouse: level.warehouse,
      min_stock: level.min_stock,
      max_stock: level.max_stock,
      safety_stock: level.safety_stock || 0,
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
    const minVal = Number(formData.min_stock);
    const maxVal = Number(formData.max_stock);
    if (minVal < 0 || maxVal <= 0) {
      setErrorMsg("Minimum Stock must be ≥ 0 and Maximum Stock must be > 0.");
      return;
    }
    if (maxVal < minVal) {
      setErrorMsg("Maximum Stock cannot be less than Minimum Stock.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      const payload = {
        product: formData.product,
        warehouse: formData.warehouse,
        min_stock: minVal,
        max_stock: maxVal,
        safety_stock: Number(formData.safety_stock || 0),
      };

      if (editingId) {
        await updateStockLevel(editingId, payload);
      } else {
        await createStockLevel(payload);
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      setErrorMsg(err.message || "Failed to save stock level limits.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this min/max limit?")) return;
    try {
      await deleteStockLevel(id);
      loadData();
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const filteredLevels = useMemo(() => {
    return stockLevels.filter((lvl) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        (lvl.product_name && lvl.product_name.toLowerCase().includes(q)) ||
        (lvl.sku && lvl.sku.toLowerCase().includes(q));

      const matchProduct = !productFilter || String(lvl.product) === String(productFilter) || lvl.product_name === productFilter;
      const matchWarehouse = !warehouseFilter || String(lvl.warehouse) === String(warehouseFilter) || lvl.warehouse_name === warehouseFilter;

      return matchSearch && matchProduct && matchWarehouse;
    });
  }, [stockLevels, searchTerm, productFilter, warehouseFilter]);

  // KPIs
  const totalCount = stockLevels.length;
  const avgMin = totalCount
    ? Math.round(stockLevels.reduce((sum, l) => sum + Number(l.min_stock || 0), 0) / totalCount)
    : 0;
  const avgMax = totalCount
    ? Math.round(stockLevels.reduce((sum, l) => sum + Number(l.max_stock || 0), 0) / totalCount)
    : 0;
  const totalSafetyStock = stockLevels.reduce((sum, l) => sum + Number(l.safety_stock || 0), 0);

  const exportCSV = () => {
    const headers = ["Product Name", "SKU", "Warehouse", "Minimum Stock", "Maximum Stock", "Safety Stock"];
    const rows = filteredLevels.map((l) => [
      l.product_name || "",
      l.sku || "",
      l.warehouse_name || l.warehouse || "",
      l.min_stock || 0,
      l.max_stock || 0,
      l.safety_stock || 0,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map(x => `"${x}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `min_max_stock_levels_${new Date().toISOString().split("T")[0]}.csv`);
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
              Min / Max Stock Levels
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Capacity Bounds
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Establish lower and upper inventory limits and buffer safety stock to prevent shortages and overstock.
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
            Create Stock Level
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Total Bounds Configured</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{totalCount}</span>
            <span className="text-xs text-slate-400">SKU-Warehouse pairs</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Average Min Stock</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{avgMin}</span>
            <span className="text-xs text-slate-400">Floor threshold</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Average Max Stock</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{avgMax}</span>
            <span className="text-xs text-slate-400">Ceiling cap</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">Safety Buffer Units</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400 tabular-nums">{totalSafetyStock}</span>
            <span className="text-xs text-slate-400">Total buffer</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
        </div>
      </div>

      {/* Stock Levels Table - Exactly the 5 Phase 6 fields */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Warehouse</th>
                <th className="py-3 px-4 text-right">Minimum Stock</th>
                <th className="py-3 px-4 text-right">Maximum Stock</th>
                <th className="py-3 px-4 text-right">Safety Stock</th>
                <th className="py-3 px-4 text-center">Spread Capacity</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading min/max stock limits...
                  </td>
                </tr>
              ) : filteredLevels.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    No min/max stock limits defined. Click "Create Stock Level" to add parameters.
                  </td>
                </tr>
              ) : (
                filteredLevels.map((lvl) => {
                  const min = Number(lvl.min_stock || 0);
                  const max = Number(lvl.max_stock || 0);
                  const spread = max - min;
                  return (
                    <tr key={lvl.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {lvl.product_name || "Product"}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                        {lvl.sku || "N/A"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300">
                        {lvl.warehouse_name || lvl.warehouse || "Warehouse"}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-amber-600 dark:text-amber-400">
                        {min}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                        {max}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-purple-600 dark:text-purple-400">
                        {Number(lvl.safety_stock || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-[11px] font-mono font-medium text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                          Δ {spread} units
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(lvl)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="Edit limits"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(lvl.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete limits"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Stock Level Form (Exact 5 Phase 6 fields) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingId ? "Edit Stock Level Limits" : "Create Stock Level Form"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Define minimum, maximum, and safety stock limits.
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
                    onChange={(e) => setFormData({ ...formData, product: e.target.value })}
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

                {/* 2. Warehouse (Dropdown, Required) */}
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
                  {/* 3. Minimum Stock (Number, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Minimum Stock <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.min_stock}
                      onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                      required
                      placeholder="e.g. 10"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-slate-400">Trigger floor</span>
                  </div>

                  {/* 4. Maximum Stock (Number, Required) */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Maximum Stock <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.max_stock}
                      onChange={(e) => setFormData({ ...formData, max_stock: e.target.value })}
                      required
                      placeholder="e.g. 100"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-slate-400">Capacity ceiling</span>
                  </div>
                </div>

                {/* 5. Safety Stock (Number, Optional) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Safety Stock (Buffer)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.safety_stock}
                    onChange={(e) => setFormData({ ...formData, safety_stock: e.target.value })}
                    placeholder="e.g. 5"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400">Unforeseen demand reserve buffer</span>
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
                  {submitting ? "Saving..." : editingId ? "Update Limits" : "Save Limits"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default MinMaxStockPage;
