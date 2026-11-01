import React, { useState } from "react";
import { PieChart, Download, FileSpreadsheet, Activity, DollarSign, Calendar, Filter, ArrowUpRight } from "lucide-react";
import { DEMO_KPIS } from "../services/api";

export function ReportsPage() {
  const [reportType, setReportType] = useState("VALUATION");
  const [dateRange, setDateRange] = useState("30d");

  const reports = [
    {
      id: "rep-1",
      name: "Inventory Valuation by Category & Warehouse",
      description: "Moving weighted average cost valuation, total asset value, and general ledger reconciliation.",
      category: "Financial Accounting",
      period: "Monthly",
    },
    {
      id: "rep-2",
      name: "Stock Velocity & ABC Classification",
      description: "Fast-moving, slow-moving, and non-moving (dead stock) analysis with Pareto 80/20 breakdown.",
      category: "Operations",
      period: "Weekly",
    },
    {
      id: "rep-3",
      name: "Stock Discrepancy & Shrinkage Audit",
      description: "Cycle count variances, loss write-offs, damage adjustments, and posting reconciliation records.",
      category: "Compliance & Audit",
      period: "Quarterly",
    },
    {
      id: "rep-4",
      name: "Batch Expiry & Shelf-Life Risk Assessment",
      description: "Batches expiring within 30, 60, and 90 days with remaining asset value at risk.",
      category: "Quality Control",
      period: "Bi-Weekly",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Inventory Analytics & Reports
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Regulatory balance sheets, inventory turnover ratio, ABC analysis, and compliance exports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="30d">Last 30 Days</option>
              <option value="90d">This Quarter (Q4)</option>
              <option value="ytd">Year-to-Date 2026</option>
            </select>
          </div>

          <button
            onClick={() => alert("Exporting comprehensive executive inventory report (PDF)...")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs cursor-pointer transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export Executive PDF</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-zinc-400">Total Asset Value</span>
          <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">
            ${DEMO_KPIS.total_stock_value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">+4.2% vs last quarter</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-zinc-400">Inventory Turnover Ratio</span>
          <div className="text-xl font-bold tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            6.4x / Year
          </div>
          <span className="text-[11px] text-slate-400">Days on Hand: 57 days</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-zinc-400">Cycle Count Accuracy</span>
          <div className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            99.82%
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">Within tolerance</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-zinc-400">Dead Stock Risk</span>
          <div className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            $3,420.00
          </div>
          <span className="text-[11px] text-amber-600 font-medium">0.8% of portfolio</span>
        </div>
      </div>

      {/* Reports Directory */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((rep) => (
          <div
            key={rep.id}
            className="p-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-500 transition-colors"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400">
                  {rep.category}
                </span>
                <span className="text-[11px] text-slate-400">{rep.period}</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-2">
                {rep.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                {rep.description}
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800 text-xs">
              <button
                onClick={() => alert(`Downloading CSV export for ${rep.name}...`)}
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export CSV
              </button>
              <button
                onClick={() => alert(`Generating PDF report for ${rep.name}...`)}
                className="text-slate-600 dark:text-zinc-300 font-medium hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
              >
                View PDF <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

