import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowUpRight,
  Download,
  Search,
  Filter,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Building2,
  Package,
} from "lucide-react";
import { fetchStockOutHistory } from "../services/api";

export function StockOutHistoryPage() {
  const [outEntries, setOutEntries] = useState([]);
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [issueTypeFilter, setIssueTypeFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    fetchStockOutHistory().then((res) => {
      const results = res.results || [];
      const mapped = results.map((e) => {
        const rawDate = e.transaction_date || (e.created_at ? e.created_at.split("T")[0] : new Date().toISOString().split("T")[0]);
        const qtyIssued = e.quantity_out !== undefined && e.quantity_out > 0 ? Number(e.quantity_out) : Math.abs(Number(e.quantity_delta || e.quantity || 1));
        return {
          id: e.id,
          issue_number: e.transaction_number || e.transaction_ref || e.document_number || `ISS-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          issue_date: rawDate,
          product_name: e.product_name || e.item_name || "Industrial Component",
          sku: e.sku || e.item_code || "SKU-000",
          warehouse_name: e.warehouse_name || e.warehouse_code || e.warehouse || "Main Central Hub",
          location_name: e.location_name || e.location_code || e.location || "Dispatch Bay 1",
          quantity_issued: qtyIssued,
          issue_type: e.issue_type || (e.movement_type === "ISSUE" ? "Sales" : e.movement_type || "Internal"),
          reference_number: e.reference_number || e.reason || "SO-2026-001",
        };
      });
      setOutEntries(mapped);
    });
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const warehousesList = useMemo(() => {
    const set = new Set();
    outEntries.forEach((e) => {
      if (e.warehouse_name) set.add(e.warehouse_name);
    });
    return Array.from(set);
  }, [outEntries]);

  const issueTypesList = ["Sales", "Production", "Internal", "Other"];

  const filtered = useMemo(() => {
    return outEntries.filter((entry) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        entry.product_name.toLowerCase().includes(q) ||
        entry.sku.toLowerCase().includes(q) ||
        entry.issue_number.toLowerCase().includes(q) ||
        entry.reference_number.toLowerCase().includes(q);

      const matchesWh = warehouseFilter === "ALL" || entry.warehouse_name === warehouseFilter;
      const matchesType = issueTypeFilter === "ALL" || entry.issue_type.toLowerCase() === issueTypeFilter.toLowerCase();

      let matchesDate = true;
      if (startDate && entry.issue_date < startDate) matchesDate = false;
      if (endDate && entry.issue_date > endDate) matchesDate = false;

      return matchesSearch && matchesWh && matchesType && matchesDate;
    });
  }, [outEntries, search, warehouseFilter, issueTypeFilter, startDate, endDate]);

  const totalIssuedQty = useMemo(() => {
    return filtered.reduce((acc, e) => acc + (e.quantity_issued || 0), 0);
  }, [filtered]);

  const handleExportCSV = () => {
    const headers = [
      "Issue Number",
      "Issue Date",
      "Product Name",
      "SKU",
      "Warehouse",
      "Storage Location",
      "Quantity Issued",
      "Issue Type",
      "Reference Number",
    ];
    const rows = filtered.map((e) => [
      `"${e.issue_number}"`,
      `"${e.issue_date}"`,
      `"${e.product_name}"`,
      `"${e.sku}"`,
      `"${e.warehouse_name}"`,
      `"${e.location_name}"`,
      e.quantity_issued,
      `"${e.issue_type}"`,
      `"${e.reference_number}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_out_history_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Stock Out history exported as CSV.");
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white text-xs font-medium shadow-2xl border border-slate-700/60 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Stock Out History
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
              <ArrowUpRight className="h-3 w-3" /> Outgoing Movements
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Filtered view of the Stock Ledger recording all dispatches, sales issues, and internal consumptions.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Issues CSV</span>
        </button>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Total Issues Recorded
          </div>
          <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums mt-1">
            {filtered.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Outbound documents</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Total Quantity Issued
          </div>
          <div className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400 tabular-nums mt-1">
            -{totalIssuedQty.toLocaleString()}
          </div>
          <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">Physical dispatch</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Active Fulfillment Hubs
          </div>
          <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums mt-1">
            {warehousesList.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Facilities in scope</div>
        </div>
      </div>

      {/* Filters: Date Range, Product, Warehouse, Issue Type */}
      <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Product Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by Product Name, SKU, Issue #..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Warehouse */}
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/60 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Source Warehouses</option>
            {warehousesList.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>

          {/* Issue Type */}
          <select
            value={issueTypeFilter}
            onChange={(e) => setIssueTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/60 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Issue Types</option>
            {issueTypesList.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Date Range */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 font-medium bg-slate-50/80 dark:bg-zinc-800/60 px-2.5 py-1 rounded-xl border border-slate-200/80 dark:border-zinc-800/80">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs text-slate-700 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs text-slate-700 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer ml-1"
                title="Clear date range"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stock Out Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                <th className="py-3.5 px-4 font-semibold">Issue Number</th>
                <th className="py-3.5 px-3 font-semibold">Issue Date</th>
                <th className="py-3.5 px-3 font-semibold">Product</th>
                <th className="py-3.5 px-3 font-semibold">SKU</th>
                <th className="py-3.5 px-3 font-semibold">Warehouse</th>
                <th className="py-3.5 px-3 font-semibold">Storage Location</th>
                <th className="py-3.5 px-3 font-semibold text-right">Quantity Issued</th>
                <th className="py-3.5 px-3 font-semibold text-center">Issue Type</th>
                <th className="py-3.5 px-4 font-semibold">Reference Number</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 dark:text-zinc-500">
                    No outgoing stock issues match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => (
                  <tr key={entry.id || entry.issue_number} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      {entry.issue_number}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                      {entry.issue_date}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-900 dark:text-white">
                      {entry.product_name}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                      {entry.sku}
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 dark:text-zinc-300 font-medium">
                      {entry.warehouse_name}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                      {entry.location_name}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap font-bold text-rose-600 dark:text-rose-400">
                      -{entry.quantity_issued} EA
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                        {entry.issue_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-zinc-300">
                      {entry.reference_number}
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

export default StockOutHistoryPage;

