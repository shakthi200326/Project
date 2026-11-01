import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Boxes,
  Building2,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  ChevronRight,
  TrendingUp,
  Download,
  CheckCircle2,
  Sparkles,
  Layers,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { fetchInventoryKPIs, fetchStockMovements, DEMO_KPIS } from "../services/api";

const MOVEMENT_DATA = [
  { date: "Oct 20", inbound: 420, outbound: 280 },
  { date: "Oct 21", inbound: 310, outbound: 450 },
  { date: "Oct 22", inbound: 580, outbound: 390 },
  { date: "Oct 23", inbound: 240, outbound: 620 },
  { date: "Oct 24", inbound: 750, outbound: 480 },
  { date: "Oct 25", inbound: 890, outbound: 530 },
  { date: "Oct 26", inbound: 640, outbound: 710 },
];

const CATEGORY_DATA = [
  { name: "Mechanical Components", value: 38, color: "#3B82F6" },
  { name: "Hydraulics & Valves", value: 24, color: "#8B5CF6" },
  { name: "Power Transmission", value: 18, color: "#10B981" },
  { name: "Sensors & Encoders", value: 12, color: "#F59E0B" },
  { name: "Fluids & Greases", value: 8, color: "#EC4899" },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(DEMO_KPIS);
  const [recentMovements, setRecentMovements] = useState([]);
  const [period, setPeriod] = useState("30d");
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    fetchInventoryKPIs().then(setKpis);
    fetchStockMovements().then((data) => setRecentMovements(data.results || []));
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExportSummary = () => {
    const headers = ["Metric", "Value", "Unit / Scope"];
    const rows = [
      ["Total Products (SKUs)", kpis.total_products, "Items"],
      ["Active Warehouses", kpis.total_warehouses, "Distribution Hubs"],
      ["Total Inventory Valuation", `$${kpis.total_stock_value}`, "USD (WAV)"],
      ["Total On-Hand Quantity", kpis.total_on_hand, "Units"],
      ["Total Available Quantity", kpis.total_available, "Units Free for Dispatch"],
      ["Total Reserved Quantity", kpis.total_reserved, "Units Allocated"],
      ["Low Stock Warning Items", kpis.low_stock_items, "Requires Reorder"],
      ["Out of Stock Items", kpis.out_of_stock_items, "Critical Stock-out"],
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Inventory_Executive_Summary_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Executive summary exported as CSV.");
  };

  const handleDraftOrder = (itemName) => {
    showToast(`Opening draft procurement requisition for ${itemName}...`);
    setTimeout(() => {
      navigate("/replenishment");
    }, 600);
  };

  if (!kpis) return null;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white text-xs font-medium shadow-2xl border border-slate-700/60 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header with Ambient SaaS Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md p-5 sm:p-6 shadow-xs">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                <Sparkles className="h-3 w-3 text-blue-500" />
                Live Telemetry
              </span>
              <span className="text-slate-300 dark:text-zinc-700">•</span>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                Multi-Facility Balance Sheet Active
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Inventory Command Center
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Real-time multi-warehouse availability, moving weighted valuation & stock health.
            </p>
          </div>

          {/* Global Dashboard Filters */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-800/60 shadow-2xs text-xs text-slate-700 dark:text-zinc-300">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-transparent font-medium focus:outline-hidden cursor-pointer"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">This Quarter</option>
                <option value="ytd">Year to Date</option>
              </select>
            </div>

            <button
              onClick={handleExportSummary}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs shadow-blue-500/25 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Summary</span>
            </button>
          </div>
        </div>
      </div>

      {/* 7 Core KPI Cards with Stripe-Standard Precision */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total Products */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-3.5 shadow-xs hover:shadow-sm hover:border-blue-300 dark:hover:border-blue-900/50 transition-all group">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500" />
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Total SKUs</span>
            <Boxes className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
            {kpis.total_products.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-medium">
            <TrendingUp className="h-3 w-3" /> +12 this month
          </div>
        </div>

        {/* Total Warehouses */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-3.5 shadow-xs hover:shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition-all group">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500" />
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Warehouses</span>
            <Building2 className="h-4 w-4 text-indigo-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
            {kpis.total_warehouses}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            Across 3 regions
          </div>
        </div>

        {/* Total Stock Value */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-3.5 shadow-xs hover:shadow-sm hover:border-emerald-300 dark:hover:border-emerald-900/50 transition-all group">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500" />
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Valuation</span>
            <DollarSign className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            ${kpis.total_stock_value.toLocaleString("en-US", { minimumFractionDigits: 0 })}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Weighted Average (WAV)
          </div>
        </div>

        {/* Available Stock */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-3.5 shadow-xs hover:shadow-sm hover:border-emerald-300 dark:hover:border-emerald-900/50 transition-all group">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500" />
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Available</span>
            <CheckCircle className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
            {kpis.total_available.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            Free for dispatch
          </div>
        </div>

        {/* Reserved Stock */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-3.5 shadow-xs hover:shadow-sm hover:border-purple-300 dark:hover:border-purple-900/50 transition-all group">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-purple-500" />
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Reserved</span>
            <Clock className="h-4 w-4 text-purple-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-purple-700 dark:text-purple-400">
            {kpis.total_reserved.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-purple-600 dark:text-purple-400 font-medium">
            Allocated to orders
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-3.5 shadow-xs hover:shadow-sm hover:border-amber-300 dark:hover:border-amber-900/50 transition-all group">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500" />
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Low Stock</span>
            <AlertTriangle className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-amber-600 dark:text-amber-400">
            {kpis.low_stock_items}
          </div>
          <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            Requires reorder
          </div>
        </div>

        {/* Out of Stock */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-3.5 shadow-xs hover:shadow-sm hover:border-rose-300 dark:hover:border-rose-900/50 transition-all group">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-rose-500" />
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Out of Stock</span>
            <XCircle className="h-4 w-4 text-rose-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-rose-600 dark:text-rose-400">
            {kpis.out_of_stock_items}
          </div>
          <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
            Critical stock-out
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Movement Trend (Inbound vs Outbound) */}
        <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Stock Movement Dynamics</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                  Daily Receipts vs Issues
                </span>
              </h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Physical transaction throughput monitored across multi-warehouse ledger.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/20" /> Inbound
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" /> Outbound
              </span>
            </div>
          </div>

          <div className="h-68 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOVEMENT_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(24, 24, 27, 0.95)",
                    borderColor: "rgba(63, 63, 70, 0.4)",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "12px",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                    backdropFilter: "blur(8px)",
                  }}
                />
                <Area type="monotone" dataKey="inbound" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#inboundGrad)" />
                <Area type="monotone" dataKey="outbound" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#outboundGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Category Distribution */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Inventory by Category
            </h2>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
              Proportion of stock valuation by classification
            </p>
          </div>

          <div className="h-48 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={CATEGORY_DATA} innerRadius={54} outerRadius={78} paddingAngle={4} dataKey="value">
                  {CATEGORY_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(24, 24, 27, 0.95)",
                    borderColor: "rgba(63, 63, 70, 0.4)",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">100%</span>
              <span className="text-[10px] uppercase font-bold text-slate-400">Portfolio</span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
            {CATEGORY_DATA.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-slate-700 dark:text-zinc-300">{item.name}</span>
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Operational Sections: Recent Movements & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Stock Movements Table */}
        <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Recent Stock Movements
              </h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500">
                Audited transaction log recorded on append-only ledger.
              </p>
            </div>
            <Link
              to="/ledger"
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              View Full Ledger <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 text-[11px] uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  <th className="pb-3 font-semibold">Doc Number</th>
                  <th className="pb-3 font-semibold">Type</th>
                  <th className="pb-3 font-semibold">Item & Storage Location</th>
                  <th className="pb-3 font-semibold text-right">Quantity</th>
                  <th className="pb-3 font-semibold text-right">Unit Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {recentMovements.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      {tx.document_number}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.type === "RECEIPT"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50"
                            : tx.type === "ISSUE"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
                            : "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50"
                        }`}
                      >
                        {tx.type === "RECEIPT" && <ArrowDownLeft className="h-3 w-3" />}
                        {tx.type === "ISSUE" && <ArrowUpRight className="h-3 w-3" />}
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="font-semibold text-slate-800 dark:text-zinc-200">{tx.item}</div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">{tx.location}</div>
                    </td>
                    <td className={`py-3 text-right font-semibold tabular-nums ${tx.quantity > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-zinc-200"}`}>
                      {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity} {tx.unit}
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums text-slate-600 dark:text-zinc-400 font-medium">
                      ${tx.unit_cost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operational Replenishment / Stock Alerts */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Stock Replenishment Alerts
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
              4 Critical
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-zinc-200">
                <span>Hydraulic Solenoid Valve 24V</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold tabular-nums">12 / 25 Min</span>
              </div>
              <div className="w-full bg-slate-200/80 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: "48%" }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                <span>Reorder Target: 40 EA</span>
                <button
                  type="button"
                  onClick={() => handleDraftOrder("Hydraulic Solenoid Valve 24V")}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                >
                  Draft Order →
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-rose-200/70 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-zinc-200">
                <span>Optical Rotary Encoder 1024 PPR</span>
                <span className="text-rose-600 dark:text-rose-400 font-bold tabular-nums">0 / 15 Min</span>
              </div>
              <div className="w-full bg-slate-200/80 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full transition-all" style={{ width: "0%" }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                <span className="text-rose-600 font-bold">OUT OF STOCK</span>
                <button
                  type="button"
                  onClick={() => handleDraftOrder("Optical Rotary Encoder 1024 PPR")}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                >
                  Draft Order →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
