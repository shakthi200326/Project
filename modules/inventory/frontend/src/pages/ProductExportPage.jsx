import React, { useState, useEffect } from "react";
import {
  Download,
  FileSpreadsheet,
  Filter,
  CheckCircle2,
  Package,
  Layers,
  Tag,
  ShieldCheck,
} from "lucide-react";
import { fetchCategories, fetchBrands, exportProductCatalog } from "../services/api.js";

export function ProductExportPage() {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [typeFilter, setTypeFilter] = useState("");
  const [exportFormat, setExportFormat] = useState("csv");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadFilterOptions = async () => {
    try {
      const [cats, brs] = await Promise.all([fetchCategories(), fetchBrands()]);
      setCategories(cats?.results || (Array.isArray(cats) ? cats : []));
      setBrands(brs?.results || (Array.isArray(brs) ? brs : []));
    } catch (err) {
      console.error("Failed to load filter options for export:", err);
    }
  };

  const handleExport = (formatToUse) => {
    setExporting(true);
    const params = {};
    if (categoryFilter) params.category = categoryFilter;
    if (statusFilter && statusFilter !== "ALL") params.status = statusFilter;
    if (typeFilter) params.item_type = typeFilter;

    exportProductCatalog(params, formatToUse || exportFormat);
    setTimeout(() => setExporting(false), 1500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Download className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Product Catalog Data Export
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time streaming catalog export with column formatting, packaging data, and pricing matrices.
          </p>
        </div>
      </div>

      {/* Export Configuration Card */}
      <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Filter className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Filter Export Scope
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} – {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Item Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Types</option>
              <option value="STOCK">Stockable Good</option>
              <option value="RAW_MATERIAL">Raw Material</option>
              <option value="WORK_IN_PROGRESS">Work in Progress</option>
              <option value="FINISHED_GOOD">Finished Good</option>
              <option value="CONSUMABLE">Consumable</option>
              <option value="NON_STOCK">Non-Stock Item</option>
              <option value="SERVICE">Service / Labor</option>
              <option value="ASSET">Capital Asset</option>
              <option value="MERCHANDISE">Retail Merchandise</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="DRAFT">Draft Only</option>
              <option value="DISCONTINUED">Discontinued</option>
            </select>
          </div>
        </div>

        
        {/* Download Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-slate-500">Format:</span>
            <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setExportFormat("csv")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  exportFormat === "csv"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                CSV (.csv)
              </button>
              <button
                type="button"
                onClick={() => setExportFormat("xlsx")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  exportFormat === "xlsx"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Excel (.xlsx)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={exporting}
              onClick={() => handleExport("csv")}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={() => handleExport("xlsx")}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {exporting ? "Streaming Export..." : "Download Excel Spreadsheet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default ProductExportPage;
