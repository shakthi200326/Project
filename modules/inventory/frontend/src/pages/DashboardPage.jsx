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
  ArrowLeftRight,
  Calendar,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Download,
  CheckCircle2,
  Sparkles,
  Layers,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  ShieldAlert,
  Gauge,
  Activity,
  Package,
  Warehouse,
  Zap,
  Filter,
  Check,
  Thermometer,
  Truck,
  ArrowRight,
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
  Legend,
} from "recharts";
import { fetchInventoryKPIs, fetchStockMovements, DEMO_KPIS } from "../services/api";
import { CreateProductModal } from "../components/CreateProductModal";
import { StockTransactionModal } from "../components/StockTransactionModal";

// 7-Day & 30-Day Movement Telemetry
const MOVEMENT_DATA_7D = [
  { date: "Oct 20", inbound: 420, outbound: 280, transfers: 90 },
  { date: "Oct 21", inbound: 310, outbound: 450, transfers: 120 },
  { date: "Oct 22", inbound: 580, outbound: 390, transfers: 75 },
  { date: "Oct 23", inbound: 240, outbound: 620, transfers: 160 },
  { date: "Oct 24", inbound: 750, outbound: 480, transfers: 110 },
  { date: "Oct 25", inbound: 890, outbound: 530, transfers: 140 },
  { date: "Oct 26", inbound: 640, outbound: 710, transfers: 85 },
];

const MOVEMENT_DATA_30D = [
  { date: "Wk 1", inbound: 2450, outbound: 1980, transfers: 540 },
  { date: "Wk 2", inbound: 3120, outbound: 2890, transfers: 680 },
  { date: "Wk 3", inbound: 2890, outbound: 3200, transfers: 790 },
  { date: "Wk 4", inbound: 3650, outbound: 3100, transfers: 620 },
];

// Product Category Breakdown
const CATEGORY_DATA = [
  { name: "Mechanical Components", value: 38, amount: 162845, color: "#3B82F6" },
  { name: "Hydraulics & Valves", value: 24, amount: 102850, color: "#8B5CF6" },
  { name: "Power Transmission", value: 18, amount: 77137, color: "#10B981" },
  { name: "Sensors & Encoders", value: 12, amount: 51425, color: "#F59E0B" },
  { name: "Fluids & Chemicals", value: 8, amount: 34283, color: "#EC4899" },
];

// Warehouse Capacity & Occupancy Matrix
const WAREHOUSE_CAPACITY_DATA = [
  {
    name: "Main Central Hub",
    occupied: 28400,
    safetyReserve: 3200,
    availableSpace: 6100,
    utilization: 82,
  },
  {
    name: "East Coast Terminal",
    occupied: 16200,
    safetyReserve: 2500,
    availableSpace: 8800,
    utilization: 65,
  },
  {
    name: "Cold Storage Facility",
    occupied: 7060,
    safetyReserve: 600,
    availableSpace: 940,
    utilization: 88,
  },
];

// Inventory Aging & Turnover Velocity Data
const AGING_DATA = [
  { band: "0-30 Days (Fast Turn)", value: 265000, percentage: 62, color: "#10B981" },
  { band: "31-60 Days (Standard)", value: 102000, percentage: 24, color: "#3B82F6" },
  { band: "61-90 Days (Slow Moving)", value: 42540, percentage: 10, color: "#F59E0B" },
  { band: "90+ Days (Aging Risk)", value: 19000, percentage: 4, color: "#EF4444" },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(DEMO_KPIS);
  const [recentMovements, setRecentMovements] = useState([]);
  const [period, setPeriod] = useState("7d");
  const [activeFacility, setActiveFacility] = useState("all");
  const [toastMessage, setToastMessage] = useState(null);

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);

  useEffect(() => {
    fetchInventoryKPIs().then(setKpis);
    fetchStockMovements().then((data) => setRecentMovements(data.results || []));
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExportSummary = () => {
    const headers = ["Metric", "Value", "Unit / Scope", "Telemetry Note"];
    const rows = [
      ["Total Products (SKUs)", kpis.total_products, "Items", "Catalog SKU registry count"],
      ["Active Warehouses", kpis.total_warehouses, "Distribution Centers", "Multi-facility hubs"],
      ["Total Inventory Valuation", `$${kpis.total_stock_value.toLocaleString()}`, "USD", "Moving Weighted Average (WAV)"],
      ["Total Physical On-Hand", kpis.total_on_hand, "Units", "Physical balance in bins"],
      ["Total Net Available (ATP)", kpis.total_available, "Units", "Available to Promise"],
      ["Total Allocated / Reserved", kpis.total_reserved, "Units", "Committed to orders"],
      ["Low Stock Alert Items", kpis.low_stock_items, "SKUs", "Approaching safety buffer"],
      ["Critical Stock-Out Items", kpis.out_of_stock_items, "SKUs", "Zero physical stock"],
      ["Annualized Inventory Turns", "6.8x", "Turns / Year", "+0.9x industrial benchmark"],
      ["Space Utilization Rate", "78.4%", "Storage Bins", "51,660 / 67,600 bins occupied"],
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map(val => `"${val}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Inventory_Executive_Intelligence_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Executive Intelligence summary exported as CSV.");
  };

  const handleDraftOrder = (itemName) => {
    showToast(`Drafting procurement requisition for ${itemName}...`);
    setTimeout(() => {
      navigate("/replenishment");
    }, 600);
  };

  const handleProductCreated = (newProd) => {
    showToast(`SKU ${newProd.sku} successfully registered in inventory catalog.`);
    setKpis((prev) => ({
      ...prev,
      total_products: prev.total_products + 1,
    }));
  };

  const handleTransactionPosted = (tx) => {
    showToast(`Transaction ${tx.document_number} posted to immutable ledger.`);
    setRecentMovements((prev) => [tx, ...prev]);
  };

  const currentMovementData = period === "30d" || period === "90d" || period === "ytd" 
    ? MOVEMENT_DATA_30D 
    : MOVEMENT_DATA_7D;

  if (!kpis) return null;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-white/95 text-white dark:text-zinc-900 shadow-2xl backdrop-blur-md border border-slate-700/50 dark:border-zinc-200/50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Page Header with Ambient SaaS Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md p-6 shadow-xs">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                Live Telemetry
              </span>
              <span className="text-slate-300 dark:text-zinc-700">•</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                3 Regional Hubs Synchronized
              </span>
              <span className="text-slate-300 dark:text-zinc-700">•</span>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium font-mono">
                WAV Recalculated: Live
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Executive Inventory Command
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1 max-w-2xl">
              Continuous multi-facility balance monitoring, automated replenishment velocity, and valuation telemetry.
            </p>
          </div>

          {/* Controls & Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Facility Quick Pill Switcher */}
            <div className="flex items-center p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-800/60 text-xs">
              {[
                { id: "all", label: "All Hubs" },
                { id: "main", label: "MDC-01" },
                { id: "east", label: "ECT-02" },
                { id: "cold", label: "CCF-03" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFacility(f.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    activeFacility === f.id
                      ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-800/80 shadow-2xs text-xs text-slate-700 dark:text-zinc-300">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-transparent font-medium focus:outline-none cursor-pointer"
              >
                <option value="7d">Last 7 Days</option>
                <option value="14d">Last 14 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">This Quarter</option>
                <option value="ytd">Year to Date</option>
              </select>
            </div>

            {/* Quick Action Buttons */}
            <button
              onClick={() => setIsTxModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800/60 shadow-xs cursor-pointer transition-all"
            >
              <ArrowLeftRight className="h-3.5 w-3.5 text-blue-500" />
              <span>Post Movement</span>
            </button>

            <button
              onClick={() => setIsProductModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs hover:shadow-blue-500/25 cursor-pointer transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>New Product</span>
            </button>

            <button
              onClick={handleExportSummary}
              className="p-2 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white shadow-xs cursor-pointer transition-colors"
              title="Export Executive CSV"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 7 Core KPI Cards with Stripe-Standard Precision */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5">
        {/* Total Stock Value */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-4 shadow-xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-900/50 transition-all group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Valuation</span>
            <DollarSign className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            ${kpis.total_stock_value.toLocaleString("en-US", { minimumFractionDigits: 0 })}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-medium">
            <TrendingUp className="h-3 w-3" /> +4.8% WAV
          </div>
        </div>

        {/* Total Products */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-4 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-900/50 transition-all group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Total SKUs</span>
            <Boxes className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
            {kpis.total_products.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-0.5 font-medium">
            <TrendingUp className="h-3 w-3" /> +12 this cycle
          </div>
        </div>

        {/* Available Stock */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-4 shadow-xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-900/50 transition-all group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-green-500" />
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Available</span>
            <CheckCircle className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
            {kpis.total_available.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
            93.3% Free to dispatch
          </div>
        </div>

        {/* Reserved Stock */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-4 shadow-xs hover:shadow-md hover:border-purple-300 dark:hover:border-purple-900/50 transition-all group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Allocated</span>
            <Clock className="h-4 w-4 text-purple-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-purple-600 dark:text-purple-400">
            {kpis.total_reserved.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-purple-600 dark:text-purple-400 font-medium">
            Order allocations
          </div>
        </div>

        {/* Space Utilization */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-4 shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-900/50 transition-all group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Occupancy</span>
            <Warehouse className="h-4 w-4 text-indigo-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
            78.4%
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            Across 3 facilities
          </div>
        </div>

        {/* Annual Turnover Velocity */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-4 shadow-xs hover:shadow-md hover:border-amber-300 dark:hover:border-amber-900/50 transition-all group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Turnover</span>
            <Activity className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
            6.8x
          </div>
          <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-0.5">
            <TrendingUp className="h-3 w-3" /> +0.9x speed
          </div>
        </div>

        {/* Stockout Risk Radar */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-4 shadow-xs hover:shadow-md hover:border-rose-300 dark:hover:border-rose-900/50 transition-all group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-red-500" />
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Stock Risk</span>
            <ShieldAlert className="h-4 w-4 text-rose-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-rose-600 dark:text-rose-400">
            {kpis.out_of_stock_items} Out
          </div>
          <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            {kpis.low_stock_items} low threshold
          </div>
        </div>
      </div>

      {/* Row 1: Primary Stock Movement Dynamics & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Movement Dynamics Chart */}
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Stock Movement Dynamics & Flow Rate
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                  Throughput
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Physical receipts, issue dispatches, and warehouse rebalancing over time.
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/20" /> Inbound
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" /> Outbound
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500 ring-2 ring-purple-500/20" /> Transfers
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentMovementData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="transfersGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    borderColor: "rgba(51, 65, 85, 0.6)",
                    borderRadius: "14px",
                    color: "#fff",
                    fontSize: "12px",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.4)",
                    backdropFilter: "blur(10px)",
                  }}
                />
                <Area type="monotone" dataKey="inbound" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#inboundGrad)" />
                <Area type="monotone" dataKey="outbound" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#outboundGrad)" />
                <Area type="monotone" dataKey="transfers" stroke="#8B5CF6" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#transfersGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Category Breakdown Donut */}
        <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Valuation by Category
              </h2>
              <span className="text-[10px] font-semibold text-slate-400 font-mono">
                5 Taxonomies
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
              Capital distribution across product classifications.
            </p>
          </div>

          <div className="h-50 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={CATEGORY_DATA} innerRadius={58} outerRadius={82} paddingAngle={4} dataKey="value">
                  {CATEGORY_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val, name, item) => [`${val}% ($${item.payload.amount.toLocaleString()})`, name]}
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    borderColor: "rgba(51, 65, 85, 0.6)",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs font-semibold text-slate-400">Total Portfolio</span>
              <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">$428.5k</span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
            {CATEGORY_DATA.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[150px]">{item.name}</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-400">${(item.amount / 1000).toFixed(1)}k</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums w-8 text-right">{item.value}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Warehouse Volume Capacity & Inventory Aging Turnover */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Multi-Warehouse Capacity Bar Chart */}
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Multi-Facility Bin Volume & Capacity
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
                  Bin Occupancy
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Comparison of occupied slots, safety buffers, and available rack positions.
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Occupied
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Buffer
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-zinc-700" /> Free Space
              </span>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WAREHOUSE_CAPACITY_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    borderColor: "rgba(51, 65, 85, 0.6)",
                    borderRadius: "14px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="occupied" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="safetyReserve" stackId="a" fill="#8B5CF6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="availableSpace" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inventory Aging & Stock Velocity */}
        <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Inventory Aging & Velocity
              </h2>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 font-medium">
                Health: 96%
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
              Turnover velocity by days in warehouse storage.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            {AGING_DATA.map((band) => (
              <div key={band.band} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-zinc-200">{band.band}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-400">${(band.value / 1000).toFixed(0)}k</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">{band.percentage}%</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${band.percentage}%`, backgroundColor: band.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-300">
            <div className="flex items-center gap-1.5 font-bold mb-0.5">
              <Zap className="h-3.5 w-3.5 text-blue-500" />
              Velocity Recommendation
            </div>
            <p className="text-[11px] text-blue-800 dark:text-blue-300/80">
              Only 4% of total inventory exceeds 90 days. Recommended for clearance promotion or consignment transfer.
            </p>
          </div>
        </div>
      </div>

      {/* Row 3: Facility Operations Radar & Status Hub */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Main Central Hub */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs space-y-3.5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <Warehouse className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Main Central Hub (WH-MAIN)</h3>
                <span className="text-[10px] text-slate-400">Primary Distribution Facility</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Optimal
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">Capacity Occupied</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">82% (28,400 / 34,500)</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full" style={{ width: "82%" }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-[11px]">
            <div>
              <span className="text-slate-400">Active Inbound Docks:</span>
              <div className="font-semibold text-slate-800 dark:text-zinc-200">4 Docks Active</div>
            </div>
            <div>
              <span className="text-slate-400">Average Turn Time:</span>
              <div className="font-semibold text-slate-800 dark:text-zinc-200 font-mono">1.8 Days</div>
            </div>
          </div>
        </div>

        {/* East Coast Logistics Terminal */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs space-y-3.5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">East Coast Terminal (WH-EAST)</h3>
                <span className="text-[10px] text-slate-400">Transit & Cross-Dock Hub</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/50">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Fast Turn
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">Capacity Occupied</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">65% (16,200 / 25,000)</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-purple-600 h-full rounded-full" style={{ width: "65%" }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-[11px]">
            <div>
              <span className="text-slate-400">Active Cross-Docks:</span>
              <div className="font-semibold text-slate-800 dark:text-zinc-200">2 Docks Active</div>
            </div>
            <div>
              <span className="text-slate-400">Average Turn Time:</span>
              <div className="font-semibold text-slate-800 dark:text-zinc-200 font-mono">0.9 Days</div>
            </div>
          </div>
        </div>

        {/* Cold Storage Facility */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs space-y-3.5 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400">
                <Thermometer className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Cold Storage Facility (WH-COLD)</h3>
                <span className="text-[10px] text-slate-400">Temperature Controlled (-18°C)</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-400 border border-cyan-200/50">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
              Cold Chain
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">Capacity Occupied</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">88% (7,060 / 8,100)</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-cyan-600 h-full rounded-full" style={{ width: "88%" }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-[11px]">
            <div>
              <span className="text-slate-400">Cold Vault Core:</span>
              <div className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">-18.2°C Stable</div>
            </div>
            <div>
              <span className="text-slate-400">Certification:</span>
              <div className="font-semibold text-slate-800 dark:text-zinc-200">ISO-22000 Valid</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Operational Ledger Stream & Reorder Defense Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Stock Movements Table */}
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Live Stock Movement Ledger
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                  Append-Only
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Cryptographically audited stock movements posted to system journal.
              </p>
            </div>
            <Link
              to="/ledger"
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              Full Ledger <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-800/30 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <th className="py-3 px-3 font-semibold">Doc Number</th>
                  <th className="py-3 px-3 font-semibold">Type</th>
                  <th className="py-3 px-3 font-semibold">Product Item</th>
                  <th className="py-3 px-3 font-semibold">Location</th>
                  <th className="py-3 px-3 font-semibold text-right">Quantity</th>
                  <th className="py-3 px-3 font-semibold text-right">Unit Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {recentMovements.slice(0, 5).map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                        {tx.document_number}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          tx.type === "RECEIPT"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/50"
                            : tx.type === "ISSUE"
                            ? "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900/50"
                            : tx.type === "TRANSFER"
                            ? "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900/50"
                            : "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900/50"
                        }`}
                      >
                        {tx.type === "RECEIPT" && <ArrowDownLeft className="h-3 w-3" />}
                        {tx.type === "ISSUE" && <ArrowUpRight className="h-3 w-3" />}
                        {tx.type === "TRANSFER" && <ArrowLeftRight className="h-3 w-3" />}
                        {tx.type === "ADJUSTMENT" && <SlidersHorizontal className="h-3 w-3" />}
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 dark:text-zinc-200">{tx.item}</div>
                      <div className="font-mono text-[10px] text-slate-400">{tx.item_code || "SKU-ITEM"}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-600 dark:text-zinc-300 font-medium">{tx.warehouse}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{tx.location}</div>
                    </td>
                    <td className={`py-3 px-3 text-right font-mono tabular-nums font-bold ${tx.quantity > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-zinc-200"}`}>
                      {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity} <span className="text-[10px] font-normal text-slate-400">{tx.unit}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-zinc-400 font-medium">
                      ${tx.unit_cost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stockout Prevention & Replenishment Priority Radar */}
        <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Reorder Priority Radar
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
              4 Critical Action
            </span>
          </div>

          <div className="space-y-3">
            {/* Urgent Item 1 */}
            <div className="p-4 rounded-xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Optical Rotary Encoder 1024 PPR
                  </div>
                  <div className="font-mono text-[10px] text-slate-400 mt-0.5">ENC-OPT-1024 • Sensors & Automation</div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                  CRITICAL OUT
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full" style={{ width: "0%" }} />
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-rose-600 font-semibold font-mono">0 / 15 Min Threshold</span>
                <button
                  type="button"
                  onClick={() => handleDraftOrder("Optical Rotary Encoder 1024 PPR")}
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                >
                  Draft PO Requisition <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Urgent Item 2 */}
            <div className="p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Hydraulic Solenoid Valve 24V DC
                  </div>
                  <div className="font-mono text-[10px] text-slate-400 mt-0.5">HYD-SV-24V • Hydraulics & Valves</div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  LOW BUFFER
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: "48%" }} />
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-amber-700 dark:text-amber-400 font-semibold font-mono">12 / 25 Min (Runout: 3 Days)</span>
                <button
                  type="button"
                  onClick={() => handleDraftOrder("Hydraulic Solenoid Valve 24V DC")}
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                >
                  Draft PO Requisition <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Urgent Item 3 */}
            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-800/30 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Heavy Duty Timing Belt T10-1200
                  </div>
                  <div className="font-mono text-[10px] text-slate-400 mt-0.5">BELT-T10-1200 • Power Transmission</div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200/70 text-slate-700 dark:bg-zinc-700 dark:text-zinc-300">
                  REORDER SOON
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: "62%" }} />
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-slate-600 dark:text-zinc-400 font-medium font-mono">310 / 500 Min</span>
                <button
                  type="button"
                  onClick={() => handleDraftOrder("Heavy Duty Timing Belt T10-1200")}
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                >
                  Review Stock <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Interactive Modals */}
      <CreateProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onCreated={handleProductCreated}
      />

      <StockTransactionModal
        isOpen={isTxModalOpen}
        initialType="RECEIPT"
        onClose={() => setIsTxModalOpen(false)}
        onPosted={handleTransactionPosted}
      />
    </div>
  );
}
