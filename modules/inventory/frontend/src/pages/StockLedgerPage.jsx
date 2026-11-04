import React, { useState, useEffect, useMemo } from "react";
import {
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import { fetchStockLedger } from "../services/api";

export function StockLedgerPage() {
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    fetchStockLedger().then((res) => {
      const results = res.results || [];
      const mapped = results.map((e) => {
        const delta = Number(e.quantity_delta !== undefined ? e.quantity_delta : (e.delta !== undefined ? e.delta : 0));
        const rawDate = e.transaction_date || (e.created_at ? e.created_at.split("T")[0] : e.timestamp ? e.timestamp.split("T")[0] : new Date().toISOString().split("T")[0]);
        return {
          id: e.id,
          transaction_date: rawDate,
          transaction_number: e.transaction_number || e.transaction_ref || e.doc_ref || `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          transaction_type: (e.transaction_type || e.movement_type || e.tx_type || "RECEIPT").toUpperCase(),
          product_name: e.product_name || e.item_name || "Industrial Component",
          sku: e.sku || e.item_code || e.item_sku || "SKU-000",
          warehouse_name: e.warehouse_name || e.warehouse_code || e.warehouse || "Main Central Hub",
          location_name: e.location_name || e.location_code || e.location || "Aisle 1 - General",
          quantity_in: e.quantity_in !== undefined ? Number(e.quantity_in) : (delta > 0 ? delta : 0),
          quantity_out: e.quantity_out !== undefined ? Number(e.quantity_out) : (delta < 0 ? Math.abs(delta) : 0),
          balance_quantity: Number(e.balance_quantity !== undefined ? e.balance_quantity : (e.balance_after !== undefined ? e.balance_after : 100)),
          batch_number: e.batch_number || "—",
        };
      });
      setLedgerEntries(mapped);
    });
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const warehousesList = useMemo(() => {
    const set = new Set();
    ledgerEntries.forEach((e) => {
      if (e.warehouse_name) set.add(e.warehouse_name);
    });
    return Array.from(set);
  }, [ledgerEntries]);

  const filtered = useMemo(() => {
    return ledgerEntries.filter((entry) => {
      const q = search.trim().toLowerCase();
      const matchesProduct =
        !q ||
        entry.product_name.toLowerCase().includes(q) ||
        entry.sku.toLowerCase().includes(q) ||
        entry.transaction_number.toLowerCase().includes(q) ||
        entry.batch_number.toLowerCase().includes(q);

      const matchesWh = warehouseFilter === "ALL" || entry.warehouse_name === warehouseFilter;
      const matchesType = typeFilter === "ALL" || entry.transaction_type === typeFilter;

      let matchesDate = true;
      if (startDate && entry.transaction_date < startDate) matchesDate = false;
      if (endDate && entry.transaction_date > endDate) matchesDate = false;

      return matchesProduct && matchesWh && matchesType && matchesDate;
    });
  }, [ledgerEntries, search, warehouseFilter, typeFilter, startDate, endDate]);

  const handleExportCSV = () => {
    const headers = [
      "Transaction Date",
      "Transaction Number",
      "Transaction Type",
      "Product Name",
      "SKU",
      "Warehouse",
      "Storage Location",
      "Quantity In",
      "Quantity Out",
      "Balance Quantity",
      "Batch Number",
    ];
    const rows = filtered.map((e) => [
      `"${e.transaction_date}"`,
      `"${e.transaction_number}"`,
      `"${e.transaction_type}"`,
      `"${e.product_name}"`,
      `"${e.sku}"`,
      `"${e.warehouse_name}"`,
      `"${e.location_name}"`,
      e.quantity_in,
      e.quantity_out,
      e.balance_quantity,
      `"${e.batch_number}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_ledger_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Stock ledger exported as CSV.");
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
              Stock Ledger
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
              <ShieldCheck className="h-3 w-3 text-blue-500" /> Complete Transaction History
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Complete history of every posted stock transaction with running perpetual balance.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Ledger CSV</span>
        </button>
      </div>

      {/* Filters: Date Range, Product, Warehouse, Transaction Type */}
      <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Product Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by Product Name, SKU, Doc #..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
          />
        </div>

        {/* Filters Group: Warehouse, Transaction Type, Date Range */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Warehouse */}
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/60 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Warehouses</option>
            {warehousesList.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>

          {/* Transaction Type */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/60 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Types</option>
            <option value="RECEIPT">Receipt</option>
            <option value="ISSUE">Issue</option>
            <option value="TRANSFER">Transfer</option>
            <option value="ADJUSTMENT">Adjustment</option>
            <option value="RETURN">Return</option>
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

      {/* Stock Ledger Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                <th className="py-3.5 px-4 font-semibold">Transaction Date</th>
                <th className="py-3.5 px-3 font-semibold">Transaction Number</th>
                <th className="py-3.5 px-3 font-semibold">Transaction Type</th>
                <th className="py-3.5 px-3 font-semibold">Product</th>
                <th className="py-3.5 px-3 font-semibold">SKU</th>
                <th className="py-3.5 px-3 font-semibold">Warehouse</th>
                <th className="py-3.5 px-3 font-semibold">Storage Location</th>
                <th className="py-3.5 px-3 font-semibold text-right">Quantity In</th>
                <th className="py-3.5 px-3 font-semibold text-right">Quantity Out</th>
                <th className="py-3.5 px-3 font-semibold text-right">Balance Quantity</th>
                <th className="py-3.5 px-4 font-semibold text-center">Batch Number</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400 dark:text-zinc-500">
                    No transactions match current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => (
                  <tr key={entry.id || entry.transaction_number} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                      {entry.transaction_date}
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {entry.transaction_number}
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          entry.transaction_type === "RECEIPT"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                            : entry.transaction_type === "ISSUE"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border-rose-200 dark:border-rose-900/50"
                            : entry.transaction_type === "TRANSFER"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 border-blue-200 dark:border-blue-900/50"
                            : entry.transaction_type === "ADJUSTMENT"
                            ? "bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-400 border-purple-200 dark:border-purple-900/50"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border-amber-200 dark:border-amber-900/50"
                        }`}
                      >
                        {entry.transaction_type === "RECEIPT" && <ArrowDownLeft className="h-3 w-3" />}
                        {entry.transaction_type === "ISSUE" && <ArrowUpRight className="h-3 w-3" />}
                        {entry.transaction_type === "TRANSFER" && <ArrowLeftRight className="h-3 w-3" />}
                        {entry.transaction_type === "ADJUSTMENT" && <SlidersHorizontal className="h-3 w-3" />}
                        {entry.transaction_type === "RETURN" && <RotateCcw className="h-3 w-3" />}
                        {entry.transaction_type}
                      </span>
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
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400">
                      {entry.quantity_in > 0 ? `+${entry.quantity_in}` : "—"}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap font-bold text-rose-600 dark:text-rose-400">
                      {entry.quantity_out > 0 ? `-${entry.quantity_out}` : "—"}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap font-bold text-slate-900 dark:text-white">
                      {entry.balance_quantity}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                      {entry.batch_number}
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
