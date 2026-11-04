import React, { useState, useEffect, useMemo } from "react";
import {
  Scale,
  Search,
  Filter,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Warehouse as WarehouseIcon,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  FileCheck,
  Check,
  Ban,
  FileSpreadsheet,
} from "lucide-react";
import {
  fetchStockCounts,
  reviewStockCount,
  approveStockCount,
  rejectStockCount,
  generateStockCountAdjustment,
  fetchWarehouses,
} from "@/services/api";

const VARIANCE_REASONS = [
  "Missing Stock",
  "Excess Stock",
  "Damage",
  "Counting Error",
  "Other",
];

export function StockVariancePage() {
  const [counts, setCounts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [reasonFilter, setReasonFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [cntRes, whRes] = await Promise.all([
        fetchStockCounts(),
        fetchWarehouses(),
      ]);
      const list = cntRes.results || cntRes || [];
      // Only keep records with difference_quantity != 0 or with a status of variance review
      setCounts(list);
      setWarehouses(whRes.results || whRes || []);
    } catch (err) {
      console.error("Failed to load stock variances", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReview = async (id) => {
    setActionLoadingId(id);
    try {
      await reviewStockCount(id);
      setSuccessMsg("Variance marked as under review.");
      await loadData();
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      setErrorMsg("Failed to mark review: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApprove = async (id) => {
    setActionLoadingId(id);
    try {
      await approveStockCount(id);
      setSuccessMsg("Variance approved. Ready to generate stock adjustment.");
      await loadData();
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      setErrorMsg("Failed to approve variance: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id) => {
    setActionLoadingId(id);
    try {
      await rejectStockCount(id);
      setSuccessMsg("Variance rejected.");
      await loadData();
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      setErrorMsg("Failed to reject variance: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleGenerateAdjustment = async (id) => {
    setActionLoadingId(id);
    try {
      const res = await generateStockCountAdjustment(id);
      setSuccessMsg(
        `Audited Stock Adjustment ${res.adjustment_document_number || ""} generated and posted to ledger.`
      );
      await loadData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setErrorMsg("Failed to generate stock adjustment: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter only items with differences or explicit variance status
  const varianceList = useMemo(() => {
    return counts.filter((c) => {
      const diff = Number(c.difference_quantity || 0);
      const st = String(c.status).toUpperCase();
      // Only items that have a non-zero difference or are submitted/pending/approved/adjusted
      return diff !== 0 || ["SUBMITTED", "PENDING", "APPROVED", "ADJUSTED", "REJECTED"].includes(st);
    });
  }, [counts]);

  const filteredVariances = useMemo(() => {
    return varianceList.filter((c) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !q ||
        (c.count_number && c.count_number.toLowerCase().includes(q)) ||
        (c.product_name && c.product_name.toLowerCase().includes(q)) ||
        (c.sku && c.sku.toLowerCase().includes(q)) ||
        (c.warehouse_name && c.warehouse_name.toLowerCase().includes(q));

      const matchWh =
        warehouseFilter === "ALL" ||
        String(c.warehouse) === String(warehouseFilter) ||
        (c.warehouse_name && c.warehouse_name.toLowerCase() === warehouseFilter.toLowerCase());

      const reason = c.variance_reason || c.reason || "Missing Stock";
      const matchReason =
        reasonFilter === "ALL" || reason.toLowerCase() === reasonFilter.toLowerCase();

      const st = String(c.status).toUpperCase();
      const matchStatus =
        statusFilter === "ALL" ||
        st === statusFilter.toUpperCase() ||
        (statusFilter === "PENDING" && (st === "SUBMITTED" || st === "PENDING"));

      return matchSearch && matchWh && matchReason && matchStatus;
    });
  }, [varianceList, searchTerm, warehouseFilter, reasonFilter, statusFilter]);

  // KPIs
  const totalVariances = varianceList.length;
  const pendingReview = varianceList.filter((c) => {
    const st = String(c.status).toUpperCase();
    return st === "SUBMITTED" || st === "PENDING" || st === "DRAFT";
  }).length;
  const approvedVariances = varianceList.filter((c) => String(c.status).toUpperCase() === "APPROVED").length;
  const adjustedCount = varianceList.filter((c) => String(c.status).toUpperCase() === "ADJUSTED").length;

  const exportCSV = () => {
    const headers = [
      "Count Number",
      "Product Name",
      "SKU",
      "Warehouse",
      "Storage Location",
      "System Qty",
      "Physical Qty",
      "Difference Qty",
      "Variance Reason",
      "Status",
      "Adjustment Ref",
    ];
    const rows = filteredVariances.map((c) => [
      c.count_number,
      c.product_name,
      c.sku,
      c.warehouse_name,
      c.location_name || "All Locations",
      c.system_quantity,
      c.physical_quantity,
      c.difference_quantity,
      c.variance_reason || c.reason || "Missing Stock",
      c.status,
      c.adjustment_document_number || "",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.map((f) => `"${f || ""}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Stock_Variances_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400">
              <Scale className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Stock Variance
              </h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Review differences between system stock and physical counts. Approved variances generate audited stock adjustments.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-colors shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            onClick={loadData}
            title="Refresh Table"
            className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg("")} className="text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Total Discrepancies</span>
            <Scale className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-slate-900 dark:text-white">
            {totalVariances}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Non-zero variance items</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Pending Review</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-amber-600 dark:text-amber-400">
            {pendingReview}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Awaiting auditor approval</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Approved for Adjustment</span>
            <Check className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-emerald-600 dark:text-emerald-400">
            {approvedVariances}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Ready for adjustment generation</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Adjusted to Ledger</span>
            <FileCheck className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-purple-600 dark:text-purple-400">
            {adjustedCount}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Audited transactions posted</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search by count number, product, SKU, warehouse..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border-none text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name}
              </option>
            ))}
          </select>

          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border-none text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Reasons</option>
            {VARIANCE_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border-none text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ADJUSTED">Adjusted</option>
          </select>
        </div>
      </div>

      {/* Variance Table - Exact 10 Columns */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-zinc-400">
            <thead className="bg-slate-50/80 dark:bg-zinc-800/50 uppercase tracking-wider text-[11px] font-semibold text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 whitespace-nowrap">
              <tr>
                <th className="py-3.5 px-4">Count Number</th>
                <th className="py-3.5 px-4">Product & SKU</th>
                <th className="py-3.5 px-4">Warehouse</th>
                <th className="py-3.5 px-4">Storage Location</th>
                <th className="py-3.5 px-4 text-right">System Qty</th>
                <th className="py-3.5 px-4 text-right">Physical Qty</th>
                <th className="py-3.5 px-4 text-right">Difference</th>
                <th className="py-3.5 px-4">Variance Reason</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading stock variances...
                  </td>
                </tr>
              ) : filteredVariances.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    No discrepancies or stock variances match the active filters.
                  </td>
                </tr>
              ) : (
                filteredVariances.map((c) => {
                  const diff = Number(c.difference_quantity || 0);
                  const st = String(c.status).toUpperCase();
                  const reason = c.variance_reason || c.reason || "Missing Stock";
                  return (
                    <tr
                      key={c.id || c.count_number}
                      className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* 1. Count Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {c.count_number}
                      </td>

                      {/* 2 & 3. Product & SKU */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 dark:text-zinc-200">
                          {c.product_name}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                          SKU: {c.sku}
                        </div>
                      </td>

                      {/* 4. Warehouse */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-zinc-200">
                        {c.warehouse_name}
                      </td>

                      {/* 5. Storage Location */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-400">
                        {c.location_name || "Main Area"}
                      </td>

                      {/* 6. System Quantity */}
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-600 dark:text-zinc-400">
                        {Number(c.system_quantity || 0).toLocaleString()}
                      </td>

                      {/* 7. Physical Quantity */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {Number(c.physical_quantity || 0).toLocaleString()}
                      </td>

                      {/* 8. Difference Quantity */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded ${
                            diff > 0
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                          }`}
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>

                      {/* 9. Variance Reason */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {reason}
                        </span>
                      </td>

                      {/* 10. Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            st === "DRAFT" || st === "SUBMITTED" || st === "PENDING"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50"
                              : st === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50"
                              : st === "ADJUSTED"
                              ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
                          }`}
                        >
                          {st === "ADJUSTED" && <FileCheck className="h-3 w-3" />}
                          {st === "APPROVED" && <Check className="h-3 w-3" />}
                          {(st === "PENDING" || st === "SUBMITTED" || st === "DRAFT") && (
                            <Clock className="h-3 w-3" />
                          )}
                          {st === "REJECTED" && <Ban className="h-3 w-3" />}
                          {c.status}
                        </span>
                      </td>

                      {/* Actions: Review, Approve, Reject, Generate Stock Adjustment */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {(st === "DRAFT" || st === "SUBMITTED") && (
                            <button
                              onClick={() => handleReview(c.id)}
                              disabled={actionLoadingId === c.id}
                              className="px-2 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors"
                            >
                              Review
                            </button>
                          )}

                          {(st === "SUBMITTED" || st === "PENDING") && (
                            <>
                              <button
                                onClick={() => handleApprove(c.id)}
                                disabled={actionLoadingId === c.id}
                                className="px-2 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(c.id)}
                                disabled={actionLoadingId === c.id}
                                className="px-2 py-1 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-400 transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {st === "APPROVED" && (
                            <button
                              onClick={() => handleGenerateAdjustment(c.id)}
                              disabled={actionLoadingId === c.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-xs"
                            >
                              <FileSpreadsheet className="h-3 w-3" />
                              Generate Adjustment
                            </button>
                          )}

                          {st === "ADJUSTED" && (
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                              {c.adjustment_document_number || "Adjusted"}
                            </span>
                          )}
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
    </div>
  );
}

export default StockVariancePage;
