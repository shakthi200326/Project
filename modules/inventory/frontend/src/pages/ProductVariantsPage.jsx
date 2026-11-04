import React, { useState, useEffect } from "react";
import {
  Boxes,
  Search,
  Filter,
  Plus,
  RefreshCw,
  CheckCircle2,
  Ban,
  Package,
  Barcode,
  Layers,
  Sparkles,
} from "lucide-react";
import { fetchVariants, toggleVariantActive, fetchProducts, generateProductVariants, fetchAttributes } from "../services/api.js";
import { ProductDetailDrawer } from "../components/ProductDetailDrawer.jsx";

export function ProductVariantsPage() {
  const [variants, setVariants] = useState([]);
  const [products, setProducts] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedParentProduct, setSelectedParentProduct] = useState(null);

  // Generate Matrix Modal
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [targetItemId, setTargetItemId] = useState("");
  const [skuPrefix, setSkuPrefix] = useState("");
  const [selectedAttrValues, setSelectedAttrValues] = useState({});
  const [matrixLoading, setMatrixLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Settle each list on its own so one failing endpoint doesn't blank the others.
      const [varRes, prodRes, attrRes] = await Promise.allSettled([
        fetchVariants(),
        fetchProducts(),
        fetchAttributes(),
      ]);
      const listOf = (r) =>
        r.status === "fulfilled" ? r.value?.results || (Array.isArray(r.value) ? r.value : []) : [];
      setVariants(listOf(varRes));
      setProducts(listOf(prodRes));
      setAttributes(listOf(attrRes));
      [varRes, prodRes, attrRes]
        .filter((r) => r.status === "rejected")
        .forEach((r) => console.error("Failed to load variant data:", r.reason));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (variantId) => {
    try {
      await toggleVariantActive(variantId);
      loadData();
    } catch (err) {
      alert("Failed to update variant status: " + err.message);
    }
  };

  const handleGenerateMatrix = async (e) => {
    e.preventDefault();
    if (!targetItemId) {
      alert("Please select a parent product.");
      return;
    }
    const cleanSelection = {};
    for (const [code, valStr] of Object.entries(selectedAttrValues)) {
      const list = valStr.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length > 0) cleanSelection[code] = list;
    }
    if (Object.keys(cleanSelection).length === 0) {
      alert("Please specify at least one attribute value to generate combinations.");
      return;
    }

    setMatrixLoading(true);
    try {
      await generateProductVariants(targetItemId, {
        attribute_selection: cleanSelection,
        sku_prefix: skuPrefix.trim(),
      });
      setIsMatrixOpen(false);
      setSelectedAttrValues({});
      setSkuPrefix("");
      setTargetItemId("");
      loadData();
    } catch (err) {
      alert("Matrix generation failed: " + err.message);
    } finally {
      setMatrixLoading(false);
    }
  };

  const filteredVariants = variants.filter((v) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      v.sku?.toLowerCase().includes(q) ||
      v.variant_name?.toLowerCase().includes(q) ||
      v.barcode?.toLowerCase().includes(q) ||
      v.item_code?.toLowerCase().includes(q) ||
      v.item_name?.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && v.is_active) ||
      (statusFilter === "DISCONTINUED" && !v.is_active);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Product Variants Matrix
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Global catalog of stocked SKU variants, multi-attribute combinations, and barcode identities.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsMatrixOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generate Variant Matrix
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SKU, variant name, barcode, item code..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 uppercase">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DISCONTINUED">Discontinued</option>
          </select>
        </div>
      </div>

      {/* Variants Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">Variant SKU</th>
                <th className="py-3.5 px-4">Variant Name</th>
                <th className="py-3.5 px-4">Parent Product</th>
                <th className="py-3.5 px-4">Attributes Combination</th>
                <th className="py-3.5 px-4">Barcode</th>
                <th className="py-3.5 px-4 text-right">Cost Delta</th>
                <th className="py-3.5 px-4 text-right">Price Delta</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading variants matrix...
                  </td>
                </tr>
              ) : filteredVariants.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-500">
                    No variants found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredVariants.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {v.sku}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                      {v.variant_name}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => {
                          const p = products.find((prod) => prod.id === v.item);
                          if (p) setSelectedParentProduct(p);
                        }}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                      >
                        <Package className="w-3.5 h-3.5" />
                        {v.item_code || `Product #${v.item}`}
                      </button>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {v.attributes && Object.keys(v.attributes).length > 0 ? (
                          Object.entries(v.attributes).map(([k, val]) => (
                            <span
                              key={k}
                              className="px-2 py-0.5 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            >
                              <strong className="text-slate-500 dark:text-slate-400">{k}:</strong> {val}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">None</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {v.barcode || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs">
                      {parseFloat(v.additional_cost) > 0 ? `+$${parseFloat(v.additional_cost).toFixed(2)}` : "$0.00"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs">
                      {parseFloat(v.additional_price) > 0 ? `+$${parseFloat(v.additional_price).toFixed(2)}` : "$0.00"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          v.is_active
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {v.is_active ? "Active" : "Discontinued"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(v.id)}
                        className={`p-1.5 rounded-lg border text-xs font-semibold ${
                          v.is_active
                            ? "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400"
                            : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                        }`}
                        title={v.is_active ? "Discontinue Variant" : "Activate Variant"}
                      >
                        {v.is_active ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Variant Matrix Modal */}
      {isMatrixOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Cartesian Variant Matrix Generator
              </h3>
              <button
                onClick={() => setIsMatrixOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleGenerateMatrix} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Target Product Master *
                </label>
                <select
                  required
                  value={targetItemId}
                  onChange={(e) => {
                    setTargetItemId(e.target.value);
                    const prod = products.find((p) => String(p.id) === e.target.value);
                    if (prod && !skuPrefix) setSkuPrefix(prod.code);
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} – {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Base SKU Prefix
                </label>
                <input
                  type="text"
                  value={skuPrefix}
                  onChange={(e) => setSkuPrefix(e.target.value.toUpperCase())}
                  placeholder="e.g. TEE, SHIRT, PUMP"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono uppercase"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  Select Attribute Values (Comma-separated)
                </label>
                {attributes.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No attributes configured. Create attributes first.</p>
                ) : (
                  attributes.map((attr) => (
                    <div key={attr.id} className="grid grid-cols-3 gap-2 items-center">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {attr.name} ({attr.code}):
                      </span>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={selectedAttrValues[attr.code] || ""}
                          onChange={(e) =>
                            setSelectedAttrValues((prev) => ({
                              ...prev,
                              [attr.code]: e.target.value,
                            }))
                          }
                          placeholder="e.g. Red, Blue or S, M, L"
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMatrixOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={matrixLoading}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm"
                >
                  {matrixLoading ? "Computing Cartesian Matrix..." : "Generate Variants"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Parent Product Detail Drawer */}
      <ProductDetailDrawer
        isOpen={!!selectedParentProduct}
        product={selectedParentProduct}
        onClose={() => setSelectedParentProduct(null)}
        onSave={loadData}
      />
    </div>
  );
}
export default ProductVariantsPage;
