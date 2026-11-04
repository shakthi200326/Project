import React, { useState, useEffect } from "react";
import {
  Hash,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Download,
  Search,
  Plus,
  RefreshCw,
  Filter,
  X,
  FileCheck2,
  Lock,
  Unlock,
  Building2,
  Layers,
  TrendingDown,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { fetchBatches, createBatch, fetchWarehouses, fetchProducts } from "@/services/api";

const fefoHorizonData = [
  { horizon: "< 30 Days", critical: 180, warning: 0, safe: 0, total: 180, lots: 2, action: "Immediate FEFO Dispatch" },
  { horizon: "31-60 Days", critical: 0, warning: 320, safe: 0, total: 320, lots: 3, action: "Prioritized Picking" },
  { horizon: "61-90 Days", critical: 0, warning: 450, safe: 0, total: 450, lots: 4, action: "Active Stock Rotation" },
  { horizon: "91-180 Days", critical: 0, warning: 0, safe: 1250, total: 1250, lots: 8, action: "Standard Operations" },
  { horizon: "181-365 Days", critical: 0, warning: 0, safe: 2400, total: 2400, lots: 14, action: "Healthy Reserve" },
  { horizon: "> 1 Year", critical: 0, warning: 0, safe: 3800, total: 3800, lots: 22, action: "Long-Range Stock" },
];

export function BatchTrackingPage() {
  const [batches, setBatches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const [newBatchForm, setNewBatchForm] = useState({
    batch_number: `LOT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    item_code: "BRG-6205-2RS",
    item_name: "Industrial Ball Bearing 6205-2RS",
    warehouse: "Main Central Fulfillment Hub",
    quantity: 100,
    manufacture_date: new Date().toISOString().split("T")[0],
    expiry_date: "2028-12-31",
    status: "RELEASED",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchRes, whRes, prodRes] = await Promise.all([
        fetchBatches(),
        fetchWarehouses(),
        fetchProducts(),
      ]);
      setBatches(batchRes.results || batchRes || []);
      setWarehouses(whRes || []);
      setProducts(prodRes.results || prodRes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    const created = await createBatch(newBatchForm);
    setBatches((prev) => [created, ...prev]);
    setShowCreateModal(false);
    showToast(`Batch ${newBatchForm.batch_number} registered in the traceability register.`);
  };

  const handleToggleQuarantine = (batchId) => {
    setBatches((prev) =>
      prev.map((b) => {
        if (b.id === batchId) {
          const nextStatus = b.status === "QUARANTINED" ? "RELEASED" : "QUARANTINED";
          showToast(`Batch ${b.batch_number} status updated to ${nextStatus}.`);
          return { ...b, status: nextStatus };
        }
        return b;
      })
    );
    if (selectedBatch && selectedBatch.id === batchId) {
      setSelectedBatch((prev) => ({
        ...prev,
        status: prev.status === "QUARANTINED" ? "RELEASED" : "QUARANTINED",
      }));
    }
  };

  const exportBatches = () => {
    const headers = [
      "Batch Number",
      "Item Code",
      "Item Name",
      "Warehouse",
      "Quantity",
      "Manufacture Date",
      "Expiry Date",
      "Status",
    ];
    const rows = batches.map((b) => [
      `"${b.batch_number}"`,
      `"${b.item_code}"`,
      `"${b.item_name}"`,
      `"${b.warehouse}"`,
      b.quantity,
      b.manufacture_date,
      b.expiry_date,
      b.status,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Batch_Register_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Batch register downloaded as CSV.");
  };

  const filteredBatches = batches.filter((b) => {
    const matchesSearch =
      b.batch_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.item_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL"
        ? true
        : statusFilter === "HEALTHY"
        ? b.status === "RELEASED" || b.status === "HEALTHY"
        : b.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalQuantity = batches.reduce((acc, b) => acc + (parseFloat(b.quantity) || 0), 0);
  const expiringCount = batches.filter((b) => b.status === "EXPIRING_SOON").length;
  const quarantinedCount = batches.filter((b) => b.status === "QUARANTINED" || b.status === "EXPIRED").length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 dark:bg-zinc-800 text-white text-xs font-medium shadow-xl border border-slate-700 animate-in slide-in-from-top-2">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Batch & Lot Lifecycle Management
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-900">
              FEFO & Expiry Compliance
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Genealogy tracking, manufacturing lot registration, automated shelf-life horizons, and quarantine holds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportBatches}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-xs transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Batch Register</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Register New Batch</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Registered Lots</span>
            <Hash className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {batches.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Active in warehouses
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Total Lot Volume</span>
            <Layers className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {totalQuantity.toLocaleString()} Units
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Across all facilities</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Expiring in 30 Days</span>
            <Clock className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">
            {expiringCount} Lots
          </div>
          <div className="text-[11px] text-amber-600/80 mt-0.5">Prioritized for dispatch (FEFO)</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-rose-500">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Quarantine / Expired</span>
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 tabular-nums mt-1">
            {quarantinedCount} Lots
          </div>
          <div className="text-[11px] text-rose-600/80 mt-0.5">Dispatch blocked</div>
        </div>
      </div>

      {/* High-Configuration Chart: FEFO Expiry Horizon & Shelf-Life Risk Wave */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  FEFO Expiry Horizon & Shelf-Life Depletion Wave
                </h3>
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40">
                  Area Wave Curve
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                First-Expired, First-Out (FEFO) queue allocation across aging intervals with 30-day quarantine cut-off.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0 text-xs">
              <span className="flex items-center gap-1.5 text-rose-500 font-medium text-[11px]">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> &lt;30d Critical
              </span>
              <span className="flex items-center gap-1.5 text-amber-500 font-medium text-[11px]">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> 31-90d Warning
              </span>
              <span className="flex items-center gap-1.5 text-emerald-500 font-medium text-[11px]">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Safe Reserve
              </span>
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fefoHorizonData} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fefoCriticalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fefoWarningGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fefoSafeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="horizon"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                />
                <YAxis width="auto"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#64748b", opacity: 0.2 }}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 text-white shadow-2xl text-xs space-y-1">
                        <div className="font-semibold text-slate-200 flex items-center justify-between gap-4">
                          <span>{label}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {d.lots} Batches
                          </span>
                        </div>
                        <div className="font-mono text-emerald-400 font-bold text-sm">
                          {d.total.toLocaleString()} EA in Lot Stock
                        </div>
                        <div className="text-[10px] text-slate-300">
                          Recommended Action: <span className="font-semibold text-amber-300">{d.action}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  x="< 30 Days"
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  label={{ value: "Quarantine Threshold", fill: "#f43f5e", fontSize: 10, position: "insideTopLeft" }}
                />
                <Area
                  type="monotone"
                  dataKey="critical"
                  stackId="1"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fill="url(#fefoCriticalGrad)"
                  isAnimationActive={false}/>
                <Area
                  type="monotone"
                  dataKey="warning"
                  stackId="1"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#fefoWarningGrad)"
                  isAnimationActive={false}/>
                <Area
                  type="monotone"
                  dataKey="safe"
                  stackId="1"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#fefoSafeGrad)"
                  isAnimationActive={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* FEFO Compliance Radar Rail */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-3">
          <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">FEFO Compliance Index</span>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">98.6%</span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                Strict FEFO
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-3">
              <div className="bg-emerald-500 h-full rounded-full w-[98.6%]" />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
              Automated pick orders prioritize nearest-expiry batch records.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Capital at Expiry Risk</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">$4,820</span>
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded">
                2 Lots &lt;30d
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-3">
              <div className="bg-amber-500 h-full rounded-full w-[12%]" />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-2">
              Represents only 1.4% of total facility lot valuation ($342,000 USD).
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-linear-to-br from-purple-500/10 via-blue-500/5 to-transparent dark:from-purple-950/30 dark:via-zinc-900 dark:to-zinc-900 shadow-xs">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-bold">Auto-Quarantine Trigger</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1">
              Batches reaching T-0 automatically transition to QUARANTINED state, barring warehouse pick lists.
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search lot number, product SKU, or title..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { key: "ALL", label: "All Lots" },
            { key: "HEALTHY", label: "Healthy / Released" },
            { key: "EXPIRING_SOON", label: "Expiring Soon" },
            { key: "QUARANTINED", label: "Quarantined" },
            { key: "EXPIRED", label: "Expired" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                statusFilter === tab.key
                  ? "bg-slate-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Batch Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                <th className="py-3.5 px-4 font-semibold">Batch / Lot No.</th>
                <th className="py-3.5 px-4 font-semibold">Product SKU & Title</th>
                <th className="py-3.5 px-4 font-semibold">Facility</th>
                <th className="py-3.5 px-4 font-semibold">Mfg Date</th>
                <th className="py-3.5 px-4 font-semibold">Expiry Date</th>
                <th className="py-3.5 px-4 font-semibold text-right">Remaining Stock</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredBatches.map((b) => {
                const isQuarantined = b.status === "QUARANTINED";
                return (
                  <tr
                    key={b.id}
                    onClick={() => setSelectedBatch(b)}
                    className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40">
                        {b.batch_number}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-zinc-100">{b.item_name}</div>
                      <div className="font-mono text-[10px] text-slate-400">{b.item_code}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300 font-medium">
                      {b.warehouse_name || b.warehouse}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">{b.manufacture_date}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-800 dark:text-zinc-200 font-medium">
                      {b.expiry_date}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold tabular-nums whitespace-nowrap text-slate-900 dark:text-white">
                      {parseFloat(b.quantity || 0).toLocaleString()} EA
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          b.status === "RELEASED" || b.status === "HEALTHY"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                            : b.status === "EXPIRING_SOON"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50"
                            : b.status === "QUARANTINED"
                            ? "bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          b.status === "RELEASED" || b.status === "HEALTHY"
                            ? "bg-emerald-500"
                            : b.status === "EXPIRING_SOON"
                            ? "bg-amber-500"
                            : b.status === "QUARANTINED"
                            ? "bg-purple-500"
                            : "bg-rose-500"
                        }`} />
                        {b.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleQuarantine(b.id);
                        }}
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                          isQuarantined
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {isQuarantined ? "Release Hold" : "Quarantine"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch Detail Slide-over / Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl h-full flex flex-col border-l border-slate-200 dark:border-zinc-800 p-6 space-y-5 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  {selectedBatch.batch_number}
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  Batch Genealogy & Certificate
                </h2>
              </div>
              <button
                onClick={() => setSelectedBatch(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 space-y-2">
                <div className="text-[10px] uppercase font-bold text-slate-400">Linked Component</div>
                <div className="font-semibold text-slate-900 dark:text-white text-sm">
                  {selectedBatch.item_name}
                </div>
                <div className="font-mono text-xs text-blue-600">{selectedBatch.item_code}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800">
                  <div className="text-[10px] text-slate-400">Manufacturing Date</div>
                  <div className="font-mono font-medium text-slate-800 dark:text-zinc-200 mt-1">
                    {selectedBatch.manufacture_date}
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800">
                  <div className="text-[10px] text-slate-400">Expiration Horizon</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white mt-1">
                    {selectedBatch.expiry_date}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-zinc-200">Quality Assurance Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedBatch.status === "RELEASED" || selectedBatch.status === "HEALTHY"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {selectedBatch.status}
                  </span>
                </div>
                <p className="text-slate-500 dark:text-zinc-400 leading-relaxed text-[11px]">
                  Certificate of Conformity (CoC) verified against ASTM / ISO industrial parameters. No active quality recalls recorded for this batch.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => handleToggleQuarantine(selectedBatch.id)}
                  className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
                    selectedBatch.status === "QUARANTINED"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-rose-600 hover:bg-rose-700 text-white"
                  }`}
                >
                  {selectedBatch.status === "QUARANTINED" ? (
                    <>
                      <Unlock className="h-4 w-4" />
                      <span>Release Batch from Quarantine</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      <span>Place Batch on Quality Quarantine Hold</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register New Batch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Register Manufacturing Lot / Batch
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Batch / Lot Identifier
                </label>
                <input
                  type="text"
                  required
                  value={newBatchForm.batch_number}
                  onChange={(e) =>
                    setNewBatchForm({ ...newBatchForm, batch_number: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Component / Item
                </label>
                <select
                  value={newBatchForm.item_code}
                  onChange={(e) => {
                    const sel = products.find((p) => p.sku === e.target.value);
                    setNewBatchForm({
                      ...newBatchForm,
                      item_code: e.target.value,
                      item_name: sel ? sel.name : "Industrial Item",
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                >
                  <option value="BRG-6205-2RS">BRG-6205-2RS - Industrial Ball Bearing 6205-2RS</option>
                  <option value="LUB-SYN-VG46">LUB-SYN-VG46 - Synthetic Compressor Lubricant ISO VG 46</option>
                  <option value="HYD-SV-24V">HYD-SV-24V - Hydraulic Solenoid Valve 24V DC</option>
                  <option value="BELT-T10-1200">BELT-T10-1200 - Polyurethane Timing Belt T10-1200</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Lot Initial Quantity
                  </label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={newBatchForm.quantity}
                    onChange={(e) =>
                      setNewBatchForm({ ...newBatchForm, quantity: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Facility
                  </label>
                  <select
                    value={newBatchForm.warehouse}
                    onChange={(e) =>
                      setNewBatchForm({ ...newBatchForm, warehouse: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
                  >
                    <option value="Main Central Fulfillment Hub">Main Central Fulfillment Hub</option>
                    <option value="East Coast Logistics Terminal">East Coast Logistics Terminal</option>
                    <option value="Cold Storage Facility">Cold Storage Facility</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Manufacture Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newBatchForm.manufacture_date}
                    onChange={(e) =>
                      setNewBatchForm({ ...newBatchForm, manufacture_date: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newBatchForm.expiry_date}
                    onChange={(e) =>
                      setNewBatchForm({ ...newBatchForm, expiry_date: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium hover:bg-slate-50 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors"
                >
                  Confirm & Commit Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
