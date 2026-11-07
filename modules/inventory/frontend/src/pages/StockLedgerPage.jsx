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
  RefreshCw,
  User,
  DollarSign,
} from "lucide-react";
import { fetchStockLedger } from "../services/api";

export function StockLedgerPage() {
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [toastMessage, setToastMessage] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchStockLedger();
      const results = res.results || (Array.isArray(res) ? res : []);
      const mapped = results.map((e) => {
        const delta = Number(e.quantity_delta !== undefined ? e.quantity_delta : (e.delta !== undefined ? e.delta : 0));
        const rawDate = e.transaction_date || (e.created_at ? e.created_at.split("T")[0] : e.timestamp ? e.timestamp.split("T")[0] : "—");
        return {
          id: e.id,
          transaction_date: rawDate,
          transaction_number: e.transaction_number || e.transaction_ref || e.doc_ref || `TRX-${e.id}`,
          transaction_type: (e.transaction_type || e.movement_type || e.tx_type || "RECEIPT").toUpperCase(),
          product_name: e.product_name || e.item_name || "—",
          sku: e.sku || e.item_code || e.item_sku || "—",
          warehouse_name: e.warehouse_name || e.warehouse_code || e.warehouse || "—",
          location_name: e.location_name || e.location_code || e.location || "General Storage",
          quantity_in: e.quantity_in !== undefined ? Number(e.quantity_in) : (delta > 0 ? delta : 0),
          quantity_out: e.quantity_out !== undefined ? Number(e.quantity_out) : (delta < 0 ? Math.abs(delta) : 0),
          balance_quantity: Number(e.balance_quantity !== undefined ? e.balance_quantity : (e.balance_after !== undefined ? e.balance_after : 0)),
          batch_number: e.batch_number || e.batch || "—",
          serial_number: e.serial_number || e.serial || "—",
          uom: e.uom || "EA",
          unit_cost: Number(e.unit_cost_val || e.unit_cost || 0),
          total_cost: Number(e.total_cost_val || e.total_cost || 0),
          posted_by: e.posted_by || e.created_by || "System",
        };
      });
      setLedgerEntries(mapped);
    } catch (err) {
      console.error("Failed to load stock ledger", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const warehousesList = useMemo(() => {
    const set = new Set();
    ledgerEntries.forEach((e) => {
      if (e.warehouse_name && e.warehouse_name !== "—") set.add(e.warehouse_name);
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
        entry.batch_number.toLowerCase().includes(q) ||
        entry.serial_number.toLowerCase().includes(q);

      const matchesWh = warehouseFilter === "ALL" || entry.warehouse_name === warehouseFilter;
      const matchesType = typeFilter === "ALL" || entry.transaction_type === typeFilter;

      let matchesDate = true;
      if (startDate && entry.transaction_date < startDate) matchesDate = false;
      if (endDate && entry.transaction_date > endDate) matchesDate = false;

      return matchesProduct && matchesWh && matchesType && matchesDate;
    });
  }, [ledgerEntries, search, warehouseFilter, typeFilter, startDate, endDate]);

  const totalIn = useMemo(() => {
    return filtered.reduce((acc, curr) => acc + (curr.quantity_in || 0), 0);
  }, [filtered]);

  const totalOut = useMemo(() => {
    return filtered.reduce((acc, curr) => acc + (curr.quantity_out || 0), 0);
  }, [filtered]);

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
      "UOM",
      "Batch Number",
      "Serial Number",
      "Unit Cost",
      "Total Cost",
      "Posted By",
    ];
    const rows = filtered.map((e) => [
      `"${e.transaction_date}"`,
      `"${e.transaction_number}"`,
      `"${e.transaction_type}"`,
      `"${e.product_name.replace(/"/g, '""')}"`,
      `"${e.sku}"`,
      `"${e.warehouse_name}"`,
      `"${e.location_name}"`,
      e.quantity_in,
      e.quantity_out,
      e.balance_quantity,
      `"${e.uom}"`,
      `"${e.batch_number}"`,
      `"${e.serial_number}"`,
      e.unit_cost.toFixed(2),
      e.total_cost.toFixed(2),
      `"${e.posted_by}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_ledger_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Stock ledger exported to CSV successfully.");
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Stock Ledger
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
              <ShieldCheck className="h-3.5 w-3.5" />
              Immutable Audit Trail
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Complete sequential debit/credit stock movements recorded by the authoritative Inventory Posting Engine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Total Inflow
          </div>
          <div className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            +{totalIn.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Total stock inward movements</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Total Outflow
          </div>
          <div className="text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400 mt-1">
            -{totalOut.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Total stock outward movements</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Net Ledger Delta
          </div>
          <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
            {(totalIn - totalOut) >= 0 ? `+${(totalIn - totalOut).toLocaleString()}` : (totalIn - totalOut).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Inflow minus outflow balance</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Audit Records
          </div>
          <div className="text-xl font-bold tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {filtered.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Matching chronological entries</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, SKU, doc #, batch..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Movement Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Movement Types</option>
            <option value="RECEIPT">Receipt (Goods In)</option>
            <option value="ISSUE">Issue (Stock Out)</option>
            <option value="TRANSFER_IN">Transfer In</option>
            <option value="TRANSFER_OUT">Transfer Out</option>
            <option value="TRANSFER">Transfer</option>
            <option value="ADJUSTMENT">Adjustment</option>
            <option value="RETURN">Return</option>
            <option value="RECLASSIFICATION">Reclassification</option>
          </select>

          {/* Warehouse Filter */}
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Warehouses</option>
            {warehousesList.map((wh) => (
              <option key={wh} value={wh}>
                {wh}
              </option>
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
                ✕
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
                <th className="py-3.5 px-3 font-semibold">Doc / Ref #</th>
                <th className="py-3.5 px-3 font-semibold">Movement Type</th>
                <th className="py-3.5 px-3 font-semibold">Product</th>
                <th className="py-3.5 px-3 font-semibold">SKU</th>
                <th className="py-3.5 px-3 font-semibold">Warehouse & Location</th>
                <th className="py-3.5 px-3 font-semibold text-right">Qty In</th>
                <th className="py-3.5 px-3 font-semibold text-right">Qty Out</th>
                <th className="py-3.5 px-3 font-semibold text-right font-bold">Balance</th>
                <th className="py-3.5 px-3 font-semibold text-center">UOM</th>
                <th className="py-3.5 px-3 font-semibold text-center">Batch / Serial</th>
                <th className="py-3.5 px-3 font-semibold text-right">Unit / Total Cost</th>
                <th className="py-3.5 px-4 font-semibold text-right">Posted By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold">No stock ledger entries found</p>
                    <p className="text-[11px] mt-0.5">Transactions posted through the inventory engine will appear here.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => (
                  <tr key={entry.id || entry.transaction_number} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    {/* Date */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                      {entry.transaction_date}
                    </td>

                    {/* Doc Ref */}
                    <td className="py-3.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {entry.transaction_number}
                    </td>

                    {/* Movement Type */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          entry.transaction_type.includes("RECEIPT") || entry.transaction_type.includes("TRANSFER_IN")
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                            : entry.transaction_type.includes("ISSUE") || entry.transaction_type.includes("TRANSFER_OUT")
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border-rose-200 dark:border-rose-900/50"
                            : entry.transaction_type === "TRANSFER"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 border-blue-200 dark:border-blue-900/50"
                            : entry.transaction_type === "ADJUSTMENT"
                            ? "bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-400 border-purple-200 dark:border-purple-900/50"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border-amber-200 dark:border-amber-900/50"
                        }`}
                      >
                        {entry.transaction_type.includes("RECEIPT") && <ArrowDownLeft className="h-3 w-3" />}
                        {entry.transaction_type.includes("ISSUE") && <ArrowUpRight className="h-3 w-3" />}
                        {entry.transaction_type.includes("TRANSFER") && <ArrowLeftRight className="h-3 w-3" />}
                        {entry.transaction_type === "ADJUSTMENT" && <SlidersHorizontal className="h-3 w-3" />}
                        {entry.transaction_type === "RETURN" && <RotateCcw className="h-3 w-3" />}
                        {entry.transaction_type}
                      </span>
                    </td>

                    {/* Product */}
                    <td className="py-3.5 px-3 font-semibold text-slate-900 dark:text-white max-w-[180px] truncate" title={entry.product_name}>
                      {entry.product_name}
                    </td>

                    {/* SKU */}
                    <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                      {entry.sku}
                    </td>

                    {/* Warehouse & Location */}
                    <td className="py-3.5 px-3">
                      <div className="font-medium text-slate-800 dark:text-zinc-200">
                        {entry.warehouse_name}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">
                        {entry.location_name}
                      </div>
                    </td>

                    {/* Qty In */}
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400">
                      {entry.quantity_in > 0 ? `+${entry.quantity_in.toLocaleString()}` : "—"}
                    </td>

                    {/* Qty Out */}
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap font-bold text-rose-600 dark:text-rose-400">
                      {entry.quantity_out > 0 ? `-${entry.quantity_out.toLocaleString()}` : "—"}
                    </td>

                    {/* Balance */}
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap font-bold text-slate-900 dark:text-white">
                      {entry.balance_quantity.toLocaleString()}
                    </td>

                    {/* UOM */}
                    <td className="py-3.5 px-3 text-center font-mono text-[11px] text-slate-500">
                      {entry.uom}
                    </td>

                    {/* Batch / Serial */}
                    <td className="py-3.5 px-3 text-center font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                      <div>{entry.batch_number !== "—" ? entry.batch_number : ""}</div>
                      {entry.serial_number !== "—" && (
                        <div className="text-[10px] text-slate-400">SN: {entry.serial_number}</div>
                      )}
                      {entry.batch_number === "—" && entry.serial_number === "—" && "—"}
                    </td>

                    {/* Unit / Total Cost */}
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300">
                      {entry.total_cost > 0 ? (
                        <>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            ${entry.total_cost.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            @ ${entry.unit_cost.toFixed(2)}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Posted By */}
                    <td className="py-3.5 px-4 text-right font-medium text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px]">
                        <User className="h-3 w-3 text-slate-400" />
                        {entry.posted_by}
                      </span>
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
export default StockLedgerPage;
