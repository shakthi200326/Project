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
  SlidersHorizontal,
  ArrowLeftRight,
  PackageCheck,
  AlertOctagon,
  Check,
  X,
  Filter,
  RefreshCw,
  Send,
  Tag,
  Bookmark,
  Truck,
  ShieldCheck,
  Radio,
  FileCheck2,
  Zap,
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
import {
  fetchInventoryKPIs,
  fetchStockMovements,
  approveStockTransaction,
  rejectStockTransaction,
  DEMO_KPIS,
} from "../services/api";

// ---------------------------------------------------------------------------
// High-Configuration Datasets & Benchmarks
// ---------------------------------------------------------------------------

// Chart 1: Dual-Axis Transaction Flux (Inbound vs Outbound Bars + Net Flux Spline)
const MOVEMENT_DATA_SERIES = {
  "7d": [
    { date: "Day 1", inbound: 320, outbound: 210, netFlux: 110, totalVolume: 530 },
    { date: "Day 2", inbound: 450, outbound: 380, netFlux: 70, totalVolume: 830 },
    { date: "Day 3", inbound: 290, outbound: 420, netFlux: -130, totalVolume: 710 },
    { date: "Day 4", inbound: 510, outbound: 340, netFlux: 170, totalVolume: 850 },
    { date: "Day 5", inbound: 680, outbound: 520, netFlux: 160, totalVolume: 1200 },
    { date: "Day 6", inbound: 740, outbound: 490, netFlux: 250, totalVolume: 1230 },
    { date: "Day 7", inbound: 590, outbound: 620, netFlux: -30, totalVolume: 1210 },
  ],
  "30d": [
    { date: "Oct 20", inbound: 420, outbound: 280, netFlux: 140, totalVolume: 700 },
    { date: "Oct 21", inbound: 310, outbound: 450, netFlux: -140, totalVolume: 760 },
    { date: "Oct 22", inbound: 580, outbound: 390, netFlux: 190, totalVolume: 970 },
    { date: "Oct 23", inbound: 240, outbound: 620, netFlux: -380, totalVolume: 860 },
    { date: "Oct 24", inbound: 750, outbound: 480, netFlux: 270, totalVolume: 1230 },
    { date: "Oct 25", inbound: 890, outbound: 530, netFlux: 360, totalVolume: 1420 },
    { date: "Oct 26", inbound: 640, outbound: 710, netFlux: -70, totalVolume: 1350 },
  ],
  "90d": [
    { date: "Aug W1", inbound: 1850, outbound: 1600, netFlux: 250, totalVolume: 3450 },
    { date: "Aug W3", inbound: 2100, outbound: 1950, netFlux: 150, totalVolume: 4050 },
    { date: "Sep W1", inbound: 2400, outbound: 2100, netFlux: 300, totalVolume: 4500 },
    { date: "Sep W3", inbound: 1900, outbound: 2300, netFlux: -400, totalVolume: 4200 },
    { date: "Oct W1", inbound: 2800, outbound: 2200, netFlux: 600, totalVolume: 5000 },
    { date: "Oct W3", inbound: 2600, outbound: 2550, netFlux: 50, totalVolume: 5150 },
  ],
  ytd: [
    { date: "Q1", inbound: 12400, outbound: 10800, netFlux: 1600, totalVolume: 23200 },
    { date: "Q2", inbound: 14800, outbound: 13900, netFlux: 900, totalVolume: 28700 },
    { date: "Q3", inbound: 16200, outbound: 15100, netFlux: 1100, totalVolume: 31300 },
    { date: "Q4 (Est)", inbound: 18500, outbound: 16800, netFlux: 1700, totalVolume: 35300 },
  ],
};

// Chart 2: Category Capital Distribution
const DEFAULT_CATEGORY_DATA = [
  { name: "Mechanical Components", value: 38, capital: "$162,845", items: 520, color: "#3B82F6" },
  { name: "Hydraulics & Valves", value: 24, capital: "$102,850", items: 240, color: "#8B5CF6" },
  { name: "Power Transmission", value: 18, capital: "$77,137", items: 180, color: "#10B981" },
  { name: "Sensors & Encoders", value: 12, capital: "$51,425", items: 310, color: "#F59E0B" },
  { name: "Fluids & Greases", value: 8, capital: "$34,283", items: 170, color: "#EC4899" },
];

// Facility Capacity Matrix
const DEFAULT_WAREHOUSE_DATA = [
  { id: 1, name: "Main Central Hub", code: "WH-MAIN", used: 78, capacity: 100, occupiedSlots: 7800, freeSlots: 2200, value: 245600, skus: 840, status: "Active" },
  { id: 2, name: "East Coast Terminal", code: "WH-EAST", used: 64, capacity: 100, occupiedSlots: 5120, freeSlots: 2880, value: 118200, skus: 420, status: "Active" },
  { id: 3, name: "Cold Storage Hub", code: "WH-COLD", used: 42, capacity: 100, occupiedSlots: 1680, freeSlots: 2320, value: 48940, skus: 160, status: "Active" },
  { id: 4, name: "West Coast Terminal", code: "WH-WEST", used: 86, capacity: 100, occupiedSlots: 4320, freeSlots: 680, value: 65800, skus: 210, status: "Active" },
];

// Fallback Low Stock Items
const DEFAULT_LOW_STOCK = [
  { id: 101, sku: "HYD-SV-24V", name: "Hydraulic Solenoid Valve 24V DC", category: "Hydraulics & Pneumatics", on_hand: 12, unit: "EA", reorder_point: 25, suggested_reorder: 40 },
  { id: 102, sku: "SEAL-VIT-40", name: "Hydraulic Seal Kit Viton High-Temp", category: "Hydraulics & Pneumatics", on_hand: 18, unit: "KIT", reorder_point: 30, suggested_reorder: 50 },
  { id: 103, sku: "BRG-6205-2RS", name: "Industrial Ball Bearing 6205-2RS", category: "Mechanical Components", on_hand: 35, unit: "EA", reorder_point: 60, suggested_reorder: 100 },
  { id: 104, sku: "BELT-T10-1200", name: "Polyurethane Timing Belt T10-1200", category: "Power Transmission", on_hand: 8, unit: "EA", reorder_point: 20, suggested_reorder: 30 },
];

// Fallback Out of Stock Items
const DEFAULT_OUT_OF_STOCK = [
  { id: 201, sku: "ENC-OPT-1024", name: "Optical Rotary Encoder 1024 PPR", category: "Sensors & Automation", on_hand: 0, unit: "EA", reorder_point: 15, supplier: "Omron Automation" },
  { id: 202, sku: "PMP-GR-100", name: "High Pressure Gear Pump 100 BAR", category: "Hydraulics & Pneumatics", on_hand: 0, unit: "EA", reorder_point: 10, supplier: "Rexroth Bosch" },
  { id: 203, sku: "VLV-CHK-050", name: "Stainless Steel Check Valve 1/2 inch", category: "Valves & Fittings", on_hand: 0, unit: "EA", reorder_point: 25, supplier: "Swagelok Supply" },
  { id: 204, sku: "BRG-LIN-25", name: "Linear Ball Bushing Bearing 25mm", category: "Mechanical Components", on_hand: 0, unit: "EA", reorder_point: 20, supplier: "THK Motion Corp" },
];

// Fallback Pending Approvals Queue
const DEFAULT_PENDING_APPROVALS = [
  { id: 901, document_number: "GRN-2026-0092", transaction_type: "RECEIPT", status: "SUBMITTED", warehouse_name: "Main Central Hub", dest_warehouse_name: null, lines_count: 3, estimated_value: 4820.00, requester: "sarah.chen", date: "2026-10-26" },
  { id: 902, document_number: "TRF-2026-0024", transaction_type: "TRANSFER", status: "SUBMITTED", warehouse_name: "Main Central Hub", dest_warehouse_name: "East Coast Terminal", lines_count: 5, estimated_value: 8450.00, requester: "alex.morgan", date: "2026-10-26" },
  { id: 903, document_number: "ADJ-2026-0012", transaction_type: "ADJUSTMENT", status: "SUBMITTED", warehouse_name: "Cold Storage Hub", dest_warehouse_name: null, lines_count: 1, estimated_value: 980.00, requester: "elena.rostova", date: "2026-10-25" },
];

// Fallback Inventory Alerts
const DEFAULT_ALERTS = [
  { id: "alert-1", severity: "CRITICAL", category: "FEFO Expiry", title: "Batch LOT-2025-NOV-01 Expiring Soon", description: "150 LTR Synthetic Lubricant expiring in 26 days at Main Hub.", timestamp: "2h ago", action_url: "/inventory/control/batches" },
  { id: "alert-2", severity: "HIGH", category: "Stockout Warning", title: "Zero Stock: Optical Rotary Encoder 1024", description: "Production buffer depleted. Reorder target: 15 EA.", timestamp: "4h ago", action_url: "/inventory/planning/replenishment" },
  { id: "alert-3", severity: "MEDIUM", category: "Quality Quarantine", title: "Hydraulic Seals Held in Quarantine", description: "85 Units pending QA physical clearance at Vault Q1.", timestamp: "1d ago", action_url: "/inventory/control/batches" },
  { id: "alert-4", severity: "INFO", category: "Buffer Safety", title: "West Coast Terminal Near Max Capacity", description: "Facility occupancy reached 86% (above 80% safety ceiling).", timestamp: "2d ago", action_url: "/inventory/warehouses" },
];

const formatCurrency = (val) => {
  if (val === null || val === undefined || isNaN(val)) return "$0.00";
  return `$${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(DEMO_KPIS);
  const [recentMovements, setRecentMovements] = useState([]);
  const [period, setPeriod] = useState("30d");
  const [pendingApprovals, setPendingApprovals] = useState(DEFAULT_PENDING_APPROVALS);
  const [processingId, setProcessingId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchInventoryKPIs();
      if (data) {
        setKpis(data);
        if (data.pending_approvals && data.pending_approvals.length > 0) {
          setPendingApprovals(data.pending_approvals);
        }
      }
      const movementsData = await fetchStockMovements();
      if (movementsData && (movementsData.results || Array.isArray(movementsData))) {
        const list = movementsData.results || movementsData;
        if (list.length > 0) setRecentMovements(list.slice(0, 7));
      }
    } catch (e) {
      console.error("Dashboard data load error:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleApprove = async (txId, docNum) => {
    setProcessingId(txId);
    try {
      await approveStockTransaction(txId);
      setPendingApprovals((prev) =>
        prev.map((item) => (item.id === txId ? { ...item, status: "APPROVED" } : item))
      );
      showToast(`Transaction ${docNum} successfully approved.`);
    } catch (e) {
      showToast(`Failed to approve ${docNum}.`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (txId, docNum) => {
    setProcessingId(txId);
    try {
      await rejectStockTransaction(txId);
      setPendingApprovals((prev) =>
        prev.map((item) => (item.id === txId ? { ...item, status: "REJECTED" } : item))
      );
      showToast(`Transaction ${docNum} has been rejected.`);
    } catch (e) {
      showToast(`Failed to reject ${docNum}.`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDraftOrder = (itemName) => {
    showToast(`Initiating draft procurement requisition for ${itemName}...`);
    setTimeout(() => {
      navigate("/inventory/planning/replenishment");
    }, 600);
  };

  const handleExportSummary = () => {
    const headers = ["Metric Section", "Key", "Value", "Scope / Details"];
    const rows = [
      ["01. Inventory Overview", "Total SKUs", kpis?.inventory_overview?.total_products || kpis?.total_products || 1420, "Catalog Items"],
      ["01. Inventory Overview", "Active SKUs", kpis?.inventory_overview?.active_products || 1398, "Live Catalog Items"],
      ["01. Inventory Overview", "Categories", kpis?.inventory_overview?.total_categories || 12, "Taxonomy Groups"],
      ["01. Inventory Overview", "Brands", kpis?.inventory_overview?.total_brands || 8, "Manufacturers"],
      ["01. Inventory Overview", "Warehouses", kpis?.inventory_overview?.total_warehouses || kpis?.total_warehouses || 4, "Physical Hubs"],
      ["02. Stock Summary", "Total On-Hand", kpis?.stock_summary?.total_on_hand || kpis?.total_on_hand || 51660, "Units"],
      ["02. Stock Summary", "Total Available", kpis?.stock_summary?.total_available || kpis?.total_available || 48210, "Units Free for Dispatch"],
      ["02. Stock Summary", "Total Reserved", kpis?.stock_summary?.total_reserved || kpis?.total_reserved || 3450, "Units Allocated"],
      ["02. Stock Summary", "Total In-Transit", kpis?.stock_summary?.total_in_transit || 1250, "Units in Transit"],
      ["03. Stock Valuation", "Total Asset Value", `$${kpis?.stock_valuation_summary?.total_stock_value || kpis?.total_stock_value || 428540}`, "USD (WAV Method)"],
      ["04. Low Stock", "Items Near/Below Reorder", kpis?.low_stock_overview?.count || kpis?.low_stock_items || 18, "Requires Reorder"],
      ["05. Out of Stock", "Depleted Items", kpis?.out_of_stock_overview?.count || kpis?.out_of_stock_items || 4, "Stockout"],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Inventory_Executive_Dashboard_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Executive dashboard summary exported as CSV.");
  };

  // Structured KPI extraction with graceful fallbacks
  const inventoryOverview = kpis.inventory_overview || {
    total_products: kpis.total_products || 1420,
    active_products: 1398,
    total_categories: 12,
    total_brands: 8,
    total_warehouses: kpis.total_warehouses || 4,
    total_units: 6,
    catalog_health: "98.5%",
  };

  const stockSummary = kpis.stock_summary || {
    total_on_hand: kpis.total_on_hand || 51660,
    total_available: kpis.total_available || 48210,
    total_reserved: kpis.total_reserved || 3450,
    total_blocked: 0,
    total_in_transit: 1250,
  };

  const stockValuation = kpis.stock_valuation_summary || {
    total_stock_value: kpis.total_stock_value || 428540.0,
    base_currency: "USD",
    valuation_method: "Weighted Average (WAV)",
    avg_item_value: 301.79,
    turnover_velocity: "6.2x / yr",
    category_distribution: DEFAULT_CATEGORY_DATA,
  };

  const lowStockOverview = kpis.low_stock_overview || {
    count: kpis.low_stock_items || 18,
    critical_count: 4,
    items: DEFAULT_LOW_STOCK,
  };

  const outOfStockOverview = kpis.out_of_stock_overview || {
    count: kpis.out_of_stock_items || 4,
    stockout_rate_pct: 0.28,
    items: DEFAULT_OUT_OF_STOCK,
  };

  const movementAnalytics = kpis.stock_movement_analytics || {
    period: period,
    total_inbound: 3830,
    total_outbound: 3460,
    net_flux: 370,
    turnover_rate: "6.2x",
    flux_series: MOVEMENT_DATA_SERIES[period] || MOVEMENT_DATA_SERIES["30d"],
  };

  const warehouseWiseStock = (kpis.warehouse_wise_stock && kpis.warehouse_wise_stock.length > 0)
    ? kpis.warehouse_wise_stock
    : DEFAULT_WAREHOUSE_DATA;

  const activities = (recentMovements && recentMovements.length > 0)
    ? recentMovements
    : (kpis.recent_activities && kpis.recent_activities.length > 0)
    ? kpis.recent_activities
    : [];

  const alerts = (kpis.inventory_alerts && kpis.inventory_alerts.length > 0)
    ? kpis.inventory_alerts
    : DEFAULT_ALERTS;

  return (
    <div className="space-y-8 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white text-xs font-semibold shadow-2xl border border-slate-700/60 animate-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Page Header & Dashboard Controls */}
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
                PostgreSQL 16 Event-Driven Architecture
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              01. Executive Inventory Dashboard
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Comprehensive inventory overview, stock summaries, valuation velocity, analytics, pending approvals & alerts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadData}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-800/60 shadow-2xs text-xs text-slate-700 dark:text-zinc-300 font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${isRefreshing ? "animate-spin text-blue-500" : ""}`} />
              <span>Refresh</span>
            </button>

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

      {/* ========================================================================= */}
      {/* 01. INVENTORY OVERVIEW                                                    */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-1.5 rounded-full bg-blue-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Boxes className="h-4 w-4 text-blue-600" />
              01. Inventory Overview
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
            Catalog & Master Data Infrastructure
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total SKUs */}
          <Link
            to="/inventory/products"
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-3.5 shadow-xs hover:shadow-md hover:border-blue-400 dark:hover:border-blue-700 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total SKUs</span>
              <Boxes className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {(inventoryOverview.total_products || 0).toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span>{inventoryOverview.active_products || 1398} Active</span>
            </div>
          </Link>

          {/* Categories */}
          <Link
            to="/inventory/categories"
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-3.5 shadow-xs hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-700 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider">Categories</span>
              <Layers className="h-4 w-4 text-indigo-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {(inventoryOverview.total_categories || 0).toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
              Across 5 sectors
            </div>
          </Link>

          {/* Brands */}
          <Link
            to="/inventory/brands"
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-3.5 shadow-xs hover:shadow-md hover:border-purple-400 dark:hover:border-purple-700 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider">Brands</span>
              <Tag className="h-4 w-4 text-purple-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {(inventoryOverview.total_brands || 0).toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
              Registered OEM brands
            </div>
          </Link>

          {/* Warehouses */}
          <Link
            to="/inventory/warehouses"
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-3.5 shadow-xs hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-700 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider">Warehouses</span>
              <Warehouse className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {(inventoryOverview.total_warehouses || 0).toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              4 Regional Hubs
            </div>
          </Link>

          {/* Units of Measure */}
          <Link
            to="/inventory/units"
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-3.5 shadow-xs hover:shadow-md hover:border-amber-400 dark:hover:border-amber-700 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider">Units (UOM)</span>
              <Bookmark className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {(inventoryOverview.total_units || 6).toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
              EA, LTR, KG, MTR, KIT
            </div>
          </Link>

          {/* Catalog Health */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider">Catalog Health</span>
              <ShieldCheck className="h-4 w-4 text-teal-500" />
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight tabular-nums text-teal-600 dark:text-teal-400">
              {inventoryOverview.catalog_health || "98.5%"}
            </div>
            <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
              Barcode & Tag coverage
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 02. STOCK SUMMARY                                                         */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-1.5 rounded-full bg-indigo-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              02. Stock Summary
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
            Real-Time Physical & Available Stock Balances
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Total On-Hand */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-4 shadow-xs">
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total On-Hand</span>
              <Boxes className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {(stockSummary.total_on_hand || 0).toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
              Physical units in hubs
            </div>
          </div>

          {/* Available */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-4 shadow-xs">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider">Available Stock</span>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
              {(stockSummary.total_available || 0).toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Free for immediate dispatch
            </div>
          </div>

          {/* Reserved */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-4 shadow-xs">
            <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500" />
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider">Reserved Stock</span>
              <Clock className="h-4 w-4 text-purple-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-purple-600 dark:text-purple-400">
              {(stockSummary.total_reserved || 0).toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-purple-600 dark:text-purple-400 font-medium">
              Allocated to confirmed sales
            </div>
          </div>

          {/* Blocked / Quarantined */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-4 shadow-xs">
            <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider">Blocked / Hold</span>
              <ShieldAlert className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-rose-600 dark:text-rose-400">
              {(stockSummary.total_blocked || 0).toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
              Quality hold or damaged
            </div>
          </div>

          {/* In-Transit */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-4 shadow-xs">
            <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500" />
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider">In-Transit</span>
              <Truck className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-indigo-600 dark:text-indigo-400">
              {(stockSummary.total_in_transit || 0).toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
              Inter-facility transfers
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 03. STOCK VALUATION SUMMARY                                               */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-1.5 rounded-full bg-emerald-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              03. Stock Valuation Summary
            </h2>
          </div>
          <Link
            to="/inventory/valuation"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 cursor-pointer"
          >
            Detailed Ledger Valuation <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Capital Metrics Card */}
          <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Total Inventory Valuation
              </span>
              <div className="mt-1 text-3xl font-extrabold font-mono tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(stockValuation.total_stock_value)}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Calculated using {stockValuation.valuation_method || "Moving Weighted Average (WAV)"} standard in {stockValuation.base_currency || "USD"}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Avg Item Value</span>
                <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums font-mono mt-0.5">
                  ${(stockValuation.avg_item_value || 301.79).toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-400">Per SKU capital</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Turnover Velocity</span>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono mt-0.5">
                  {stockValuation.turnover_velocity || "6.2x / yr"}
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Optimal turnover</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-300 flex items-center justify-between">
              <span className="font-semibold">Fiscal Valuation Status</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                Reconciled
              </span>
            </div>
          </div>

          {/* Category Capital Donut Chart */}
          <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Category Capital Allocation
                </h3>
                <p className="text-xs text-slate-400 dark:text-zinc-500">
                  Inventory capital exposure distributed across product categories
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                {DEFAULT_CATEGORY_DATA.length} Sectors
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div className="h-48 w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={DEFAULT_CATEGORY_DATA}
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                      isAnimationActive={false}
                    >
                      {DEFAULT_CATEGORY_DATA.map((entry, index) => (
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
                      formatter={(val, name, entry) => [
                        `${val}% (${entry?.payload?.capital || ""})`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    $428.5k
                  </span>
                  <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-zinc-500">
                    Active Capital
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                {DEFAULT_CATEGORY_DATA.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between gap-2 text-slate-600 dark:text-zinc-400">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="font-medium text-slate-700 dark:text-zinc-300 truncate">{cat.name}</span>
                    </span>
                    <div className="flex items-center gap-2 font-mono shrink-0">
                      <span className="text-slate-400 text-[11px]">{cat.capital}</span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">{cat.value}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 04. LOW STOCK OVERVIEW & 05. OUT OF STOCK OVERVIEW                       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 04. LOW STOCK OVERVIEW */}
        <section className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1.5 rounded-full bg-amber-500" />
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  04. Low Stock Overview
                </h2>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                  Products reaching minimum safety reorder thresholds
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
              {lowStockOverview.count} SKUs Below Threshold
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  <th className="pl-0 pr-3 pb-2.5 font-semibold">Product SKU & Name</th>
                  <th className="px-2 pb-2.5 font-semibold text-right">On-Hand</th>
                  <th className="px-2 pb-2.5 font-semibold text-right">Min Buffer</th>
                  <th className="pl-2 pr-0 pb-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {lowStockOverview.items.map((item) => (
                  <tr key={item.sku} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="pl-0 pr-3 py-2.5">
                      <div className="font-semibold text-slate-900 dark:text-white">{item.name}</div>
                      <div className="font-mono text-[11px] text-amber-600 dark:text-amber-400 font-semibold">{item.sku}</div>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400">
                      {item.on_hand} {item.unit}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-slate-500 dark:text-zinc-400">
                      {item.reorder_point} {item.unit}
                    </td>
                    <td className="pl-2 pr-0 py-2.5 text-right">
                      <button
                        onClick={() => handleDraftOrder(item.name)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[11px] shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>Reorder</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Link
            to="/inventory/planning/replenishment"
            className="pt-2 text-xs font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1 border-t border-slate-100 dark:border-zinc-800 cursor-pointer"
          >
            <span>View Replenishment Planning Engine</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        {/* 05. OUT OF STOCK OVERVIEW */}
        <section className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1.5 rounded-full bg-rose-600" />
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-rose-600" />
                  05. Out of Stock Overview
                </h2>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                  Critical zero-inventory balance items requiring rapid procurement
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
              {outOfStockOverview.count} Depleted (Stockout: {outOfStockOverview.stockout_rate_pct}%)
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  <th className="pl-0 pr-3 pb-2.5 font-semibold">Zero-Stock SKU</th>
                  <th className="px-2 pb-2.5 font-semibold">Vendor / Category</th>
                  <th className="px-2 pb-2.5 font-semibold text-right">Min Target</th>
                  <th className="pl-2 pr-0 pb-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {outOfStockOverview.items.map((item) => (
                  <tr key={item.sku} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="pl-0 pr-3 py-2.5">
                      <div className="font-semibold text-slate-900 dark:text-white">{item.name}</div>
                      <div className="font-mono text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{item.sku}</div>
                    </td>
                    <td className="px-2 py-2.5 text-slate-600 dark:text-zinc-400">
                      <div>{item.supplier || "Catalog Vendor"}</div>
                      <div className="text-[10px] text-slate-400">{item.category}</div>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono font-bold tabular-nums text-rose-600 dark:text-rose-400">
                      0 / {item.reorder_point} {item.unit}
                    </td>
                    <td className="pl-2 pr-0 py-2.5 text-right">
                      <button
                        onClick={() => handleDraftOrder(item.name)}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <Zap className="h-3 w-3" />
                        <span>Restock</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Link
            to="/inventory/planning/purchase-suggestions"
            className="pt-2 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center justify-center gap-1 border-t border-slate-100 dark:border-zinc-800 cursor-pointer"
          >
            <span>View Automated Purchase Suggestions</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* 06. STOCK MOVEMENT ANALYTICS                                              */}
      {/* ========================================================================= */}
      <section className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1.5 rounded-full bg-blue-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" />
                06. Stock Movement Analytics
              </h2>
            </div>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
              Dual-axis throughput analytics: Inbound receipts vs Outbound dispatches with Net Inventory Delta flux
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 shrink-0 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Inbound (+{movementAnalytics.total_inbound})
            </span>
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
              <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Outbound (-{movementAnalytics.total_outbound})
            </span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" /> Net Delta ({movementAnalytics.net_flux > 0 ? `+${movementAnalytics.net_flux}` : movementAnalytics.net_flux})
            </span>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={MOVEMENT_DATA_SERIES[period] || MOVEMENT_DATA_SERIES["30d"]}
              margin={{ top: 10, right: 15, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818CF8" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#e2e8f0" opacity={0.5} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="vol" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="flux" orientation="right" tick={{ fontSize: 11, fill: "#10B981" }} tickLine={false} axisLine={false} />
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
              <Bar yAxisId="vol" dataKey="inbound" fill="url(#inboundGrad)" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
              <Bar yAxisId="vol" dataKey="outbound" fill="url(#outboundGrad)" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
              <Line yAxisId="flux" type="monotone" dataKey="netFlux" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: "#10B981", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6, fill: "#10B981" }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 07. WAREHOUSE-WISE STOCK                                                  */}
      {/* ========================================================================= */}
      <section className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-1.5 rounded-full bg-indigo-600" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-indigo-600" />
                07. Warehouse-wise Stock
              </h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Physical inventory balances, bin occupancy rates, and safety buffer tracking per hub
              </p>
            </div>
          </div>
          <Link
            to="/inventory/warehouses"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 cursor-pointer"
          >
            Manage Facilities <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                <th className="pl-0 pr-3 pb-3 font-semibold">Warehouse Hub</th>
                <th className="px-3 pb-3 font-semibold">Code</th>
                <th className="px-3 pb-3 font-semibold text-right">Active SKUs</th>
                <th className="px-3 pb-3 font-semibold text-right">Occupied Slots</th>
                <th className="px-3 pb-3 font-semibold text-right">Free Slots</th>
                <th className="px-3 pb-3 font-semibold">Capacity Bar (80% Ceiling)</th>
                <th className="px-3 pb-3 font-semibold text-right">Stock Valuation</th>
                <th className="pl-3 pr-0 pb-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {warehouseWiseStock.map((wh) => (
                <tr key={wh.code} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="pl-0 pr-3 py-3.5 font-semibold text-slate-900 dark:text-white">
                    {wh.name}
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50">
                      {wh.code}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300 font-semibold">
                    {wh.skus || 840} items
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono tabular-nums text-slate-900 dark:text-white font-bold">
                    {(wh.occupiedSlots || 7800).toLocaleString()}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                    {(wh.freeSlots || 2200).toLocaleString()}
                  </td>
                  <td className="px-3 py-3.5 min-w-[150px]">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full ${
                            wh.used > 80 ? "bg-rose-500" : wh.used > 60 ? "bg-indigo-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${wh.used}%` }}
                        />
                      </div>
                      <span className={`text-[11px] font-bold font-mono tabular-nums shrink-0 ${
                        wh.used > 80 ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-zinc-400"
                      }`}>
                        {wh.used}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    ${(wh.value || 245600).toLocaleString()}
                  </td>
                  <td className="pl-3 pr-0 py-3.5 text-center">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Active Hub
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 08. RECENT ACTIVITIES & 09. PENDING APPROVALS                             */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 08. RECENT ACTIVITIES */}
        <section className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1.5 rounded-full bg-teal-600" />
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-teal-600" />
                  08. Recent Activities
                </h2>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                  Immutable stock movement transactions recorded on ledger
                </p>
              </div>
            </div>
            <Link
              to="/inventory/control/ledger"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 cursor-pointer"
            >
              Full Ledger <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  <th className="pl-0 pr-2 pb-2.5 font-semibold">Document #</th>
                  <th className="px-2 pb-2.5 font-semibold">Type</th>
                  <th className="px-2 pb-2.5 font-semibold">Item & Location</th>
                  <th className="pl-2 pr-0 pb-2.5 font-semibold text-right">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {activities.map((tx) => {
                  const txType = String(tx.type || tx.movement_type || tx.transaction_type || "RECEIPT").toUpperCase();
                  const rawQty = Number(tx.quantity !== undefined ? tx.quantity : 10);
                  const isPositive = txType === "RECEIPT" || rawQty > 0;
                  return (
                    <tr key={tx.id || tx.document_number} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="pl-0 pr-2 py-2.5 font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                        {tx.document_number || `DOC-${tx.id}`}
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          txType === "RECEIPT"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200"
                            : txType === "ISSUE"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200"
                            : txType === "TRANSFER"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 border border-blue-200"
                            : "bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-400 border border-purple-200"
                        }`}>
                          {txType}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[180px]">
                          {tx.item_name || tx.item || "Industrial Component"}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                          {tx.location || "Main Hub"}
                        </div>
                      </td>
                      <td className={`pl-2 pr-0 py-2.5 text-right font-mono font-bold tabular-nums ${
                        isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}>
                        {isPositive ? `+${Math.abs(rawQty)}` : `-${Math.abs(rawQty)}`} {tx.unit || "EA"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 09. PENDING APPROVALS */}
        <section className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1.5 rounded-full bg-purple-600" />
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-purple-600" />
                  09. Pending Approvals
                </h2>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                  Transactions submitted for manager sign-off before posting
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50">
              {pendingApprovals.filter((t) => t.status !== "APPROVED" && t.status !== "REJECTED").length} Awaiting
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  <th className="pl-0 pr-2 pb-2.5 font-semibold">Document & Type</th>
                  <th className="px-2 pb-2.5 font-semibold">Facility / Value</th>
                  <th className="px-2 pb-2.5 font-semibold">Status</th>
                  <th className="pl-2 pr-0 pb-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {pendingApprovals.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="pl-0 pr-2 py-2.5">
                      <div className="font-mono font-bold text-blue-600 dark:text-blue-400">{tx.document_number}</div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">{tx.transaction_type} • {tx.requester}</div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="text-slate-800 dark:text-zinc-200 font-medium">
                        {tx.warehouse_name} {tx.dest_warehouse_name ? `→ ${tx.dest_warehouse_name}` : ""}
                      </div>
                      <div className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        ${(tx.estimated_value || 1200).toLocaleString()} ({tx.lines_count || 1} lines)
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tx.status === "APPROVED"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200"
                          : tx.status === "REJECTED"
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-200"
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="pl-2 pr-0 py-2.5 text-right">
                      {tx.status === "APPROVED" ? (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-end gap-1">
                          <Check className="h-3.5 w-3.5" /> Approved
                        </span>
                      ) : tx.status === "REJECTED" ? (
                        <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold flex items-center justify-end gap-1">
                          <X className="h-3.5 w-3.5" /> Rejected
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleApprove(tx.id, tx.document_number)}
                            disabled={processingId === tx.id}
                            className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                            title="Approve Transaction"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleReject(tx.id, tx.document_number)}
                            disabled={processingId === tx.id}
                            className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                            title="Reject Transaction"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Link
            to="/inventory/transactions"
            className="pt-2 text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center justify-center gap-1 border-t border-slate-100 dark:border-zinc-800 cursor-pointer"
          >
            <span>View All Stock Transactions</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* 10. INVENTORY ALERTS                                                      */}
      {/* ========================================================================= */}
      <section className="p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-1.5 rounded-full bg-rose-600" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-rose-600" />
                10. Inventory Alerts
              </h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Centralized telemetry: FEFO batch expiration risks, quarantined holds, buffer ceilings, and integration DLQ
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/inventory/control/batches"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 cursor-pointer"
            >
              FEFO Batch Manager <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all hover:shadow-sm ${
                alert.severity === "CRITICAL"
                  ? "border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20"
                  : alert.severity === "HIGH"
                  ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20"
                  : alert.severity === "MEDIUM"
                  ? "border-purple-200 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-950/20"
                  : "border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      alert.severity === "CRITICAL"
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                        : alert.severity === "HIGH"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                        : alert.severity === "MEDIUM"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                    }`}
                  >
                    {alert.severity} • {alert.category}
                  </span>
                  <span className="text-[10px] text-slate-400">{alert.timestamp}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  {alert.title}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1">
                  {alert.description}
                </p>
              </div>

              {alert.action_url && (
                <Link
                  to={alert.action_url}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 cursor-pointer pt-2 border-t border-slate-200/50 dark:border-zinc-800"
                >
                  <span>Resolve Alert</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
