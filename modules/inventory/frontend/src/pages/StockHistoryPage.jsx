import React, { useState, useEffect, useMemo } from "react";
import {
  History,
  Search,
  Filter,
  Download,
  Calendar,
  Building2,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { fetchStockLedger, fetchWarehouses, fetchProducts } from "../services/api";

export function StockHistoryPage() {
  const [entries, setEntries] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [directionFilter, setDirectionFilter] = useState("ALL"); // ALL | IN | OUT
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [ledgerRes, whRes] = await Promise.all([
        fetchStockLedger(),
        fetchWarehouses(),
      ]);
      const list = ledgerRes.results || (Array.isArray(ledgerRes) ? ledgerRes : []);
      setEntries(list);
      setWarehouses(whRes.results || whRes || []);
    } catch (err) {
      console.error("Failed to load stock history", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        e.product_name?.toLowerCase().includes(q) ||
        e.item_name?.toLowerCase().includes(q) ||
        e.sku?.toLowerCase().includes(q) ||
        e.item_code?.toLowerCase().includes(q) ||
        e.transaction_number?.toLowerCase().includes(q) ||
        e.transaction_ref?.toLowerCase().includes(q) ||
        e.batch_number?.toLowerCase().includes(q) ||
        e.actor?.toLowerCase().includes(q);

      const matchesWh =
        warehouseFilter === "ALL" ||
        e.warehouse_name === warehouseFilter ||
        e.warehouse_code === warehouseFilter ||
        String(e.warehouse) === String(warehouseFilter);

      const isPositive = Number(e.quantity_delta || 0) > 0 || Number(e.quantity_in || 0) > 0;
      const isNegative = Number(e.quantity_delta || 0) < 0 || Number(e.quantity_out || 0) > 0;
      const matchesDirection =
        directionFilter === "ALL" ||
        (directionFilter === "IN" && isPositive) ||
        (directionFilter === "OUT" && isNegative);

      const txnType = (e.transaction_type || e.movement_type || "").toUpperCase();
      const matchesType = typeFilter === "ALL" || txnType === typeFilter;

      let matchesDate = true;
      const rawDate = e.transaction_date || (e.created_at ? e.created_at.split("T")[0] : "");
      if (startDate && rawDate && rawDate < startDate) matchesDate = false;
      if (endDate && rawDate && rawDate > endDate) matchesDate = false;

      return matchesSearch && matchesWh && matchesDirection && matchesType && matchesDate;
    });
  }, [entries, search, warehouseFilter, directionFilter, typeFilter, startDate, endDate]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    filtered.forEach((e) => {
      const inQty = Number(e.quantity_in !== undefined ? e.quantity_in : (e.quantity_delta > 0 ? e.quantity_delta : 0));
      const outQty = Number(e.quantity_out !== undefined ? e.quantity_out : (e.quantity_delta < 0 ? Math.abs(e.quantity_delta) : 0));
      totalIn += inQty;
      totalOut += outQty;
    });
    return {
      totalIn,
      totalOut,
      netDelta: totalIn - totalOut,
      count: filtered.length,
    };
  }, [filtered]);

  const handleExportCSV = () => {
    const headers = [
      "Transaction Date",
      "Transaction ID",
      "Movement Type",
      "Direction",
      "Product Name",
      "SKU",
      "Warehouse",
      "Storage Location",
      "Batch / Lot",
      "Quantity In",
      "Quantity Out",
      "Balance After",
      "UOM",
      "Unit Cost",
      "Posted By",
    ];
    const rows = filtered.map((e) => {
      const inQty = Number(e.quantity_in !== undefined ? e.quantity_in : (e.quantity_delta > 0 ? e.quantity_delta : 0));
      const outQty = Number(e.quantity_out !== undefined ? e.quantity_out : (e.quantity_delta < 0 ? Math.abs(e.quantity_delta) : 0));
      return [
        `"${e.transaction_date || (e.created_at ? e.created_at.split("T")[0] : "")}"`,
        `"${e.transaction_number || e.transaction_ref || ""}"`,
        `"${e.transaction_type || e.movement_type || ""}"`,
        inQty > 0 ? "INWARD" : "OUTWARD",
        `"${e.product_name || e.item_name || ""}"`,
        `"${e.sku || e.item_code || ""}"`,
        `"${e.warehouse_name || ""}"`,
        `"${e.location_name || ""}"`,
        `"${e.batch_number || ""}"`,
        inQty,
        outQty,
        e.balance_quantity !== undefined ? e.balance_quantity : (e.balance_after || 0),
        `"${e.uom || "EA"}"`,
        e.unit_cost_val || e.unit_cost || 0,
        `"${e.posted_by || e.actor || "system"}"`,
      ];
    });
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_history_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    showToast("Stock history exported to CSV.");
  };

  return (
    <div className="p-6 space-y-6">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-xl flex items-center space-x-2 text-sm font-medium animate-in fade-in">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Stock History
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
              Stock Control
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Complete, authoritative chronological ledger of all inward, outward, and internal stock movements.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Total Inward Volume
            </span>
            <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-2 font-mono">
            +{metrics.totalIn.toLocaleString()}
          </div>
          <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">
            Receipts, transfers in, and returns
          </p>
        </div>

        <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
              Total Outward Volume
            </span>
            <ArrowUpRight className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-700 dark:text-red-300 mt-2 font-mono">
            -{metrics.totalOut.toLocaleString()}
          </div>
          <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
            Issues, transfers out, and write-offs
          </p>
        </div>

        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Net Stock Movement
            </span>
            <ArrowLeftRight className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-2 font-mono">
            {metrics.netDelta >= 0 ? `+${metrics.netDelta.toLocaleString()}` : metrics.netDelta.toLocaleString()}
          </div>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">
            Net physical on-hand change
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Movements
            </span>
            <History className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-2 font-mono">
            {metrics.count}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Recorded transaction log entries
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-1 min-w-[260px] max-w-md items-center relative">
            <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by transaction #, product, SKU, user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1 border border-slate-200 dark:border-slate-700 rounded-lg p-1 bg-slate-50 dark:bg-slate-800 text-xs">
              <button
                onClick={() => setDirectionFilter("ALL")}
                className={`px-3 py-1 font-semibold rounded-md transition ${
                  directionFilter === "ALL" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400"
                }`}
              >
                All Movements
              </button>
              <button
                onClick={() => setDirectionFilter("IN")}
                className={`px-3 py-1 font-semibold rounded-md transition ${
                  directionFilter === "IN" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Inward Only
              </button>
              <button
                onClick={() => setDirectionFilter("OUT")}
                className={`px-3 py-1 font-semibold rounded-md transition ${
                  directionFilter === "OUT" ? "bg-red-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Outward Only
              </button>
            </div>

            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Facilities</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.name}>
                  {wh.name}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Types</option>
              <option value="RECEIPT">Goods Receipt</option>
              <option value="ISSUE">Stock Issue</option>
              <option value="TRANSFER_IN">Transfer In</option>
              <option value="TRANSFER_OUT">Transfer Out</option>
              <option value="ADJUSTMENT">Stock Adjustment</option>
              <option value="RETURN">Stock Return</option>
              <option value="RECLASSIFICATION">Reclassification</option>
            </select>
          </div>
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-slate-500 flex items-center space-x-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Posting Date Range:</span>
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              Clear Dates
            </button>
          )}
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Document #</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Product / SKU</th>
                <th className="px-4 py-3">Facility & Location</th>
                <th className="px-4 py-3">Batch / Ref</th>
                <th className="px-4 py-3 text-right">Qty In</th>
                <th className="px-4 py-3 text-right">Qty Out</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-center">Posted By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading chronological stock history from database...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => {
                  const inQty = Number(e.quantity_in !== undefined ? e.quantity_in : (e.quantity_delta > 0 ? e.quantity_delta : 0));
                  const outQty = Number(e.quantity_out !== undefined ? e.quantity_out : (e.quantity_delta < 0 ? Math.abs(e.quantity_delta) : 0));
                  const rawDate = e.transaction_date || (e.created_at ? e.created_at.split("T")[0] : "");
                  return (
                    <tr
                      key={e.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">
                        {rawDate}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {e.transaction_number || e.transaction_ref || `TX-${e.id}`}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            inQty > 0
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                          }`}
                        >
                          {e.transaction_type || e.movement_type || "MOVEMENT"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {e.product_name || e.item_name || "Component"}
                        </div>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          {e.sku || e.item_code}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        <div>{e.warehouse_name || "Main Hub"}</div>
                        <div className="text-slate-400">{e.location_name || "Standard Bin"}</div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">
                        {e.batch_number && e.batch_number !== "—" ? e.batch_number : (e.reference_number || "—")}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        {inQty > 0 ? `+${inQty.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-red-600 dark:text-red-400">
                        {outQty > 0 ? `-${outQty.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {Number(e.balance_quantity !== undefined ? e.balance_quantity : (e.balance_after || 0)).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-mono text-slate-500">
                        {e.posted_by || e.actor || "system"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default StockHistoryPage;

