import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  FileText,
  Filter,
  RotateCcw,
  Search,
  Calendar,
  Building2,
  MapPin,
  Tag,
  Package,
  Layers,
  ChevronRight,
} from "lucide-react";
import {
  fetchWarehouses,
  fetchCategories,
  fetchProducts,
  fetchLocations,
} from "../services/api";
import { downloadReportPdf } from "../utils/pdfExport";

const BADGE_TONES = {
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-800",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-800",
};

export function ReportShell({
  title,
  subtitle,
  badge = "READ-ONLY ANALYTICS",
  badgeColor = "emerald",
  columns = [],
  data = [],
  loading = false,
  onApplyFilters,
  customSummary = null,
  fileName = "report",
}) {
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedWarehouse, setSelectedWarehouse] = useState("ALL");
  const [selectedLocation, setSelectedLocation] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    fetchWarehouses().then((res) => setWarehouses(res || []));
    fetchCategories().then((res) => setCategories(res.results || res || []));
    fetchProducts().then((res) => setProducts(res.results || res || []));
    fetchLocations().then((res) => setLocations(res.results || res || []));
  }, []);

  const handleApply = (e) => {
    if (e) e.preventDefault();
    if (onApplyFilters) {
      onApplyFilters({
        date_from: dateFrom,
        date_to: dateTo,
        product: selectedProduct,
        category: selectedCategory,
        warehouse: selectedWarehouse,
        storage_location: selectedLocation,
        stock_status: selectedStatus,
        search: searchQuery,
      });
    }
  };

  const handleReset = () => {
    setDateFrom("");
    setDateTo("");
    setSelectedProduct("ALL");
    setSelectedCategory("ALL");
    setSelectedWarehouse("ALL");
    setSelectedLocation("ALL");
    setSelectedStatus("ALL");
    setSearchQuery("");
    if (onApplyFilters) {
      onApplyFilters({
        date_from: "",
        date_to: "",
        product: "ALL",
        category: "ALL",
        warehouse: "ALL",
        storage_location: "ALL",
        stock_status: "ALL",
        search: "",
      });
    }
  };

  const exportExcel = () => {
    if (!data.length) return;
    const headers = columns.map((col) => `"${col.header.replace(/"/g, '""')}"`).join(",");
    const rows = data.map((row) =>
      columns
        .map((col) => {
          const val = col.accessor(row);
          if (val === null || val === undefined) return '""';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csvContent = "\uFEFF" + [headers, ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    setPdfError("");
    try {
      downloadReportPdf({
        title,
        subtitle,
        fileName,
        sections: [
          {
            title: "Applied Filters",
            rows: [
              ["Date From", dateFrom || "All"],
              ["Date To", dateTo || "All"],
              ["Product", selectedProduct],
              ["Category", selectedCategory],
              ["Warehouse", selectedWarehouse],
              ["Storage Location", selectedLocation],
              ["Stock Status", selectedStatus],
              ["Search", searchQuery || "None"],
            ],
          },
          {
            title: "Report Data",
            headers: columns.map((column) => column.header),
            rows: data.map((row) => columns.map((column) => column.accessor(row))),
          },
        ],
      });
    } catch (exportError) {
      setPdfError(exportError?.message || "Unable to generate the PDF. Please try again.");
    }
  };

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      {/* Header & Common Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="min-w-0 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>
            <span
              className={`shrink-0 whitespace-nowrap text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full border ${
                BADGE_TONES[badgeColor] || BADGE_TONES.blue
              }`}
            >
              {badge}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{subtitle}</p>
        </div>

        {/* Export actions */}
        <div className="flex shrink-0 items-center gap-2 print:hidden flex-wrap">
          <button
            type="button"
            onClick={exportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors shadow-2xs cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5" />
            Export PDF
          </button>
        </div>
      </div>

      {pdfError && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {pdfError}
        </div>
      )}

      {/* Common Filters Container */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs print:hidden space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
            <Filter className="h-3.5 w-3.5 text-blue-500" />
            Common Report Filters
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          {/* 1. Date Range: From / To */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
              Date Range (From)
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
              Date Range (To)
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* 2. Product */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
              Product
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Products</option>
              {products.map((p) => (
                <option key={p.id || p.code || p.sku} value={p.code || p.sku || p.id}>
                  {p.name} ({p.code || p.sku})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Category */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id || c.name} value={c.id || c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Warehouse */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
              Warehouse
            </label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id || w.code} value={w.name || w.code || w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Storage Location */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
              Storage Location
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id || loc.code} value={loc.id || loc.code}>
                  {loc.name} ({loc.location_type || "Storage"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Second Row: Stock Status, Search, and Action Button */}
        <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="w-48">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                Stock Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="In Stock">In Stock</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Out of Stock">Out of Stock</option>
                <option value="Expiring Soon">Expiring Soon</option>
                <option value="Expired">Expired</option>
              </select>
            </div>

            <div className="w-64">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                Quick Search
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="SKU, Product, Doc #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApply()}
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-end self-end sm:self-auto">
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors cursor-pointer"
            >
              <Filter className="h-3.5 w-3.5" />
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* KPI / Metrics Bar */}
      {customSummary}

      {/* Report Data Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-700/80">
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className={`py-3 px-3.5 whitespace-nowrap font-bold uppercase tracking-wider text-[11px] text-slate-700 dark:text-zinc-200 ${
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left"
                    }`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      Loading report analytics...
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    No report records found matching the applied filter criteria.
                  </td>
                </tr>
              ) : (
                data.map((row, rowIdx) => (
                  <tr
                    key={row.id || rowIdx}
                    className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    {columns.map((col, colIdx) => (
                      <td
                        key={colIdx}
                        className={`py-3 px-3.5 text-slate-700 dark:text-zinc-200 ${
                          col.align === "right"
                            ? "text-right font-mono tabular-nums whitespace-nowrap"
                            : col.align === "center"
                            ? "text-center whitespace-nowrap"
                            : "text-left"
                        }`}
                      >
                        {col.cell ? col.cell(row) : col.accessor(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-800 text-[11px] text-slate-500 dark:text-zinc-400">
          <span>
            Total Entries: <strong className="text-slate-800 dark:text-white font-mono">{data.length}</strong>
          </span>
          <span className="italic">
            Read-only financial and inventory performance report • Real-time database snapshot
          </span>
        </div>
      </div>
    </div>
  );
}
