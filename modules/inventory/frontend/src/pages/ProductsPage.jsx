import React, { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Upload,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Boxes,
  Barcode,
  CheckCircle,
  AlertCircle,
  XCircle,
  SlidersHorizontal,
} from "lucide-react";
import { fetchProducts } from "../services/api";

export function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    fetchProducts().then((res) => setProducts(res.results || []));
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "ALL" || p.category === categoryFilter;
    const matchesStatus = statusFilter === "ALL" || p.stock_status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredProducts.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Products & Catalog
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Manage stock items, variant matrices, barcodes, UOM conversions & reorder parameters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs">
            <Upload className="h-3.5 w-3.5" />
            <span>Import</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs">
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors shadow-xs">
            <Plus className="h-4 w-4" />
            <span>Create Product</span>
          </button>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SKU, product name, brand or barcode..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 text-slate-700 dark:text-zinc-300">
            <Filter className="h-3 w-3 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Stock Statuses</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 text-slate-700 dark:text-zinc-300">
            <SlidersHorizontal className="h-3 w-3 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="Mechanical Components">Mechanical Components</option>
              <option value="Hydraulics & Pneumatics">Hydraulics & Pneumatics</option>
              <option value="Power Transmission">Power Transmission</option>
              <option value="Sensors & Automation">Sensors & Automation</option>
              <option value="Chemicals & Fluids">Chemicals & Fluids</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar (When selected) */}
      {selectedIds.length > 0 && (
        <div className="p-2.5 px-4 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
          <span className="font-semibold">{selectedIds.length} items selected</span>
          <div className="flex items-center gap-2">
            <button className="px-2.5 py-1 rounded bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-800 text-xs font-medium hover:bg-blue-100">
              Print Barcodes
            </button>
            <button className="px-2.5 py-1 rounded bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-800 text-xs font-medium hover:bg-blue-100">
              Update Reorder Rules
            </button>
            <button className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-medium hover:bg-rose-700">
              Archive Selected
            </button>
          </div>
        </div>
      )}

      {/* High-Density Data Table */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/40 text-slate-500 dark:text-zinc-400 select-none">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0}
                    onChange={handleSelectAll}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="py-3 px-4 font-semibold">SKU & Item Name</th>
                <th className="py-3 px-4 font-semibold">Category & Brand</th>
                <th className="py-3 px-4 font-semibold text-center">Variants</th>
                <th className="py-3 px-4 font-semibold text-right">On-Hand</th>
                <th className="py-3 px-4 font-semibold text-right">Reserved</th>
                <th className="py-3 px-4 font-semibold text-right">Available</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Unit WAV</th>
                <th className="py-3 px-4 text-center w-12">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => handleSelectOne(p.id)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      {p.sku}
                    </div>
                    <div className="font-medium text-slate-900 dark:text-zinc-100 mt-0.5">
                      {p.name}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-800 dark:text-zinc-200 font-medium">{p.category}</div>
                    <div className="text-[11px] text-slate-400 dark:text-zinc-500">{p.brand}</div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      <Boxes className="h-3 w-3 text-slate-400" /> {p.variants_count}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-medium tabular-nums text-slate-900 dark:text-zinc-100">
                    {p.on_hand.toLocaleString()} {p.unit}
                  </td>
                  <td className="py-3 px-4 text-right font-medium tabular-nums text-purple-600 dark:text-purple-400">
                    {p.reserved > 0 ? `${p.reserved.toLocaleString()} ${p.unit}` : "-"}
                  </td>
                  <td className="py-3 px-4 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {p.available.toLocaleString()} {p.unit}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.stock_status === "IN_STOCK"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : p.stock_status === "LOW_STOCK"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                      }`}
                    >
                      {p.stock_status === "IN_STOCK" && <CheckCircle className="h-3 w-3" />}
                      {p.stock_status === "LOW_STOCK" && <AlertCircle className="h-3 w-3" />}
                      {p.stock_status === "OUT_OF_STOCK" && <XCircle className="h-3 w-3" />}
                      {p.stock_status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300">
                    ${p.unit_cost.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 px-4 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
          <span>Showing 1 to {filteredProducts.length} of {products.length} products</span>
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50" disabled>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 font-medium text-slate-900 dark:text-white">Page 1</span>
            <button className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50" disabled>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
