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
  Activity,
  ShieldAlert,
  Flame,
  Gauge,
  Warehouse,
  RotateCcw,
  Sliders,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { fetchInventoryKPIs, fetchStockMovements, DEMO_KPIS } from "../services/api";

// ---------------------------------------------------------------------------
// High-Configuration Analytics Datasets
// ---------------------------------------------------------------------------

// Chart 1: Dual-Axis Transaction Flux (Inbound vs Outbound Bars + Net Flux Spline)
const MOVEMENT_DATA = [
  { date: "Oct 20", inbound: 420, outbound: 280, netFlux: 140, totalVolume: 700 },
  { date: "Oct 21", inbound: 310, outbound: 450, netFlux: -140, totalVolume: 760 },
  { date: "Oct 22", inbound: 580, outbound: 390, netFlux: 190, totalVolume: 970 },
  { date: "Oct 23", inbound: 240, outbound: 620, netFlux: -380, totalVolume: 860 },
  { date: "Oct 24", inbound: 750, outbound: 480, netFlux: 270, totalVolume: 1230 },
  { date: "Oct 25", inbound: 890, outbound: 530, netFlux: 360, totalVolume: 1420 },
  { date: "Oct 26", inbound: 640, outbound: 710, netFlux: -70, totalVolume: 1350 },
];

// Chart 2: Category Capital Distribution
const CATEGORY_DATA = [
  { name: "Mechanical Components", value: 38, capital: "$162,845", items: 520, color: "#3B82F6" },
  { name: "Hydraulics & Valves", value: 24, capital: "$102,850", items: 240, color: "#8B5CF6" },
  { name: "Power Transmission", value: 18, capital: "$77,137", items: 180, color: "#10B981" },
  { name: "Sensors & Encoders", value: 12, capital: "$51,425", items: 310, color: "#F59E0B" },
  { name: "Fluids & Greases", value: 8, capital: "$34,283", items: 170, color: "#EC4899" },
];

// Chart 3: Facility Capacity & Buffer Benchmark (BarChart with Reference Line)
const WAREHOUSE_CAPACITY_DATA = [
  { name: "Main Central Hub", code: "WH-MAIN", used: 78, capacity: 100, occupiedSlots: 7800, freeSlots: 2200, value: 245600, skus: 840 },
  { name: "East Coast Terminal", code: "WH-EAST", used: 64, capacity: 100, occupiedSlots: 5120, freeSlots: 2880, value: 118200, skus: 420 },
  { name: "Cold Storage Hub", code: "WH-COLD", used: 42, capacity: 100, occupiedSlots: 1680, freeSlots: 2320, value: 48940, skus: 160 },
  { name: "West Coast Terminal", code: "WH-WEST", used: 86, capacity: 100, occupiedSlots: 4320, freeSlots: 680, value: 65800, skus: 210 },
];

// Chart 4: Capital Valuation & Turnover Velocity Combo (ComposedChart with Area + Line)
const VALUATION_VELOCITY_DATA = [
  { month: "May", valuation: 340, turnover: 4.8, targetVal: 330 },
  { month: "Jun", valuation: 365, turnover: 5.1, targetVal: 350 },
  { month: "Jul", valuation: 380, turnover: 5.4, targetVal: 370 },
  { month: "Aug", valuation: 395, turnover: 5.2, targetVal: 390 },
  { month: "Sep", valuation: 412, turnover: 5.7, targetVal: 405 },
  { month: "Oct", valuation: 428.5, turnover: 6.2, targetVal: 420 },
];

// Chart 5: Stock Ageing & Depletion Tiers
const STOCK_AGING_TIERS = [
  { tier: "Fresh Stock (<30d)", percentage: 62, capital: "$265,695", skus: 880, status: "Optimal", color: "from-emerald-500 to-teal-500", text: "text-emerald-600 dark:text-emerald-400" },
  { tier: "Circulating (31-60d)", percentage: 24, capital: "$102,850", skus: 340, status: "Healthy", color: "from-blue-500 to-indigo-500", text: "text-blue-600 dark:text-blue-400" },
  { tier: "Slow Moving (61-90d)", percentage: 10, capital: "$42,854", skus: 142, status: "Review", color: "from-amber-500 to-orange-500", text: "text-amber-600 dark:text-amber-400" },
  { tier: "Stagnant / Dead (>90d)", percentage: 4, capital: "$17,141", skus: 58, status: "Action Needed", color: "from-rose-500 to-red-500", text: "text-rose-600 dark:text-rose-400" },
];

// Top Capital Concentration Items
const TOP_CAPITAL_SKUS = [
  {
    sku: "LUB-SYN-VG46",
    name: "Synthetic Compressor Lubricant ISO VG 46",
    category: "Chemicals & Fluids",
    onHand: 1200,
    unit: "LTR",
    unitCost: 18.20,
    totalVal: 21840.00,
    turnover: "5.8x / yr",
    status: "IN_STOCK",
  },
  {
    sku: "BELT-T10-1200",
    name: "Polyurethane Timing Belt T10-1200",
    category: "Power Transmission",
    onHand: 280,
    unit: "EA",
    unitCost: 32.40,
    totalVal: 9072.00,
    turnover: "7.2x / yr",
    status: "IN_STOCK",
  },
  {
    sku: "BRG-6205-2RS",
    name: "Industrial Ball Bearing 6205-2RS",
    category: "Mechanical Components",
    onHand: 450,
    unit: "EA",
    unitCost: 14.85,
    totalVal: 6682.50,
    turnover: "8.4x / yr",
    status: "IN_STOCK",
  },
  {
    sku: "HYD-SV-24V",
    name: "Hydraulic Solenoid Valve 24V DC",
    category: "Hydraulics & Pneumatics",
    onHand: 18,
    unit: "EA",
    unitCost: 128.50,
    totalVal: 2313.00,
    turnover: "11.2x / yr",
    status: "LOW_STOCK",
  },
  {
    sku: "ENC-OPT-1024",
    name: "Optical Rotary Encoder 1024 PPR",
    category: "Sensors & Automation",
    onHand: 0,
    unit: "EA",
    unitCost: 185.00,
    totalVal: 0.00,
    turnover: "14.5x / yr",
    status: "OUT_OF_STOCK",
  },
];

// FEFO Expiry Risks
const FEFO_EXPIRY_RISKS = [
  {
    batch: "LOT-2025-NOV-01",
    sku: "LUB-SYN-VG46",
    name: "Synthetic Compressor Lubricant VG46",
    expiry: "2026-11-28",
    daysLeft: 26,
    qty: 150,
    warehouse: "Main Central Hub",
    risk: "CRITICAL",
  },
  {
    batch: "LOT-2025-DEC-09",
    sku: "SEAL-VIT-40",
    name: "Hydraulic Seal Kit Viton High-Temp",
    expiry: "2026-12-15",
    daysLeft: 43,
    qty: 85,
    warehouse: "Cold Storage Facility",
    risk: "ELEVATED",
  },
  {
    batch: "LOT-2026-JAN-14",
    sku: "GRS-EP2-400G",
    name: "Industrial Bearing Grease EP2 Cartridge",
    expiry: "2027-01-20",
    daysLeft: 79,
    qty: 320,
    warehouse: "East Coast Terminal",
    risk: "MONITORED",
  },
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
      navigate("/inventory/planning/replenishment");
    }, 600);
  };

  if (!kpis) return null;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white text-xs font-semibold shadow-2xl border border-slate-700/60 animate-in slide-in-from-top-2 duration-200">
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
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/60">
                <Sparkles className="h-3 w-3 text-blue-500" />
                Live Telemetry Hub
              </span>
              <span className="text-slate-300 dark:text-zinc-700">•</span>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                4 Active Facilities Synchronized
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Executive Inventory Intelligence
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              High-configuration analytics, dual-axis movement dynamics, facility buffer controls & capital velocity.
            </p>
          </div>

          {/* Global Dashboard Filters */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-800/60 shadow-2xs text-xs text-slate-700 dark:text-zinc-300 font-medium">
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
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs hover:shadow-blue-500/25 transition-all cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 7 Core Executive KPI Cards */}
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

      {/* Row 1: High Configuration Composed Charts (Multi-Axis Ledger Flux + Portfolio Radial Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CHART 1: High-Configuration Dual-Axis ComposedChart (Inbound/Outbound Bars + Net Flux Spline) */}
        <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  Multi-Dimensional Stock Movement Flux
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60">
                  Dual-Axis Dynamic
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Bars represent throughput volume (left axis); curve traces Net Inventory Delta flux (right axis).
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Inbound
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Outbound
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" /> Net Delta
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={MOVEMENT_DATA} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="inboundBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="outboundBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818CF8" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="volume" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} domain={[0, 1000]} />
                <YAxis yAxisId="flux" orientation="right" tick={{ fontSize: 11, fill: "#10B981" }} tickLine={false} axisLine={false} domain={[-500, 500]} />
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
                  formatter={(value, name) => [
                    `${value > 0 && name === "netFlux" ? "+" : ""}${value} units`,
                    name === "inbound" ? "Receipts (Inbound)" : name === "outbound" ? "Dispatches (Outbound)" : "Net Inventory Flux",
                  ]}
                />
                <ReferenceLine yAxisId="flux" y={0} stroke="#94a3b8" strokeDasharray="3 3" opacity={0.6} />
                <Bar yAxisId="volume" dataKey="inbound" fill="url(#inboundBarGrad)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar yAxisId="volume" dataKey="outbound" fill="url(#outboundBarGrad)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Line yAxisId="flux" type="monotone" dataKey="netFlux" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: "#10B981", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6, fill: "#10B981" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 2: Portfolio Capital Allocation by Category (Donut with Segment Progress) */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Portfolio Valuation Share
              </h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Capital distribution by master category
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
              5 Sectors
            </span>
          </div>

          <div className="h-44 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={CATEGORY_DATA} innerRadius={52} outerRadius={72} paddingAngle={4} dataKey="value">
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
                  formatter={(val, name, entry) => [`${val}% (${entry.payload.capital})`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-base font-bold font-mono text-slate-900 dark:text-white">$428.5k</span>
              <span className="text-[9px] uppercase font-bold text-slate-400">Active Capital</span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
            {CATEGORY_DATA.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-slate-700 dark:text-zinc-300 truncate">{item.name}</span>
                </span>
                <div className="flex items-center gap-2 font-mono shrink-0">
                  <span className="text-slate-400 text-[11px]">{item.capital}</span>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums">{item.value}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Specialized Benchmark & Velocity Charts (Multi-Facility Benchmark + Valuation Growth + Aging Tiers) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CHART 3: Multi-Facility Space Utilization (BarChart with 80% Buffer Line) */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-indigo-500" />
                Facility Space Utilization
              </h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Current occupancy % vs 80% safety ceiling
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200/60">
              Pallet Slots
            </span>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WAREHOUSE_CAPACITY_DATA} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#e2e8f0" opacity={0.4} />
                <XAxis dataKey="code" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  cursor={{ fill: "rgba(0, 0, 0, 0.04)" }}
                  contentStyle={{
                    backgroundColor: "rgba(24, 24, 27, 0.95)",
                    borderColor: "rgba(63, 63, 70, 0.4)",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                  formatter={(val, name, entry) => [
                    `${val}% (${entry.payload.occupiedSlots.toLocaleString()} / ${(entry.payload.occupiedSlots + entry.payload.freeSlots).toLocaleString()} slots)`,
                    "Occupancy Rate",
                  ]}
                />
                <ReferenceLine y={80} stroke="#F43F5E" strokeDasharray="3 3" label={{ value: "80% Max Buffer", position: "insideTopRight", fill: "#F43F5E", fontSize: 10, fontWeight: "bold" }} />
                <Bar
                  dataKey="used"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                >
                  {WAREHOUSE_CAPACITY_DATA.map((entry, index) => (
                    <Cell
                      key={`bar-${index}`}
                      fill={entry.used > 80 ? "#F43F5E" : entry.used > 60 ? "#6366F1" : "#10B981"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800 text-[11px]">
            {WAREHOUSE_CAPACITY_DATA.map((wh) => (
              <div key={wh.code} className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-slate-700 dark:text-zinc-200 truncate">{wh.code}</span>
                  <span className={`tabular-nums font-bold ${wh.used > 80 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {wh.used}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-zinc-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      wh.used > 80 ? "bg-rose-500" : wh.used > 60 ? "bg-indigo-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${wh.used}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CHART 4: Valuation & Turnover Velocity Combo (Area + Line Dual Y-Axis) */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Capital Valuation & Turnover
              </h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Asset volume ($k) vs turnover turns/year
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60">
              6.2x Turnover
            </span>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={VALUATION_VELOCITY_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="valGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#e2e8f0" opacity={0.4} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#10B981" }} tickLine={false} axisLine={false} domain={[300, 460]} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#6366F1" }} tickLine={false} axisLine={false} domain={[4, 8]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(24, 24, 27, 0.95)",
                    borderColor: "rgba(63, 63, 70, 0.4)",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                  formatter={(val, name) => [
                    name === "valuation" ? `$${val}k USD` : `${val}x / Year`,
                    name === "valuation" ? "Total Valuation (WAV)" : "Turnover Velocity",
                  ]}
                />
                <Area yAxisId="left" type="monotone" dataKey="valuation" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#valGrad2)" />
                <Line yAxisId="right" type="monotone" dataKey="turnover" stroke="#6366F1" strokeWidth={2.5} dot={{ r: 4, fill: "#6366F1", stroke: "#fff" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Latest Portfolio Value</span>
              <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">$428,540.00</div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Annual Turnover</span>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">6.2x / Year</div>
            </div>
          </div>
        </div>

        {/* CHART 5: Inventory Ageing Lifecycle & Capital Exposure Tiers */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Gauge className="h-4 w-4 text-purple-500" />
                Stock Aging & Depletion Tiers
              </h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Capital exposure categorized by shelf-life duration
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200/60">
              86% Healthy
            </span>
          </div>

          {/* Segmented Tier Progress Stack */}
          <div className="space-y-3 pt-1">
            {STOCK_AGING_TIERS.map((tier) => (
              <div key={tier.tier} className="p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-800 dark:text-zinc-200">{tier.tier}</span>
                  <span className={`font-mono font-bold ${tier.text}`}>{tier.percentage}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${tier.color}`} style={{ width: `${tier.percentage}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{tier.skus} SKUs in circulation</span>
                  <span className="font-mono font-medium text-slate-600 dark:text-zinc-300">{tier.capital}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Multi-Facility Real-Time Stock Balance Matrix */}
      <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                Multi-Facility Stock Balances & Operational Matrix
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60">
                Live Physical Sync
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
              Instant balance audit by facility with bin capacity, active SKUs, and inventory assets.
            </p>
          </div>
          <Link
            to="/inventory/warehouses"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            Manage Facilities <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                <th className="pb-3 font-semibold">Warehouse Hub</th>
                <th className="pb-3 font-semibold">Code</th>
                <th className="pb-3 font-semibold text-right">Active SKUs</th>
                <th className="pb-3 font-semibold text-right">Occupied Slots</th>
                <th className="pb-3 font-semibold text-right">Free Slots</th>
                <th className="pb-3 font-semibold">Capacity Bar</th>
                <th className="pb-3 font-semibold text-right">Stock Valuation</th>
                <th className="pb-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {WAREHOUSE_CAPACITY_DATA.map((wh) => (
                <tr key={wh.code} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3.5 font-semibold text-slate-900 dark:text-white">
                    {wh.name}
                  </td>
                  <td className="py-3.5">
                    <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60">
                      {wh.code}
                    </span>
                  </td>
                  <td className="py-3.5 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300 font-semibold">
                    {wh.skus} items
                  </td>
                  <td className="py-3.5 text-right font-mono tabular-nums text-slate-900 dark:text-white font-bold">
                    {wh.occupiedSlots.toLocaleString()}
                  </td>
                  <td className="py-3.5 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                    {wh.freeSlots.toLocaleString()}
                  </td>
                  <td className="py-3.5 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            wh.used > 80 ? "bg-rose-500" : wh.used > 60 ? "bg-indigo-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${wh.used}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold font-mono text-slate-600 dark:text-zinc-400 shrink-0">
                        {wh.used}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    ${wh.value.toLocaleString()}
                  </td>
                  <td className="py-3.5 text-center">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 4: Top Capital Concentration SKUs & FEFO Expiry Risk Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 5 Capital Concentration SKUs */}
        <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                Top Capital Concentration Items
              </h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Highest value inventory assets ranked by moving weighted valuation
              </p>
            </div>
            <Link
              to="/inventory/products"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 cursor-pointer"
            >
              Full Catalog <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  <th className="pb-3 font-semibold">Product SKU & Title</th>
                  <th className="pb-3 font-semibold">Category</th>
                  <th className="pb-3 font-semibold text-right">Physical On-Hand</th>
                  <th className="pb-3 font-semibold text-right">Unit WAV</th>
                  <th className="pb-3 font-semibold text-right">Total Asset Value</th>
                  <th className="pb-3 font-semibold text-center">Velocity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {TOP_CAPITAL_SKUS.map((item) => (
                  <tr key={item.sku} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{item.name}</div>
                      <div className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">{item.sku}</div>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-zinc-400 font-medium">
                      {item.category}
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {item.onHand.toLocaleString()} <span className="text-[10px] text-slate-400">{item.unit}</span>
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums text-slate-600 dark:text-zinc-400">
                      ${item.unitCost.toFixed(2)}
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                      ${item.totalVal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        {item.turnover}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FEFO Expiry Risk & Shelf Life Alerts */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-500" />
              FEFO Expiry Warnings
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60">
              3 Lots Impending
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-zinc-500">
            Batches reaching shelf-life horizon within active fulfillment zones.
          </p>

          <div className="space-y-3">
            {FEFO_EXPIRY_RISKS.map((lot) => (
              <div
                key={lot.batch}
                className="p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 space-y-2 hover:border-slate-300 dark:hover:border-zinc-700 transition-all"
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{lot.batch}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      lot.risk === "CRITICAL"
                        ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/60"
                    }`}
                  >
                    {lot.daysLeft} days left
                  </span>
                </div>
                <div className="text-xs font-medium text-slate-900 dark:text-white truncate">
                  {lot.name}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{lot.warehouse}</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-zinc-300 tabular-nums">{lot.qty} Units</span>
                </div>
              </div>
            ))}
          </div>

          <Link
            to="/inventory/control/batches"
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
          >
            <span>View All Monitored Batches</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Row 5: Operational Recent Movements Table & Low Stock Alerts */}
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
              to="/inventory/control/ledger"
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
