import React, { useState, useEffect, useMemo } from "react";
import {
  History,
  Search,
  Filter,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Warehouse as WarehouseIcon,
  RefreshCw,
  FileCheck,
  ShieldCheck,
  Calendar,
  User,
} from "lucide-react";
import {
  fetchAuditHistory,
  fetchWarehouses,
} from "@/services/api";

export function AuditHistoryPage() {
  const [audits, setAudits] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const loadData = async () => {
    setLoading(true);
    try {
      const [aRes, whRes] = await Promise.all([
        fetchAuditHistory(),
        fetchWarehouses(),
      ]);
      setAudits(aRes.results || aRes || []);
      setWarehouses(whRes.results || whRes || []);
    } catch (err) {
      console.error("Failed to load audit history", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredAudits = useMemo(() => {
    return audits.filter((a) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !q ||
        (a.audit_number && a.audit_number.toLowerCase().includes(q)) ||
        (a.count_number && a.count_number.toLowerCase().includes(q)) ||
        (a.warehouse_name && a.warehouse_name.toLowerCase().includes(q)) ||
        (a.counted_by && a.counted_by.toLowerCase().includes(q)) ||
        (a.verified_by && a.verified_by.toLowerCase().includes(q));

      const matchWh =
        warehouseFilter === "ALL" ||
        String(a.warehouse) === String(warehouseFilter) ||
        (a.warehouse_name && a.warehouse_name.toLowerCase() === warehouseFilter.toLowerCase());

      const matchStatus =
        statusFilter === "ALL" ||
        String(a.status).toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchWh && matchStatus;
    });
  }, [audits, searchTerm, warehouseFilter, statusFilter]);

  // KPIs
  const totalAudits = audits.length;
  const zeroVariance = audits.filter((a) => Number(a.variance_count || 0) === 0).length;
  const totalItemsCounted = audits.reduce((acc, a) => acc + Number(a.total_products_counted || 0), 0);
  const closedAudits = audits.filter((a) => a.status === "Closed" || a.status === "Approved").length;

  const exportCSV = () => {
    const headers = [
      "Audit Number",
      "Count Number",
      "Warehouse",
      "Count Date",
      "Counted By",
      "Verified By",
      "Total Products Counted",
      "Variance Count",
      "Status",
      "Notes",
    ];
    const rows = filteredAudits.map((a) => [
      a.audit_number,
      a.count_number,
      a.warehouse_name,
      a.count_date,
      a.counted_by,
      a.verified_by,
      a.total_products_counted,
      a.variance_count,
      a.status,
      a.notes || "",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.map((f) => `"${f || ""}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Physical_Inventory_Audit_History_${new Date().toISOString().split("T")[0]}.csv`);
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
              <History className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Audit History
              </h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Permanent audited record of completed physical stock counts, verified variances, and ledger adjustments.
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Completed Audits</span>
            <History className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-slate-900 dark:text-white">
            {totalAudits}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Archived counting events</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">100% Accuracy Audits</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-emerald-600 dark:text-emerald-400">
            {zeroVariance}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Zero variance verified</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Total Products Counted</span>
            <FileCheck className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-purple-600 dark:text-purple-400">
            {totalItemsCounted}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Audited SKUs across fleet</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium">Closed Audits</span>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-blue-600 dark:text-blue-400">
            {closedAudits}
          </p>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Verified & fully closed</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search by audit number, count reference, counted by, verified by..."
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border-none text-slate-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Approved">Approved</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Audit History Table - Exact Fields */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-zinc-400">
            <thead className="bg-slate-50/80 dark:bg-zinc-800/50 uppercase tracking-wider text-[11px] font-semibold text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 whitespace-nowrap">
              <tr>
                <th className="py-3.5 px-4">Audit Number</th>
                <th className="py-3.5 px-4">Count Number</th>
                <th className="py-3.5 px-4">Warehouse</th>
                <th className="py-3.5 px-4">Count Date</th>
                <th className="py-3.5 px-4">Counted By</th>
                <th className="py-3.5 px-4">Verified By</th>
                <th className="py-3.5 px-4 text-right">Products Counted</th>
                <th className="py-3.5 px-4 text-right">Variance Count</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading audit history...
                  </td>
                </tr>
              ) : filteredAudits.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                    No physical count audit history records found.
                  </td>
                </tr>
              ) : (
                filteredAudits.map((a) => (
                  <tr
                    key={a.id || a.audit_number}
                    className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    {/* 1. Audit Number */}
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {a.audit_number}
                    </td>

                    {/* 2. Count Number */}
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 dark:text-zinc-300">
                      {a.count_number}
                    </td>

                    {/* 3. Warehouse */}
                    <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-zinc-200">
                      {a.warehouse_name}
                    </td>

                    {/* 4. Count Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap">{a.count_date}</td>

                    {/* 5. Counted By */}
                    <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300">
                      {a.counted_by}
                    </td>

                    {/* 6. Verified By */}
                    <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300">
                      {a.verified_by}
                    </td>

                    {/* 7. Total Products Counted */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {a.total_products_counted}
                    </td>

                    {/* 8. Variance Count */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold">
                      <span
                        className={`inline-block px-2 py-0.5 rounded ${
                          Number(a.variance_count || 0) === 0
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                        }`}
                      >
                        {a.variance_count}
                      </span>
                    </td>

                    {/* 9. Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          a.status === "Approved"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50"
                            : a.status === "Closed"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50"
                            : "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50"
                        }`}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {a.status}
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

export default AuditHistoryPage;
