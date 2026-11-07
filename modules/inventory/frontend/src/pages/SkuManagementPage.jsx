import React, { useState, useEffect } from "react";
import {
  Hash,
  Search,
  Copy,
  Check,
  ShieldCheck,
  Package,
  Boxes,
  RefreshCw,
  Sparkles,
  Layers,
} from "lucide-react";
import { fetchProducts, fetchVariants } from "../services/api.js";

export function SkuManagementPage() {
  const [items, setItems] = useState([]);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [copiedSku, setCopiedSku] = useState(null);

  // SKU Builder Tool state
  const [prefix, setPrefix] = useState("PROD");
  const [categoryToken, setCategoryToken] = useState("GEN");
  const [seqNumber, setSeqNumber] = useState(1001);
  const [previewSku, setPreviewSku] = useState("PROD-GEN-1001");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const p = prefix.trim().toUpperCase() || "PROD";
    const c = categoryToken.trim().toUpperCase() || "GEN";
    setPreviewSku(`${p}-${c}-${seqNumber}`);
  }, [prefix, categoryToken, seqNumber]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodData, varData] = await Promise.all([fetchProducts(), fetchVariants()]);
      setItems(prodData?.results || (Array.isArray(prodData) ? prodData : []));
      setVariants(varData?.results || (Array.isArray(varData) ? varData : []));
    } catch (err) {
      console.error("Failed to load SKUs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (sku) => {
    navigator.clipboard.writeText(sku);
    setCopiedSku(sku);
    setTimeout(() => setCopiedSku(null), 2000);
  };

  // Harmonize all stock identities (Parent items + Variants)
  const allSkus = [
    ...items.map((it) => ({
      id: `item-${it.id}`,
      sku: it.code,
      name: it.name,
      type: "Master Item",
      itemType: it.item_type,
      category: it.category_name || "Uncategorized",
      barcode: it.barcode || "—",
      status: it.is_active ? "Active" : "Discontinued",
      isVariant: false,
    })),
    ...variants.map((v) => ({
      id: `var-${v.id}`,
      sku: v.sku,
      name: v.variant_name,
      type: "Variant SKU",
      itemType: "STOCK",
      category: v.item_code || "Master Item",
      barcode: v.barcode || "—",
      status: v.is_active ? "Active" : "Discontinued",
      isVariant: true,
    })),
  ];

  const filteredSkus = allSkus.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      s.sku.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.barcode.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q);

    const matchesType =
      typeFilter === "ALL" ||
      (typeFilter === "MASTER" && !s.isVariant) ||
      (typeFilter === "VARIANT" && s.isVariant);

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Hash className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Stock Keeping Unit (SKU) Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Centralized inventory stock identity registry, stable ID references, and format generators.
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
            placeholder="Search SKUs, product names, barcodes..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 uppercase">Identity Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Stock Identities ({allSkus.length})</option>
            <option value="MASTER">Item Master Codes ({items.length})</option>
            <option value="VARIANT">Variant SKUs ({variants.length})</option>
          </select>
        </div>
      </div>

      {/* SKU Registry Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">Stock Keeping Unit (SKU)</th>
                <th className="py-3.5 px-4">Item / Variant Name</th>
                <th className="py-3.5 px-4">Classification</th>
                <th className="py-3.5 px-4">Parent / Category</th>
                <th className="py-3.5 px-4">Primary Barcode</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading SKU directory...
                  </td>
                </tr>
              ) : filteredSkus.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    No matching SKUs found.
                  </td>
                </tr>
              ) : (
                filteredSkus.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      {s.sku}
                      <button
                        onClick={() => handleCopy(s.sku)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Copy SKU"
                      >
                        {copiedSku === s.sku ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                      {s.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {s.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 text-xs">
                      {s.category}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {s.barcode}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleCopy(s.sku)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        {copiedSku === s.sku ? "Copied!" : "Copy"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default SkuManagementPage;

