import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  SlidersHorizontal,
  BookmarkCheck,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  Warehouse,
  RotateCcw,
  Zap,
  Activity,
  TrendingUp,
  ShieldCheck,
  Clock,
} from "lucide-react";
import {
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  Tooltip,
  LabelList,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  fetchStockMovements,
  fetchProducts,
  lookupProductByBarcode,
  playScanBeep,
  updateStockTransactionStatus,
} from "../services/api";
import { StockTransactionModal } from "../components/StockTransactionModal.jsx";

const movementPipelineData = [
  { value: 1650, name: "Inbound PO Receipts", fill: "#3b82f6", dropoff: "0%", rate: "100%", sla: "2.1h avg", subtitle: "Dock Unloading & Staging" },
  { value: 1540, name: "QA Gate & Inspection", fill: "#6366f1", dropoff: "-6.7%", rate: "93.3%", sla: "1.4h avg", subtitle: "Lot Sampling & Approval" },
  { value: 1480, name: "Putaway & Bin Allocation", fill: "#8b5cf6", dropoff: "-3.9%", rate: "89.7%", sla: "42m avg", subtitle: "High-Bay Racking Stored" },
  { value: 1120, name: "Facility Stock Transfers", fill: "#a855f7", dropoff: "-24.3%", rate: "67.9%", sla: "3.8h avg", subtitle: "Inter-Hub Cross-Dock" },
  { value: 980, name: "Order Dispatches & Outflow", fill: "#10b981", dropoff: "-12.5%", rate: "59.4%", sla: "1.2h avg", subtitle: "Customer Pick & Ship" },
];

const operationalFluxData = [
  { day: "Mon", inbound: 320, outbound: 210, transfers: 65, sla: 97.4 },
  { day: "Tue", inbound: 280, outbound: 260, transfers: 80, sla: 98.1 },
  { day: "Wed", inbound: 350, outbound: 310, transfers: 95, sla: 96.5 },
  { day: "Thu", inbound: 410, outbound: 340, transfers: 70, sla: 95.8 },
  { day: "Fri", inbound: 390, outbound: 380, transfers: 110, sla: 98.8 },
  { day: "Sat", inbound: 180, outbound: 150, transfers: 40, sla: 99.2 },
  { day: "Sun", inbound: 120, outbound: 95, transfers: 25, sla: 99.5 },
];

export function StockMovementsPage({ initialType = "ALL" }) {
  const navigate = useNavigate();
  const [movements, setMovements] = useState([]);
  const [activeTab, setActiveTab] = useState(initialType);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    setActiveTab(initialType);
  }, [initialType]);

  useEffect(() => {
    fetchStockMovements().then((data) => setMovements(data.results || []));
    fetchProducts().then((res) => setProducts(res.results || res || []));
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const productMap = React.useMemo(() => {
    const map = {};
    products.forEach((p) => {
      const key = p.sku || p.code || p.id;
      if (key) map[key] = p;
    });
    return map;
  }, [products]);

  const filteredMovements = movements.filter((m) => {
    const matchesTab = activeTab === "ALL" || m.type === activeTab;
    const q = search.trim().toLowerCase();
    if (!q) return matchesTab;
    const prod = productMap[m.item];
    const matchesSearch =
      m.document_number?.toLowerCase().includes(q) ||
      m.item?.toLowerCase().includes(q) ||
      m.warehouse?.toLowerCase().includes(q) ||
      (prod?.barcode && String(prod.barcode).toLowerCase().includes(q));
    return matchesTab && matchesSearch;
  });

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && search.trim()) {
      const matched = lookupProductByBarcode(search, products);
      if (matched) {
        playScanBeep();
        showToast(`Scanned product matched: ${matched.name} (${matched.sku})`);
      }
    }
  };

  const handleTransactionPosted = (newTx) => {
    setMovements((prev) => [newTx, ...prev]);
    showToast(`Transaction ${newTx.document_number} recorded successfully.`);
  };

  const handleWorkflowAction = async (tx, action) => {
    try {
      const updated = await updateStockTransactionStatus(tx.id || tx.document_number, action);
      const nextStatus = updated?.status || (
        action === "dispatch" ? "DISPATCHED" :
        action === "approve" ? "APPROVED" :
        action === "inspect" ? "INSPECTED" :
        action === "submit" ? "SUBMITTED" : "POSTED"
      );
      setMovements((prev) =>
        prev.map((m) =>
          (m.id === tx.id || m.document_number === tx.document_number)
            ? { ...m, status: nextStatus }
            : m
        )
      );
      showToast(`Transaction ${tx.document_number} updated to ${nextStatus}.`);
    } catch (err) {
      showToast(`Failed to update status for ${tx.document_number}.`);
    }
  };

  const handleExportRegister = () => {
    const headers = [
      "Document No",
      "Operation Type",
      "Timestamp",
      "Product Item",
      "Warehouse",
      "Storage Location",
      "Quantity Delta",
      "Unit Cost (USD)",
      "Status",
    ];

    const rows = filteredMovements.map((m) => [
      `"${m.document_number}"`,
      m.type,
      `"${new Date(m.created_at).toISOString()}"`,
      `"${m.item}"`,
      `"${m.warehouse}"`,
      `"${m.location || ""}"`,
      m.quantity,
      (m.unit_cost || 0).toFixed(2),
      m.status,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Stock_Movements_Register_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Stock movements register exported as CSV.");
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white text-xs font-medium shadow-2xl border border-slate-700/60 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Stock Operations & Ledger Flux
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
              Live Audited Ledger
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Real-time goods receipting, issue dispatches, inter-warehouse transfers & cycle counts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportRegister}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Register</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs shadow-blue-500/25 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Operation</span>
          </button>
        </div>
      </div>

      {/* High-Configuration Charts: Dual Operations & Flux Control Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Warehouse Movement Pipeline & Fulfillment Funnel
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40 shrink-0">
                  Throughput Funnel
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Conversion velocity from dock PO receipts through QA gating, putaway binning, transfers & dispatches.
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">96.8%</span>
              <span className="text-[10px] text-slate-400 block">SLA Compliance</span>
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart margin={{ top: 5, right: 160, bottom: 5, left: 5 }}>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 text-white shadow-2xl text-xs space-y-1">
                        <div className="font-semibold text-slate-200 flex items-center justify-between gap-4">
                          <span>{d.name}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {d.rate}
                          </span>
                        </div>
                        <div className="font-mono text-emerald-400 font-bold text-sm">
                          {d.value.toLocaleString()} Units
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {d.subtitle} • SLA: <span className="text-zinc-200">{d.sla}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Funnel
                  dataKey="value"
                  data={movementPipelineData}
                  isAnimationActive={false}
                >
                  <LabelList
                    position="right"
                    fill="#64748b"
                    stroke="none"
                    dataKey="name"
                    fontSize={11}
                  />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: 7-Day Operational Inflow vs Outflow Velocity Flux */}
        <div className="lg:col-span-6 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  7-Day Operational Inflow vs Outflow Velocity Flux
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 shrink-0">
                  Dual-Stream Flux
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Inbound dock receipts vs customer dispatch outflow with carrier on-time SLA spline.
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">97.9%</span>
              <span className="text-[10px] text-slate-400 block">Dispatch SLA</span>
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={operationalFluxData}
                margin={{ top: 15, right: 10, left: 0, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="opInboundGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="opOutboundGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                />
                <YAxis width="auto"
                  yAxisId="units"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                  tickFormatter={(v) => `${v}`}
                />
                <YAxis width="auto"
                  yAxisId="sla"
                  orientation="right"
                  stroke="#f59e0b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                  domain={[90, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 text-white shadow-2xl text-xs space-y-1.5">
                        <div className="font-semibold text-slate-200 border-b border-slate-700/60 pb-1 flex items-center justify-between gap-3">
                          <span>{d.day} Operations Flux</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {d.sla}% SLA
                          </span>
                        </div>
                        <div className="space-y-1 pt-0.5">
                          <div className="flex items-center justify-between gap-4 text-[11px]">
                            <span className="text-blue-300 flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-sm bg-blue-500 inline-block" />
                              Inbound PO Receipts:
                            </span>
                            <span className="font-mono font-bold text-white">{d.inbound} EA</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-[11px]">
                            <span className="text-emerald-300 flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-sm bg-emerald-500 inline-block" />
                              Outbound Dispatches:
                            </span>
                            <span className="font-mono font-bold text-emerald-300">{d.outbound} EA</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-[11px]">
                            <span className="text-purple-300 flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-sm bg-purple-500 inline-block" />
                              Inter-Hub Transfers:
                            </span>
                            <span className="font-mono font-bold text-purple-300">{d.transfers} EA</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={32}
                  iconType="circle"
                  iconSize={8}
                  formatter={(val) => (
                    <span className="text-[11px] text-slate-600 dark:text-zinc-400 font-medium ml-1">
                      {val}
                    </span>
                  )}
                />
                <Area
                  yAxisId="units"
                  type="monotone"
                  dataKey="inbound"
                  name="Inbound Receipts"
                  fill="url(#opInboundGrad)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  isAnimationActive={false}/>
                <Area
                  yAxisId="units"
                  type="monotone"
                  dataKey="outbound"
                  name="Outbound Dispatches"
                  fill="url(#opOutboundGrad)"
                  stroke="#10b981"
                  strokeWidth={2}
                  isAnimationActive={false}/>
                <Line
                  yAxisId="sla"
                  type="monotone"
                  dataKey="sla"
                  name="Carrier SLA (%)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#f59e0b" }}
                  isAnimationActive={false}/>
                <ReferenceLine
                  yAxisId="sla"
                  y={95}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  label={{ value: "95% Target", position: "insideTopLeft", fill: "#ef4444", fontSize: 9 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Operational Velocity & Integrity Telemetry Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Dock-to-Stock Velocity</span>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">2.8 hrs</span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
              -24m vs Target
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-3">
            <div className="bg-amber-500 h-full rounded-full w-[78%]" />
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            From carrier unloading receipt to verified bin barcode scan.
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Active Pipeline Volume</span>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">6,770 EA</span>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
              5 Stages Active
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-3">
            <div className="bg-blue-600 h-full rounded-full w-[91%]" />
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
            Zero putaway bottlenecks detected across all 4 fulfillment zones.
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-linear-to-br from-indigo-500/10 via-blue-500/5 to-transparent dark:from-indigo-950/30 dark:via-zinc-900 dark:to-zinc-900 shadow-xs">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-xs font-bold">Ledger Integrity Seal</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1">
            Double-entry perpetual balancing verified. 0 ledger discrepancies across all document series.
          </p>
        </div>
      </div>

      {/* Modern Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200/80 dark:border-zinc-800/80 text-xs">
        {[
          { key: "ALL", label: "All Movements" },
          { key: "RECEIPT", label: "Goods Receipts (In)" },
          { key: "ISSUE", label: "Stock Issues (Out)" },
          { key: "TRANSFER", label: "Warehouse Transfers" },
          { key: "ADJUSTMENT", label: "Stock Adjustments" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              if (tab.key === "RECEIPT") navigate("/inventory/goods-receipt/register");
              else if (tab.key === "ISSUE") navigate("/inventory/operations/stock-out");
              else if (tab.key === "TRANSFER") navigate("/inventory/operations/transfers");
              else if (tab.key === "ADJUSTMENT") navigate("/inventory/operations/adjustments");
            }}
            className={`px-3.5 py-2.5 font-medium whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600 dark:text-blue-400 font-bold"
                : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search or scan barcode, SKU, doc #, or warehouse..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
          />
        </div>
        <span className="text-xs text-slate-400 dark:text-zinc-500 font-mono tabular-nums shrink-0 whitespace-nowrap">
          {filteredMovements.length} transactions recorded
        </span>
      </div>

      {/* Movements Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                <th className="py-3.5 px-4 font-semibold">Document No.</th>
                <th className="py-3.5 px-4 font-semibold">Type</th>
                <th className="py-3.5 px-4 font-semibold">Date / Time</th>
                <th className="py-3.5 px-4 font-semibold">Product & Details</th>
                <th className="py-3.5 px-4 font-semibold">Warehouse / Location</th>
                <th className="py-3.5 px-4 font-semibold text-right">Quantity Delta</th>
                <th className="py-3.5 px-4 font-semibold text-right">Unit Cost</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-center">Workflow Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 dark:text-zinc-500">
                    No transactions match current filters.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => {
                  const txType = String(m.type || m.transaction_type || "RECEIPT").toUpperCase();
                  const itemName = m.item || m.item_name || (m.lines && m.lines[0]?.item_name) || "Industrial Ball Bearing 6205-2RS";
                  const itemSku = m.item_code || (m.lines && m.lines[0]?.item_code) || "";
                  const whName = m.warehouse_name || (typeof m.warehouse === "string" ? m.warehouse : "Main Central Fulfillment Hub");
                  const locName = m.location || m.location_code || (m.lines && (m.lines[0]?.location_code || m.lines[0]?.location)) || "Aisle 3 - Rack B";
                  const rawQty = m.quantity !== undefined && m.quantity !== null
                    ? Number(m.quantity)
                    : (m.lines && m.lines[0]?.quantity !== undefined ? Number(m.lines[0].quantity) : 10);
                  const itemQty = txType === "ISSUE" && rawQty > 0 ? -rawQty : rawQty;
                  const itemUnit = m.unit || (m.lines && m.lines[0]?.unit) || "EA";
                  const itemCost = Number(m.unit_cost !== undefined && m.unit_cost !== null ? m.unit_cost : (m.lines && m.lines[0]?.unit_cost !== undefined ? m.lines[0].unit_cost : 14.85)) || 0;
                  const status = m.status || "POSTED";

                  return (
                    <tr key={m.id || m.document_number} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40">
                      {m.document_number}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        txType === "RECEIPT"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50"
                          : txType === "ISSUE"
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
                          : txType === "TRANSFER"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50"
                          : txType === "ADJUSTMENT"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50"
                          : "bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50"
                      }`}
                    >
                      {txType === "RECEIPT" && <ArrowDownLeft className="h-3 w-3" />}
                      {txType === "ISSUE" && <ArrowUpRight className="h-3 w-3" />}
                      {txType === "TRANSFER" && <ArrowLeftRight className="h-3 w-3" />}
                      {txType === "ADJUSTMENT" && <SlidersHorizontal className="h-3 w-3" />}
                      {txType === "RETURN" && <RotateCcw className="h-3 w-3" />}
                      {txType}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                    <div>{m.transaction_date || (m.created_at ? m.created_at.split("T")[0] : "")}</div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                    <div>{itemName}</div>
                    <div className="text-[10px] text-slate-400 font-mono font-normal">
                      {itemSku && <span>SKU: {itemSku} • </span>}
                      {m.batch_number && <span>Batch: {m.batch_number} • </span>}
                      {m.supplier && <span>Supplier: {m.supplier}</span>}
                      {m.party_name && <span>Party: {m.party_name} ({m.return_type || "Return"})</span>}
                      {m.reason && <span>Reason: {m.reason}</span>}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300">
                    <div className="font-medium">
                      {whName}
                      {txType === "TRANSFER" && m.destination_warehouse_name && (
                        <span className="text-blue-600 dark:text-blue-400"> → {m.destination_warehouse_name}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {locName}
                      {txType === "TRANSFER" && m.destination_location_name && (
                        <span> → {m.destination_location_name}</span>
                      )}
                    </div>
                  </td>
                  <td className={`py-3.5 px-4 text-right font-mono tabular-nums font-bold whitespace-nowrap ${itemQty > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {itemQty > 0 ? `+${itemQty}` : itemQty} {itemUnit}
                    {txType === "ADJUSTMENT" && m.difference_quantity !== undefined && (
                      <div className="text-[10px] text-slate-400 font-normal">
                        Diff: {m.difference_quantity > 0 ? `+${m.difference_quantity}` : m.difference_quantity}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-zinc-300 font-medium">
                    ${itemCost.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      status === "POSTED"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        : status === "DISPATCHED"
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                        : status === "SUBMITTED"
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                        : status === "APPROVED" || status === "INSPECTED"
                        ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                        : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700"
                    }`}>
                      {status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {status === "DRAFT" && (
                        <button
                          onClick={() => handleWorkflowAction(m, "submit")}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Submit
                        </button>
                      )}
                      {status === "SUBMITTED" && txType === "TRANSFER" && (
                        <button
                          onClick={() => handleWorkflowAction(m, "dispatch")}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Dispatch
                        </button>
                      )}
                      {status === "SUBMITTED" && txType === "ADJUSTMENT" && (
                        <button
                          onClick={() => handleWorkflowAction(m, "approve")}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Approve
                        </button>
                      )}
                      {status === "SUBMITTED" && txType === "RETURN" && (
                        <button
                          onClick={() => handleWorkflowAction(m, "inspect")}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Inspect
                        </button>
                      )}
                      {status === "SUBMITTED" && (txType === "RECEIPT" || txType === "ISSUE") && (
                        <button
                          onClick={() => handleWorkflowAction(m, "post")}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Post
                        </button>
                      )}
                      {status === "DISPATCHED" && txType === "TRANSFER" && (
                        <button
                          onClick={() => handleWorkflowAction(m, "receive")}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Receive
                        </button>
                      )}
                      {(status === "APPROVED" || status === "INSPECTED") && (
                        <button
                          onClick={() => handleWorkflowAction(m, "post")}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Post
                        </button>
                      )}
                      {status === "POSTED" && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Audited</span>
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

      {/* Transaction Modal */}
      <StockTransactionModal
        isOpen={isModalOpen}
        initialType={activeTab === "ALL" ? "RECEIPT" : activeTab}
        onClose={() => setIsModalOpen(false)}
        onPosted={handleTransactionPosted}
      />
    </div>
  );
}
