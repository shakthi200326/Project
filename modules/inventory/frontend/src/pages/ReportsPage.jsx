import React, { useState } from "react";
import { PieChart, Download, FileSpreadsheet, Activity, DollarSign, Calendar, Filter, ArrowUpRight, CheckCircle2, BarChart3, Sparkles } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from "recharts";
import { DEMO_KPIS } from "../services/api";

const ABC_PARETO_DATA = [
  { rank: "A1", category: "High Velocity Motors & Pumps", value: 168.4, cumulative: 39.3, class: "A", skus: 120 },
  { rank: "A2", category: "Hydraulic Solenoid Valves", value: 124.8, cumulative: 68.4, class: "A", skus: 180 },
  { rank: "B1", category: "Encoders & PLC Modules", value: 54.2, cumulative: 81.1, class: "B", skus: 240 },
  { rank: "B2", category: "Timing Belts & Pulleys", value: 36.2, cumulative: 89.5, class: "B", skus: 310 },
  { rank: "C1", category: "Seals, O-Rings & Gaskets", value: 24.5, cumulative: 95.2, class: "C", skus: 420 },
  { rank: "C2", category: "Fasteners & Bulk Hardware", value: 20.4, cumulative: 100.0, class: "C", skus: 580 },
];

export function ReportsPage() {
  const [reportType, setReportType] = useState("VALUATION");
  const [dateRange, setDateRange] = useState("30d");
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

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

  const handleExportPdf = () => {
    showToast("Generating executive inventory analytics PDF summary...");
  };

  const handleExportReportCsv = (reportName) => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      encodeURI(`Report Name,${reportName}\nGenerated Date,${new Date().toISOString()}\nStatus,Audit Ready\n`);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `${reportName.toLowerCase().replace(/[^a-z0-9]/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`CSV data for "${reportName}" downloaded.`);
  };

  const handleViewReportPdf = (reportName) => {
    showToast(`Opening PDF preview for "${reportName}"...`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white text-xs font-semibold shadow-2xl border border-slate-700/60 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Inventory Analytics & Reports
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60">
              <Sparkles className="h-2.5 w-2.5" />
              Intelligence Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Regulatory balance sheets, inventory turnover ratio, ABC Pareto analysis & audit compliance exports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs text-slate-700 dark:text-zinc-300 shadow-2xs font-medium">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent font-medium focus:outline-hidden cursor-pointer"
            >
              <option value="30d">Last 30 Days</option>
              <option value="90d">This Quarter (Q4)</option>
              <option value="ytd">Year-to-Date 2026</option>
            </select>
          </div>

          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs hover:shadow-blue-500/25 transition-all cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Executive PDF</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Total Asset Value</span>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            ${DEMO_KPIS.total_stock_value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">+4.2% vs last quarter</span>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Inventory Turnover Ratio</span>
          <div className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            6.4x / Year
          </div>
          <span className="text-[11px] text-slate-400">Days on Hand: 57 days</span>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Cycle Count Accuracy</span>
          <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            99.82%
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">Within tolerance</span>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Dead Stock Risk</span>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            $3,420.00
          </div>
          <span className="text-[11px] text-amber-600 font-medium">0.8% of portfolio</span>
        </div>
      </div>

      {/* High Configuration ABC Pareto Velocity Analysis Chart */}
      <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              ABC Velocity & Pareto 80/20 Capital Concentration
            </h2>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
              Dual-axis Pareto analysis: Bars indicate capital held per subcategory; line tracks cumulative valuation percentage.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Class A (Top 80%)
            </span>
            <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Class B (15%)
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Class C (5%)
            </span>
            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <span className="h-2 w-2 rounded-full bg-rose-500 ring-2 ring-rose-500/20" /> Pareto 80%
            </span>
          </div>
        </div>

        <div className="h-68 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={ABC_PARETO_DATA} margin={{ top: 15, right: 15, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#e2e8f0" opacity={0.5} />
              <XAxis dataKey="rank" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="val" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} domain={[0, 200]} />
              <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11, fill: "#F43F5E" }} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip
                cursor={{ fill: "rgba(0, 0, 0, 0.03)" }}
                contentStyle={{
                  backgroundColor: "rgba(24, 24, 27, 0.95)",
                  borderColor: "rgba(63, 63, 70, 0.5)",
                  borderRadius: "14px",
                  color: "#fff",
                  fontSize: "12px",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
                  backdropFilter: "blur(12px)",
                }}
                formatter={(val, name, entry) => [
                  name === "value" ? `$${val}k USD (${entry.payload.skus} SKUs)` : `${val}% Cumulative`,
                  entry.payload.category,
                ]}
              />
              <ReferenceLine yAxisId="pct" y={80} stroke="#F43F5E" strokeDasharray="3 3" label={{ value: "80% Pareto Frontier", position: "insideTopRight", fill: "#F43F5E", fontSize: 10, fontWeight: "bold" }} />
              <Bar yAxisId="val" dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={44}>
                {ABC_PARETO_DATA.map((entry, index) => (
                  <Cell
                    key={`pareto-bar-${index}`}
                    fill={entry.class === "A" ? "#3B82F6" : entry.class === "B" ? "#6366F1" : "#F59E0B"}
                  />
                ))}
              </Bar>
              <Line yAxisId="pct" type="monotone" dataKey="cumulative" stroke="#F43F5E" strokeWidth={2.5} dot={{ r: 4, fill: "#F43F5E", stroke: "#fff" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Reports Directory */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((rep) => (
          <div
            key={rep.id}
            className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md hover:border-blue-400/60 dark:hover:border-blue-700/60 transition-all group"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                  {rep.category}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">{rep.period}</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-2.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {rep.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                {rep.description}
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800/80 text-xs">
              <button
                onClick={() => handleExportReportCsv(rep.name)}
                className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export CSV
              </button>
              <button
                onClick={() => handleViewReportPdf(rep.name)}
                className="text-slate-600 dark:text-zinc-300 font-medium hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
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
