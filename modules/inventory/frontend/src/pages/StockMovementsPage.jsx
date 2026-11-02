import React, { useState, useEffect } from "react";
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
} from "recharts";
import { fetchStockMovements } from "../services/api";
import { StockTransactionModal } from "../components/StockTransactionModal.jsx";

const movementPipelineData = [
  { value: 1650, name: "Inbound PO Receipts", fill: "#3b82f6", dropoff: "0%", rate: "100%", sla: "2.1h avg", subtitle: "Dock Unloading & Staging" },
  { value: 1540, name: "QA Gate & Inspection", fill: "#6366f1", dropoff: "-6.7%", rate: "93.3%", sla: "1.4h avg", subtitle: "Lot Sampling & Approval" },
  { value: 1480, name: "Putaway & Bin Allocation", fill: "#8b5cf6", dropoff: "-3.9%", rate: "89.7%", sla: "42m avg", subtitle: "High-Bay Racking Stored" },
  { value: 1120, name: "Facility Stock Transfers", fill: "#a855f7", dropoff: "-24.3%", rate: "67.9%", sla: "3.8h avg", subtitle: "Inter-Hub Cross-Dock" },
  { value: 980, name: "Order Dispatches & Outflow", fill: "#10b981", dropoff: "-12.5%", rate: "59.4%", sla: "1.2h avg", subtitle: "Customer Pick & Ship" },
];

export function StockMovementsPage({ initialType = "ALL" }) {
  const [movements, setMovements] = useState([]);
  const [activeTab, setActiveTab] = useState(initialType);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    setActiveTab(initialType);
  }, [initialType]);

  useEffect(() => {
    fetchStockMovements().then((data) => setMovements(data.results || []));
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredMovements = movements.filter((m) => {
    const matchesTab = activeTab === "ALL" || m.type === activeTab;
    const matchesSearch =
      m.document_number?.toLowerCase().includes(search.toLowerCase()) ||
      m.item?.toLowerCase().includes(search.toLowerCase()) ||
      m.warehouse?.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleTransactionPosted = (newTx) => {
    setMovements((prev) => [newTx, ...prev]);
    showToast(`Transaction ${newTx.document_number} posted successfully.`);
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

      {/* High-Configuration Chart: Operational Movement Pipeline & Throughput Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Warehouse Movement Pipeline & Fulfillment Funnel
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40">
                  Throughput Funnel
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                Conversion velocity from dock PO receipts through QA gating, putaway binning, transfers & dispatches.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">96.8%</span>
              <span className="text-[10px] text-slate-400 block">SLA Compliance</span>
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
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
                  isAnimationActive={true}
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

        {/* Velocity & Operational Telemetry Rail */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-3">
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
      </div>

      {/* Modern Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200/80 dark:border-zinc-800/80 text-xs">
        {[
          { key: "ALL", label: "All Movements" },
          { key: "RECEIPT", label: "Goods Receipts (In)" },
          { key: "ISSUE", label: "Stock Issues (Out)" },
          { key: "TRANSFER", label: "Warehouse Transfers" },
          { key: "ADJUSTMENT", label: "Cycle Adjustments" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3.5 py-2.5 font-medium border-b-2 transition-all cursor-pointer ${
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
            placeholder="Search by document number, product name or facility..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-slate-400 dark:text-zinc-500 font-mono tabular-nums">
          {filteredMovements.length} transactions recorded
        </span>
      </div>

      {/* Movements Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                <th className="py-3.5 px-4 font-semibold">Document No.</th>
                <th className="py-3.5 px-4 font-semibold">Type</th>
                <th className="py-3.5 px-4 font-semibold">Timestamp</th>
                <th className="py-3.5 px-4 font-semibold">Product Item</th>
                <th className="py-3.5 px-4 font-semibold">Warehouse / Bin</th>
                <th className="py-3.5 px-4 font-semibold text-right">Quantity Delta</th>
                <th className="py-3.5 px-4 font-semibold text-right">Unit Cost</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredMovements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40">
                      {m.document_number}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        m.type === "RECEIPT"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                          : m.type === "ISSUE"
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
                          : m.type === "TRANSFER"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50"
                          : "bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50"
                      }`}
                    >
                      {m.type === "RECEIPT" && <ArrowDownLeft className="h-3 w-3" />}
                      {m.type === "ISSUE" && <ArrowUpRight className="h-3 w-3" />}
                      {m.type === "TRANSFER" && <ArrowLeftRight className="h-3 w-3" />}
                      {m.type === "ADJUSTMENT" && <SlidersHorizontal className="h-3 w-3" />}
                      {m.type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                    {new Date(m.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                    {m.item}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300">
                    <div className="font-medium">{m.warehouse}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{m.location}</div>
                  </td>
                  <td className={`py-3.5 px-4 text-right font-mono tabular-nums font-bold ${m.quantity > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-zinc-200"}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity} {m.unit}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-zinc-300 font-medium">
                    ${m.unit_cost?.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-700">
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
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
